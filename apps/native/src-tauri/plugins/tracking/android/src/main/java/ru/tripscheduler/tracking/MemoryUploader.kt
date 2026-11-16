package ru.tripscheduler.tracking

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.CancellationException

object MemoryUploadFiles {
    fun path(context: Context, id: String): File {
        require(id.matches(Regex("[a-fA-F0-9-]{36}"))) { "Invalid upload ID" }
        val dir = File(context.cacheDir, "memory-uploads").apply { mkdirs() }
        return File(dir, id)
    }
    fun append(context: Context, args: JSONObject) {
        val bytes = Base64.decode(args.getString("data"), Base64.DEFAULT)
        require(bytes.size <= 512 * 1024)
        val file = path(context, args.getString("id"))
        java.io.FileOutputStream(file, args.getBoolean("append")).use { it.write(bytes) }
    }
}

/** All network steps, including memory creation, execute without the WebView. */
class MemoryUploader(
    private val context: Context,
    private val config: JSONObject,
    private val saveImage: (JSONObject, JSONObject) -> Unit = { item, image -> item.put("image", image); Unit }
) {
    @Volatile var connection: HttpURLConnection? = null
    private val base = config.getString("serverUrl").trimEnd('/')
    init {
        val uri = URI(base)
        require(uri.scheme == "https" || (uri.scheme == "http" && uri.host in listOf("localhost", "127.0.0.1", "10.0.2.2")))
    }
    fun json(path: String, body: JSONObject): JSONObject = request(path, "POST", body.toString().toByteArray(), "application/json")
    private fun request(path: String, method: String, bytes: ByteArray, type: String, refresh: Boolean = true, onBytes: ((Int) -> Unit)? = null): JSONObject {
        val http = URI(base + path).toURL().openConnection() as HttpURLConnection
        connection = http
        try {
            http.requestMethod = method
            http.instanceFollowRedirects = false
            http.connectTimeout = 30_000
            http.readTimeout = 120_000
            http.setRequestProperty("Authorization", "Bearer ${config.getString("accessToken")}")
            http.setRequestProperty("Content-Type", type)
            http.doOutput = true
            http.setFixedLengthStreamingMode(bytes.size)
            http.outputStream.use { output ->
                var offset = 0
                while (offset < bytes.size) {
                    val count = minOf(64 * 1024, bytes.size - offset)
                    output.write(bytes, offset, count)
                    offset += count
                    onBytes?.invoke(offset)
                }
            }
            if (http.responseCode == 401 && refresh && config.optString("refreshToken").isNotEmpty()) {
                http.disconnect()
                val response = request("/trpc/user.refresh", "POST", JSONObject().put("refreshToken", config.getString("refreshToken")).toString().toByteArray(), "application/json", false)
                val tokens = response.getJSONObject("result").getJSONObject("data").getJSONObject("token")
                synchronized(config) { config.put("accessToken", tokens.getString("accessToken")).put("refreshToken", tokens.getString("refreshToken")).put("refreshed", true) }
                return request(path, method, bytes, type, false, onBytes)
            }
            if (http.responseCode !in 200..299) throw java.io.IOException("HTTP ${http.responseCode}")
            return JSONObject(http.inputStream.bufferedReader().use { it.readText() })
        } finally { http.disconnect(); connection = null }
    }
    fun upload(item: JSONObject, cancelled: () -> Boolean, progress: (Int) -> Unit): JSONObject {
        val file = MemoryUploadFiles.path(context, item.getString("id"))
        val tripId = config.getString("tripId")
        var image = item.optJSONObject("image")
        if (image == null) {
            val info = JSONObject().put("entityType", "trip").put("entityId", tripId).put("placement", "memories")
                .put("fileName", item.getString("name")).put("fileSize", file.length()).put("fileType", item.getString("type"))
            val init = json("/api/upload/multipart/initiate", info)
            val uploadId = init.getString("uploadId")
            val key = init.getString("key")
            val parts = JSONArray()
            val chunkSize = init.getInt("chunkSize")
            require(chunkSize in 1..32 * 1024 * 1024)
            try {
                var sent = 0L
                file.inputStream().use { input ->
                    var number = 1
                    val buffer = ByteArray(chunkSize)
                    while (sent < file.length()) {
                        if (cancelled()) throw CancellationException()
                        var count = 0
                        while (count < buffer.size) {
                            val read = input.read(buffer, count, buffer.size - count)
                            if (read < 0) break
                            count += read
                        }
                        if (count == 0) throw java.io.IOException("Incomplete staged file")
                        val path = "/api/upload/multipart/chunk?uploadId=${URLEncoder.encode(uploadId, "UTF-8")}&key=${URLEncoder.encode(key, "UTF-8")}&partNumber=$number"
                        parts.put(request(path, "PUT", buffer.copyOf(count), "application/octet-stream", onBytes = { uploaded ->
                            if (cancelled()) throw CancellationException()
                            progress((((sent + uploaded) * 99) / file.length()).toInt())
                        }))
                        sent += count
                        progress(((sent * 99) / file.length()).toInt())
                        number++
                    }
                }
                if (cancelled()) throw CancellationException()
                info.put("uploadId", uploadId).put("key", key).put("parts", parts)
                image = json("/api/upload/multipart/complete", info)
                saveImage(item, image) // Retry memory creation without re-uploading the original.
            } catch (error: Exception) {
                runCatching { json("/api/upload/multipart/abort", JSONObject().put("uploadId", uploadId).put("key", key)) }
                throw error
            }
        }
        progress(100)
        if (cancelled()) throw CancellationException()
        var timestamp: String? = null
        runCatching {
            val takenAt = image!!.optString("takenAt")
            if (takenAt.isNotBlank() && takenAt != "null") {
                val offset = image!!.optJSONObject("metadata")?.optLong("timezoneOffset", 0) ?: 0
                val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssX", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC"); isLenient = false }
                val parsed = format.parse(takenAt.replace(Regex("\\.\\d+Z$"), "Z")) ?: throw IllegalArgumentException("Invalid date")
                val local = format.format(java.util.Date(parsed.time + offset * 60_000))
                val dates = config.getJSONArray("dates")
                if ((0 until dates.length()).any { dates.getString(it) == local.take(10) }) timestamp = local
            }
        }
        val result = json("/trpc/memory.create", JSONObject().put("tripId", tripId).put("imageId", image!!.getString("id")).put("timestamp", timestamp ?: JSONObject.NULL))
        return result.getJSONObject("result").getJSONObject("data")
    }
}
