"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export interface ActionResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, key: string) {
  return ((formData.get(key) as string) ?? "").trim();
}

function refresh() {
  revalidatePath("/prayer-points");
  revalidatePath("/admin/prayer-points");
}

/** Adds "https://" if someone pastes a link without one, e.g. "example.com/story". */
function normalizeUrl(url: string) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function readEntry(formData: FormData) {
  return {
    title: text(formData, "title"),
    url: normalizeUrl(text(formData, "url")),
  };
}

export async function addPrayerPoint(formData: FormData): Promise<ActionResult> {
  const entry = readEntry(formData);
  if (!entry.title || !entry.url) {
    return { ok: false, message: "Please add both a title and a link." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("prayer_points").insert(entry);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("addPrayerPoint failed:", err);
    return { ok: false, message: "Sorry, that could not be added. Please try again." };
  }

  refresh();
  return { ok: true, message: "Prayer point added." };
}

export async function updatePrayerPoint(formData: FormData): Promise<ActionResult> {
  const id = text(formData, "id");
  const entry = readEntry(formData);
  if (!id) return { ok: false, message: "Something went wrong - please reload the page." };
  if (!entry.title || !entry.url) {
    return { ok: false, message: "Please add both a title and a link." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("prayer_points")
      .update(entry)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("updatePrayerPoint failed:", err);
    return { ok: false, message: "Sorry, that change could not be saved. Please try again." };
  }

  refresh();
  return { ok: true, message: "Changes saved." };
}

export async function deletePrayerPoint(formData: FormData): Promise<ActionResult> {
  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Something went wrong - please reload the page." };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("prayer_points").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("deletePrayerPoint failed:", err);
    return { ok: false, message: "Sorry, that could not be removed. Please try again." };
  }

  refresh();
  return { ok: true, message: "Prayer point removed." };
}
