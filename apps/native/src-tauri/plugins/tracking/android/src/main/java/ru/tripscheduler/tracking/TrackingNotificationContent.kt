package ru.tripscheduler.tracking

import kotlin.math.ceil

/** Presentation only: does not change filtering, persistence or delivery of GPS points. */
object TrackingNotificationContent {
    private const val FRESH_FIX_MS = 30_000L

    fun status(nowElapsedMs: Long, lastFixElapsedMs: Long?, accuracyMeters: Float?, freshFixMs: Long = FRESH_FIX_MS): String {
        if (lastFixElapsedMs == null || lastFixElapsedMs > nowElapsedMs || nowElapsedMs - lastFixElapsedMs > freshFixMs) {
            return "Ищем GPS-сигнал…"
        }
        if (accuracyMeters == null || !accuracyMeters.isFinite() || accuracyMeters < 0) {
            return "GPS активен"
        }
        val accuracy = ceil(accuracyMeters.toDouble()).toInt().coerceAtLeast(1)
        return "GPS активен · ±$accuracy м"
    }
}
