import { contextFromHeaders, recordEvent } from "@/lib/analytics/record";
import { RateLimiter } from "@/lib/analytics/limit";
import { MAX_BODY_BYTES, parseTrackBody } from "@/lib/analytics/validate";

/**
 * Anonymous statistics endpoint - the one place the website's own pages send
 * "someone viewed a page / is listening / clicked a link" notes to.
 *
 * It is deliberately small and one-way:
 *   - write only: it NEVER returns any data (every answer is an empty body);
 *   - tiny requests only (1 KB), strictly validated, unknown things refused;
 *   - rate limited per visitor and per network, then again in the database;
 *   - robots and crawlers are ignored;
 *   - nothing is ever recorded for /admin pages.
 * Reading the numbers back is only possible on the password-protected
 * /admin/statistics page.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per visitor: a burst of 20, then 1 event every 2 seconds. Per network (many
// people can share one office or mobile-network address): a burst of 150, then 3 a second.
const perVisitor = new RateLimiter(20, 0.5);
const perNetwork = new RateLimiter(150, 3);

const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, extra: Record<string, string> = {}) {
  return new Response(null, { status, headers: { ...NO_STORE, ...extra } });
}

/** Reads the request body, giving up as soon as it is bigger than the limit. */
async function readSmallBody(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(req: Request) {
  // A page on ANOTHER website must not be able to make visitors' browsers send events here.
  if (req.headers.get("sec-fetch-site") === "cross-site") return reply(403);

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return reply(413);

  const raw = await readSmallBody(req, MAX_BODY_BYTES);
  if (raw === null) return reply(413);

  const host = req.headers.get("host") ?? "";
  const parsed = parseTrackBody(raw, host);
  if (!parsed.ok) return reply(parsed.reason === "ignored" ? 204 : 400);

  const ctx = contextFromHeaders(req.headers);
  if (!ctx) return reply(204); // not configured: quietly do nothing
  if (ctx.bot) return reply(204); // robots are not visitors

  if (!perNetwork.allow(ctx.network) || !perVisitor.allow(ctx.visitor)) {
    return reply(429, { "Retry-After": "30" });
  }

  await recordEvent(parsed.event, ctx);
  return reply(204);
}

// Anything but POST: no, and no data either.
export function GET() {
  return reply(405, { Allow: "POST" });
}
