import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, setSession } from "@/lib/adminSession";

export const runtime = "nodejs";

// Reçoit l'access_token Supabase (extrait du fragment # par la page /veille/confirm),
// vérifie qu'il appartient bien à l'admin, puis pose NOTRE cookie de session.
export async function POST(req: NextRequest) {
  let accessToken = "";
  try {
    accessToken = String((await req.json())?.access_token || "");
  } catch {
    return NextResponse.json({ error: "BAD_BODY" }, { status: 400 });
  }
  const ok = await verifyAccessToken(accessToken);
  if (!ok) {
    return NextResponse.json({ error: "INVALID" }, { status: 401 });
  }
  await setSession();
  return NextResponse.json({ ok: true });
}
