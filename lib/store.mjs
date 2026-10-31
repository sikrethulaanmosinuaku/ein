import { randomUUID } from "node:crypto";

const LIST_KEY = "avci:images:v1";
const ADD_SCRIPT = `
if ARGV[2] ~= "" then redis.call("SET", KEYS[2], ARGV[2]) end
redis.call("LPUSH", KEYS[1], ARGV[1])
return 1
`;

export function getConfig(env = process.env) {
  const upstash = [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN];
  const kv = [env.KV_REST_API_URL, env.KV_REST_API_TOKEN];
  const [url, token] = upstash[0] && upstash[1] ? upstash : kv;
  if (!url || !token) throw new Error("Connect an Upstash Redis database to this Vercel project. See the README.");
  let endpoint;
  try { endpoint = new URL(url); } catch { throw new Error("Invalid Upstash REST URL."); }
  if (endpoint.protocol !== "https:") throw new Error("Upstash REST URL must use HTTPS.");
  return { url: endpoint.toString().replace(/\/+$/, ""), token };
}

export async function command(args, env = process.env, fetcher = fetch) {
  const { url, token } = getConfig(env);
  const response = await fetcher(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not connect to Upstash. Check the connection and write token.");
  const data = await response.json();
  if (data.error) throw new Error("Upstash returned an error. Check the database connection.");
  return data.result;
}

export function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Please complete the image form." };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const image = typeof input.image === "string" ? input.image.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!title || title.length > 60) return { error: "Use a name between 1 and 60 characters." };
  if (description.length > 500) return { error: "Descriptions must be 500 characters or fewer." };
  if (!image || image.length > 2048) return { error: "Enter an image link up to 2,048 characters." };
  let url;
  try { url = new URL(image); } catch { return { error: "Enter a valid image link." }; }
  if (url.protocol !== "https:" || url.username || url.password || !/\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) {
    return { error: "Use a direct HTTPS image link ending in .jpg, .png, .gif, .webp or .avif." };
  }
  return { image: { id: randomUUID(), title, image: url.href, description, creator: "community" } };
}

export function validateUpload(input, bytes) {
  if (!input || typeof input !== "object") return { error: "Please complete the image form." };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!title || title.length > 60) return { error: "Use a name between 1 and 60 characters." };
  if (description.length > 500) return { error: "Descriptions must be 500 characters or fewer." };
  if (!bytes || bytes.length < 4 || bytes.length > 3 * 1024 * 1024) return { error: "The processed image must be 3 MB or smaller." };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { error: "Only processed JPEG images are accepted." };
  const id = randomUUID();
  return { image: { id, title, image: `/api/media?id=${id}`, description, creator: "community" }, bytes };
}

export async function listImages(offset = 0, env = process.env, fetcher = fetch) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid page.");
  const data = await command(["LRANGE", LIST_KEY, offset, offset + 50], env, fetcher);
  if (!Array.isArray(data)) throw new Error("Unexpected database response.");
  const images = data.slice(0, 50).map((value) => {
    try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
  }).filter((value) => value && typeof value.id === "string" && typeof value.title === "string" && typeof value.image === "string");
  return { images, hasMore: data.length > 50, nextOffset: offset + Math.min(data.length, 50) };
}

export async function addImage(image, env = process.env, fetcher = fetch, bytes = null) {
  const mediaKey = `avci:media:${image.id}`;
  const result = await command(["EVAL", ADD_SCRIPT, 2, LIST_KEY, mediaKey, JSON.stringify(image), bytes ? Buffer.from(bytes).toString("base64") : ""], env, fetcher);
  if (Number(result) !== 1) throw new Error("Unexpected database response.");
  return true;
}

export async function getMedia(id, env = process.env, fetcher = fetch) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return null;
  const value = await command(["GET", `avci:media:${id}`], env, fetcher);
  if (typeof value !== "string") return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 4 || bytes.length > 3 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  return bytes;
}
