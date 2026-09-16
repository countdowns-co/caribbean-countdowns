/* Unit tests for the ngo-apply Worker — run: node --test test.mjs
 * Mocks env (R2 put + rate limiter); uses global Request/Response (Node 18+). */
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

function makeEnv(overrides = {}) {
  const puts = [];
  return {
    puts,
    CARIBBEAN_DATA: { put: async (key, value) => { puts.push({ key, value }); } },
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

function post(body, headers = {}) {
  return new Request("https://caribbean.countdowns.co/api/ngo-apply", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = {
  name: "Test NGO", website: "https://example.org", location: "Martinique",
  foundedYear: "2016", volunteers: "10",
  actions: ["Beach cleanups", "Reef surveys"],
  email: "contact@example.org", phone: "+596000000000",
  notes: "test submission",
};

test("valid POST → 201, object stored under ngo-applications/, no PII beyond submitted fields", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post(VALID), env);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(env.puts.length, 1);
  assert.match(env.puts[0].key, /^ngo-applications\/\d{4}-\d{2}-\d{2}-[0-9a-f-]{8}\.json$/);
  const stored = JSON.parse(env.puts[0].value);
  assert.ok(stored.receivedAt);
  assert.equal(stored.application.name, "Test NGO");
  assert.ok(!env.puts[0].value.includes("1.2.3.4"));
});

test("CORS header restricted to site origin", async () => {
  const res = await worker.fetch(post(VALID), makeEnv());
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://caribbean.countdowns.co");
});

test("OPTIONS preflight → 204", async () => {
  const req = new Request("https://caribbean.countdowns.co/api/ngo-apply", { method: "OPTIONS" });
  const res = await worker.fetch(req, makeEnv());
  assert.equal(res.status, 204);
});

test("GET → 405", async () => {
  const req = new Request("https://caribbean.countdowns.co/api/ngo-apply", { method: "GET" });
  const res = await worker.fetch(req, makeEnv());
  assert.equal(res.status, 405);
});

test("wrong Content-Type → 415", async () => {
  const res = await worker.fetch(post(VALID, { "Content-Type": "text/plain" }), makeEnv());
  assert.equal(res.status, 415);
});

test("oversized body → 413", async () => {
  const big = { ...VALID, notes: "x".repeat(11 * 1024) };
  const res = await worker.fetch(post(big), makeEnv());
  assert.equal(res.status, 413);
});

test("rate limited → 429, nothing stored", async () => {
  const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
  const res = await worker.fetch(post(VALID), env);
  assert.equal(res.status, 429);
  assert.equal(env.puts.length, 0);
});

test("invalid JSON → 400", async () => {
  const res = await worker.fetch(post("{nope"), makeEnv());
  assert.equal(res.status, 400);
});

test("missing required fields → 400 with field", async () => {
  for (const [omit, field] of [["name", "name"], ["location", "location"], ["email", "email"]]) {
    const bad = { ...VALID }; delete bad[omit];
    const res = await worker.fetch(post(bad), makeEnv());
    assert.equal(res.status, 400, omit);
    assert.equal((await res.json()).field, field);
  }
});

test("empty actions array → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, actions: [] }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "actions");
});

test("more than 5 actions → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, actions: ["a", "b", "c", "d", "e", "f"] }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "actions");
});

test("action over 120 chars → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, actions: ["x".repeat(121)] }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "actions");
});

test("invalid email format → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, email: "not-an-email" }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "email");
});

test("non-http website → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, website: "javascript:alert(1)" }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "website");
});

test("bad foundedYear format → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, foundedYear: "16" }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "foundedYear");
});

test("bad volunteers format → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, volunteers: "ten" }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "volunteers");
});

test("name over 120 chars → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, name: "x".repeat(121) }), makeEnv());
  assert.equal(res.status, 400);
});

test("optional fields blank by default", async () => {
  const bare = { ...VALID };
  delete bare.website; delete bare.foundedYear; delete bare.volunteers;
  delete bare.phone; delete bare.notes;
  const env = makeEnv();
  const res = await worker.fetch(post(bare), env);
  assert.equal(res.status, 201);
  const stored = JSON.parse(env.puts[0].value);
  assert.equal(stored.application.website, "");
  assert.equal(stored.application.phone, "");
});

test("unknown keys are dropped, never stored", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post({ ...VALID, admin: true, ip: "1.2.3.4" }), env);
  assert.equal(res.status, 201);
  assert.ok(!("admin" in JSON.parse(env.puts[0].value).application));
});
