import { useEffect, useRef, useState } from 'react';
import { Play, Shuffle } from 'lucide-react';
import type { Stream } from '../types';
import { channelNumber, countryName, formatCount, primaryCategory } from '../lib/format';
import { ChannelLogo } from './ChannelLogo';

interface TunerProps {
  pool: Stream[];
  totalChannels: number;
  totalCountries: number;
  countryLabel: string | null;
  /** Last channel watched on this device; the dial starts there when it's in the pool. */
  resume: Stream | null;
  onWatch: (stream: Stream) => void;
}

const ROLL_STEPS = 12;
const ROLL_INTERVAL_MS = 55;

function pick(pool: Stream[], avoid?: Stream | null) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  while (next.id === avoid?.id) next = pool[Math.floor(Math.random() * pool.length)];
  return next;
}

/**
 * The hero: a tuner readout parked on a random channel. "Surf" rolls the dial and lands somewhere new.
 */
export function Tuner({ pool, totalChannels, totalCountries, countryLabel, resume, onWatch }: TunerProps) {
  const [current, setCurrent] = useState<Stream | null>(() =>
    resume && pool.some((s) => s.id === resume.id) ? resume : pick(pool),
  );
  const [rollingNumber, setRollingNumber] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Re-tune when the pool changes (e.g. a different country).
  useEffect(() => {
    setCurrent((previous) => (previous && pool.some((s) => s.id === previous.id) ? previous : pick(pool)));
  }, [pool]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const surf = () => {
    if (rollingNumber !== null || pool.length === 0) return;
    const target = pick(pool, current);
    if (!target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(target);
      return;
    }
    let step = 0;
    const max = pool[pool.length - 1].number;
    timer.current = window.setInterval(() => {
      step += 1;
      if (step >= ROLL_STEPS) {
        window.clearInterval(timer.current);
        setRollingNumber(null);
        setCurrent(target);
        return;
      }
      setRollingNumber(1 + Math.floor(Math.random() * max));
    }, ROLL_INTERVAL_MS);
    setRollingNumber(current?.number ?? 1);
  };

  const rolling = rollingNumber !== null;
  const shownNumber = rollingNumber ?? current?.number ?? 0;

  return (
    <section className="mx-auto grid max-w-[1500px] gap-10 px-4 pt-10 pb-12 md:px-8 md:pt-16 md:pb-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
      <div className="animate-fade-up">
        <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-wider text-dim uppercase">
          <span className="flex items-center gap-1.5 text-onair">
            <span className="size-1.5 animate-onair rounded-full bg-onair" />
            On air
          </span>
          <span>{formatCount(totalChannels)} channels</span>
          <span aria-hidden>·</span>
          <span>{countryLabel ?? `${formatCount(totalCountries)} countries`}</span>
        </p>
        <h1 className="font-display text-[clamp(3.2rem,9vw,7.25rem)] leading-[0.86] font-black tracking-[-0.01em] uppercase">
          Tune in to
          <br />
          <span className="text-amber">{countryLabel ?? 'the world'}.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-dim md:text-lg">
          Free, publicly available live channels from news desks, public broadcasters and local stations. Pick a
          category, or let the dial choose.
        </p>
      </div>

      <div
        className="relative animate-fade-up overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] md:p-7"
        style={{ animationDelay: '120ms' }}
      >
        <div aria-hidden className="scanlines pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-white/[0.025] to-transparent" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
              {!rolling && resume && current?.id === resume.id ? 'Last watched' : 'Tuned to'}
            </p>
            <p
              className={`mt-1 font-mono text-[clamp(2.8rem,7vw,4.5rem)] leading-none font-semibold tabular-nums transition-colors ${
                rolling ? 'text-amber/60' : 'text-amber'
              } [text-shadow:0_0_24px_rgb(255_181_71/0.35)]`}
              aria-live="polite"
              aria-atomic
            >
              <span className="sr-only">Channel </span>
              {channelNumber(shownNumber)}
            </p>
          </div>
          <ChannelLogo
            src={rolling ? '' : current?.logo ?? ''}
            name={rolling ? '··' : current?.title ?? ''}
            className="size-20 shrink-0 rounded-xl border border-line bg-raised p-3 text-sm md:size-24"
          />
        </div>

        <div className="relative mt-6 min-h-[4.5rem] border-t border-line pt-5">
          {current ? (
            <div className={rolling ? 'opacity-30 blur-[2px] transition' : 'transition'}>
              <p className="line-clamp-1 font-display text-3xl leading-tight font-extrabold tracking-tight uppercase md:text-4xl">
                {current.title}
              </p>
              <p className="mt-1 text-sm text-dim">
                {primaryCategory(current.channel_categories)} · {countryName(current.channel_country)}
                {current.quality && <span className="ml-2 font-mono text-[11px] text-paper/70">{current.quality}</span>}
              </p>
            </div>
          ) : (
            <p className="text-sm text-dim">No channels to tune to. Try another country.</p>
          )}
        </div>

        <div className="relative mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => current && onWatch(current)}
            disabled={!current || rolling}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-amber px-6 font-semibold text-ink transition hover:bg-[#ffc56e] active:scale-[0.98] disabled:opacity-50"
          >
            <Play className="size-4 fill-current" />
            Watch
          </button>
          <button
            type="button"
            onClick={surf}
            disabled={pool.length < 2 || rolling}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-line px-6 font-semibold text-paper transition hover:border-amber hover:text-amber active:scale-[0.98] disabled:opacity-50"
          >
            <Shuffle className="size-4" />
            Surf
          </button>
        </div>
      </div>
    </section>
  );
}
