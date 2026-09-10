import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const value = request.headers.get("x-vercel-ip-country");
  const country = value && /^[A-Z]{2}$/.test(value) ? value : null;
  // Per-visitor response; never cache geographically personalised data publicly.
  return NextResponse.json({ country }, { headers: { "Cache-Control": "private, no-store" } });
}
