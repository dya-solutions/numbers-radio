/**
 * Everything about turning a devotion into something that can be read aloud.
 *
 * This file has no server-only or browser-only code, so the SAME text is used
 * by the server (to make the AI audio and fingerprint it) and by the browser
 * (for the built-in voice fallback). Keep it free of imports.
 */

export interface SpeechSource {
  title: string;
  sourceLine: string;
  scriptureReference: string;
  scriptureText: string;
  body: string;
  furtherStudy: string;
  goldenNugget: string;
  prayer: string;
}

/** How the saved audio relates to the saved text. */
export type AudioStatus = "none" | "ready" | "outdated";

export interface AudioInfo {
  status: AudioStatus;
  /** Public MP3 address (only when status is "ready"). */
  url: string | null;
  /** Same file, set up so the browser downloads it instead of playing it. */
  downloadUrl: string | null;
}

/* ---------------------------------------------------------------------------
   Small helpers
--------------------------------------------------------------------------- */

const ENDS_LIKE_A_SENTENCE = /[.!?…]["'”’)\]]*$/;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").trim();
}

/** One line of text that always ends with punctuation, so the voice pauses. */
function sentence(value: string | null | undefined): string {
  const text = clean(value).replace(/\s+/g, " ");
  if (!text) return "";
  return ENDS_LIKE_A_SENTENCE.test(text) ? text : `${text}.`;
}

/** Paragraphs are separated by blank lines; single line breaks become spaces. */
function paragraphs(value: string | null | undefined): string[] {
  return clean(value)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

/**
 * "Isaiah 43:1" -> "Isaiah 43, verse 1"; "Psalm 139:1-18" -> "Psalm 139,
 * verses 1 to 18". Voices read the written form clumsily ("forty-three
 * colon one"), so references are spelled out the way a person would say them.
 */
export function speakScriptureReferences(text: string): string {
  return text.replace(
    /(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3})(?::(\d{1,3}))?)?/g,
    (_match, chapter: string, verse: string, end?: string, endVerse?: string) => {
      if (end && endVerse) {
        return `${chapter}, verse ${verse} through ${end}, verse ${endVerse}`;
      }
      if (end) return `${chapter}, verses ${verse} to ${end}`;
      return `${chapter}, verse ${verse}`;
    },
  );
}

/* ---------------------------------------------------------------------------
   The text that is read aloud
--------------------------------------------------------------------------- */

/**
 * In this order, skipping any empty section together with its label:
 *   "Today's devotion: <title>."  source line  scripture reference + verse
 *   body  "Further study:" ...  "Golden nugget:" ...  "Let us pray." prayer
 * The date is never read.
 */
export function buildSpokenText(d: SpeechSource): string {
  const parts: string[] = [];

  const title = sentence(d.title);
  if (title) parts.push(`Today's devotion: ${title}`);

  const source = sentence(d.sourceLine);
  if (source) parts.push(source);

  const reference = sentence(speakScriptureReferences(clean(d.scriptureReference)));
  const verse = sentence(d.scriptureText);
  const scripture = [reference, verse].filter(Boolean).join(" ");
  if (scripture) parts.push(scripture);

  const body = paragraphs(d.body);
  if (body.length) parts.push(body.join("\n\n"));

  const study = clean(d.furtherStudy)
    .split("\n")
    .map((line) => sentence(speakScriptureReferences(line)))
    .filter(Boolean);
  if (study.length) parts.push(`Further study:\n${study.join("\n")}`);

  const nugget = sentence(d.goldenNugget);
  if (nugget) parts.push(`Golden nugget: ${nugget}`);

  const prayer = paragraphs(d.prayer);
  if (prayer.length) parts.push(`Let us pray.\n${prayer.join("\n\n")}`);

  return parts.join("\n\n");
}

/** True when there is nothing to read (every section is empty). */
export function hasSpokenContent(d: SpeechSource): boolean {
  return buildSpokenText(d).length > 0;
}

/* ---------------------------------------------------------------------------
   Splitting long text
--------------------------------------------------------------------------- */

function splitSentences(paragraph: string): string[] {
  const found = paragraph.match(
    /[\s\S]+?[.!?…]+["'”’)\]]*(?=\s|$)|[\s\S]+$/g,
  );
  return (found ?? []).map((s) => s.trim()).filter(Boolean);
}

/** A single sentence longer than `max`: break it between words. */
function splitLongSentence(sentenceText: string, max: number): string[] {
  if (sentenceText.length <= max) return [sentenceText];
  const pieces: string[] = [];
  let current = "";
  for (const word of sentenceText.split(/\s+/)) {
    if (word.length > max) {
      if (current) pieces.push(current);
      current = "";
      for (let i = 0; i < word.length; i += max) pieces.push(word.slice(i, i + max));
      continue;
    }
    if (current && current.length + 1 + word.length > max) {
      pieces.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Splits text into pieces of at most `maxChars`, only ever breaking between
 * sentences (or, for a monster sentence, between words). Paragraph breaks are
 * kept inside a piece where they fit. Used for the AI voice (large pieces) and
 * the browser voice (sentence-sized pieces).
 */
export function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of clean(text).split(/\n{2,}/)) {
    let firstInParagraph = true;
    for (const sentenceText of splitSentences(paragraph)) {
      for (const piece of splitLongSentence(sentenceText.replace(/\s*\n\s*/g, " "), maxChars)) {
        const separator = current === "" ? "" : firstInParagraph ? "\n\n" : " ";
        if (current !== "" && current.length + separator.length + piece.length > maxChars) {
          flush();
          current = piece;
        } else {
          current += separator + piece;
        }
        firstInParagraph = false;
      }
    }
  }
  flush();
  return chunks;
}
