/**
 * Tracks in-flight playback attempts so a failure only advances the backup-source
 * chain once, and only for the load it actually belongs to.
 *
 * Each call to `replaceAsync` for a (channel, source index, retry) triple is one
 * "attempt". Both the rejection of that call and a later `statusChange` error event
 * can report the same failure, and a `statusChange` error can also arrive late, after
 * the user has already moved to a different channel or backup source. Routing every
 * failure signal through `AttemptTracker#fail` collapses duplicates and drops stale
 * ones, so `onAdvance` runs at most once per attempt and never for an attempt that is
 * no longer current.
 */
export function attemptId(streamId: string, sourceIndex: number, retryKey: number): string {
  return `${streamId}#${sourceIndex}#${retryKey}`;
}

export class AttemptTracker {
  private current: string | null = null;
  private ready: string | null = null;
  private advanced: string | null = null;

  /** Call when a new `replaceAsync` starts. */
  start(attempt: string): void {
    this.current = attempt;
  }

  /** Call when that attempt's `replaceAsync` has resolved. */
  markReady(attempt: string): void {
    this.ready = attempt;
  }

  /**
   * Reports a failure for `attempt`. Runs `onAdvance` only if this attempt is still
   * the in-flight one and hasn't already advanced (so two failure signals for the
   * same attempt only advance once, and a failure for a superseded attempt is dropped).
   */
  fail(attempt: string, onAdvance: () => void): void {
    if (attempt !== this.current) return;
    if (this.advanced === attempt) return;
    this.advanced = attempt;
    onAdvance();
  }

  /**
   * Errors that arrive before the current attempt's `replaceAsync` resolves belong to
   * the previous source (its own rejection handler will report it); only once the
   * current attempt is ready does a status error describe it.
   */
  isCurrentAttemptReady(): boolean {
    return this.current !== null && this.ready === this.current;
  }

  /** The attempt currently in flight, if any. */
  currentAttempt(): string | null {
    return this.current;
  }
}
