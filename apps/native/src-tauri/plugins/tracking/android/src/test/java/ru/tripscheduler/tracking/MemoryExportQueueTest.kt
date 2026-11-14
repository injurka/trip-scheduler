package ru.tripscheduler.tracking

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.IOException
import java.util.concurrent.CancellationException

class MemoryExportQueueTest {
    @Test fun savesWholeDayAndContinuesAfterFailedAndExistingFiles() {
        val attempted = mutableListOf<Int>()
        val bytes = mutableListOf<Long?>()
        var failed = 0
        MemoryExportQueue.run(listOf(1, 2, 3, 4), { false }, save = {
            attempted.add(it)
            when (it) { 2 -> 0L; 3 -> throw IOException("disk full"); else -> 100L }
        }, onResult = { saved, error -> bytes.add(saved); if (error != null) failed++ })
        assertEquals(listOf(1, 2, 3, 4), attempted)
        assertEquals(listOf(100L, 0L, null, 100L), bytes)
        assertEquals(1, failed)
    }

    @Test fun cancellationStopsBeforeTheNextFile() {
        var cancelled = false
        val attempted = mutableListOf<Int>()
        MemoryExportQueue.run(listOf(1, 2, 3), { cancelled }, save = {
            attempted.add(it)
            100L
        }, onResult = { _, _ -> cancelled = true })
        assertEquals(listOf(1), attempted)
    }

    @Test fun cancellationOfInFlightFileDoesNotCountItAsCompleted() {
        var completed = 0
        MemoryExportQueue.run(listOf(1, 2), { false }, save = { throw CancellationException() },
            onResult = { _, _ -> completed++ })
        assertEquals(0, completed)
    }

    @Test fun disconnectedRequestDuringCancellationDoesNotStartTheNextFile() {
        var cancelled = false
        var attempted = 0
        var completed = 0
        MemoryExportQueue.run(listOf(1, 2), { cancelled }, save = {
            attempted++
            cancelled = true
            throw IOException("connection closed")
        }, onResult = { _, _ -> completed++ })
        assertEquals(1, attempted)
        assertEquals(0, completed)
    }
}
