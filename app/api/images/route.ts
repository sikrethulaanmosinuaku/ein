import { NextRequest, NextResponse } from "next/server";
import { addImage, listImages, validate } from "@/lib/store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ images: await listImages() }, { headers: { "Cache-Control": "no-store" } });
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
  const result = validate(input);
  if (result.error || !result.image) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const allowed = await addImage(result.image, ip);
    if (!allowed) return NextResponse.json({ error: "Posting limit reached. Please try again later." }, { status: 429 });
    return NextResponse.json({ image: result.image }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add image." }, { status: 503 });
  }
}
