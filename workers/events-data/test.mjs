/* Unit tests for the events-data Worker — run: node --test test.mjs
 * Mocks env (R2 get); uses global Request/Response (Node 18+). */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import worker from "./index.js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js (Cloudflare Workers uses it)
if (!crypto.subtle.timingSafeEqual) {
  crypto.subtle.timingSafeEqual = crypto.timingSafeEqual;
}

function makeEnv(files = {}) {
  const calls = [];
  return {
    calls,
    KEY_MEDIUM: "medium-secret",
    KEY_PREMIUM: "premium-secret",
    EVENTS_RL: { limit: async () => ({ success: true }) },
    CARIBBEAN_DATA: {
      get: async (key) => {
        calls.push(key);
        if (!(key in files)) return null;
        return { text: async () => files[key] };
      },
    },
  };
}

function get(path, headers = {}) {
  return new Request(`https://caribbean.countdowns.co${path}`, { headers });
}

const MAIN_EVENT = {
  name: "Test Fest", website: "https://example.com", description: "A test festival.",
  startDate: "2026-08-01", endDate: "2026-08-02", city: "Le Moule",
  country: "Guadeloupe", timezone: "America/Guadeloupe", type: "music",
  details: ["zouk"], image: "https://example.com/img.webp",
  tickets: [{ name: "Website", url: "https://example.com/tickets" }],
};

const CANDIDATE_EVENT = {
  name: "Soolang Pangui Fest", website: "", description: "",
  startDate: "2026-08-02", endDate: "2026-08-02", city: "Saint-Laurent du Maroni",
  country: "French Guiana", timezone: "America/Cayenne", type: "music",
  details: [], image: "",
  tickets: [{ name: "Tickets", url: "https://www.bizouk.com/events/details/soolang-pangui-fest/123800" }],
  createdYear: 2026,
};

test("premium: candidates merged in, listed:true on main events, listed:false on candidates", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([MAIN_EVENT]),
    "events-2026-candidates.json": JSON.stringify([CANDIDATE_EVENT]),
  });
  const res = await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2);
  const main = body.find(e => e.name === "Test Fest");
  const cand = body.find(e => e.name === "Soolang Pangui Fest");
  assert.equal(main.listed, true);
  assert.equal(cand.listed, false);
  assert.equal(res.headers.get("X-Total-Count"), "2");
});

test("premium: no candidates file for year → unchanged, no error", async () => {
  const env = makeEnv({ "events-2026.json": JSON.stringify([MAIN_EVENT]) });
  const res = await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].listed, true);
});

test("free tier: candidates file never fetched, listed field absent", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([MAIN_EVENT]),
    "events-2026-candidates.json": JSON.stringify([CANDIDATE_EVENT]),
  });
  const res = await worker.fetch(get("/api/events/2026"), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.ok(!("listed" in body[0]));
  assert.ok(!env.calls.includes("events-2026-candidates.json"));
});

test("medium tier: candidates file never fetched, listed field absent", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([MAIN_EVENT]),
    "events-2026-candidates.json": JSON.stringify([CANDIDATE_EVENT]),
  });
  const res = await worker.fetch(get("/api/events/2026", { "X-API-Key": "medium-secret" }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.ok(!("listed" in body[0]));
  assert.ok(!env.calls.includes("events-2026-candidates.json"));
});

test("premium: country filter applies across merged main+candidate events", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([MAIN_EVENT]),
    "events-2026-candidates.json": JSON.stringify([CANDIDATE_EVENT]),
  });
  const res = await worker.fetch(
    get("/api/events/2026?country=French%20Guiana", { "X-API-Key": "premium-secret" }),
    env
  );
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].name, "Soolang Pangui Fest");
  assert.equal(body[0].listed, false);
});

test("premium: malformed candidates JSON → 500, free tier for same year unaffected", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([MAIN_EVENT]),
    "events-2026-candidates.json": "{not valid json",
  });
  const premiumRes = await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env);
  assert.equal(premiumRes.status, 500);

  const freeRes = await worker.fetch(get("/api/events/2026"), env);
  assert.equal(freeRes.status, 200);
  const freeBody = await freeRes.json();
  assert.equal(freeBody.length, 1);
});

test("premium tier receives priceRangeEstimate + priceCheckedDate when a pricerange entry matches", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([
      { name: "Test Fest", country: "Testland", startDate: "2026-01-01", endDate: "2026-01-01" },
    ]),
    "events-2026-pricerange.json": JSON.stringify([
      { name: "Test Fest", country: "Testland", priceRangeEstimate: "under_20", priceCheckedDate: "2026-08-01" },
    ]),
  });
  const res = await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  const event = body.find((e) => e.name === "Test Fest");
  assert.equal(event.priceRangeEstimate, "under_20");
  assert.equal(event.priceCheckedDate, "2026-08-01");
});

test("free tier never receives priceRangeEstimate even when a pricerange entry matches", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([
      { name: "Test Fest", country: "Testland", startDate: "2026-01-01", endDate: "2026-01-01" },
    ]),
    "events-2026-pricerange.json": JSON.stringify([
      { name: "Test Fest", country: "Testland", priceRangeEstimate: "under_20", priceCheckedDate: "2026-08-01" },
    ]),
  });
  const res = await worker.fetch(get("/api/events/2026"), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  const event = body.find((e) => e.name === "Test Fest");
  assert.equal("priceRangeEstimate" in event, false);
  assert.equal("priceCheckedDate" in event, false);
  assert.ok(!env.calls.includes("events-2026-pricerange.json"));
});

test("missing events-{year}-pricerange.json object does not error, behaves as before", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([
      { name: "Solo Event", country: "Nowhere", startDate: "2026-01-01", endDate: "2026-01-01" },
    ]),
  });
  const res = await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body[0].name, "Solo Event");
  assert.equal("priceRangeEstimate" in body[0], false);
});

test("premium tier receives participantPriceRangeEstimate; free and medium never do", async () => {
  const files = {
    "events-2026.json": JSON.stringify([
      { name: "Test Race", country: "Testland", startDate: "2026-01-01", endDate: "2026-01-01", description: "d", type: "sport", website: "https://example.com" },
    ]),
    "events-2026-pricerange.json": JSON.stringify([
      { name: "Test Race", country: "Testland", priceRangeEstimate: "free", participantPriceRangeEstimate: "20_50", priceCheckedDate: "2026-11-10" },
    ]),
  };
  const premium = await (await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), makeEnv(files))).json();
  assert.equal(premium[0].priceRangeEstimate, "free");
  assert.equal(premium[0].participantPriceRangeEstimate, "20_50");
  for (const headers of [{}, { "X-API-Key": "medium-secret" }]) {
    const body = await (await worker.fetch(get("/api/events/2026", headers), makeEnv(files))).json();
    assert.equal("priceRangeEstimate" in body[0], false);
    assert.equal("participantPriceRangeEstimate" in body[0], false);
  }
});

test("an entry with only a participant bucket leaves the visitor bucket absent (unknown, not free)", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([{ name: "Test Race", country: "Testland", startDate: "2026-01-01", endDate: "2026-01-01" }]),
    "events-2026-pricerange.json": JSON.stringify([
      { name: "Test Race", country: "Testland", participantPriceRangeEstimate: "over_100", priceCheckedDate: "2026-11-10" },
    ]),
  });
  const [event] = await (await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env)).json();
  assert.equal(event.participantPriceRangeEstimate, "over_100");
  assert.equal("priceRangeEstimate" in event, false);
});

test("price entries are joined by internal id when present, so a renamed event keeps its price", async () => {
  const env = makeEnv({
    "events-2026.json": JSON.stringify([{ id: "evt_aaaaaaaaaaaaaaaa", name: "Renamed Fest", country: "Testland", startDate: "2026-01-01", endDate: "2026-01-01" }]),
    "events-2026-pricerange.json": JSON.stringify([
      { id: "evt_aaaaaaaaaaaaaaaa", name: "Old Name Fest", country: "Testland", priceRangeEstimate: "20_50", priceCheckedDate: "2026-11-10" },
    ]),
  });
  const [event] = await (await worker.fetch(get("/api/events/2026", { "X-API-Key": "premium-secret" }), env)).json();
  assert.equal(event.priceRangeEstimate, "20_50");
  assert.equal("id" in event, false);
});

test("id is an internal join key: never exposed on any tier, even when present in events, candidates and pricerange", async () => {
  const files = {
    "events-2026.json": JSON.stringify([
      { id: "evt_testfest0000001", name: "Test Fest", country: "Testland", startDate: "2026-01-01", endDate: "2026-01-01", description: "d", type: "music", website: "https://example.com" },
    ]),
    "events-2026-candidates.json": JSON.stringify([
      { id: "evt_candfest0000001", name: "Cand Fest", country: "Testland", startDate: "2026-02-01", endDate: "2026-02-01" },
    ]),
    "events-2026-pricerange.json": JSON.stringify([
      { id: "evt_testfest0000001", name: "Test Fest", country: "Testland", priceRangeEstimate: "20_50", priceCheckedDate: "2026-11-10" },
    ]),
  };
  for (const headers of [{}, { "X-API-Key": "medium-secret" }, { "X-API-Key": "premium-secret" }]) {
    const res = await worker.fetch(get("/api/events/2026", headers), makeEnv(files));
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes("evt_testfest0000001") && !text.includes("evt_candfest0000001"), `id leaked for ${JSON.stringify(headers)}`);
    for (const e of JSON.parse(text)) assert.equal("id" in e, false);
  }
});
