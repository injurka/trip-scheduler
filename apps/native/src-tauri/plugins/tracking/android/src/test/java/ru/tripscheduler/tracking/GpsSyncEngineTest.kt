package ru.tripscheduler.tracking

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class GpsSyncEngineTest {
    private fun point(owner: String = "A", id: String = "point-number-1") = JSONObject().put("ownerId", owner).put("sessionId", "session-1").put("clientPointId", id).put("lat", 25).put("lng", 121).put("time", 1000)
    private fun config() = JSONObject().put("ownerId", "A").put("syncToken", "isolated-device-key")
    @Test fun confirmsOnlyServerAcknowledgedIdsAndPreservesIdentity() {
        var confirmed = emptySet<String>()
        val engine = GpsSyncEngine({ listOf(point()) }, { owner, ids -> assertEquals("A", owner); confirmed = ids }, { "A" }, { _, body ->
            assertEquals("point-number-1", body.getJSONArray("points").getJSONObject(0).getString("clientPointId"))
            JSONObject().put("accepted", JSONArray(listOf("point-number-1", "foreign-id")))
        })
        assertEquals(1, engine.run(config()))
        assertEquals(setOf("point-number-1"), confirmed)
    }
    @Test fun lostResponseAndAccountChangeNeverAcknowledgeTheJournal() {
        var acknowledgements = 0
        val lost = GpsSyncEngine({ listOf(point()) }, { _, _ -> acknowledgements++ }, { "A" }, { _, _ -> throw java.io.IOException("response lost") })
        try { lost.run(config()); fail("Should report network failure") } catch (_: java.io.IOException) {}
        assertEquals(0, acknowledgements)
        var owner: String? = "A"
        val switched = GpsSyncEngine({ listOf(point()) }, { _, _ -> acknowledgements++ }, { owner }, { _, _ -> owner = "B"; JSONObject().put("accepted", JSONArray(listOf("point-number-1"))) })
        assertEquals(0, switched.run(config()))
        assertEquals(0, acknowledgements)
    }
    @Test fun rejectsForeignPointsBeforeAnyNetworkRequest() {
        var sent = false
        val engine = GpsSyncEngine({ listOf(point("B")) }, { _, _ -> fail("Must not ack") }, { "A" }, { _, _ -> sent = true; JSONObject() })
        try { engine.run(config()); fail("Should reject owner mismatch") } catch (_: IllegalArgumentException) {}
        assertFalse(sent)
    }
    @Test fun partialAcceptanceRetainsTheRestForRetry() {
        var confirmed = emptySet<String>()
        val engine = GpsSyncEngine({ listOf(point(), point(id = "point-number-2")) }, { _, ids -> confirmed = ids }, { "A" }, { _, _ -> JSONObject().put("accepted", JSONArray(listOf("point-number-1"))) })
        try { engine.run(config()); fail("Should report partial response") } catch (_: IllegalStateException) {}
        assertEquals(setOf("point-number-1"), confirmed)
    }
    @Test fun economyNeverSlowsWalkingTrainOrUnknownAndWaitsForSustainedRest() {
        for (activity in listOf("walk", "vehicle", "rail", "unknown", "bike")) assertEquals(3000L, GpsSamplingPolicy.interval(true, activity, 90, 600000))
        assertEquals(3000L, GpsSamplingPolicy.interval(true, "still", 90, 119999))
        assertEquals(3000L, GpsSamplingPolicy.interval(true, "still", 40, 600000))
        assertEquals(3000L, GpsSamplingPolicy.interval(false, "still", 90, 600000))
        assertEquals(30000L, GpsSamplingPolicy.interval(true, "still", 90, 120000))
    }
}
