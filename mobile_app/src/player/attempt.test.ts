import { describe, expect, it, jest } from '@jest/globals';
import { AttemptTracker, MAX_RECONNECTS, attemptId } from './attempt';

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

describe('AttemptTracker reconnects', () => {
  const handlers = () => ({ reload: jest.fn(), onAdvance: jest.fn() });
  /** A new attempt whose load resolved; `plays` marks that playback started. */
  const load = (tracker: AttemptTracker, attempt: string, plays = false) => {
    tracker.start(attempt);
    tracker.markReady(attempt);
    if (plays) tracker.markPlaying(attempt);
  };

  it('advances immediately, without reloading, when the source never played', () => {
    const tracker = new AttemptTracker();
    const h = handlers();
    load(tracker, 's#0#0');

    tracker.statusError('s#0#0', h);

    expect(h.reload).not.toHaveBeenCalled();
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
  });

  it('reloads a stream that was playing up to MAX_RECONNECTS times in a row, then advances once', () => {
    const tracker = new AttemptTracker();
    const h = handlers();
    load(tracker, 's#0#0', true);

    tracker.statusError('s#0#0', h); // reload 1
    load(tracker, 's#0#1'); // reloaded attempt fails before playing again
    tracker.statusError('s#0#1', h); // reload 2
    load(tracker, 's#0#2');
    tracker.statusError('s#0#2', h); // budget spent -> advance
    tracker.statusError('s#0#2', h); // duplicate report does not advance twice

    expect(MAX_RECONNECTS).toBe(2);
    expect(h.reload).toHaveBeenCalledTimes(2);
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
  });

  it('refills the budget when playback resumes', () => {
    const tracker = new AttemptTracker();
    const h = handlers();
    load(tracker, 's#0#0', true);
    tracker.statusError('s#0#0', h); // reload 1
    load(tracker, 's#0#1', true); // resumed -> refilled
    tracker.statusError('s#0#1', h); // reload 1 again
    load(tracker, 's#0#2', true);
    tracker.statusError('s#0#2', h); // reload 1 again
    load(tracker, 's#0#3');
    tracker.statusError('s#0#3', h); // reload 2

    expect(h.reload).toHaveBeenCalledTimes(4);
    expect(h.onAdvance).not.toHaveBeenCalled();
  });

  it('starts over for a new source or stream', () => {
    const tracker = new AttemptTracker();
    const h = handlers();
    load(tracker, 's#0#0', true);
    tracker.statusError('s#0#0', h); // reload 1
    load(tracker, 's#0#1');
    tracker.statusError('s#0#1', h); // reload 2
    load(tracker, 's#0#2');
    tracker.statusError('s#0#2', h); // advance to backup
    expect(h.onAdvance).toHaveBeenCalledTimes(1);

    load(tracker, 's#1#0'); // backup never played: no reload, advance at once
    tracker.statusError('s#1#0', h);
    expect(h.reload).toHaveBeenCalledTimes(2);
    expect(h.onAdvance).toHaveBeenCalledTimes(2);

    load(tracker, 't#0#0', true); // another channel gets a full budget
    tracker.statusError('t#0#0', h);
    load(tracker, 't#0#1');
    tracker.statusError('t#0#1', h);
    expect(h.reload).toHaveBeenCalledTimes(4);
  });

  it('forgets spent reconnects on resetReconnects (Try again)', () => {
    const tracker = new AttemptTracker();
    const h = handlers();
    load(tracker, 's#0#0', true);
    tracker.statusError('s#0#0', h);
    load(tracker, 's#0#1');
    tracker.statusError('s#0#1', h); // budget spent

    tracker.resetReconnects();
    load(tracker, 's#0#2');
    tracker.statusError('s#0#2', h);

    expect(h.reload).toHaveBeenCalledTimes(3);
    expect(h.onAdvance).not.toHaveBeenCalled();
  });

  it('ignores playback and errors for a superseded attempt, and playback before the load resolved', () => {
    const tracker = new AttemptTracker();
    const h = handlers();
    load(tracker, 's#0#0', true);
    load(tracker, 't#0#0');
    tracker.markPlaying('s#0#0'); // late event from the old channel

    tracker.statusError('s#0#0', h); // superseded
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.onAdvance).not.toHaveBeenCalled();

    tracker.start('u#0#0'); // load not resolved yet
    tracker.markPlaying('u#0#0');
    tracker.markReady('u#0#0');
    tracker.statusError('u#0#0', h); // never really played
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
  });
});
