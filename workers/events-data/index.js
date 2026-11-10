/* events-data Worker — caribbean.countdowns.co/api/events/:year
 * R2 binding:  CARIBBEAN_DATA (bucket: caribbean-data)
 * Rate limit:  EVENTS_RL (ratelimit binding — see wrangler.toml)
 * Secrets (wrangler secret put): KEY_MEDIUM, KEY_PREMIUM
 *
 * GET /api/events/2026                          → events-2026.json (tier-filtered)
 * GET /api/events/2026?country=Trinidad%20and%20Tobago → filtered by country (full name)
 * GET /api/events/2026?type=music               → filtered by type
 *
 * Tiers (header X-API-Key, silent fallback to free on missing/unknown key):
 *   free    (no key)   → name, startDate, endDate, country
 *   medium  KEY_MEDIUM → + description, type, website
 *   premium KEY_PREMIUM→ explicit allowlist of known fields (NOT a raw passthrough).
 *                        Also merges in events-{year}-candidates.json (events failing a
 *                        listing criterion, e.g. not yet 2nd edition), tagged listed:false.
 *                        Also merges in events-{year}-pricerange.json (ticket price-range
 *                        estimates, joined by internal id with name+country as fallback) as
 *                        priceRangeEstimate (visitor: watch/attend), participantPriceRangeEstimate
 *                        (entry fee for participants) and priceCheckedDate. The internal id itself is
 *                        never returned.
 *                        Free/medium never fetch either object.
 *
 * Security (see caribbean-countdowns-api/api-authorization-audit.html):
 *   A — keys compared in constant time; free traffic rate-limited per IP.
 *   B — premium is an explicit allowlist so a newly-added data field never auto-leaks.
 *   C — CORS is '*' only for anonymous reads; keyed calls require an allowlisted Origin.
 *   D — 404 does not echo the internal R2 object key.
 */

const ALLOWED_YEARS   = ['2026', '2027'];
const API_VERSION     = '1';
// First-party origins allowed to send X-API-Key from a browser. Anonymous reads stay open ('*').
const ALLOWED_ORIGINS = ['https://caribbean.countdowns.co'];

const FIELDS = {
  free:    ['name', 'startDate', 'endDate', 'country'],
  medium:  ['name', 'startDate', 'endDate', 'country', 'description', 'type', 'website'],
  // Explicit allowlist (was `null` = raw passthrough). Adding a field to the data does NOT
  // expose it until it is listed here — turns a data edit back into a deliberate code decision.
  // 'listed' is stamped by fetch() below (true for events-{year}.json, false for
  // events-{year}-candidates.json) — it is never present in the source JSON files.
  // priceRangeEstimate/participantPriceRangeEstimate/priceCheckedDate come from
  // events-{year}-pricerange.json — premium-only price tracking, never on free/medium.
  // priceRangeEstimate = what a visitor pays to watch/attend (free = known free, absent = unknown);
  // participantPriceRangeEstimate = what a participant pays to enter (absent = no entry fee data).
  premium: ['name', 'startDate', 'endDate', 'country', 'description', 'type', 'website',
            'timezone', 'city', 'details', 'image', 'tickets', 'eco', 'listed',
            'priceRangeEstimate', 'participantPriceRangeEstimate', 'priceCheckedDate'],
};

// Constant-time key comparison — avoids a timing side-channel on the secret keys.
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.byteLength !== eb.byteLength) return false;      // length is not secret
  return crypto.subtle.timingSafeEqual(ea, eb);          // Workers runtime extension
}

// Missing or unknown key → free (no leakage, no 401).
const getTier = (apiKey, env) =>
  !apiKey                           ? 'free'
  : safeEq(apiKey, env.KEY_PREMIUM) ? 'premium'
  : safeEq(apiKey, env.KEY_MEDIUM)  ? 'medium'
  : 'free';

// free/medium: fixed sets, always present → null-fill keeps a stable shape.
// premium: allowlist filtered to present keys → output byte-identical to today for existing
// records, but any field NOT in the list (a future addition) is dropped.
const project = (ev, tier) =>
  tier === 'premium'
    ? Object.fromEntries(FIELDS.premium.filter(f => f in ev).map(f => [f, ev[f]]))
    : Object.fromEntries(FIELDS[tier].map(f => [f, ev[f] ?? null]));

// '*' for anonymous reads; for keyed requests, reflect an allowlisted Origin or grant nothing.
function corsHeaders(request) {
  const hasKey = !!request.headers.get('X-API-Key');
  const origin = request.headers.get('Origin');
  const allow  = !hasKey                                  ? '*'
    : (origin && ALLOWED_ORIGINS.includes(origin))        ? origin
    : null;
  const h = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-API-Key',
    'Access-Control-Max-Age':       '86400',
  };
  if (allow) { h['Access-Control-Allow-Origin'] = allow; h['Vary'] = 'Origin'; }
  return h;
}

function jsonResponse(body, status = 200, extra = {}, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type':           'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-API-Version':          API_VERSION,
      ...extra,
    },
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, {}, cors);
    }

    const url   = new URL(request.url);
    // pathname: /api/events/2026  →  parts: ['api','events','2026']
    const parts = url.pathname.split('/').filter(Boolean);
    const year  = parts[2];

    if (!year || !ALLOWED_YEARS.includes(year)) {
      return jsonResponse({ error: 'Not found', allowedYears: ALLOWED_YEARS }, 404, {}, cors);
    }

    const tier = getTier(request.headers.get('X-API-Key'), env);

    // Abuse control: throttle anonymous/free traffic per IP; medium/premium keys are exempt.
    if (tier === 'free' && env.EVENTS_RL) {
      const ip = request.headers.get('CF-Connecting-IP') || 'anon';
      const { success } = await env.EVENTS_RL.limit({ key: ip });
      if (!success) {
        return jsonResponse({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': '60' }, cors);
      }
    }

    const key    = `events-${year}.json`;
    const object = await env.CARIBBEAN_DATA.get(key);

    if (!object) {
      console.log('events-data miss', key);   // internal only — not echoed to caller
      return jsonResponse({ error: 'Data not available' }, 404, {}, cors);
    }

    let events;
    try {
      events = JSON.parse(await object.text());
    } catch {
      return jsonResponse({ error: 'Data parse error' }, 500, {}, cors);
    }

    // Premium only: merge in events that fail a listing criterion (e.g. not yet
    // a 2nd edition) from a separate R2 object. Free/medium never fetch this —
    // one less R2 read on the hot path, and it keeps them structurally unable
    // to see unlisted events. Missing object (no candidates that year) → [].
    if (tier === 'premium') {
      const candidatesObject = await env.CARIBBEAN_DATA.get(`events-${year}-candidates.json`);
      let candidates = [];
      if (candidatesObject) {
        try {
          candidates = JSON.parse(await candidatesObject.text());
        } catch {
          return jsonResponse({ error: 'Data parse error' }, 500, {}, cors);
        }
      }
      events = [
        ...events.map(e => ({ ...e, listed: true })),
        ...candidates.map(e => ({ ...e, listed: false })),
      ];

      // Premium only: attach price-range estimates from a separate R2 object, produced by the
      // price-tracking script and the review page. Missing object (no pricing run yet that year)
      // → [], same as candidates.
      const pricerangeObject = await env.CARIBBEAN_DATA.get(`events-${year}-pricerange.json`);
      let priceranges = [];
      if (pricerangeObject) {
        try {
          priceranges = JSON.parse(await pricerangeObject.text());
        } catch {
          return jsonResponse({ error: 'Data parse error' }, 500, {}, cors);
        }
      }
      // Joined by the internal id when both sides have one (survives a rename), otherwise by
      // name+country. The id is only used here: it is not in any FIELDS list, so it is never returned.
      const priceById  = new Map(priceranges.filter(p => p.id).map(p => [p.id, p]));
      const priceByKey = new Map(priceranges.map(p => [`${p.name}::${p.country}`, p]));
      events = events.map(e => {
        const price = (e.id && priceById.get(e.id)) || priceByKey.get(`${e.name}::${e.country}`);
        if (!price) return e;
        const merged = { ...e, priceCheckedDate: price.priceCheckedDate };
        if (price.priceRangeEstimate !== undefined)            merged.priceRangeEstimate = price.priceRangeEstimate;
        if (price.participantPriceRangeEstimate !== undefined) merged.participantPriceRangeEstimate = price.participantPriceRangeEstimate;
        return merged;
      });
    }

    // Optional query filters — stackable, applied before tier projection.
    const country = url.searchParams.get('country');
    const type    = url.searchParams.get('type');

    if (country) events = events.filter(e => e.country === country);
    if (type)    events = events.filter(e => e.type    === type);

    // X-Total-Count reflects the (post-filter) result set, before projection.
    const total = events.length;
    events = events.map(e => project(e, tier));

    return jsonResponse(events, 200, {
      'Cache-Control': tier === 'free' ? 'public, max-age=3600' : 'private, max-age=300',
      'X-Total-Count': String(total),
      'X-API-Tier':    tier,
    }, cors);
  },
};
