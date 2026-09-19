/* ngo-stats Worker — caribbean.countdowns.co/api/ngo-stats
 * KV binding: NGO_KV
 * GET  → { communityProgress, contributors }
 * POST { contribution: number } → increments stats, returns updated values
 */

const DEFAULTS = { communityProgress: 0, contributors: 0 };

async function getStats(env) {
  const raw = await env.NGO_KV.get("stats");
  return raw ? JSON.parse(raw) : { ...DEFAULTS };
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

      const contribution = Math.max(0, Math.min(parseFloat(body.contribution) || 0, 5));
      const stats = await getStats(env);

      stats.contributors += 1;
      stats.communityProgress = Math.min(
        parseFloat((stats.communityProgress + contribution).toFixed(2)),
        100
      );

      await putStats(env, stats);
      return Response.json(stats);
    }

    return new Response("Method not allowed", { status: 405 });
  }
};
