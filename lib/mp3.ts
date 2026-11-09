/**
 * Joining several MP3 files into one.
 *
 * MP3 is a stream of independent frames, so files can be glued end to end.
 * Two things must be removed first or players misreport the length / glitch:
 *   - tags at the start (ID3v2) and end (ID3v1) of each piece, and
 *   - the "Xing"/"Info" header frame many encoders put first, which holds the
 *     length of THAT piece only (players would stop the joined file early).
 * No imports - pure byte handling.
 */

const BITRATES_MPEG1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_MPEG2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], //  MPEG 2.5
};

interface FrameInfo {
  length: number;
  /** Where "Xing"/"Info" would sit inside this frame. */
  xingOffset: number;
}

/** Reads a Layer III frame header at `offset`; null if it is not one. */
function readFrame(bytes: Uint8Array, offset: number): FrameInfo | null {
  if (offset + 4 > bytes.length) return null;
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const b3 = bytes[offset + 3];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const version = (b1 >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layer = (b1 >> 1) & 3; //   1 = Layer III
  const hasCrc = (b1 & 1) === 0;
  const bitrateIndex = b2 >> 4;
  const rateIndex = (b2 >> 2) & 3;
  const padding = (b2 >> 1) & 1;
  const mono = (b3 >> 6) === 3;

  if (version === 1 || layer !== 1) return null;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;

  const mpeg1 = version === 3;
  const bitrate = (mpeg1 ? BITRATES_MPEG1_L3 : BITRATES_MPEG2_L3)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const length = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;

  return { length, xingOffset: 4 + (hasCrc ? 2 : 0) + sideInfo };
}

function startsWith(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Index of the first real audio frame (after any ID3v2 tag / junk). */
function firstFrameOffset(bytes: Uint8Array): number {
  let offset = 0;
  if (startsWith(bytes, 0, "ID3") && bytes.length >= 10) {
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    const footer = (bytes[5] & 0x10) !== 0 ? 10 : 0;
    offset = 10 + size + footer;
  }
  // Skip padding/junk until a header that is followed by a second valid one.
  for (let i = offset; i + 4 <= bytes.length; i++) {
    const frame = readFrame(bytes, i);
    if (!frame) continue;
    const next = i + frame.length;
    if (next >= bytes.length || readFrame(bytes, next)) return i;
  }
  return bytes.length;
}

/** Removes leading tags + a Xing/Info frame, and a trailing ID3v1 tag. */
function stripMetadata(bytes: Uint8Array): Uint8Array {
  let start = firstFrameOffset(bytes);
  let end = bytes.length;

  const first = readFrame(bytes, start);
  if (
    first &&
    (startsWith(bytes, start + first.xingOffset, "Xing") ||
      startsWith(bytes, start + first.xingOffset, "Info") ||
      startsWith(bytes, start + 36, "VBRI"))
  ) {
    start += first.length;
  }

  if (end - start >= 128 && startsWith(bytes, end - 128, "TAG")) end -= 128;
  return bytes.subarray(start, end);
}

/** One MP3 made from several. A single piece is returned untouched. */
export function joinMp3(pieces: Uint8Array[]): Uint8Array {
  if (pieces.length === 1) return pieces[0];

  const cleaned = pieces.map(stripMetadata);
  const out = new Uint8Array(cleaned.reduce((sum, p) => sum + p.length, 0));
  let position = 0;
  for (const piece of cleaned) {
    out.set(piece, position);
    position += piece.length;
  }
  return out;
}
