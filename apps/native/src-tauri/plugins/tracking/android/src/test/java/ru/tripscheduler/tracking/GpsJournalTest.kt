package ru.tripscheduler.tracking

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files
import java.io.File

class GpsJournalTest {
    private fun point(id: Int, owner: String = "A") = JSONObject().put("ownerId", owner).put("sessionId", "session-1").put("clientPointId", "point-number-$id").put("lat", 25).put("lng", 121).put("time", id.toLong() + 1000)
    @Test fun acknowledgementsSurviveRestartAndNeverAffectAnotherOwner() {
        val directory = Files.createTempDirectory("gps-index-test").toFile()
        try {
            val queue = GpsJournal(directory)
            queue.append(point(1).toString(), "A")
            queue.append(point(1, "B").toString(), "B")
            queue.append(point(1).toString(), "A")
            assertEquals(1, queue.read("A").size)
            queue.acknowledge("A", setOf("point-number-1", "not-delivered"))
            val recovered = GpsJournal(directory)
            assertTrue(recovered.read("A").isEmpty())
            assertEquals(1, recovered.read("B").size)
        } finally { directory.deleteRecursively() }
    }
    @Test fun compactionKeepsMalformedOriginalsAndPendingRecords() {
        val directory = Files.createTempDirectory("gps-compaction-test").toFile()
        try {
            val broken = "{broken original record"
            File(directory, "tracking_buffered_points.jsonl").writeText((listOf(broken) + (0..10000).map { point(it).toString() }).joinToString("\n", postfix = "\n"))
            val queue = GpsJournal(directory)
            assertEquals(10001, queue.count("A"))
            queue.acknowledge("A", (0 until 10000).map { "point-number-$it" }.toSet())
            assertEquals(1, queue.count("A"))
            assertEquals(1, queue.damagedRecords)
            assertTrue(File(directory, "tracking_buffered_points.jsonl").readLines().contains(broken))
            assertEquals("point-number-10000", GpsJournal(directory).read("A").single().getString("clientPointId"))
        } finally { directory.deleteRecursively() }
    }
    @Test fun indexesLargeBacklogsOnceAndDoesNotRewriteJournalForEachBatch() {
        for (size in listOf(10000, 50000, 100000)) {
            val directory = Files.createTempDirectory("gps-size-test").toFile()
            try {
                val file = File(directory, "tracking_buffered_points.jsonl")
                file.bufferedWriter().use { writer -> repeat(size) { writer.appendLine(point(it).toString()) } }
                val started = System.nanoTime()
                val queue = GpsJournal(directory)
                assertEquals(size, queue.count("A"))
                val indexed = System.nanoTime()
                val bytes = file.length()
                repeat(5) {
                    val batch = queue.read("A")
                    assertEquals(500, batch.size)
                    queue.acknowledge("A", batch.map { it.getString("clientPointId") }.toSet())
                }
                assertEquals(bytes, file.length())
                val finished = System.nanoTime()
                assertEquals(size - 2500, GpsJournal(directory).count("A"))
                println("GPS journal $size: index ${(indexed - started) / 1000000} ms, five batches ${(finished - indexed) / 1000000} ms")
            } finally { directory.deleteRecursively() }
        }
    }
}
