import { describe, expect, it } from '@jest/globals';
import { channelNumber } from '@shared/lib/format';
import { logosFirst } from '@shared/lib/selectors';

describe('@shared alias', () => {
  it('resolves the web app catalog helpers', () => {
    expect(channelNumber(7)).toBe('0007');
    expect(logosFirst([])).toEqual([]);
  });
});
