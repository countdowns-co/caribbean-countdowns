/* Unit tests for the ngo-stats Worker — run: node --test test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

function makeEnv(initialStats) {
  const store = new Map();
  if (initialStats) store.set("stats", JSON.stringify(initialStats));
  return {
    store,
    NGO_KV: {
      get: async (key) => (store.has(key) ? store.get(key) : null),
      put: async (key, value) => { store.set(key, value); },
    },
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
}

function post(body) {
  return new Request("https://caribbean.countdowns.co/api/ngo-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("GET returns defaults when no stats stored", async () => {
  const res = await worker.fetch(
    new Request("https://caribbean.countdowns.co/api/ngo-stats"),
    makeEnv()
  );
  assert.deepEqual(await res.json(), { communityProgress: 0, contributors: 0 });
});

test("communityProgress can reach 100, not capped at 94", async () => {
  const env = makeEnv({ communityProgress: 97, contributors: 5 });
  const res = await worker.fetch(post({ contribution: 5 }), env);
  const body = await res.json();
  assert.equal(body.communityProgress, 100);
});

test("communityProgress still caps at 100 (upper bound preserved)", async () => {
  const env = makeEnv({ communityProgress: 99, contributors: 5 });
  const res = await worker.fetch(post({ contribution: 5 }), env);
  const body = await res.json();
  assert.equal(body.communityProgress, 100);
});
