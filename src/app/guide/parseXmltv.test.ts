import { describe, expect, it } from 'vitest';
import { decodeEntities, parseXmltv, parseXmltvTime } from './parseXmltv';

const at = (iso: string) => Date.parse(iso);

describe('parseXmltvTime', () => {
  it('parses UTC', () => {
    expect(parseXmltvTime('20260927120000 +0000')).toBe(at('2026-09-27T12:00:00Z'));
  });
  it('applies positive and negative offsets', () => {
    expect(parseXmltvTime('20260927120000 +0930')).toBe(at('2026-09-27T02:30:00Z'));
    expect(parseXmltvTime('20260927120000 -0500')).toBe(at('2026-09-27T17:00:00Z'));
  });
  it('treats a missing offset as UTC', () => {
    expect(parseXmltvTime('20260927120000')).toBe(at('2026-09-27T12:00:00Z'));
  });
  it('returns NaN for malformed input', () => {
    expect(parseXmltvTime('2026-09-27')).toBeNaN();
    expect(parseXmltvTime('')).toBeNaN();
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &lt;3 &quot;hi&quot; &apos;x&#39; &#x2764;')).toBe(`Tom & Jerry <3 "hi" 'x' ❤`);
  });
  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&nbsp;&bogus;')).toBe('&nbsp;&bogus;');
  });
});

const programme = (channel: string, start: string, stop: string | null, inner: string) =>
  `<programme channel="${channel}" start="${start} +0000"${stop ? ` stop="${stop} +0000"` : ''}>${inner}</programme>`;

describe('parseXmltv', () => {
  const windowStart = at('2026-09-27T11:00:00Z');
  const windowEnd = at('2026-09-28T00:00:00Z');

  it('groups programmes by channel and reads title, sub-title and desc', () => {
    const xml = `<tv>
      <channel id="a"><display-name>A</display-name></channel>
      ${programme('a', '20260927120000', '20260927130000', '<title lang="en">News &amp; Views</title><sub-title>Evening</sub-title><desc>Headlines.</desc>')}
      ${programme('b', '20260927120000', '20260927123000', '<title>Cartoons</title>')}
    </tv>`;
    const result = parseXmltv(xml, windowStart, windowEnd);
    expect(result.get('a')).toEqual([
      {
        start: at('2026-09-27T12:00:00Z'),
        stop: at('2026-09-27T13:00:00Z'),
        title: 'News & Views',
        subtitle: 'Evening',
        description: 'Headlines.',
      },
    ]);
    expect(result.get('b')).toEqual([
      { start: at('2026-09-27T12:00:00Z'), stop: at('2026-09-27T12:30:00Z'), title: 'Cartoons' },
    ]);
  });

  it('reads attributes in any order and single quotes', () => {
    const xml = `<programme stop='20260927130000 +0000' channel='a' start='20260927120000 +0000'><title>X</title></programme>`;
    expect(parseXmltv(xml, windowStart, windowEnd).get('a')?.[0].title).toBe('X');
  });

  it('keeps only programmes overlapping the window, sorted by start', () => {
    const xml = [
      programme('a', '20260927140000', '20260927150000', '<title>Later</title>'),
      programme('a', '20260927080000', '20260927090000', '<title>Too early</title>'),
      programme('a', '20260927103000', '20260927113000', '<title>Straddles start</title>'),
      programme('a', '20260928010000', '20260928020000', '<title>Too late</title>'),
    ].join('');
    const titles = parseXmltv(xml, windowStart, windowEnd).get('a')?.map((p) => p.title);
    expect(titles).toEqual(['Straddles start', 'Later']);
  });

  it('infers a missing stop from the next programme and drops the last one without a stop', () => {
    const xml = [
      programme('a', '20260927120000', null, '<title>First</title>'),
      programme('a', '20260927123000', null, '<title>Second</title>'),
    ].join('');
    expect(parseXmltv(xml, windowStart, windowEnd).get('a')).toEqual([
      { start: at('2026-09-27T12:00:00Z'), stop: at('2026-09-27T12:30:00Z'), title: 'First' },
    ]);
  });

  it('skips programmes with malformed times or no title', () => {
    const xml = [
      programme('a', 'garbage', '20260927130000', '<title>Bad</title>'),
      programme('a', '20260927120000', '20260927130000', '<desc>No title</desc>'),
    ].join('');
    expect(parseXmltv(xml, windowStart, windowEnd).has('a')).toBe(false);
  });

  it('unwraps CDATA and trims long descriptions to 280 characters', () => {
    const long = 'x'.repeat(400);
    const xml = programme('a', '20260927120000', '20260927130000', `<title><![CDATA[Q&A]]></title><desc>${long}</desc>`);
    const [p] = parseXmltv(xml, windowStart, windowEnd).get('a')!;
    expect(p.title).toBe('Q&A');
    expect(p.description).toHaveLength(280);
    expect(p.description?.endsWith('…')).toBe(true);
  });
});
