import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, validateUpload, getConfig, listImages, addImage, getMedia } from "../lib/store.mjs";

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
    assert.deepEqual(JSON.parse(options.body), ["LRANGE", "avci:images:v1", 0, 50]);
    return { ok: true, json: async () => ({ result: [JSON.stringify(image), "not-json"] }) };
  };
  assert.deepEqual(await listImages(0, env, fetcher), { images: [image], hasMore: false, nextOffset: 2 });
});

test("writes atomically without a posting rate cap and never trims existing posts", async () => {
  const image = validate({ title: "Hi", image: "https://example.com/a.jpg", description: "Hidden detail" }).image;
  let observed;
  const fetcher = async (url, options) => {
    observed = JSON.parse(options.body);
    return { ok: true, json: async () => ({ result: 1 }) };
  };
  assert.equal(await addImage(image, env, fetcher), true);
  assert.equal(observed[0], "EVAL");
  assert.doesNotMatch(observed[1], /INCR/);
  assert.match(observed[1], /LPUSH/);
  assert.doesNotMatch(observed[1], /LTRIM/);
  assert.equal(JSON.parse(observed[5]).description, "Hidden detail");
  for (let i = 0; i < 7; i++) assert.equal(await addImage(image, env, fetcher), true);
});

test("validates uploads and preserves a separate file key", async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const result = validateUpload({ title: "Phone picture", description: "A detail" }, bytes);
  assert.ok(result.image.image.startsWith("/api/media?id="));
  assert.ok(validateUpload({ title: "Bad" }, Uint8Array.from([0, 1, 2, 3])).error);
  assert.ok(validateUpload({ title: "Big" }, new Uint8Array(3 * 1024 * 1024 + 1)).error);
  let observed;
  const fetcher = async (url, options) => {
    observed = JSON.parse(options.body);
    return { ok: true, json: async () => ({ result: 1 }) };
  };
  assert.equal(await addImage(result.image, env, fetcher, bytes), true);
  assert.match(observed[1], /SET/);
  assert.equal(observed[2], 2);
  assert.equal(observed[4], `avci:media:${result.image.id}`);
  assert.equal(observed[6], Buffer.from(bytes).toString("base64"));
  const mediaFetcher = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body), ["GET", `avci:media:${result.image.id}`]);
    return { ok: true, json: async () => ({ result: Buffer.from(bytes).toString("base64") }) };
  };
  assert.deepEqual(await getMedia(result.image.id, env, mediaFetcher), Buffer.from(bytes));
  assert.equal(await getMedia("../bad", env, mediaFetcher), null);
});

test("fails safely on Upstash errors", async () => {
  await assert.rejects(() => listImages(0, env, async () => ({ ok: false })), /Upstash/);
  await assert.rejects(() => listImages(0, env, async () => ({ ok: true, json: async () => ({ error: "bad token" }) })), /Upstash/);
});

test("pages beyond 500 entries without removing older images", async () => {
  const items = Array.from({ length: 51 }, (_, index) => JSON.stringify({ id: `id${index}`, title: "Find", image: "https://example.com/a.jpg" }));
  const fetcher = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body), ["LRANGE", "avci:images:v1", 500, 550]);
    return { ok: true, json: async () => ({ result: items }) };
  };
  const result = await listImages(500, env, fetcher);
  assert.equal(result.images.length, 50);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextOffset, 550);
});
