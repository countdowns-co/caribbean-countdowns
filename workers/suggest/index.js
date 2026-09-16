/* suggest Worker — caribbean.countdowns.co/api/suggest
 * Receives event suggestions from the wizard, stores them in R2 for review.
 * R2 binding: CARIBBEAN_DATA (bucket caribbean-data) · ratelimit: RATE_LIMITER (3/min per IP)
 *
 * POST /api/suggest → 201 { ok: true }
 * Stored key: suggestions/YYYY-MM-DD-xxxxxxxx.json → { receivedAt, suggestion }
 * Privacy: no IP, no user-agent, no email — only the allowlisted event fields.
 * Review runbook: caribbean-countdowns-api/suggestions.txt
 */

const ORIGIN   = 'https://caribbean.countdowns.co';
const MAX_BODY = 10 * 1024;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
const EDITION_RE = /^\d{1,3}$/;
const YEAR_RE  = /^\d{4}$/;
const TYPES    = ['music festival', 'carnival', 'sailing race', 'art', 'sport', 'other'];
const ECO_IDS  = ['transport', 'no_plastic', 'reusable', 'water', 'ngo'];
const ATTENDANCE_OPTIONS = ['under_200', '200_1000', '1000_plus'];
const ORGANIZER_OPTIONS  = ['association', 'company', 'municipality', 'media', 'individual'];

const CORS = {
  'Access-Control-Allow-Origin':  ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function str(v) { return typeof v === 'string' ? v.trim() : ''; }

function isHttpUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

/* Allowlist + validate. Returns { suggestion } or { error, field? }.
 * Unknown keys are dropped here — they never reach R2. */
function buildSuggestion(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'Invalid payload' };
  }
  const s = {
    name:        str(raw.name),
    website:     str(raw.website),
    description: str(raw.description),
    startDate:   str(raw.startDate),
    endDate:     str(raw.endDate),
    city:        str(raw.city),
    country:     str(raw.country),
    timezone:    str(raw.timezone),
    type:        str(raw.type),
    details:     Array.isArray(raw.details) ? raw.details : [],
    image:       str(raw.image),
    tickets:     Array.isArray(raw.tickets) ? raw.tickets : [],
    eco:         Array.isArray(raw.eco) ? raw.eco : [],
    notes:       str(raw.notes),
    edition:     str(raw.edition),
    firstYear:   str(raw.firstYear),
    attendance:  str(raw.attendance),
    organizer:   str(raw.organizer),
    priceRange:  str(raw.priceRange),
  };

  if (!s.name)                    return { error: 'Missing required field', field: 'name' };
  if (!s.startDate || !s.endDate) return { error: 'Missing required field', field: 'dates' };
  if (!s.country)                 return { error: 'Missing required field', field: 'country' };
  if (!s.type)                    return { error: 'Missing required field', field: 'type' };

  const caps = { name: 120, description: 2000, notes: 2000, city: 120, country: 60, timezone: 60, priceRange: 60 };
  for (const [field, max] of Object.entries(caps)) {
    if (s[field].length > max) return { error: 'Too long', field };
  }
  if (!DATE_RE.test(s.startDate)) return { error: 'Invalid date', field: 'startDate' };
  if (!DATE_RE.test(s.endDate))   return { error: 'Invalid date', field: 'endDate' };
  if (!TYPES.includes(s.type))    return { error: 'Invalid value', field: 'type' };
  if (s.edition && !EDITION_RE.test(s.edition))            return { error: 'Invalid value', field: 'edition' };
  if (s.firstYear && !YEAR_RE.test(s.firstYear))           return { error: 'Invalid value', field: 'firstYear' };
  if (s.attendance && !ATTENDANCE_OPTIONS.includes(s.attendance)) return { error: 'Invalid value', field: 'attendance' };
  if (s.organizer && !ORGANIZER_OPTIONS.includes(s.organizer))    return { error: 'Invalid value', field: 'organizer' };

  for (const field of ['website', 'image']) {
    if (s[field] && (s[field].length > 300 || !isHttpUrl(s[field]))) {
      return { error: 'Invalid URL', field };
    }
  }
  if (s.details.length > 30 ||
      !s.details.every(d => typeof d === 'string' && d.length <= 40)) {
    return { error: 'Invalid value', field: 'details' };
  }
  if (s.eco.length > ECO_IDS.length || !s.eco.every(e => ECO_IDS.includes(e))) {
    return { error: 'Invalid value', field: 'eco' };
  }
  if (s.tickets.length > 10) return { error: 'Too many items', field: 'tickets' };
  const tickets = [];
  for (const t of s.tickets) {
    if (typeof t !== 'object' || t === null || Array.isArray(t)) {
      return { error: 'Invalid value', field: 'tickets' };
    }
    const name = str(t.name), url = str(t.url);
    if (name.length > 40 || url.length > 300 || (url && !isHttpUrl(url))) {
      return { error: 'Invalid value', field: 'tickets' };
    }
    tickets.push({ name, url });
  }
  s.tickets = tickets;
  s.details = s.details.map(d => d.trim());

  return { suggestion: s };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }
    const ct = request.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 415);
    }
    if (parseInt(request.headers.get('Content-Length') || '0', 10) > MAX_BODY) {
      return jsonResponse({ error: 'Payload too large' }, 413);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return jsonResponse({ error: 'Too many submissions — try again in a minute' }, 429);
    }

    const text = await request.text();
    if (text.length > MAX_BODY) {
      return jsonResponse({ error: 'Payload too large' }, 413);
    }
    let body;
    try { body = JSON.parse(text); }
    catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const result = buildSuggestion(body);
    if (result.error) return jsonResponse(result, 400);

    const date = new Date().toISOString().slice(0, 10);
    const rand = crypto.randomUUID().slice(0, 8);
    const key  = `suggestions/${date}-${rand}.json`;
    await env.CARIBBEAN_DATA.put(
      key,
      JSON.stringify({ receivedAt: new Date().toISOString(), suggestion: result.suggestion }, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    );

    return jsonResponse({ ok: true }, 201);
  },
};
