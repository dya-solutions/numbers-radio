import { NextRequest, NextResponse } from "next/server";

/**
 * Looks up the title of an external page for the Prayer Points editor.
 *
 * Lives under /admin so the existing password (middleware.ts) protects it.
 * It reads the target page's <title> or Open Graph "og:title" and returns
 * { title }. On any problem it returns { error } with a friendly message and
 * a 200 status, so the editor can quietly fall back to a typed title.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024; // the <head> is always near the top of the file

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url")?.trim();

  if (!target) {
    return NextResponse.json({ error: "No link provided." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json(
      { error: "That does not look like a valid link." },
      { status: 400 },
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only http and https links are supported." },
      { status: 400 },
    );
  }

  // Best-effort block of local / internal addresses.
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return NextResponse.json({ error: "That link cannot be reached." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; NumbersRadioBot/1.0; +https://trynumbers.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `The page returned an error (${res.status}).` },
        { status: 200 },
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("html")) {
      return NextResponse.json(
        { error: "That link is not a web page." },
        { status: 200 },
      );
    }

    const html = await readHead(res);
    const title = extractTitle(html);

    if (!title) {
      return NextResponse.json(
        { error: "Could not find a title on that page." },
        { status: 200 },
      );
    }

    return NextResponse.json({ title });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted
          ? "The page took too long to respond."
          : "Could not reach that link.",
      },
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the response body only up to </head> (or a hard byte cap). */
async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const decoder = new TextDecoder();
  let html = "";
  let received = 0;

  try {
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return html;
}

function extractTitle(html: string): string {
  const og =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i,
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i,
    );
  if (og?.[1]?.trim()) {
    return clean(og[1]);
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]?.trim()) {
    return clean(title[1]);
  }

  return "";
}

function clean(raw: string): string {
  return decodeEntities(raw).replace(/\s+/g, " ").trim().slice(0, 300);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)));
}

function safeCodePoint(n: number): string {
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}
