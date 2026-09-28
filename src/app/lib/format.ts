// Framework-free: shared by the web app and mobile_app. No React, DOM or browser-only APIs.
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** "PH" → "Philippines". Falls back to the code for unknown or special regions. */
export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown';
  if (code === 'UK') return 'United Kingdom';
  if (code === 'INT') return 'International';
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** 427 → "0427"; wider catalogs keep all their digits. */
export function channelNumber(n: number, width = 4): string {
  return String(n).padStart(width, '0');
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en').format(n);
}

/** First category name only, so cards stay on one line. */
export function primaryCategory(categories: string | null): string {
  return categories?.split(',')[0]?.trim() || 'General';
}

const TAKES_THE = new Set(['AE', 'BS', 'CF', 'DO', 'GB', 'GM', 'KM', 'KY', 'MH', 'MV', 'NL', 'PH', 'SB', 'UK', 'US']);

/** Country name as it reads mid-sentence: "the Philippines", "Japan". */
export function countryInSentence(code: string): string {
  return TAKES_THE.has(code) ? `the ${countryName(code)}` : countryName(code);
}
