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
  assert.deepEqual(await res.json(), { passingRounds: 0 });
});

test("POST a passing round (3/5) increments passingRounds by 1", async () => {
  const env = makeEnv({ passingRounds: 10 });
  const res = await worker.fetch(post({ score: 3, total: 5 }), env);
  assert.equal((await res.json()).passingRounds, 11);
});

test("POST a failing round (2/5) does not increment passingRounds", async () => {
  const env = makeEnv({ passingRounds: 10 });
  const res = await worker.fetch(post({ score: 2, total: 5 }), env);
  assert.equal((await res.json()).passingRounds, 10);
});

test("passingRounds caps at 25, does not overflow", async () => {
  const env = makeEnv({ passingRounds: 25 });
  const res = await worker.fetch(post({ score: 5, total: 5 }), env);
  assert.equal((await res.json()).passingRounds, 25);
});

test("GET normalizes a legacy-shaped stored value instead of echoing it", async () => {
  const env = makeEnv({ communityProgress: 87.5, contributors: 42 });
  const res = await worker.fetch(
    new Request("https://caribbean.countdowns.co/api/ngo-stats"),
    env
  );
  assert.deepEqual(await res.json(), { passingRounds: 0 });
});
