import { useEffect, useRef, useState } from 'react';
import type { Stream } from '../types';

const COMMIT_DELAY_MS = 1600;
const NOT_FOUND_MS = 1400;

interface ChannelEntryProps {
  streams: Stream[];
  onTune: (stream: Stream) => void;
}

/**
 * Remote-control style tuning: type a channel number anywhere (outside text fields) and it tunes
 * after a short pause, or straight away on Enter. Esc cancels.
 */
export function ChannelEntry({ streams, onTune }: ChannelEntryProps) {
  const [digits, setDigits] = useState('');
  const [missing, setMissing] = useState<string | null>(null);
  const commitTimer = useRef<number | undefined>(undefined);
  const missingTimer = useRef<number | undefined>(undefined);
  const maxDigits = String(streams.length).length;

  // Keystrokes can arrive faster than re-renders, so pending digits live in a ref; state only drives the overlay.
  const pending = useRef('');
  const latest = useRef({ streams, onTune });
  latest.current = { streams, onTune };

  const setEntry = (value: string) => {
    pending.current = value;
    setDigits(value);
  };

  useEffect(() => {
    const commit = (value: string) => {
      window.clearTimeout(commitTimer.current);
      setEntry('');
      if (!value) return;
      const number = Number(value);
      // Channel numbers are catalog positions, so lookup is by index.
      const stream = latest.current.streams[number - 1];
      if (stream) {
        latest.current.onTune(stream);
      } else {
        setMissing(value);
        window.clearTimeout(missingTimer.current);
        missingTimer.current = window.setTimeout(() => setMissing(null), NOT_FOUND_MS);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      const typed = pending.current;

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        const next = (typed + event.key).replace(/^0+(?=\d)/, '').slice(0, maxDigits);
        setEntry(next);
        setMissing(null);
        window.clearTimeout(commitTimer.current);
        if (next.length >= maxDigits) commit(next);
        else commitTimer.current = window.setTimeout(() => commit(next), COMMIT_DELAY_MS);
        return;
      }
      if (!typed) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        commit(typed);
      } else if (event.key === 'Escape') {
        // Capture phase: cancel the entry without also closing the player.
        event.stopImmediatePropagation();
        window.clearTimeout(commitTimer.current);
        setEntry('');
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        const next = typed.slice(0, -1);
        setEntry(next);
        window.clearTimeout(commitTimer.current);
        if (next) commitTimer.current = window.setTimeout(() => commit(next), COMMIT_DELAY_MS);
      }
    };

    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      window.clearTimeout(commitTimer.current);
      window.clearTimeout(missingTimer.current);
    };
  }, [maxDigits]);

  if (!digits && !missing) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="scanlines fixed top-20 right-4 z-[60] min-w-40 rounded-xl border border-line bg-panel/95 px-5 py-3 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur md:top-24 md:right-8"
    >
      {missing ? (
        <>
          <p className="font-mono text-[10px] tracking-[0.2em] text-onair uppercase">No channel</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-dim tabular-nums">{missing.padStart(4, '0')}</p>
        </>
      ) : (
        <>
          <p className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">Go to channel</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-amber tabular-nums [text-shadow:0_0_18px_rgb(255_181_71/0.35)]">
            {digits.padStart(Math.max(4, maxDigits), '_').replace(/_/g, '–')}
          </p>
          <p className="mt-1 font-mono text-[10px] text-dim">Enter to tune · Esc to cancel</p>
        </>
      )}
    </div>
  );
}
