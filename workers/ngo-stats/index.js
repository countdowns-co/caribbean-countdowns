/* ngo-stats Worker — caribbean.countdowns.co/api/ngo-stats
 * KV binding: NGO_KV
 * GET  → { passingRounds }
 * POST { score: number, total: number } → increments passingRounds if score/total is a
 *   passing ratio, returns updated value. Pass/fail is decided here, not trusted from
 *   the client as a bare boolean.
 */

const TRIGGER_THRESHOLD = 25; // must match workers/ngo-fight's own copy of this number
const PASS_RATIO = 0.6; // 3/5

async function getStats(env) {
  const raw = await env.NGO_KV.get("stats");
  const parsed = raw ? JSON.parse(raw) : {};
  return { passingRounds: Number(parsed.passingRounds) || 0 };
}

async function putStats(env, stats) {
  await env.NGO_KV.put("stats", JSON.stringify(stats));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/ngo-stats") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "GET") {
      const stats = await getStats(env);
      return Response.json(stats);
    }

    if (request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response("Too many requests", { status: 429 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Bad request", { status: 400 });
      }

      const score = Number(body.score) || 0;
      const total = Number(body.total) || 1; // avoid div-by-zero; a real total is always 5 today
      const passed = score / total >= PASS_RATIO;

      const stats = await getStats(env);
      if (passed) {
        stats.passingRounds = Math.min(stats.passingRounds + 1, TRIGGER_THRESHOLD);
      }

      await putStats(env, stats);
      return Response.json(stats);
    }

    return new Response("Method not allowed", { status: 405 });
  }
};
