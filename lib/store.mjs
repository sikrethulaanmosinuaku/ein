import { createHash, randomUUID } from "node:crypto";

const LIST_KEY = "avci:images:v1";
const ADD_SCRIPT = `
local n = redis.call("INCR", KEYS[1])
if n == 1 then redis.call("EXPIRE", KEYS[1], 3600) end
if n > 5 then return 0 end
redis.call("LPUSH", KEYS[2], ARGV[1])
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

export async function listImages(env = process.env, fetcher = fetch) {
  const data = await command(["LRANGE", LIST_KEY, 0, 499], env, fetcher);
  if (!Array.isArray(data)) throw new Error("Unexpected database response.");
  return data.map((value) => {
    try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
  }).filter((value) => value && typeof value.id === "string" && typeof value.title === "string" && typeof value.image === "string");
}

export async function addImage(image, ip, env = process.env, fetcher = fetch) {
  const hash = createHash("sha256").update(ip).digest("hex");
  const result = await command(["EVAL", ADD_SCRIPT, 2, `avci:rate:${hash}`, LIST_KEY, JSON.stringify(image)], env, fetcher);
  if (Number(result) === 0) return false;
  if (Number(result) !== 1) throw new Error("Unexpected database response.");
  return true;
}
