import { describe, expect, it, jest } from '@jest/globals';
import { AttemptTracker, attemptId } from './attempt';

describe('attemptId', () => {
  it('combines stream, source index, and retry key', () => {
    expect(attemptId('bbc@SD', 1, 0)).toBe('bbc@SD#1#0');
  });
});

describe('AttemptTracker', () => {
  it('advances once even when both the rejection and a status error report the same attempt', () => {
    const tracker = new AttemptTracker();
    const onAdvance = jest.fn();
    tracker.start('a#0#0');

    tracker.fail('a#0#0', onAdvance);
    tracker.fail('a#0#0', onAdvance);

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('ignores a failure for an attempt that is no longer current', () => {
    const tracker = new AttemptTracker();
    const onAdvance = jest.fn();
    tracker.start('a#0#0');
    tracker.start('a#1#0'); // a new attempt supersedes the old one

    tracker.fail('a#0#0', onAdvance);

    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('only treats the current attempt as ready once it has resolved', () => {
    const tracker = new AttemptTracker();
    tracker.start('a#0#0');
    expect(tracker.isCurrentAttemptReady()).toBe(false);

    tracker.markReady('a#0#0');
    expect(tracker.isCurrentAttemptReady()).toBe(true);
  });

  it('treats a late-resolving stale attempt as not ready once a new attempt has started', () => {
    const tracker = new AttemptTracker();
    tracker.start('a#0#0');
    tracker.start('a#1#0');
    tracker.markReady('a#0#0'); // the old attempt resolves after being superseded

    expect(tracker.isCurrentAttemptReady()).toBe(false);
  });
});
