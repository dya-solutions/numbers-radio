import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdminApi } from "@/lib/adminAuth";
import { generateDevotionAudio } from "@/lib/devotionAudio";

/**
 * Makes (or re-makes) the AI audio for the saved Daily Devotion.
 *
 * This is the ONLY place that spends money on the voice service. It lives under
 * /admin (so the password middleware covers it) AND checks the password itself,
 * and it refuses requests that did not come from the admin page. Nothing on the
 * public site calls it.
 *
 * It runs as its own request, separate from saving the text, because making
 * audio can take a while. The long time limit below allows for that.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = guardAdminApi(req);
  if (denied) return denied;

  let force = false;
  try {
    const body = (await req.json()) as { force?: unknown };
    force = body?.force === true;
  } catch {
    /* no body = normal (not forced) request */
  }

  const result = await generateDevotionAudio({ force });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.status },
    );
  }

  revalidatePath("/daily-devotion");
  revalidatePath("/admin/devotion");
  return NextResponse.json({ ok: true, audio: result.audio, skipped: result.skipped });
}
