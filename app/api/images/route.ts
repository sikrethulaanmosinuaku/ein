import { NextRequest, NextResponse } from "next/server";
import { addImage, listImages, validate, validateUpload } from "@/lib/store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const offset = Number(request.nextUrl.searchParams.get("offset") || "0");
    if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ error: "Invalid page." }, { status: 400 });
    return NextResponse.json(await listImages(offset), { headers: { "Cache-Control": "no-store" } });
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
  if (size > 3 * 1024 * 1024 + 64 * 1024) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

  let input: Record<string, unknown>;
  let bytes: Uint8Array | null = null;
  try {
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "The processed image must be under 3 MB." }, { status: 400 });
      bytes = new Uint8Array(await file.arrayBuffer());
      input = { title: form.get("title"), description: form.get("description") };
    } else {
      const raw = await request.text();
      if (raw.length > 8192) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid");
      input = parsed as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "Please complete the image form." }, { status: 400 });
  }
  const result = bytes ? validateUpload(input, bytes) : validate(input);
  if (result.error || !result.image) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await addImage(result.image, process.env, fetch, bytes);
    return NextResponse.json({ image: result.image }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add image." }, { status: 503 });
  }
}
