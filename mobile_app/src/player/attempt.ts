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

/** The (stream, source) an attempt belongs to, ignoring the retry key, so reconnects share one budget. */
export function attemptSource(attempt: string): string {
  return attempt.slice(0, attempt.lastIndexOf('#'));
}

/** Consecutive reloads of a stream that was playing before the source is treated as dead. */
export const MAX_RECONNECTS = 2;

export class AttemptTracker {
  private current: string | null = null;
  private ready: string | null = null;
  private advanced: string | null = null;
  private played = false;
  private reconnects = 0;

  /**
   * Call when a new `replaceAsync` starts. A different stream or source starts over (not played, full budget);
   * a reload of the same source keeps `played`, so a dropped stream gets its consecutive reconnects.
   */
  start(attempt: string): void {
    if (this.current === null || attemptSource(this.current) !== attemptSource(attempt)) {
      this.reconnects = 0;
      this.played = false;
    }
    this.current = attempt;
  }

  /** Playback actually started (or resumed) for `attempt`: it may now reconnect, and the budget refills. */
  markPlaying(attempt: string): void {
    // Ignore playback events from a superseded source or from before this attempt's load resolved.
    if (attempt !== this.current || this.ready !== attempt) return;
    this.played = true;
    this.reconnects = 0;
  }

  /** Forget spent reconnects (user pressed Try again). */
  resetReconnects(): void {
    this.reconnects = 0;
  }

  /**
   * A status error for `attempt`. If it had played and the budget allows, calls `reload` (the caller starts a
   * new attempt for the same source); otherwise reports the failure through `fail`, so this stays the single
   * path that advances the backup chain.
   */
  statusError(attempt: string, handlers: { reload: () => void; onAdvance: () => void }): void {
    if (attempt !== this.current) return;
    if (this.played && this.reconnects < MAX_RECONNECTS) {
      this.reconnects += 1;
      handlers.reload();
      return;
    }
    this.fail(attempt, handlers.onAdvance);
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
