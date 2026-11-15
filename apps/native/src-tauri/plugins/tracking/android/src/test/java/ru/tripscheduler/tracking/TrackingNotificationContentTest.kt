package ru.tripscheduler.tracking

import org.junit.Assert.assertEquals
import org.junit.Test

class TrackingNotificationContentTest {
    @Test fun waitsForFirstFixAndDoesNotPretendStaleCoordinatesAreLive() {
        assertEquals("Ищем GPS-сигнал…", TrackingNotificationContent.status(100_000L, null, null))
        assertEquals("GPS активен · ±12 м", TrackingNotificationContent.status(100_000L, 99_000L, 11.3f))
        assertEquals("Ищем GPS-сигнал…", TrackingNotificationContent.status(131_001L, 100_000L, 11.3f))
        assertEquals("Ищем GPS-сигнал…", TrackingNotificationContent.status(100L, 200L, 3f))
    }
    @Test fun showsAccuracyWithoutUnderstatingItAndHandlesUnknownValues() {
        assertEquals("GPS активен", TrackingNotificationContent.status(100L, 100L, null))
        assertEquals("GPS активен", TrackingNotificationContent.status(100L, 100L, Float.NaN))
        assertEquals("GPS активен", TrackingNotificationContent.status(100L, 100L, -1f))
        assertEquals("GPS активен · ±1 м", TrackingNotificationContent.status(100L, 100L, 0f))
        assertEquals("GPS активен · ±1 м", TrackingNotificationContent.status(100L, 100L, 0.2f))
    }
}
