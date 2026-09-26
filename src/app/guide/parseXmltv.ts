export interface Programme {
  /** Epoch milliseconds. */
  start: number;
  stop: number;
  title: string;
  subtitle?: string;
  description?: string;
}

const MAX_DESCRIPTION = 280;
const TIME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?$/;
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** "YYYYMMDDhhmmss ±hhmm" → epoch ms. No offset is read as UTC. NaN when malformed. */
export function parseXmltvTime(value: string): number {
  const match = TIME.exec(value.trim());
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second, sign, offsetHours, offsetMinutes] = match;
  const utc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  if (!sign) return utc;
  const offset = (Number(offsetHours) * 60 + Number(offsetMinutes)) * 60_000;
  return sign === '+' ? utc - offset : utc + offset;
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1]] = decodeEntities(match[2] ?? match[3]);
  }
  return attributes;
}

function childText(body: string, name: string): string | undefined {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(body);
  if (!match) return undefined;
  const text = decodeEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
  return text || undefined;
}

/**
 * Scans XMLTV text (a string scanner: workers have no DOMParser) and returns programmes per channel id
 * that overlap [windowStart, windowEnd], sorted by start.
 */
export function parseXmltv(xml: string, windowStart: number, windowEnd: number): Map<string, Programme[]> {
  const byChannel = new Map<string, Programme[]>();

  for (const match of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const attributes = readAttributes(match[1]);
    const channel = attributes.channel;
    const start = parseXmltvTime(attributes.start ?? '');
    if (!channel || Number.isNaN(start)) continue;
    const stop = attributes.stop ? parseXmltvTime(attributes.stop) : Number.NaN;
    // Cheap early exit for the bulk of a large file. Programmes without a stop are kept until their
    // neighbours are known.
    if (!Number.isNaN(stop) && (stop <= windowStart || start >= windowEnd)) continue;

    const title = childText(match[2], 'title');
    if (!title) continue;
    const programme: Programme = { start, stop, title };
    const subtitle = childText(match[2], 'sub-title');
    if (subtitle) programme.subtitle = subtitle;
    const description = childText(match[2], 'desc');
    if (description) {
      programme.description =
        description.length > MAX_DESCRIPTION ? `${description.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : description;
    }

    const list = byChannel.get(channel);
    if (list) list.push(programme);
    else byChannel.set(channel, [programme]);
  }

  const result = new Map<string, Programme[]>();
  for (const [channel, list] of byChannel) {
    list.sort((a, b) => a.start - b.start);
    const kept: Programme[] = [];
    list.forEach((programme, index) => {
      if (Number.isNaN(programme.stop)) {
        const next = list[index + 1];
        if (!next) return;
        programme.stop = next.start;
      }
      if (programme.stop > programme.start && programme.stop > windowStart && programme.start < windowEnd) {
        kept.push(programme);
      }
    });
    if (kept.length) result.set(channel, kept);
  }
  return result;
}
