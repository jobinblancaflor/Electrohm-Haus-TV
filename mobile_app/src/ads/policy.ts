export const MIN_OPENS_BEFORE_FIRST = 3;
export const MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface InterstitialState {
  /** Channel opens from Home/Browse this session, including the one being decided. */
  opens: number;
  lastShownAt: number | null;
}

export function shouldShowInterstitial(state: InterstitialState, now: number): boolean {
  if (state.opens < MIN_OPENS_BEFORE_FIRST) return false;
  return state.lastShownAt === null || now - state.lastShownAt >= MIN_INTERVAL_MS;
}
