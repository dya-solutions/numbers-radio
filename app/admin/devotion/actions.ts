"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { audioInfoFor, removeDevotionAudio, sourceFromRow } from "@/lib/devotionAudio";
import { buildSpokenText, type AudioInfo } from "@/lib/devotionSpeech";

export interface SaveResult {
  ok: boolean;
  message: string;
  /** How the saved audio relates to the text that was just saved. */
  audio?: AudioInfo;
  /** True when the editor should now start making new audio (a separate step). */
  needsAudio?: boolean;
}

function text(formData: FormData, key: string) {
  return ((formData.get(key) as string) ?? "").trim();
}

/**
 * Saves the devotion text. This is deliberately ONLY about the text, so it is
 * fast and cannot time out. Making the audio happens afterwards, as its own
 * request (see app/admin/api/devotion-audio).
 */
export async function saveDevotion(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const record = {
    id: 1,
    date_label: text(formData, "date_label"),
    source_line: text(formData, "source_line"),
    title: text(formData, "title"),
    scripture_reference: text(formData, "scripture_reference"),
    scripture_text: text(formData, "scripture_text"),
    body: text(formData, "body"),
    further_study: text(formData, "further_study"),
    golden_nugget: text(formData, "golden_nugget"),
    prayer: text(formData, "prayer"),
    updated_at: new Date().toISOString(),
  };

  // Every box empty = the editor pressed "Clear All" and then Save on purpose.
  const everythingEmpty = [
    record.date_label,
    record.source_line,
    record.title,
    record.scripture_reference,
    record.scripture_text,
    record.body,
    record.further_study,
    record.golden_nugget,
    record.prayer,
  ].every((value) => value === "");

  if (!everythingEmpty && !record.title && !record.body) {
    return {
      ok: false,
      message: "Please add at least a title and the devotion body before saving.",
    };
  }

  let audio: AudioInfo = { status: "none", url: null, downloadUrl: null };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("devotion").upsert(record);
    if (error) throw new Error(error.message);

    if (everythingEmpty) {
      // Nothing left to read, so the old audio goes too.
      await removeDevotionAudio();
    } else {
      const { data: row } = await supabase.from("devotion").select("*").eq("id", 1).maybeSingle();
      if (row) {
        audio = audioInfoFor(sourceFromRow(row), {
          url: row.audio_url as string | null,
          hash: row.audio_hash as string | null,
        });
      }
    }
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

  const hasText = buildSpokenText({
    title: record.title,
    sourceLine: record.source_line,
    scriptureReference: record.scripture_reference,
    scriptureText: record.scripture_text,
    body: record.body,
    furtherStudy: record.further_study,
    goldenNugget: record.golden_nugget,
    prayer: record.prayer,
  }) !== "";

  return {
    ok: true,
    message: everythingEmpty
      ? "Saved. The devotion and its audio have been cleared."
      : "Saved. The Daily Devotion page is now updated.",
    audio,
    needsAudio: hasText && audio.status !== "ready",
  };
}
