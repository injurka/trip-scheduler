package ru.tripscheduler.tracking

import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class GpsWriteQueueTest {
    @Test fun failedDiskWriteIsVisibleAndRetriedInOrder() {
        val persisted = mutableListOf<String>()
        var failing = true
        val queue = GpsWriteQueue { record ->
            if (failing) throw IOException("disk full")
            persisted.add(record)
        }
        queue.enqueue("point-1", 1000)
        queue.enqueue("point-2", 2000)
        assertEquals(2, queue.size)
        assertNull(queue.lastSavedAt)
        assertTrue(queue.error!!.contains("disk full"))
        failing = false
        queue.flush()
        assertEquals(listOf("point-1", "point-2"), persisted)
        assertEquals(0, queue.size)
        assertNull(queue.error)
        assertEquals(2000L, queue.lastSavedAt)
        queue.flush()
        assertEquals(2, persisted.size)
    }
}
