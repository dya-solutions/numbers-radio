import { chunkText } from "./devotionSpeech";
import { joinMp3 } from "./mp3";

/**
 * Text-to-speech with OpenAI. SERVER ONLY - the API key must never reach the
 * browser, so it is read from OPENAI_API_KEY (not NEXT_PUBLIC_).
 *
 * NOTE: OpenAI has announced that gpt-4o-mini-tts is removed from its API on
 * 6 January 2027. Everything that talks to OpenAI is in this one file, so
 * switching to another voice service later only means changing synthesizeChunk.
 */

export const TTS_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_VOICE = "cedar";

/** Voice names gpt-4o-mini-tts accepts. "marin" and "cedar" are OpenAI's best. */
export const AVAILABLE_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const TTS_INSTRUCTIONS =
  "Read this as a warm, calm, reverent devotional, the way a gentle and sincere " +
  "pastor would speak to a listener at the start of their day. Use a peaceful, " +
  "comforting tone with an unhurried, steady pace. Pause naturally between " +
  "sentences and a little longer between sections. Say Bible book names and " +
  "verse numbers clearly. Speak the closing prayer softly and sincerely.";

/** OpenAI accepts at most 2000 tokens per request; 3000 characters is well under that. */
const MAX_CHARS_PER_REQUEST = 3000;
const REQUEST_TIMEOUT_MS = 120_000;
const PARALLEL_REQUESTS = 3;
const MAX_RETRIES = 2;

export type TtsErrorCode =
  | "missing_api_key"
  | "auth"
  | "quota"
  | "rate_limit"
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

export function configuredVoice(): string {
  return (process.env.DEVOTION_VOICE ?? "").trim().toLowerCase() || DEFAULT_VOICE;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface OpenAiErrorBody {
  error?: { message?: string; code?: string; type?: string };
}

async function readError(res: Response): Promise<{ message: string; code: string }> {
  try {
    const body = (await res.json()) as OpenAiErrorBody;
    return { message: body.error?.message ?? "", code: body.error?.code ?? "" };
  } catch {
    return { message: "", code: "" };
  }
}

/** Reads one piece of text aloud and returns an MP3. */
async function synthesizeChunk(text: string, apiKey: string, voice: string): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice,
          input: text,
          instructions: TTS_INSTRUCTIONS,
          response_format: "mp3",
        }),
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
        "Could not reach OpenAI (the request failed or timed out). Please try again in a moment.",
      );
    }

    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 100) {
        throw new TtsError("unavailable", "OpenAI returned an empty audio file. Please try again.");
      }
      return bytes;
    }

    const { message, code } = await readError(res);

    if (res.status === 401 || res.status === 403) {
      throw new TtsError(
        "auth",
        "OpenAI did not accept the API key. Check that OPENAI_API_KEY is correct and still active.",
      );
    }

    if (res.status === 429 && /quota|billing/i.test(`${code} ${message}`)) {
      throw new TtsError(
        "quota",
        "The OpenAI account is out of credit. Add credit or billing on the OpenAI account, then try again.",
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
          ? "OpenAI is receiving too many requests right now. Wait a minute and try again."
          : "OpenAI had a temporary problem. Please try again in a moment.",
      );
    }

    // The text turned out too long for one request: read it in two halves.
    if (res.status === 400 && /maximum input|input limit|too long|too many tokens/i.test(message) && text.length > 400) {
      const halves = chunkText(text, Math.ceil(text.length / 2) + 50);
      if (halves.length > 1) {
        return joinMp3(await Promise.all(halves.map((half) => synthesizeChunk(half, apiKey, voice))));
      }
    }

    if (res.status === 404 || /model/i.test(code)) {
      throw new TtsError(
        "unavailable",
        `OpenAI says the voice model (${TTS_MODEL}) is not available. OpenAI is retiring it on 6 January 2027.`,
      );
    }

    throw new TtsError(
      "bad_request",
      `OpenAI could not read the text${message ? `: ${message}` : "."} (If this mentions the voice, check DEVOTION_VOICE.)`,
    );
  }
}

/** Runs `worker` over `items` a few at a time, keeping the order of the results. */
async function mapPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

/**
 * Turns text of any length into ONE MP3. Long text is split at sentence
 * boundaries into pieces under OpenAI's per-request limit, and the pieces are
 * joined back together in order.
 */
export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new TtsError(
      "missing_api_key",
      "Audio can't be made yet because the OpenAI API key (OPENAI_API_KEY) has not been added to the website's settings.",
    );
  }

  const voice = configuredVoice();
  const pieces = chunkText(text, MAX_CHARS_PER_REQUEST);
  if (pieces.length === 0) throw new TtsError("bad_request", "There is no text to read.");

  const audio = await mapPool(pieces, PARALLEL_REQUESTS, (piece) =>
    synthesizeChunk(piece, apiKey, voice),
  );
  return joinMp3(audio);
}
