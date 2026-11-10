import type { TrackActivityType } from './index'

/** Live transitions require sustained evidence; a traffic slowdown is not a new journey. */
export class ActivityState {
  private current: TrackActivityType = 'unknown'
  private pending: TrackActivityType = 'unknown'
  private pendingSince = 0
  private lastTime = 0

  reset() {
    this.current = 'unknown'
    this.pending = 'unknown'
    this.pendingSince = 0
    this.lastTime = 0
  }

  update(candidate: TrackActivityType, time: number, motorEvidence = false, deviceConfirmed = false): TrackActivityType {
    if (time - this.lastTime > 900_000 || time < this.lastTime)
      this.reset()
    this.lastTime = time
    if (candidate === this.current) {
      this.pending = candidate
      this.pendingSince = time
      return this.current
    }
    if (candidate !== this.pending) {
      this.pending = candidate
      this.pendingSince = time
    }
    const motor = this.current === 'vehicle' || this.current === 'rail'
    if (motor && !deviceConfirmed && candidate !== 'still' && candidate !== 'unknown' && !motorEvidence)
      return this.current
    const delay = motorEvidence ? 15_000 : motor && !deviceConfirmed ? 120_000 : 45_000
    if (this.current === 'unknown' && !motorEvidence) {
      this.current = candidate
      return this.current
    }
    if (time - this.pendingSince >= delay)
      this.current = candidate
    return this.current
  }
}
