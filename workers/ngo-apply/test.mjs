/* Unit tests for the ngo-apply Worker — run: node --test test.mjs
 * Mocks env (R2 put only — no rate limiter, see index.js header for why).
 * Uses global Request/Response (Node 18+). */
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

// 1x1 transparent PNG, well-known minimal fixture.
const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function makeEnv(overrides = {}) {
  const puts = [];
  return {
    puts,
    CARIBBEAN_DATA: { put: async (key, value) => { puts.push({ key, value }); } },
    ...overrides,
  };
}

function post(body, headers = {}) {
  return new Request("https://caribbean.countdowns.co/api/ngo-apply", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = {
  name: "Test NGO", website: "https://example.org", location: "Martinique",
  foundedYear: "2016", volunteers: "10",
  actions: ["Beach cleanups", "Reef surveys"],
  donationStatus: "no",
  notes: "test submission",
};

test("valid POST (no receipt) → 201, one object stored, no PII", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post(VALID), env);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(env.puts.length, 1);
  assert.match(env.puts[0].key, /^ngo-applications\/\d{4}-\d{2}-\d{2}-[0-9a-f-]{8}\.json$/);
  const stored = JSON.parse(env.puts[0].value);
  assert.ok(stored.receivedAt);
  assert.equal(stored.application.name, "Test NGO");
  assert.ok(!("email" in stored.application));
  assert.ok(!("phone" in stored.application));
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
  const big = { ...VALID, notes: "x".repeat(7 * 1024 * 1024) };
  const res = await worker.fetch(post(big), makeEnv());
  assert.equal(res.status, 413);
});

test("invalid JSON → 400", async () => {
  const res = await worker.fetch(post("{nope"), makeEnv());
  assert.equal(res.status, 400);
});

test("missing required fields → 400 with field", async () => {
  for (const [omit, field] of [["name", "name"], ["website", "website"], ["location", "location"], ["donationStatus", "donationStatus"]]) {
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

test("unknown donationStatus value → 400", async () => {
  const res = await worker.fetch(post({ ...VALID, donationStatus: "maybe" }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "donationStatus");
});

test("optional fields blank by default", async () => {
  const bare = { ...VALID };
  delete bare.website2; delete bare.foundedYear; delete bare.volunteers; delete bare.notes;
  const env = makeEnv();
  const res = await worker.fetch(post(bare), env);
  assert.equal(res.status, 201);
  const stored = JSON.parse(env.puts[0].value);
  assert.equal(stored.application.foundedYear, "");
});

test("unknown keys are dropped, never stored", async () => {
  const env = makeEnv();
  const res = await worker.fetch(post({ ...VALID, admin: true, email: "leak@example.com" }), env);
  assert.equal(res.status, 201);
  assert.ok(!env.puts[0].value.includes("leak@example.com"));
  assert.ok(!("admin" in JSON.parse(env.puts[0].value).application));
});

test("donationStatus yes + valid PNG receipt → 2 objects stored, JSON references the receipt", async () => {
  const env = makeEnv();
  const withReceipt = { ...VALID, donationStatus: "yes", receiptImage: { data: TINY_PNG_B64, contentType: "image/png" } };
  const res = await worker.fetch(post(withReceipt), env);
  assert.equal(res.status, 201);
  assert.equal(env.puts.length, 2);
  const receiptPut = env.puts.find(p => p.key.endsWith(".png"));
  const jsonPut = env.puts.find(p => p.key.endsWith(".json"));
  assert.ok(receiptPut, "receipt object should be stored");
  assert.ok(jsonPut, "application JSON should be stored");
  const stored = JSON.parse(jsonPut.value);
  assert.equal(stored.application.receiptKey, receiptPut.key);
  // The JSON record must never carry the raw base64 blob.
  assert.ok(!jsonPut.value.includes(TINY_PNG_B64));
});

test("donationStatus no + receiptImage present → receipt silently ignored, not stored", async () => {
  const env = makeEnv();
  const ignored = { ...VALID, donationStatus: "no", receiptImage: { data: TINY_PNG_B64, contentType: "image/png" } };
  const res = await worker.fetch(post(ignored), env);
  assert.equal(res.status, 201);
  assert.equal(env.puts.length, 1);
  const stored = JSON.parse(env.puts[0].value);
  assert.ok(!("receiptKey" in stored.application));
});

test("receipt with disallowed content type → 400", async () => {
  const res = await worker.fetch(post({
    ...VALID, donationStatus: "yes",
    receiptImage: { data: TINY_PNG_B64, contentType: "application/pdf" },
  }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "receiptImage");
});

test("receipt with invalid base64 → 400", async () => {
  const res = await worker.fetch(post({
    ...VALID, donationStatus: "yes",
    receiptImage: { data: "not-valid-base64!!!", contentType: "image/png" },
  }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "receiptImage");
});

test("receipt over 4 MB → 400", async () => {
  const bigB64 = Buffer.alloc(4 * 1024 * 1024 + 1, 1).toString("base64");
  const res = await worker.fetch(post({
    ...VALID, donationStatus: "yes",
    receiptImage: { data: bigB64, contentType: "image/png" },
  }), makeEnv());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).field, "receiptImage");
});
