import { describe, expect, it } from '@jest/globals';
import { MIN_INTERVAL_MS, MIN_OPENS_BEFORE_FIRST, shouldShowInterstitial } from './policy';

describe('shouldShowInterstitial', () => {
  it('waits for the third channel open', () => {
    expect(MIN_OPENS_BEFORE_FIRST).toBe(3);
    expect(shouldShowInterstitial({ opens: 1, lastShownAt: null }, 0)).toBe(false);
    expect(shouldShowInterstitial({ opens: 2, lastShownAt: null }, 0)).toBe(false);
    expect(shouldShowInterstitial({ opens: 3, lastShownAt: null }, 0)).toBe(true);
  });

  it('shows at most once every five minutes', () => {
    expect(MIN_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(shouldShowInterstitial({ opens: 4, lastShownAt: 1000 }, 1000 + MIN_INTERVAL_MS - 1)).toBe(false);
    expect(shouldShowInterstitial({ opens: 4, lastShownAt: 1000 }, 1000 + MIN_INTERVAL_MS)).toBe(true);
  });
});
