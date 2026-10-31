import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Please finish the Supabase setup in the README.");
  return { base, key };
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function GET() {
  try {
    const { base, key } = config();
    const response = await fetch(`${base}/rest/v1/avci_images?select=id,title,creator,image,description&order=created_at.desc&limit=500`, {
      headers: headers(key), cache: "no-store",
    });
    if (!response.ok) throw new Error("The database could not be reached. Check the setup guide.");
    return NextResponse.json({ images: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load images." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  const size = Number(request.headers.get("content-length") || 0);
  if (size > 8192) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid");
    input = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Please complete the image form." }, { status: 400 });
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const image = typeof input.image === "string" ? input.image.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!title || title.length > 60 || description.length > 500 || !image || image.length > 2048) {
    return NextResponse.json({ error: "Use a name up to 60 characters and a description up to 500 characters." }, { status: 400 });
  }
  let url: URL;
  try { url = new URL(image); } catch { return NextResponse.json({ error: "Enter a valid image link." }, { status: 400 }); }
  if (url.protocol !== "https:" || url.username || url.password || !/\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) {
    return NextResponse.json({ error: "Use a direct HTTPS image link ending in .jpg, .png, .gif, .webp or .avif." }, { status: 400 });
  }

  try {
    const { base, key } = config();
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex");
    const response = await fetch(`${base}/rest/v1/rpc/avci_add_image`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({ p_key: ipHash, p_title: title, p_image: url.href, p_description: description }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Posting is unavailable. Check the database setup.");
    const result = await response.json();
    if (result?.limited) return NextResponse.json({ error: "Posting limit reached. Please try again later." }, { status: 429 });
    if (!result?.image) throw new Error("The database did not save the image.");
    return NextResponse.json({ image: result.image }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add image." }, { status: 503 });
  }
}
