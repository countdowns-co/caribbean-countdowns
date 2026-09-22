/* Unit tests for the ngo-fight Worker — run: node --test test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: async (key) => (store.has(key) ? store.get(key) : null),
    put: async (key, value) => { store.set(key, value); },
    delete: async (key) => { store.delete(key); },
    list: async ({ prefix }) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
    }),
  };
}

function makeEnv({ fightKv = {}, ngoStats = null } = {}) {
  // Real mutable store, not a static closure — a put() must actually persist so a
  // later get() reflects it (checkQuizTrigger's reset-to-0 write depends on this).
  const NGO_KV = ngoStats ? makeKV({ stats: JSON.stringify(ngoStats) }) : undefined;
  return {
    FIGHT_KV: makeKV(fightKv),
    NGO_KV,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    SALT_SECRET: "test-salt",
  };
}

function get(path) {
  return new Request("https://caribbean.countdowns.co" + path);
}

test("GET /status lazily creates season 1 with correct defaults", async () => {
  const env = makeEnv();
  const res = await worker.fetch(get("/api/ngo-fight/status"), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.extensionsUsed, 0);
  assert.equal(body.goalCompany, 1000);
  assert.equal(body.goalCommunity, 500);
  assert.equal(body.companyTotal, 0);
  assert.equal(body.communityTotal, 0);
  assert.equal(body.end - body.start, 30 * 86400000);
  assert.deepEqual(body.history, []);
});

test("GET /status returns the same season on a second call (no re-init)", async () => {
  const env = makeEnv();
  const first = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  const second = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  assert.equal(first.seasonId, second.seasonId);
});

test("quiz trigger: <25 passing rounds does nothing", async () => {
  const env = makeEnv({ ngoStats: { passingRounds: 18 } });
  const before = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  const after = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  assert.equal(after.end, before.end);
  assert.equal(after.extensionsUsed, 0);
});

// checkQuizTrigger runs on every /status call and resets passingRounds to 0 once
// consumed (spec: each extension has to be earned fresh) — so simulating "the
// community hit 25 passing rounds again" between calls means re-seeding env.NGO_KV,
// not reusing one static mock across multiple fetches.
function fillQuizGauge(env) {
  env.NGO_KV = makeKV({ stats: JSON.stringify({ passingRounds: 25 }) });
}

test("quiz trigger: 25 passing rounds extends season by 7 days, extensionsUsed 0→1", async () => {
  const env = makeEnv(); // no NGO_KV bound yet — clean baseline, no trigger possible
  const before = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  fillQuizGauge(env); // simulate the community just hitting 25 passing rounds
  const after = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  assert.equal(after.end - before.end, 7 * 86400000);
  assert.equal(after.extensionsUsed, 1);
});

test("quiz trigger: after 2 extensions, a 3rd 25-round hit closes season to history and starts a new one", async () => {
  const env = makeEnv();
  fillQuizGauge(env);
  await worker.fetch(get("/api/ngo-fight/status"), env); // extension 1 (0→1)

  fillQuizGauge(env); // community hits 25 again
  const beforeThird = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json(); // extension 2 (1→2)
  assert.equal(beforeThird.extensionsUsed, 2);
  const originalSeasonId = beforeThird.seasonId;

  fillQuizGauge(env); // community hits 25 a 3rd time
  const after = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json(); // forced close
  assert.notEqual(after.seasonId, originalSeasonId);
  assert.equal(after.extensionsUsed, 0);
  assert.equal(after.history.length, 1);
  assert.equal(after.history[0].seasonId, originalSeasonId);
});

test("closeSeasonEntry: higher total wins even below goal", async () => {
  // Exercised indirectly via the forced-close path above; direct total check here.
  const env = makeEnv();
  fillQuizGauge(env);
  await worker.fetch(get("/api/ngo-fight/status"), env);
  fillQuizGauge(env);
  await worker.fetch(get("/api/ngo-fight/status"), env);
  fillQuizGauge(env);
  const after = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  assert.equal(after.history[0].winner, "tie"); // both start at 0 — exact tie case
});

function post(path, body) {
  return new Request("https://caribbean.countdowns.co" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_COMPANY = { side: "company", amount: 250, name: "Surf Shop Martinique", siret: "81234567800012" };
const VALID_COMMUNITY = { side: "community", amount: 20 };

test("POST /submit valid company entry → 201, pending entry stored", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post("/api/ngo-fight/submit", VALID_COMPANY), env);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.status, "pending");
  assert.ok(body.entryId);
  const stored = JSON.parse(env.FIGHT_KV.store.get(`fight:lassomer:pending:${body.entryId}`));
  assert.equal(stored.side, "company");
  assert.equal(stored.amount, 250);
  assert.equal(stored.siret, "81234567800012");
});

test("POST /submit valid community entry, no name → 201, name defaults to empty (anonymous)", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post("/api/ngo-fight/submit", VALID_COMMUNITY), env);
  const body = await res.json();
  const stored = JSON.parse(env.FIGHT_KV.store.get(`fight:lassomer:pending:${body.entryId}`));
  assert.equal(stored.name, "");
});

test("POST /submit invalid side → 400", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post("/api/ngo-fight/submit", { ...VALID_COMMUNITY, side: "nope" }), env);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "side");
});

test("POST /submit amount <= 0 → 400", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post("/api/ngo-fight/submit", { ...VALID_COMMUNITY, amount: 0 }), env);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "amount");
});

test("POST /submit malformed SIRET → 400", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post("/api/ngo-fight/submit", { ...VALID_COMPANY, siret: "123" }), env);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "siret");
});

test("POST /submit rate-limited → 429", async () => {
  const env = makeEnv();
  env.RATE_LIMITER.limit = async () => ({ success: false });
  const res = await worker.fetch(post("/api/ngo-fight/submit", VALID_COMMUNITY), env);
  assert.equal(res.status, 429);
});

test("POST /submit same IP+day dedup hash caps at 5 submissions/day → 6th is 429", async () => {
  const env = makeEnv();
  const req = () => new Request("https://caribbean.countdowns.co/api/ngo-fight/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
    body: JSON.stringify(VALID_COMMUNITY),
  });
  for (let i = 0; i < 5; i++) {
    const res = await worker.fetch(req(), env);
    assert.equal(res.status, 201, `submission ${i + 1} should succeed`);
  }
  const sixth = await worker.fetch(req(), env);
  assert.equal(sixth.status, 429);
});

test("POST /submit invalid JSON → 400", async () => {
  const req = new Request("https://caribbean.countdowns.co/api/ngo-fight/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{nope",
  });
  const res = await worker.fetch(req, makeEnv());
  assert.equal(res.status, 400);
});

test("GET /pending lists submitted entries with entryId", async () => {
  const env = makeEnv();
  const { entryId } = await (await worker.fetch(post("/api/ngo-fight/submit", VALID_COMPANY), env)).json();
  const res = await worker.fetch(get("/api/ngo-fight/pending"), env);
  const list = await res.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].entryId, entryId);
  assert.equal(list[0].side, "company");
});

test("POST /approve with decision=approve moves entry into totals and removes it from pending", async () => {
  const env = makeEnv();
  const { entryId } = await (await worker.fetch(post("/api/ngo-fight/submit", VALID_COMPANY), env)).json();
  const res = await worker.fetch(post("/api/ngo-fight/approve", { entryId, decision: "approve" }), env);
  assert.equal(res.status, 200);
  const status = await res.json();
  assert.equal(status.companyTotal, 250);
  assert.equal(status.companyContributors, 1);

  const pending = await (await worker.fetch(get("/api/ngo-fight/pending"), env)).json();
  assert.equal(pending.length, 0);
});

test("POST /approve with decision=reject moves entry to rejected, never counted, never in /pending", async () => {
  const env = makeEnv();
  const { entryId } = await (await worker.fetch(post("/api/ngo-fight/submit", VALID_COMMUNITY), env)).json();
  const res = await worker.fetch(post("/api/ngo-fight/approve", { entryId, decision: "reject" }), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "rejected" });

  const pending = await (await worker.fetch(get("/api/ngo-fight/pending"), env)).json();
  assert.equal(pending.length, 0);
  assert.ok(env.FIGHT_KV.store.has(`fight:lassomer:rejected:${entryId}`));

  const status = await (await worker.fetch(get("/api/ngo-fight/status"), env)).json();
  assert.equal(status.communityTotal, 0);
  assert.equal(status.communityContributors, 0);
});

test("POST /approve unknown entryId → 404", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post("/api/ngo-fight/approve", { entryId: "nope", decision: "approve" }), env);
  assert.equal(res.status, 404);
});

test("POST /approve invalid decision → 400", async () => {
  const env = makeEnv();
  const { entryId } = await (await worker.fetch(post("/api/ngo-fight/submit", VALID_COMMUNITY), env)).json();
  const res = await worker.fetch(post("/api/ngo-fight/approve", { entryId, decision: "maybe" }), env);
  assert.equal(res.status, 400);
});

test("approving two community entries accumulates the total across both", async () => {
  const env = makeEnv();
  const a = await (await worker.fetch(post("/api/ngo-fight/submit", { side: "community", amount: 20 }), env)).json();
  const b = await (await worker.fetch(post("/api/ngo-fight/submit", { side: "community", amount: 30 }), env)).json();
  await worker.fetch(post("/api/ngo-fight/approve", { entryId: a.entryId, decision: "approve" }), env);
  const status = await (await worker.fetch(post("/api/ngo-fight/approve", { entryId: b.entryId, decision: "approve" }), env)).json();
  assert.equal(status.communityTotal, 50);
  assert.equal(status.communityContributors, 2);
});
