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
  revalidatePath("/program-guide");
  revalidatePath("/admin/schedule");
}

function readEntry(formData: FormData) {
  return {
    day: text(formData, "day"),
    time_label: text(formData, "time_label"),
    show_name: text(formData, "show_name"),
    description: text(formData, "description"),
  };
}

export async function addScheduleEntry(formData: FormData): Promise<ActionResult> {
  const entry = readEntry(formData);
  if (!entry.day || !entry.time_label || !entry.show_name) {
    return {
      ok: false,
      message: "Please fill in the day, the time, and the show name.",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("schedule_entries").insert(entry);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("addScheduleEntry failed:", err);
    return { ok: false, message: "Sorry, that show could not be added. Please try again." };
  }

  refresh();
  return { ok: true, message: "Show added." };
}

export async function updateScheduleEntry(formData: FormData): Promise<ActionResult> {
  const id = text(formData, "id");
  const entry = readEntry(formData);
  if (!id) return { ok: false, message: "Something went wrong - please reload the page." };
  if (!entry.day || !entry.time_label || !entry.show_name) {
    return {
      ok: false,
      message: "Please fill in the day, the time, and the show name.",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("schedule_entries")
      .update(entry)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("updateScheduleEntry failed:", err);
    return { ok: false, message: "Sorry, that change could not be saved. Please try again." };
  }

  refresh();
  return { ok: true, message: "Changes saved." };
}

export async function deleteScheduleEntry(formData: FormData): Promise<ActionResult> {
  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Something went wrong - please reload the page." };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("deleteScheduleEntry failed:", err);
    return { ok: false, message: "Sorry, that show could not be removed. Please try again." };
  }

  refresh();
  return { ok: true, message: "Show removed." };
}
