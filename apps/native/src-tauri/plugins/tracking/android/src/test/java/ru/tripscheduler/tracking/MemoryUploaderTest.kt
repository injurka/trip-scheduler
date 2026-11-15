package ru.tripscheduler.tracking

import android.content.ContextWrapper
import com.sun.net.httpserver.HttpServer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files
import java.net.InetSocketAddress

class MemoryUploaderTest {
    @Test fun uploadsWholeFileAndFinalizesWithoutWebViewAndRetriesOnlyMemoryCreation() {
        val directory = Files.createTempDirectory("native-upload").toFile()
        val context = object : ContextWrapper(null) { override fun getCacheDir() = directory }
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        val chunks = mutableListOf<Byte>()
        var initiations = 0
        var creates = 0
        var rejectCreation = true
        var input: JSONObject? = null
        server.createContext("/") { exchange ->
            val bytes = exchange.requestBody.readBytes()
            var code = 200
            val response = when (exchange.requestURI.path) {
                "/api/upload/multipart/initiate" -> { initiations++; """{"uploadId":"upload","key":"image","chunkSize":4}""" }
                "/api/upload/multipart/chunk" -> { chunks.addAll(bytes.toList()); """{"PartNumber":1,"ETag":"etag"}""" }
                "/api/upload/multipart/complete" -> """{"id":"image","takenAt":"2026-11-15T01:30:00.000Z","metadata":{"timezoneOffset":480}}"""
                "/trpc/memory.create" -> {
                    creates++
                    input = JSONObject(String(bytes))
                    if (rejectCreation) { code = 503; "{}" } else """{"result":{"data":{"id":"memory"}}}"""
                }
                else -> "{}"
            }
            val body = response.toByteArray()
            exchange.sendResponseHeaders(code, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()
        try {
            val id = "405a53ea-0ccb-4a64-aaaf-a19103b276af"
            val content = "native original bytes".toByteArray()
            MemoryUploadFiles.path(context, id).writeBytes(content)
            val config = JSONObject().put("serverUrl", "http://127.0.0.1:${server.address.port}")
                .put("tripId", "trip").put("accessToken", "test-token").put("dates", JSONArray().put("2026-11-15"))
            val item = JSONObject().put("id", id).put("name", "photo.jpg").put("type", "image/jpeg")
            val uploader = MemoryUploader(context, config)
            val progress = mutableListOf<Int>()
            try { uploader.upload(item, { false }, { progress.add(it) }); fail("Creation should fail") } catch (_: java.io.IOException) { }
            assertArrayEquals(content, chunks.toByteArray())
            assertTrue(item.has("image"))
            rejectCreation = false
            assertEquals("memory", uploader.upload(item, { false }, {}).getString("id"))
            assertEquals(1, initiations)
            assertEquals(2, creates)
            assertEquals("2026-11-15T09:30:00Z", input!!.getString("timestamp"))
            assertEquals(100, progress.last())
        } finally { server.stop(0); directory.deleteRecursively() }
    }
}
