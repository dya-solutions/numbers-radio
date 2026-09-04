"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export interface SaveResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, key: string) {
  return ((formData.get(key) as string) ?? "").trim();
}

export async function saveDevotion(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const record = {
    id: 1,
    date_label: text(formData, "date_label"),
    title: text(formData, "title"),
    scripture_reference: text(formData, "scripture_reference"),
    scripture_text: text(formData, "scripture_text"),
    reflection: text(formData, "reflection"),
    prayer: text(formData, "prayer"),
    updated_at: new Date().toISOString(),
  };

  if (!record.title && !record.reflection) {
    return {
      ok: false,
      message: "Please add at least a title and a reflection before saving.",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("devotion").upsert(record);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("saveDevotion failed:", err);
    return {
      ok: false,
      message:
        "Sorry, the devotion could not be saved. Please try again in a moment.",
    };
  }

  // Update the public page and this editor right away.
  revalidatePath("/daily-devotion");
  revalidatePath("/admin/devotion");

  return { ok: true, message: "Saved. The Daily Devotion page is now updated." };
}
