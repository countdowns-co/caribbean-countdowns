/* ngo-apply Worker — caribbean.countdowns.co/api/ngo-apply
 * Receives NGO applications from the /apply-ngo wizard, stores them in R2 for review.
 * NGO-only: companies never submit data here — they deal directly with the
 * featured NGO. This is how an NGO applies to become that featured NGO.
 * R2 binding: CARIBBEAN_DATA (bucket caribbean-data) · ratelimit: RATE_LIMITER (3/min per IP)
 *
 * POST /api/ngo-apply → 201 { ok: true }
 * Stored key: ngo-applications/YYYY-MM-DD-xxxxxxxx.json → { receivedAt, application }
 * Privacy: no IP, no user-agent — only the allowlisted application fields.
 */

const ORIGIN   = 'https://caribbean.countdowns.co';
const MAX_BODY = 10 * 1024;
const YEAR_RE  = /^\d{4}$/;

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

/* Allowlist + validate. Returns { application } or { error, field? }.
 * Unknown keys are dropped here — they never reach R2. */
function buildApplication(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'Invalid payload' };
  }
  const a = {
    name:        str(raw.name),
    website:     str(raw.website),
    location:    str(raw.location),
    foundedYear: str(raw.foundedYear),
    volunteers:  str(raw.volunteers),
    actions:     Array.isArray(raw.actions) ? raw.actions : [],
    email:       str(raw.email),
    phone:       str(raw.phone),
    notes:       str(raw.notes),
  };

  if (!a.name)     return { error: 'Missing required field', field: 'name' };
  if (!a.location) return { error: 'Missing required field', field: 'location' };
  if (!a.email)    return { error: 'Missing required field', field: 'email' };
  if (a.actions.length === 0) return { error: 'Missing required field', field: 'actions' };

  const caps = { name: 120, website: 300, location: 120, email: 200, phone: 40, notes: 2000 };
  for (const [field, max] of Object.entries(caps)) {
    if (a[field].length > max) return { error: 'Too long', field };
  }

  if (a.website && (a.website.length > 300 || !isHttpUrl(a.website))) {
    return { error: 'Invalid URL', field: 'website' };
  }
  if (a.foundedYear && !YEAR_RE.test(a.foundedYear)) {
    return { error: 'Invalid value', field: 'foundedYear' };
  }
  if (a.volunteers && !/^\d{1,7}$/.test(a.volunteers)) {
    return { error: 'Invalid value', field: 'volunteers' };
  }
  if (a.actions.length > 5 ||
      !a.actions.every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 120)) {
    return { error: 'Invalid value', field: 'actions' };
  }
  a.actions = a.actions.map(x => x.trim());

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(a.email)) return { error: 'Invalid value', field: 'email' };

  return { application: a };
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

    const result = buildApplication(body);
    if (result.error) return jsonResponse(result, 400);

    const date = new Date().toISOString().slice(0, 10);
    const rand = crypto.randomUUID().slice(0, 8);
    const key  = `ngo-applications/${date}-${rand}.json`;
    await env.CARIBBEAN_DATA.put(
      key,
      JSON.stringify({ receivedAt: new Date().toISOString(), application: result.application }, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    );

    return jsonResponse({ ok: true }, 201);
  },
};
