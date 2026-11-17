package ru.tripscheduler.tracking

/** Opt-in economy slows only confirmed sustained rest; movement/uncertainty keeps full sampling. */
internal object GpsSamplingPolicy {
    fun interval(economy: Boolean, activity: String, confidence: Int, restDurationMs: Long): Long =
        if (economy && activity == "still" && confidence >= 60 && restDurationMs >= 120_000) 30_000 else 3_000
}
