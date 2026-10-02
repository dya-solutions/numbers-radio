"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeTime24 } from "@/lib/time";

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

const TIME_HELP =
  "Please enter the time in 24-hour format, like 09:00 or 18:30.";

function readEntry(formData: FormData) {
  const rawTime = text(formData, "time_label");
  return {
    day: text(formData, "day"),
    // Stored as "HH:MM" (24-hour). Empty/invalid input is caught by validate().
    time_label: normalizeTime24(rawTime) ?? rawTime,
    show_name: text(formData, "show_name"),
    description: text(formData, "description"),
  };
}

/** Returns an error message if the entry is not ready to save, otherwise null. */
function validate(entry: ReturnType<typeof readEntry>): string | null {
  if (!entry.day || !entry.time_label || !entry.show_name) {
    return "Please fill in the day, the time, and the show name.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time_label)) {
    return TIME_HELP;
  }
  return null;
}

export async function addScheduleEntry(formData: FormData): Promise<ActionResult> {
  const entry = readEntry(formData);
  const problem = validate(entry);
  if (problem) return { ok: false, message: problem };

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
  const problem = validate(entry);
  if (problem) return { ok: false, message: problem };

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
