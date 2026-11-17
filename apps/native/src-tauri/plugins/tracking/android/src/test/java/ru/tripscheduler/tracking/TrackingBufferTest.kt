package ru.tripscheduler.tracking

import android.content.ContextWrapper
import java.io.File
import java.nio.file.Files
import org.junit.Assert.*
import org.junit.Test

class TrackingBufferTest {
    private class FileContext(private val directory: File) : ContextWrapper(null) {
        override fun getFilesDir(): File = directory
    }

    @Test fun bufferIsOwnerScopedAndAcknowledgesIdsRatherThanTimestamps() {
        val directory = Files.createTempDirectory("tracking-buffer-test").toFile()
        val context = FileContext(directory)
        val file = File(directory, "tracking_buffered_points.jsonl")
        val legacy = """{"lat":25,"lng":121,"time":1000}"""
        val first = """{"lat":25,"lng":121,"time":1000,"ownerId":"A","sessionId":"session-1","clientPointId":"point-1"}"""
        val second = """{"lat":25,"lng":121,"time":1000,"ownerId":"A","sessionId":"session-2","clientPointId":"point-2"}"""
        val foreign = """{"lat":25,"lng":121,"time":1000,"ownerId":"B","sessionId":"session-3","clientPointId":"point-1"}"""
        try {
            file.writeText(listOf(legacy, first, first, second, foreign).joinToString("\n", postfix = "\n"))
            val points = TrackingService.drainBuffer(context, "A")
            assertFalse(TrackingService.legacyQueuePreserved)
            assertEquals(3, points.size)
            assertEquals(listOf("point-1", "point-2"), points.mapNotNull { it.extras?.getString("clientPointId")?.takeIf { id -> id.startsWith("point-") } })
            assertEquals(listOf("session-1", "session-2"), points.mapNotNull { it.extras?.getString("sessionId")?.takeIf { id -> id.startsWith("session-") } })
            TrackingService.acknowledgeBuffer(context, setOf("point-1"), "A")
            assertEquals(listOf("point-2"), TrackingService.drainBuffer(context, "A").mapNotNull { it.extras?.getString("clientPointId")?.takeIf { id -> id.startsWith("point-") } })
            assertEquals(1, TrackingService.drainBuffer(context, "B").size)
            assertEquals(2, TrackingService.drainBuffer(context, "A").size)
            assertEquals("A", File(directory, "tracking_legacy_owner").readText())
            assertTrue(file.readText().contains(foreign))
        } finally { directory.deleteRecursively() }
    }
}
