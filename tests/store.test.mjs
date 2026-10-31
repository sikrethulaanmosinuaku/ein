import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, getConfig, listImages, addImage } from "../lib/store.mjs";

const env = { KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "fake-test-token" };

test("accepts valid links and rejects unsafe or malformed posts", () => {
  const good = validate({ title: " A picture ", image: "https://example.com/photo.webp?size=large", description: " Details " });
  assert.equal(good.image.title, "A picture");
  assert.equal(good.image.description, "Details");
  assert.ok(good.image.id);
  for (const image of ["http://example.com/a.jpg", "https://example.com/page", "javascript:alert(1)", "https://u:p@example.com/a.jpg"]) {
    assert.ok(validate({ title: "Hi", image }).error);
  }
  assert.ok(validate({ title: " ", image: "https://example.com/a.jpg" }).error);
  assert.ok(validate({ title: "x".repeat(61), image: "https://example.com/a.jpg" }).error);
  assert.ok(validate({ title: "Hi", image: "https://example.com/a.jpg", description: "x".repeat(501) }).error);
});

test("uses a complete matching pair of credentials", () => {
  assert.deepEqual(getConfig(env), { url: "https://example.upstash.io", token: "fake-test-token" });
  assert.equal(getConfig({ ...env, UPSTASH_REDIS_REST_URL: "https://other.upstash.io" }).url, "https://example.upstash.io");
  assert.throws(() => getConfig({ UPSTASH_REDIS_REST_URL: "https://x", KV_REST_API_TOKEN: "bad" }));
  assert.throws(() => getConfig({ KV_REST_API_URL: "http://x", KV_REST_API_TOKEN: "bad" }));
});

test("reads the newest entries and ignores malformed records", async () => {
  const image = validate({ title: "Hi", image: "https://example.com/a.jpg" }).image;
  const fetcher = async (url, options) => {
    assert.equal(url, env.KV_REST_API_URL);
    assert.equal(options.headers.Authorization, "Bearer fake-test-token");
    assert.deepEqual(JSON.parse(options.body), ["LRANGE", "avci:images:v1", 0, 499]);
    return { ok: true, json: async () => ({ result: [JSON.stringify(image), "not-json"] }) };
  };
  assert.deepEqual(await listImages(env, fetcher), [image]);
});

test("writes atomically with a rate limit and never trims existing posts", async () => {
  const image = validate({ title: "Hi", image: "https://example.com/a.jpg", description: "Hidden detail" }).image;
  let observed;
  const fetcher = async (url, options) => {
    observed = JSON.parse(options.body);
    return { ok: true, json: async () => ({ result: 1 }) };
  };
  assert.equal(await addImage(image, "127.0.0.1", env, fetcher), true);
  assert.equal(observed[0], "EVAL");
  assert.match(observed[1], /INCR/);
  assert.match(observed[1], /LPUSH/);
  assert.doesNotMatch(observed[1], /LTRIM/);
  assert.equal(JSON.parse(observed[5]).description, "Hidden detail");
  const limited = async () => ({ ok: true, json: async () => ({ result: 0 }) });
  assert.equal(await addImage(image, "127.0.0.1", env, limited), false);
});

test("fails safely on Upstash errors", async () => {
  await assert.rejects(() => listImages(env, async () => ({ ok: false })), /Upstash/);
  await assert.rejects(() => listImages(env, async () => ({ ok: true, json: async () => ({ error: "bad token" }) })), /Upstash/);
});
