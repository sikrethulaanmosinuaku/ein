import { NextRequest, NextResponse } from "next/server";
import { getMedia } from "@/lib/store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const bytes = await getMedia(request.nextUrl.searchParams.get("id") || "");
    if (!bytes) return new NextResponse("Image not found", { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Image temporarily unavailable", { status: 503 });
  }
}
