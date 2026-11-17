package ru.tripscheduler.tracking

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.charset.StandardCharsets
import java.util.UUID

/** Append-only data and acknowledgements. Each process indexes once; batches never rewrite the tail. */
internal class GpsJournal(private val directory: File) {
    private data class Entry(val offset: Long, val owner: String, val id: String, val timestamp: Long)
    private val file = File(directory, "tracking_buffered_points.jsonl")
    private val acknowledgements = File(directory, "tracking_acknowledged.jsonl")
    private val legacyOwner = File(directory, "tracking_legacy_owner")
    private val pending = HashMap<String, LinkedHashMap<String, Entry>>()
    private val acknowledged = HashSet<String>()
    private var loaded = false
    private var scanned = 0L
    private var acknowledgedSinceCompaction = 0
    @Volatile var damagedRecords = 0
        private set
    @Volatile var legacyPreserved = false
        private set

    private fun key(owner: String, id: String) = "$owner:$id"
    private fun line(reader: RandomAccessFile): String? = reader.readLine()?.let {
        String(it.toByteArray(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8)
    }
    private fun decode(raw: String, owner: String): JSONObject? {
        val json = try { JSONObject(raw) } catch (_: Exception) { return null }
        val lat = json.optDouble("lat", Double.NaN)
        val lng = json.optDouble("lng", Double.NaN)
        val timestamp = json.optLong("time", 0)
        if (!lat.isFinite() || lat !in -90.0..90.0 || !lng.isFinite() || lng !in -180.0..180.0 || timestamp <= 0 || timestamp > 8_640_000_000_000_000L) return null
        if (json.optString("ownerId").isEmpty()) {
            if (!legacyOwner.exists()) {
                val temporary = File(directory, "tracking_legacy_owner.tmp")
                durableWrite(temporary, owner)
                check(temporary.renameTo(legacyOwner)) { "Cannot bind legacy GPS owner" }
            }
            val bound = legacyOwner.readText()
            if (bound != owner) legacyPreserved = true
            json.put("ownerId", bound)
            if (json.optString("sessionId").isEmpty()) json.put("sessionId", UUID.nameUUIDFromBytes("legacy:$bound:${timestamp / 86400000}".toByteArray()).toString())
            if (json.optString("clientPointId").isEmpty()) json.put("clientPointId", UUID.nameUUIDFromBytes("legacy:$bound:$raw".toByteArray()).toString())
        }
        if (json.optString("sessionId").isBlank() || json.optString("clientPointId").isBlank()) return null
        return try {
            if (listOf("acc", "alt", "spd", "brg").any { json.has(it) && !json.getDouble(it).isFinite() }) return null
            if (json.has("act")) json.getString("act")
            if (json.has("actc")) json.getInt("actc")
            json
        } catch (_: Exception) { null }
    }
    private fun durableWrite(target: File, value: String, append: Boolean = false) {
        FileOutputStream(target, append).use { stream -> stream.write(value.toByteArray(StandardCharsets.UTF_8)); stream.fd.sync() }
    }
    private fun load(owner: String) {
        if (!loaded) {
            if (acknowledgements.exists()) acknowledgements.useLines { lines -> lines.forEach { raw ->
                runCatching { val json = JSONObject(raw); acknowledged.add(key(json.getString("owner"), json.getString("id"))) }
            } }
            loaded = true
        }
        if (!file.exists()) return
        // External truncation is treated as a new journal, including an explicit recovery.
        if (file.length() < scanned) { pending.clear(); scanned = 0; damagedRecords = 0 }
        RandomAccessFile(file, "r").use { reader ->
            reader.seek(scanned)
            while (true) {
                val offset = reader.filePointer
                val raw = line(reader) ?: break
                if (raw.isNotBlank()) {
                    val json = decode(raw, owner)
                    if (json == null) damagedRecords++
                    else {
                        val account = json.getString("ownerId")
                        val id = json.getString("clientPointId")
                        if (!acknowledged.contains(key(account, id)))
                            pending.getOrPut(account) { LinkedHashMap() }.putIfAbsent(id, Entry(offset, account, id, json.getLong("time")))
                    }
                }
            }
            scanned = reader.filePointer
        }
    }
    @Synchronized fun append(record: String, owner: String) {
        load(owner)
        durableWrite(file, "\n$record\n", true)
        load(owner)
    }
    @Synchronized fun count(owner: String): Int { load(owner); return pending[owner]?.size ?: 0 }
    @Synchronized fun read(owner: String, limit: Int = 500, from: Long = 0, until: Long = Long.MAX_VALUE): List<JSONObject> {
        load(owner)
        val entries = pending[owner]?.values?.asSequence()?.filter { it.timestamp >= from && it.timestamp < until }?.take(limit)?.toList() ?: return emptyList()
        if (entries.isEmpty()) return emptyList()
        return RandomAccessFile(file, "r").use { reader -> entries.mapNotNull { entry -> reader.seek(entry.offset); line(reader)?.let { decode(it, owner) } } }.sortedBy { it.getLong("time") }
    }
    @Synchronized fun acknowledge(owner: String, ids: Set<String>) {
        load(owner)
        val confirmed = ids.filter { pending[owner]?.containsKey(it) == true }
        if (confirmed.isEmpty()) return
        durableWrite(acknowledgements, confirmed.joinToString("\n", prefix = "\n", postfix = "\n") { JSONObject().put("owner", owner).put("id", it).toString() }, true)
        for (id in confirmed) { pending[owner]?.remove(id); acknowledged.add(key(owner, id)) }
        acknowledgedSinceCompaction += confirmed.size
        if (acknowledgedSinceCompaction >= 10_000 && acknowledgedSinceCompaction > pending.values.sumOf { it.size }) compact(owner)
    }
    private fun compact(owner: String) {
        val temporary = File(directory, "tracking_compact.tmp")
        FileOutputStream(temporary).use { stream ->
            RandomAccessFile(file, "r").use { reader ->
                while (true) {
                    val start = reader.filePointer
                    val raw = line(reader) ?: break
                    val end = reader.filePointer
                    val json = decode(raw, owner)
                    if (raw.isNotBlank() && (json == null || !acknowledged.contains(key(json.getString("ownerId"), json.getString("clientPointId"))))) {
                        reader.seek(start)
                        val original = ByteArray((end - start).toInt())
                        reader.readFully(original)
                        stream.write(original)
                    }
                }
            }
            stream.fd.sync()
        }
        check(temporary.renameTo(file)) { "Cannot compact GPS journal" }
        // A crash before clearing the ack log is safe: acknowledged records are already absent.
        try { durableWrite(acknowledgements, ""); acknowledged.clear() }
        finally {
            pending.clear(); scanned = 0; damagedRecords = 0
            acknowledgedSinceCompaction = 0
            load(owner)
        }
    }
}
