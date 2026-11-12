"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export interface CleanupResult {
  ok: boolean;
  message: string;
}

/**
 * The "Clean up now" button: does by hand what the nightly job does - writes
 * the daily totals and deletes raw events older than 120 days. Only works for
 * the logged-in admin (checked again here, on top of the /admin password).
 */
export async function runCleanup(_prev: CleanupResult | null): Promise<CleanupResult> {
  if (!isAdminAuthorized((await headers()).get("authorization"))) {
    return { ok: false, message: "Not allowed." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("analytics_maintenance", { p_keep_days: 120 });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/statistics");
    const removed = Number(data?.events_removed ?? 0) + Number(data?.sessions_removed ?? 0);
    return {
      ok: true,
      message:
        removed > 0
          ? `Done. Daily totals are up to date and ${removed} old detailed rows were removed.`
          : "Done. Daily totals are up to date. There was nothing old enough to remove.",
    };
  } catch (err) {
    console.error("statistics cleanup failed -", err instanceof Error ? err.message : err);
    return { ok: false, message: "The cleanup could not run. Please try again." };
  }
}
