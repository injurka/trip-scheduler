package ru.tripscheduler.tracking

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI

/** Bounded, owner-checked and idempotent. A lost HTTP response never acknowledges local data. */
internal class GpsSyncEngine(
    private val read: (String) -> List<JSONObject>,
    private val acknowledge: (String, Set<String>) -> Unit,
    private val currentOwner: () -> String?,
    private val send: (JSONObject, JSONObject) -> JSONObject = ::post
) {
    companion object {
        @Volatile var connection: HttpURLConnection? = null
        fun post(config: JSONObject, body: JSONObject): JSONObject {
            val base = URI(config.getString("serverUrl"))
            require(base.scheme == "https" || (base.scheme == "http" && base.host in listOf("localhost", "127.0.0.1", "10.0.2.2")))
            val http = URI(base.toString().trimEnd('/') + "/trpc/tracking.syncNative").toURL().openConnection() as HttpURLConnection
            connection = http
            try {
                http.requestMethod = "POST"; http.instanceFollowRedirects = false
                http.connectTimeout = 15000; http.readTimeout = 60000
                http.setRequestProperty("Content-Type", "application/json"); http.doOutput = true
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                http.setFixedLengthStreamingMode(bytes.size)
                http.outputStream.use { it.write(bytes) }
                if (http.responseCode == 401) throw SecurityException("Войдите в приложение для восстановления фоновой отправки GPS")
                if (http.responseCode !in 200..299) throw java.io.IOException("Сервер GPS недоступен (HTTP ${http.responseCode})")
                return JSONObject(http.inputStream.bufferedReader().use { it.readText() }).getJSONObject("result").getJSONObject("data")
            } finally { http.disconnect(); connection = null }
        }
    }
    fun run(config: JSONObject): Int {
        val owner = config.getString("ownerId")
        var count = 0
        repeat(20) {
            if (Thread.currentThread().isInterrupted || currentOwner() != owner) return count
            val points = read(owner)
            if (points.isEmpty()) return count
            val normalized = points.map { p ->
                require(p.getString("ownerId") == owner) { "GPS owner mismatch" }
                JSONObject().put("clientPointId", p.getString("clientPointId")).put("sessionId", p.getString("sessionId"))
                    .put("samplingIntervalMs", p.optLong("samplingIntervalMs", 3000L))
                    .put("tsUtc", p.getLong("time")).put("lat", p.getDouble("lat")).put("lng", p.getDouble("lng"))
                    .put("accuracy", p.opt("acc") ?: JSONObject.NULL).put("altitude", p.opt("alt") ?: JSONObject.NULL)
                    .put("speed", p.opt("spd") ?: JSONObject.NULL).put("bearing", p.opt("brg") ?: JSONObject.NULL)
                    .put("activity", "unknown").put("activityConfidence", 0)
                    .put("deviceActivity", p.opt("act") ?: JSONObject.NULL).put("deviceActivityConfidence", p.opt("actc") ?: JSONObject.NULL)
            }
            val result = send(config, JSONObject().put("syncToken", config.getString("syncToken")).put("ownerId", owner).put("points", JSONArray(normalized)))
            if (currentOwner() != owner || Thread.currentThread().isInterrupted) return count
            val accepted = result.getJSONArray("accepted")
            val ids = (0 until accepted.length()).map { accepted.getString(it) }.toSet().intersect(points.map { it.getString("clientPointId") }.toSet())
            acknowledge(owner, ids)
            count += ids.size
            check(ids.size == points.size) { "Сервер подтвердил часть точек GPS; остальные сохранены" }
            if (points.size < 500) return count
        }
        return count
    }
}
