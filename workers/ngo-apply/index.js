/* ngo-apply Worker — caribbean.countdowns.co/api/ngo-apply
 * Receives NGO applications from the /apply-ngo wizard, stores them in R2 for review.
 * NGO-only: companies never submit data here — they deal directly with the
 * featured NGO. This is how an NGO applies to become that featured NGO.
 * R2 binding: CARIBBEAN_DATA (bucket caribbean-data)
 *
 * POST /api/ngo-apply → 201 { ok: true }
 * Stored key: ngo-applications/YYYY-MM-DD-xxxxxxxx.json → { receivedAt, application }
 * Optional receipt image, if donationStatus is "yes" and one was uploaded,
 * is stored as a SEPARATE object (ngo-applications/YYYY-MM-DD-xxxxxxxx-receipt.ext)
 * — never embedded in the JSON record, so the application record stays small
 * and reviewable at a glance. The JSON carries only a `receiptKey` reference.
 *
 * Deliberately does not collect email or phone — website is the sole
 * identifying/contact field; the Cal.com booking flow (linked from the
 * wizard's final screen) collects an email itself if the NGO books a call,
 * without us ever storing it.
 *
 * Privacy: no IP, no user-agent — only the allowlisted application fields.
 *
 * No rate limiter (deployed via dashboard UI, which can't configure the
 * Rate Limiting binding — CLI/wrangler.toml only). Low-volume, human-
 * reviewed form; revisit if it gets spammed.
 */

const ORIGIN            = 'https://caribbean.countdowns.co';
const MAX_BODY          = 6 * 1024 * 1024;  // headroom over a 4 MB receipt image at base64 (~+33%)
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const YEAR_RE           = /^\d{4}$/;
const DONATION_STATUSES = ['yes', 'no'];
const RECEIPT_TYPES     = { 'image/png': 'png', 'image/jpeg': 'jpg' };

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

function decodeBase64(b64) {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/* Allowlist + validate. Returns { application, receiptBytes?, receiptExt? }
 * or { error, field? }. Unknown keys are dropped here — they never reach R2. */
function buildApplication(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'Invalid payload' };
  }
  const a = {
    name:           str(raw.name),
    website:        str(raw.website),
    location:       str(raw.location),
    foundedYear:    str(raw.foundedYear),
    volunteers:     str(raw.volunteers),
    actions:        Array.isArray(raw.actions) ? raw.actions : [],
    donationStatus: str(raw.donationStatus),
    notes:          str(raw.notes),
  };

  if (!a.name)                return { error: 'Missing required field', field: 'name' };
  if (!a.website)             return { error: 'Missing required field', field: 'website' };
  if (!a.location)            return { error: 'Missing required field', field: 'location' };
  if (!a.donationStatus)      return { error: 'Missing required field', field: 'donationStatus' };
  if (a.actions.length === 0) return { error: 'Missing required field', field: 'actions' };

  const caps = { name: 120, website: 300, location: 120, notes: 2000 };
  for (const [field, max] of Object.entries(caps)) {
    if (a[field].length > max) return { error: 'Too long', field };
  }

  if (!isHttpUrl(a.website)) return { error: 'Invalid URL', field: 'website' };
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

  if (!DONATION_STATUSES.includes(a.donationStatus)) {
    return { error: 'Invalid value', field: 'donationStatus' };
  }

  let receiptBytes, receiptExt;
  if (a.donationStatus === 'yes' && raw.receiptImage && typeof raw.receiptImage === 'object') {
    const contentType = str(raw.receiptImage.contentType);
    const ext = RECEIPT_TYPES[contentType];
    if (!ext) return { error: 'Invalid value', field: 'receiptImage' };
    const bytes = decodeBase64(str(raw.receiptImage.data));
    if (!bytes) return { error: 'Invalid value', field: 'receiptImage' };
    if (bytes.byteLength > MAX_RECEIPT_BYTES) return { error: 'Too large', field: 'receiptImage' };
    receiptBytes = bytes;
    receiptExt   = ext;
  }

  return { application: a, receiptBytes, receiptExt };
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
    const base = `ngo-applications/${date}-${rand}`;

    const application = { ...result.application };
    if (result.receiptBytes) {
      const receiptKey = `${base}-receipt.${result.receiptExt}`;
      await env.CARIBBEAN_DATA.put(receiptKey, result.receiptBytes, {
        httpMetadata: { contentType: result.receiptExt === 'png' ? 'image/png' : 'image/jpeg' },
      });
      application.receiptKey = receiptKey;
    }

    await env.CARIBBEAN_DATA.put(
      `${base}.json`,
      JSON.stringify({ receivedAt: new Date().toISOString(), application }, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    );

    return jsonResponse({ ok: true }, 201);
  },
};
