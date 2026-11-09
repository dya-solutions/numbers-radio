import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabaseServer";
import {
  buildSpokenText,
  type AudioInfo,
  type SpeechSource,
} from "./devotionSpeech";
import { synthesizeSpeech, TtsError, type TtsErrorCode } from "./tts";

/**
 * Making, storing, and checking the AI audio for the Daily Devotion.
 * SERVER ONLY. Only the admin API route (password protected) and the admin's
 * Save action call into the "make audio" parts - nothing public can.
 *
 * One MP3 is kept in the public Supabase Storage bucket below. Each new MP3
 * gets a fresh file name (so browsers and CDNs never serve an old copy) and the
 * previous file is deleted, so storage never fills up.
 */

export const AUDIO_BUCKET = "devotion-audio";
/** Leftover files younger than this might belong to a run still in progress. */
const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000;

type Supabase = ReturnType<typeof getSupabaseAdmin>;

/* ---------------------------------------------------------------------------
   Fingerprint + status
--------------------------------------------------------------------------- */

/** Fingerprint of the exact text the audio is made from. */
export function hashSpokenText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** "numbers-radio-devotion-known-by-name.mp3" */
export function devotionFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `numbers-radio-devotion${slug ? `-${slug}` : ""}.mp3`;
}

/** Does the stored audio match the current text? */
export function audioInfoFor(
  source: SpeechSource,
  stored: { url?: string | null; hash?: string | null },
): AudioInfo {
  const url = stored.url || null;
  if (!url) return { status: "none", url: null, downloadUrl: null };

  const text = buildSpokenText(source);
  const matches = text !== "" && stored.hash === hashSpokenText(text);
  if (!matches) return { status: "outdated", url: null, downloadUrl: null };

  const separator = url.includes("?") ? "&" : "?";
  return {
    status: "ready",
    url,
    downloadUrl: `${url}${separator}download=${encodeURIComponent(devotionFileName(source.title))}`,
  };
}

/** Database row -> the fields that get read aloud. */
export function sourceFromRow(row: Record<string, unknown>): SpeechSource {
  const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");
  return {
    title: text("title"),
    sourceLine: text("source_line"),
    scriptureReference: text("scripture_reference"),
    scriptureText: text("scripture_text"),
    body: text("body"),
    furtherStudy: text("further_study"),
    goldenNugget: text("golden_nugget"),
    prayer: text("prayer"),
  };
}

/* ---------------------------------------------------------------------------
   Storage helpers
--------------------------------------------------------------------------- */

function objectNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/${AUDIO_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  return decodeURIComponent(url.slice(at + marker.length).split("?")[0]) || null;
}

async function removeObjects(supabase: Supabase, names: string[]) {
  if (names.length === 0) return;
  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(names);
  if (error) console.error("devotion audio: could not delete old files -", error.message);
}

/** Deletes the previous file, and any stray files older than a few minutes. */
async function cleanUpOldFiles(
  supabase: Supabase,
  keep: string,
  previousUrl: string | null | undefined,
) {
  try {
    const stale = new Set<string>();
    const previous = objectNameFromUrl(previousUrl);
    if (previous && previous !== keep) stale.add(previous);

    const { data: files } = await supabase.storage.from(AUDIO_BUCKET).list("", { limit: 200 });
    for (const file of files ?? []) {
      if (!file.id || file.name === keep) continue;
      const created = Date.parse(file.created_at ?? file.updated_at ?? "");
      if (Number.isNaN(created) || Date.now() - created > ORPHAN_MIN_AGE_MS) stale.add(file.name);
    }
    await removeObjects(supabase, [...stale]);
  } catch (err) {
    console.error("devotion audio: clean-up failed -", err);
  }
}

/**
 * Used when the devotion is saved completely empty ("Clear All" + Save):
 * forget the audio and delete every file in the bucket.
 */
export async function removeDevotionAudio(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase.from("devotion").select("*").eq("id", 1).maybeSingle();
    if (row && "audio_url" in row) {
      await supabase.from("devotion").update({ audio_url: null, audio_hash: null }).eq("id", 1);
    }
    const { data: files } = await supabase.storage.from(AUDIO_BUCKET).list("", { limit: 200 });
    await removeObjects(
      supabase,
      (files ?? []).filter((f) => f.id).map((f) => f.name),
    );
  } catch (err) {
    console.error("devotion audio: could not remove audio -", err);
  }
}

/* ---------------------------------------------------------------------------
   Generating
--------------------------------------------------------------------------- */

export type GenerateResult =
  | { ok: true; audio: AudioInfo; skipped: boolean }
  | { ok: false; code: string; message: string; status: number };

function fail(code: string, message: string, status: number): GenerateResult {
  return { ok: false, code, message, status };
}

const TTS_HTTP_STATUS: Record<TtsErrorCode, number> = {
  missing_api_key: 503,
  missing_voice_id: 503,
  auth: 502,
  quota: 502,
  rate_limit: 429,
  voice_unavailable: 502,
  bad_request: 502,
  unavailable: 502,
  network: 504,
};

/** One generation at a time per server instance (guards against double clicks). */
let generating = false;

/**
 * Reads the SAVED devotion, makes the audio, stores it, and records it on the
 * devotion. Skips the (paid) voice-service call when the stored audio already matches
 * the text, unless `force` is set.
 */
export async function generateDevotionAudio({ force }: { force: boolean }): Promise<GenerateResult> {
  if (generating) {
    return fail("busy", "Audio is already being generated. Please wait for it to finish.", 409);
  }
  generating = true;
  try {
    return await generate(force);
  } catch (err) {
    console.error("devotion audio: unexpected error -", err);
    return fail("error", "Something went wrong while making the audio. Your text is saved. Please try again.", 500);
  } finally {
    generating = false;
  }
}

async function generate(force: boolean): Promise<GenerateResult> {
  let supabase: Supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return fail("not_configured", "The database connection isn't set up on the website yet.", 500);
  }

  const { data: row, error: readError } = await supabase
    .from("devotion")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (readError) {
    return fail("db_error", "Could not read the saved devotion. Your text is safe. Please try again.", 500);
  }
  if (!row) return fail("not_saved", "Save the devotion first, then make the audio.", 409);
  if (!("audio_url" in row)) {
    return fail(
      "db_not_ready",
      "The database doesn't have the audio columns yet. Run the SQL in supabase/add-devotion-audio.sql in Supabase, then try again.",
      500,
    );
  }

  const source = sourceFromRow(row);
  const text = buildSpokenText(source);
  if (!text) return fail("no_text", "There is no devotion text to read yet. Save some text first.", 400);

  const hash = hashSpokenText(text);
  if (!force && row.audio_url && row.audio_hash === hash) {
    return { ok: true, audio: audioInfoFor(source, { url: row.audio_url, hash: row.audio_hash }), skipped: true };
  }

  // Check the storage bucket BEFORE spending money on the voice.
  const { error: bucketError } = await supabase.storage.getBucket(AUDIO_BUCKET);
  if (bucketError) {
    return fail(
      "bucket_missing",
      `The audio storage area ("${AUDIO_BUCKET}") isn't set up yet. Run the SQL in supabase/add-devotion-audio.sql in Supabase, then try again.`,
      500,
    );
  }

  let mp3: Uint8Array;
  try {
    mp3 = await synthesizeSpeech(text);
  } catch (err) {
    if (err instanceof TtsError) return fail(err.code, err.message, TTS_HTTP_STATUS[err.code]);
    throw err;
  }

  const name = `devotion-${hash.slice(0, 12)}-${Date.now()}.mp3`;
  const bucket = supabase.storage.from(AUDIO_BUCKET);
  const { error: uploadError } = await bucket.upload(name, Buffer.from(mp3), {
    contentType: "audio/mpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) {
    console.error("devotion audio: upload failed -", uploadError.message);
    return fail("storage_error", "The audio was made but could not be saved to storage. Please try again.", 500);
  }

  const url = bucket.getPublicUrl(name).data.publicUrl;
  const { error: updateError } = await supabase
    .from("devotion")
    .update({ audio_url: url, audio_hash: hash })
    .eq("id", 1);
  if (updateError) {
    console.error("devotion audio: could not record audio -", updateError.message);
    await removeObjects(supabase, [name]);
    return fail("db_error", "The audio was made but could not be linked to the devotion. Please try again.", 500);
  }

  await cleanUpOldFiles(supabase, name, row.audio_url);

  // Re-read: the text may have been edited while the audio was being made.
  const { data: latest } = await supabase.from("devotion").select("*").eq("id", 1).maybeSingle();
  const audio = audioInfoFor(latest ? sourceFromRow(latest) : source, { url, hash });
  return { ok: true, audio, skipped: false };
}
