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
  revalidatePath("/sermons");
  revalidatePath("/admin/sermons");
}

/** Adds "https://" if someone pastes a link without one, e.g. "youtu.be/abc123". */
function normalizeUrl(url: string) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function isYouTubeUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    );
  } catch {
    return false;
  }
}

function readEntry(formData: FormData) {
  return {
    title: text(formData, "title"),
    url: normalizeUrl(text(formData, "url")),
  };
}

/** Returns an error message if the entry is not ready to save, otherwise null. */
function validate(entry: ReturnType<typeof readEntry>): string | null {
  if (!entry.title || !entry.url) {
    return "Please add both a sermon title and a YouTube link.";
  }
  if (!isYouTubeUrl(entry.url)) {
    return "That does not look like a YouTube link. Please paste the link to the YouTube video.";
  }
  return null;
}

export async function addSermon(formData: FormData): Promise<ActionResult> {
  const entry = readEntry(formData);
  const problem = validate(entry);
  if (problem) return { ok: false, message: problem };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sermons").insert(entry);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("addSermon failed:", err);
    return { ok: false, message: "Sorry, that could not be added. Please try again." };
  }

  refresh();
  return { ok: true, message: "Sermon added." };
}

export async function updateSermon(formData: FormData): Promise<ActionResult> {
  const id = text(formData, "id");
  const entry = readEntry(formData);
  if (!id) return { ok: false, message: "Something went wrong - please reload the page." };
  const problem = validate(entry);
  if (problem) return { ok: false, message: problem };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sermons").update(entry).eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("updateSermon failed:", err);
    return { ok: false, message: "Sorry, that change could not be saved. Please try again." };
  }

  refresh();
  return { ok: true, message: "Changes saved." };
}

export async function deleteSermon(formData: FormData): Promise<ActionResult> {
  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Something went wrong - please reload the page." };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sermons").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("deleteSermon failed:", err);
    return { ok: false, message: "Sorry, that could not be removed. Please try again." };
  }

  refresh();
  return { ok: true, message: "Sermon removed." };
}
