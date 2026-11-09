import { chunkText } from "./devotionSpeech";
import { joinMp3 } from "./mp3";

/**
 * Text-to-speech with ElevenLabs. SERVER ONLY - the API key must never reach
 * the browser, so it is read from ELEVENLABS_API_KEY (not NEXT_PUBLIC_), and
 * the voice from DEVOTION_VOICE_ID.
 *
 * Everything that talks to the voice service is in this one file, so switching
 * to another service later only means changing synthesizeChunk.
 */

/**
 * ElevenLabs' own docs call Multilingual v2 the "most stable on long-form
 * generations" (10,000 characters per request). Their newer eleven_v4 is more
 * expressive; to try it, change this one line and press "Regenerate audio".
 */
export const TTS_MODEL = "eleven_multilingual_v2";

/** MP3, 44.1 kHz, 128 kbps - available on every ElevenLabs plan. */
export const OUTPUT_FORMAT = "mp3_44100_128";

/**
 * A calm, unhurried devotional delivery. (ElevenLabs has no free-text "tone
 * instructions"; the delivery comes from the voice plus these settings.)
 * - stability 0.6: a little steadier than the default 0.5, so the reading stays
 *   even and peaceful instead of swinging between moods.
 * - similarity_boost 0.75: ElevenLabs' default (stays close to the chosen voice).
 * - style 0: no added exaggeration (higher values sound theatrical and less stable).
 * - speed 0.95: a touch slower than normal (allowed range is 0.7 to 1.2).
 */
export const VOICE_SETTINGS = {
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 0.95,
} as const;

/**
 * The model accepts up to 10,000 characters per request. 4,000 keeps each
 * request quick and the voice consistent; longer devotions are split at
 * sentence boundaries and joined back into one MP3.
 */
const MAX_CHARS_PER_REQUEST = 4000;
/** How much neighbouring text is sent along so the voice flows across a split. */
const CONTEXT_CHARS = 400;
const REQUEST_TIMEOUT_MS = 120_000;
/** Plans allow only a few requests at once (the smallest allows 2). */
const PARALLEL_REQUESTS = 2;
const MAX_RETRIES = 2;

export type TtsErrorCode =
  | "missing_api_key"
  | "missing_voice_id"
  | "auth"
  | "quota"
  | "rate_limit"
  | "voice_unavailable"
  | "bad_request"
  | "unavailable"
  | "network";

export class TtsError extends Error {
  constructor(
    public code: TtsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TtsError";
  }
}

/** The voice to read with. There is deliberately no default: voices differ per account. */
export function configuredVoiceId(): string {
  return (process.env.DEVOTION_VOICE_ID ?? "").trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ApiProblem {
  message: string;
  code: string;
}

/**
 * ElevenLabs reports problems as { detail: { code, status, message } }, or for
 * validation errors { detail: [ { loc, msg, type } ] }. Handle both, and
 * anything else, without ever throwing.
 */
async function readProblem(res: Response): Promise<ApiProblem> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    const detail = body?.detail;
    if (typeof detail === "string") return { message: detail, code: "" };
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: unknown } | undefined;
      return { message: typeof first?.msg === "string" ? first.msg : "", code: "validation_error" };
    }
    if (detail && typeof detail === "object") {
      const d = detail as { code?: unknown; status?: unknown; message?: unknown };
      const code = typeof d.code === "string" ? d.code : typeof d.status === "string" ? d.status : "";
      return { message: typeof d.message === "string" ? d.message : "", code };
    }
  } catch {
    // not JSON
  }
  return { message: "", code: "" };
}

interface Neighbours {
  previous?: string;
  next?: string;
}

/** Reads one piece of text aloud and returns an MP3. */
async function synthesizeChunk(
  text: string,
  around: Neighbours,
  apiKey: string,
  voiceId: string,
): Promise<Uint8Array> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`;
  const payload = JSON.stringify({
    text,
    model_id: TTS_MODEL,
    voice_settings: VOICE_SETTINGS,
    ...(around.previous ? { previous_text: around.previous } : {}),
    ...(around.next ? { next_text: around.next } : {}),
  });

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: payload,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt * 2 + 1));
        continue;
      }
      throw new TtsError(
        "network",
        "Could not reach ElevenLabs (the request failed or timed out). Please try again in a moment.",
      );
    }

    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 100) {
        throw new TtsError("unavailable", "ElevenLabs returned an empty audio file. Please try again.");
      }
      return bytes;
    }

    const { message, code } = await readProblem(res);
    const both = `${code} ${message}`;
    const said = message ? ` ElevenLabs says: "${message}"` : "";

    // Out of credit (ElevenLabs uses 402, and sometimes other statuses with a quota code).
    if (res.status === 402 || /quota|credit/i.test(both)) {
      throw new TtsError(
        "quota",
        `The ElevenLabs account has run out of credits for this month. Add credits or upgrade the plan on elevenlabs.io, then try again.${said}`,
      );
    }

    if (res.status === 401 || (res.status === 403 && !/voice|subscription|feature/i.test(code))) {
      throw new TtsError(
        "auth",
        `ElevenLabs did not accept the API key. Check that ELEVENLABS_API_KEY is correct, still active, and allowed to use text to speech.${said}`,
      );
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt * 2 + 1));
        continue;
      }
      throw new TtsError(
        res.status === 429 ? "rate_limit" : "unavailable",
        res.status === 429
          ? "ElevenLabs is receiving too many requests right now (or too many at once on this plan). Wait a minute and try again."
          : "ElevenLabs had a temporary problem. Please try again in a moment.",
      );
    }

    // The text turned out too long for one request: read it in two halves.
    if (/text_too_long|too long|exceeds.*(character|limit)/i.test(both) && text.length > 400) {
      const halves = chunkText(text, Math.ceil(text.length / 2) + 50);
      if (halves.length > 1) {
        const parts: Uint8Array[] = [];
        for (let i = 0; i < halves.length; i++) {
          parts.push(
            await synthesizeChunk(
              halves[i],
              {
                previous: i === 0 ? around.previous : halves[i - 1].slice(-CONTEXT_CHARS),
                next: i === halves.length - 1 ? around.next : halves[i + 1].slice(0, CONTEXT_CHARS),
              },
              apiKey,
              voiceId,
            ),
          );
        }
        return joinMp3(parts);
      }
    }

    // Unknown voice, a voice this account may not use, or a library voice on a free plan.
    if ((res.status === 404 || res.status === 403 || /voice/i.test(both)) && !/settings/i.test(code)) {
      if (/model/i.test(code)) {
        throw new TtsError(
          "unavailable",
          `ElevenLabs says the voice model (${TTS_MODEL}) is not available to this account.${said}`,
        );
      }
      throw new TtsError(
        "voice_unavailable",
        `ElevenLabs would not use that voice. Check that DEVOTION_VOICE_ID is a voice in your ElevenLabs account (voices from the public Voice Library need a paid plan to be used through the API).${said}`,
      );
    }

    if (/model/i.test(code)) {
      throw new TtsError(
        "unavailable",
        `ElevenLabs says the voice model (${TTS_MODEL}) is not available to this account.${said}`,
      );
    }

    throw new TtsError("bad_request", `ElevenLabs could not read the text.${said}`);
  }
}

/** Runs `worker` over `items` a few at a time, keeping the order of the results. */
async function mapPool<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

/**
 * Turns text of any length into ONE MP3. Long text is split at sentence
 * boundaries into pieces under the per-request limit, each piece is told what
 * comes before and after it (so the voice flows), and the pieces are joined
 * back together in order.
 */
export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  const apiKey = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new TtsError(
      "missing_api_key",
      "Audio can't be made yet because the ElevenLabs API key (ELEVENLABS_API_KEY) has not been added to the website's settings.",
    );
  }

  const voiceId = configuredVoiceId();
  if (!voiceId) {
    throw new TtsError(
      "missing_voice_id",
      "Audio can't be made yet because the voice (DEVOTION_VOICE_ID) has not been added to the website's settings.",
    );
  }
  // Voice IDs are letters and digits. Refuse anything else before it goes into a web address.
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(voiceId)) {
    throw new TtsError(
      "voice_unavailable",
      "DEVOTION_VOICE_ID doesn't look like an ElevenLabs voice ID. Copy it from your voice in ElevenLabs (My Voices > Copy voice ID).",
    );
  }

  const pieces = chunkText(text, MAX_CHARS_PER_REQUEST);
  if (pieces.length === 0) throw new TtsError("bad_request", "There is no text to read.");

  const audio = await mapPool(pieces, PARALLEL_REQUESTS, (piece, i) =>
    synthesizeChunk(
      piece,
      {
        previous: i > 0 ? pieces[i - 1].slice(-CONTEXT_CHARS) : undefined,
        next: i < pieces.length - 1 ? pieces[i + 1].slice(0, CONTEXT_CHARS) : undefined,
      },
      apiKey,
      voiceId,
    ),
  );
  return joinMp3(audio);
}
