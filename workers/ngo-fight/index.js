/* ngo-fight Worker — caribbean.countdowns.co/api/ngo-fight/*
 * KV binding: FIGHT_KV · read-only cross-Worker binding: NGO_KV (ngo-stats' KV)
 * secret: SALT_SECRET (shared with visits/ngo-stats)
 *
 * Company-vs-Community 30-day € contribution race for the featured NGO. Self-report +
 * manual moderation only — this Worker never processes payment. See
 * caribbean-countdowns-tools/specs/2026-09-19-ngo-fight-design.md for the full design.
 *
 * Single-NGO for now (NGO_ID constant) — see the plan's Global Constraints for why this
 * isn't parameterized from the client yet. KV keys are still namespaced by NGO_ID so
 * multi-NGO support later is a smaller change.
 *
 * GET  /api/ngo-fight/status   → public season status + history
 * POST /api/ngo-fight/submit   → public, writes a pending entry (rate-limited + deduped)
 * GET  /api/ngo-fight/pending  → admin (Cloudflare Access-gated at the edge, not here)
 * POST /api/ngo-fight/approve  → admin (Cloudflare Access-gated at the edge, not here)
 */

const NGO_ID = "lassomer";
const GOAL_COMPANY = 1000;
const GOAL_COMMUNITY = 500;
const SEASON_DAYS = 30;
const EXTENSION_DAYS = 7;
const MAX_EXTENSIONS = 2;

const seasonKey = () => `fight:${NGO_ID}:current`;
const pendingPrefix = () => `fight:${NGO_ID}:pending:`;
const pendingKey = (id) => `${pendingPrefix()}${id}`;
const rejectedKey = (id) => `fight:${NGO_ID}:rejected:${id}`;
const historyKey = () => `fight:${NGO_ID}:history`;
const seenKey = (hash) => `fight:${NGO_ID}:seen:${hash}`;

function newSeason(now = Date.now()) {
  return {
    seasonId: now,
    start: now,
    end: now + SEASON_DAYS * 86400000,
    extensionsUsed: 0,
    goalCompany: GOAL_COMPANY,
    goalCommunity: GOAL_COMMUNITY,
    companyTotal: 0,
    communityTotal: 0,
    companyContributors: 0,
    communityContributors: 0,
  };
}

async function getSeason(env) {
  const raw = await env.FIGHT_KV.get(seasonKey());
  if (raw) return JSON.parse(raw);
  const season = newSeason();
  await env.FIGHT_KV.put(seasonKey(), JSON.stringify(season));
  return season;
}

async function putSeason(env, season) {
  await env.FIGHT_KV.put(seasonKey(), JSON.stringify(season));
}

async function getHistory(env) {
  const raw = await env.FIGHT_KV.get(historyKey());
  return raw ? JSON.parse(raw) : [];
}

async function appendHistory(env, entry) {
  const history = await getHistory(env);
  history.push(entry);
  await env.FIGHT_KV.put(historyKey(), JSON.stringify(history));
}

function closeSeasonEntry(season) {
  let winner;
  if (season.companyTotal > season.communityTotal) winner = "company";
  else if (season.communityTotal > season.companyTotal) winner = "community";
  else winner = "tie";
  return {
    seasonId: season.seasonId,
    start: season.start,
    end: season.end,
    companyFinal: season.companyTotal,
    communityFinal: season.communityTotal,
    winner,
  };
}

// Lazily checked from both GET /status and POST /approve (see plan Global Constraints
// for why not approve-only). No-ops if NGO_KV isn't bound or progress hasn't hit 100.
async function checkQuizTrigger(env, season) {
  if (!env.NGO_KV) return season;
  const raw = await env.NGO_KV.get("stats");
  const stats = raw ? JSON.parse(raw) : { communityProgress: 0 };
  if (stats.communityProgress < 100) return season;

  if (season.extensionsUsed < MAX_EXTENSIONS) {
    season.end += EXTENSION_DAYS * 86400000;
    season.extensionsUsed += 1;
  } else {
    await appendHistory(env, closeSeasonEntry(season));
    season = newSeason();
  }
  await env.NGO_KV.put("stats", JSON.stringify({ ...stats, communityProgress: 0 }));
  await putSeason(env, season);
  return season;
}

// Applied on every read/write of the season: closes a naturally-expired season to
// history and starts a fresh one, independent of the quiz trigger.
async function checkNaturalExpiry(env, season) {
  if (Date.now() < season.end) return season;
  await appendHistory(env, closeSeasonEntry(season));
  const fresh = newSeason();
  await putSeason(env, fresh);
  return fresh;
}

function corsHeaders() {
  return { "Access-Control-Allow-Origin": "https://caribbean.countdowns.co" };
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders() });
}

async function dailyHash(env, ip) {
  const date = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${env.SALT_SECRET}:${NGO_ID}:${date}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function isValidSide(side) { return side === "company" || side === "community"; }
function isValidSiret(siret) { return /^\d{14}$/.test(siret); }

async function handleSubmit(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) return new Response("Too many requests", { status: 429, headers: corsHeaders() });

  let body;
  try { body = await request.json(); } catch { return new Response("Bad request", { status: 400, headers: corsHeaders() }); }

  if (!isValidSide(body.side)) return json({ field: "side" }, 400);
  const amount = parseFloat(body.amount);
  if (!isFinite(amount) || amount <= 0) return json({ field: "amount" }, 400);
  if (body.siret !== undefined && body.siret !== "" && !isValidSiret(String(body.siret))) {
    return json({ field: "siret" }, 400);
  }

  const hash = await dailyHash(env, ip);
  const seenRaw = await env.FIGHT_KV.get(seenKey(hash));
  const seenCount = seenRaw ? parseInt(seenRaw, 10) : 0;
  if (seenCount >= 5) return json({ field: "rate" }, 429);
  await env.FIGHT_KV.put(seenKey(hash), String(seenCount + 1), { expirationTtl: 86400 });

  const entryId = crypto.randomUUID();
  const entry = {
    side: body.side,
    amount,
    name: body.name ? String(body.name).slice(0, 120) : "",
    siret: body.siret ? String(body.siret) : "",
    note: body.note ? String(body.note).slice(0, 500) : "",
    submittedAt: Date.now(),
  };
  await env.FIGHT_KV.put(pendingKey(entryId), JSON.stringify(entry));
  return json({ status: "pending", entryId }, 201);
}

async function handlePending(env) {
  const list = await env.FIGHT_KV.list({ prefix: pendingPrefix() });
  const entries = [];
  for (const k of list.keys) {
    const raw = await env.FIGHT_KV.get(k.name);
    if (raw) entries.push({ entryId: k.name.slice(pendingPrefix().length), ...JSON.parse(raw) });
  }
  return json(entries);
}

async function handleApprove(request, env) {
  let body;
  try { body = await request.json(); } catch { return new Response("Bad request", { status: 400, headers: corsHeaders() }); }

  const { entryId, decision } = body;
  if (decision !== "approve" && decision !== "reject") return json({ field: "decision" }, 400);

  const raw = await env.FIGHT_KV.get(pendingKey(entryId));
  if (!raw) return json({ error: "not found" }, 404);
  const entry = JSON.parse(raw);
  await env.FIGHT_KV.delete(pendingKey(entryId));

  if (decision === "reject") {
    await env.FIGHT_KV.put(rejectedKey(entryId), raw);
    return json({ status: "rejected" });
  }

  let season = await getSeason(env);
  season = await checkNaturalExpiry(env, season);
  if (entry.side === "company") {
    season.companyTotal = Math.round((season.companyTotal + entry.amount) * 100) / 100;
    season.companyContributors += 1;
  } else {
    season.communityTotal = Math.round((season.communityTotal + entry.amount) * 100) / 100;
    season.communityContributors += 1;
  }
  await putSeason(env, season);
  season = await checkQuizTrigger(env, season);

  const history = await getHistory(env);
  return json({ ...season, history });
}

async function handleStatus(env) {
  let season = await getSeason(env);
  season = await checkNaturalExpiry(env, season);
  season = await checkQuizTrigger(env, season);
  const history = await getHistory(env);
  return json({ ...season, history });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/api/ngo-fight/status" && request.method === "GET") {
      return handleStatus(env);
    }

    if (url.pathname === "/api/ngo-fight/submit" && request.method === "POST") {
      return handleSubmit(request, env);
    }

    if (url.pathname === "/api/ngo-fight/pending" && request.method === "GET") {
      return handlePending(env);
    }

    if (url.pathname === "/api/ngo-fight/approve" && request.method === "POST") {
      return handleApprove(request, env);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
};
