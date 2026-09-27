import type { WeatherAlert } from '@/types/weather';
import { digestSubtitle } from './weatherCodes';

/** Towns shown before the "+N more" expander in the alert modal. */
export const INITIAL_TOWNS = 7;

export function isPagasaAlert(alert: WeatherAlert): boolean {
  if (alert.alertType === 'daily_digest') return false;
  const source = alert.data?.source ?? '';
  if (/pagasa/i.test(source)) return true;
  return alert.alertType === 'thunderstorm' || alert.alertType === 'heavy_rain';
}

/** "Thunderstorm Advisory No. 2 — DOST-PAGASA (Iligan & LDN)" → "Thunderstorm Advisory No. 2". */
export function shortTitle(alert: WeatherAlert): string {
  const raw = (alert.data?.title ?? '').trim();
  if (!raw) return '';
  const stripped = raw
    .replace(/\s*[—–-]\s*DOST-PAGASA.*$/i, '')
    .replace(/\s*\(Iligan & LDN\)\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[—–-]\s*$/, '')
    .trim();
  return stripped || raw;
}

export function normalizeTownName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function townKey(name: string): string {
  return name.toLowerCase();
}

/** Split raw `#LanaoDelNorte(A, B)` tokens into readable town names, Iligan first. */
export function parseLocalTowns(alertOrAreas: WeatherAlert | string[]): string[] {
  const areas = Array.isArray(alertOrAreas)
    ? alertOrAreas
    : (alertOrAreas.data?.affectedAreas ?? []);
  const seen = new Set<string>();
  const towns: string[] = [];
  for (const token of areas) {
    const m = /^([^()]+)(?:\(([^)]*)\))?$/.exec(token.trim());
    if (!m) continue;
    const inner = m[2];
    if (!inner) continue; // bare province token carries no town detail
    for (const part of inner.split(',')) {
      const name = normalizeTownName(part.trim());
      if (!name || seen.has(townKey(name))) continue;
      seen.add(townKey(name));
      towns.push(name);
    }
  }
  towns.sort((a, b) => {
    const aIligan = /iligan/i.test(a) ? 0 : 1;
    const bIligan = /iligan/i.test(b) ? 0 : 1;
    if (aIligan !== bIligan) return aIligan - bIligan;
    return a.localeCompare(b);
  });
  return towns;
}

function fullText(alert: WeatherAlert): string {
  return `${alert.data?.description ?? ''}\n${alert.data?.rawText ?? ''}`;
}

function stripHashtags(text: string): string {
  return text
    .replace(/#[A-Za-z0-9_]+(?:\([^)]*\))?/g, ' ')
    .replace(/[ \t]{2,}/g, ' ');
}

function cap(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

/** Bulletin boilerplate that never belongs in the condensed summary. */
const HEADER_SENTENCE =
  /(advisory|warning|watch)\b.{0,40}(no\s+\d+|issued|#)|issued\s+at|all are advised|precautionary measures/i;

/** Remove the area-list holes left behind after hashtag stripping. */
function cleanRemnants(sentence: string): string {
  let t = sentence;
  // "expected over , , , within" → "expected within"
  // "expected over, and within" → "expected within"
  t = t.replace(/\bover\b[\s,]*(?:and\b[\s,]*)?(?=within\b)/gi, '');
  t = t.replace(/\bin\b[\s,]*(?=which\b)/gi, '');
  t = t.replace(/,(?:\s*,)+/g, ',');
  t = t.replace(/\s+,/g, ',');
  t = t.replace(/,\s*(?=[.!]|$)/g, '');
  t = t.replace(/\(\s*,?\s*\)/g, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t.replace(/\s+([.,])/g, '$1');
}

/** First verbatim hazard sentence with hashtags removed (never paraphrased). */
export function hazardSummary(alert: WeatherAlert): string {
  const raw = fullText(alert);
  if (!raw.trim()) return '';
  let cleaned = stripHashtags(raw)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\bNo\.\s*/g, 'No ')
    .trim();
  // Strip the leading bulletin header ("… Advisory No 2 Issued at 02:00 PM 27
  // September 2026 ") which shares a sentence with the hazard line.
  cleaned = cleaned
    .replace(/^.*?\bissued\s+at\s+\d{1,2}:\d{2}\s*(?:[AP]\.?M\.?)?\s*,?\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*/i, '')
    .replace(/^(thunderstorm|heavy\s+rainfall|rainfall)\s+(advisory|warning|watch)(?:\s+no\s+\d+)?\s*/i, '')
    .trim();
  if (!cleaned) return '';
  const sentences = cleaned.split(/(?<=[.!])\s+/).map((s) => s.trim()).filter(Boolean);
  const body = sentences.filter((s) => !HEADER_SENTENCE.test(s));
  const pool = body.length > 0 ? body : sentences;
  // Hazard keywords first so a header sentence mentioning "thunderstorm" never
  // wins over the actual rain / lightning / winds sentence.
  const hit =
    pool.find((s) => /(rain|shower|lightning|strong winds|flood)/i.test(s)) ??
    pool.find((s) => /thunderstorm/i.test(s)) ??
    pool[0];
  if (!hit) return '';
  let summary = cleanRemnants(cap(hit, 240));
  if (/being experienced/i.test(raw)) {
    const timing = timingShort(alert).replace(/^next\s+/, '');
    summary += timing
      ? ` Already occurring in some areas. May persist ${timing}.`
      : ' Already occurring in some areas.';
  }
  return summary;
}

/** "within the next 1-2 hours" → "next 1–2 hrs", else "". */
export function timingShort(alertOrText: WeatherAlert | string): string {
  const text = typeof alertOrText === 'string'
    ? alertOrText
    : fullText(alertOrText);
  const m = /within (?:the )?next\s+(\d+)(?:\s*[–-]\s*(\d+))?\s*hours?/i.exec(text)
    ?? /next\s+(\d+)(?:\s*[–-]\s*(\d+))?\s*hours?/i.exec(text);
  if (!m) return '';
  return m[2] ? `next ${m[1]}–${m[2]} hrs` : `next ${m[1]} hr${m[1] === '1' ? '' : 's'}`;
}

/** Plain-sentence hazard from the bulletin's own words, e.g. "Moderate to heavy rainshowers with lightning and strong winds". */
function hazardPlain(alert: WeatherAlert): string {
  const text = `${alert.data?.title ?? ''} ${alert.data?.description ?? ''} ${alert.data?.rawText ?? ''}`;
  const intensity = /torrential/i.test(text)
    ? 'Torrential'
    : /occasionally heavy|moderate to.{0,24}heavy|moderate-heavy/i.test(text)
      ? 'Moderate to heavy'
      : /light to moderate|light-moderate/i.test(text)
        ? 'Light to moderate'
        : /\bheavy\b/i.test(text)
          ? 'Heavy'
          : '';
  const noun = alert.alertType === 'heavy_rain' ? 'rain' : 'rainshowers';
  const extras: string[] = [];
  if (/lightning|thunderstorm/i.test(text)) extras.push('lightning');
  if (/strong winds/i.test(text)) extras.push('strong winds');
  if (alert.alertType === 'heavy_rain' && /flood/i.test(text)) extras.push('flooding');
  const head = intensity ? `${intensity} ${noun}` : noun[0].toUpperCase() + noun.slice(1);
  return extras.length > 0 ? `${head} with ${extras.join(' and ')}` : head;
}

function expiryShort(alert: WeatherAlert): string {
  const d = new Date(alert.validTo);
  if (Number.isNaN(d.getTime())) return '';
  return `until ${d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Notification subtitle: hazard sentence plus concrete expiry. Places live in the modal. */
export function pagasaSubtitle(alert: WeatherAlert): string {
  if (alert.alertType === 'daily_digest') return digestSubtitle(alert);
  const expiry = expiryShort(alert);
  return cap(expiry ? `${hazardPlain(alert)} · ${expiry}` : hazardPlain(alert), 160);
}

/** Distinct `#Province` hashtags outside our area (excludes #MINPRSD, LDN, Iligan). */
export function otherProvinceCount(alert: WeatherAlert): number {
  const text = fullText(alert);
  const seen = new Set<string>();
  for (const m of text.matchAll(/#([A-Za-z0-9_]+)/g)) {
    const base = m[1].toLowerCase();
    if (base === 'minprsd') continue;
    if (base.includes('iligan')) continue;
    if (base.includes('lanao') && !base.includes('sur')) continue;
    seen.add(base);
  }
  return seen.size;
}
