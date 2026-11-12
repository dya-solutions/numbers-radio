import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { isBot, parseUserAgent } from "./ua";
import type { TrackEvent } from "./validate";
import { analyticsSecret, daySalt, networkKey, visitorId } from "./visitor";

/**
 * Turns a request (or a server action) into an anonymous, recorded event.
 * SERVER ONLY. The IP address is used for two things and then forgotten:
 * the hash that makes the anonymous visitor code, and a short-lived in-memory
 * flood limit. It is never stored or logged.
 */

export interface RequestContext {
  /** Anonymous visitor code for today (hash of IP + browser details + secret daily salt). */
  visitor: string;
  /** In-memory-only code for the network, used to slow down floods. */
  network: string;
  userAgent: string;
  bot: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
}

function firstHeader(headers: Headers, name: string): string {
  return (headers.get(name) ?? "").split(",")[0].trim();
}

/** Vercel puts the real client address in these headers (and overwrites any a visitor sends). */
function clientIp(headers: Headers): string {
  return (
    firstHeader(headers, "x-vercel-forwarded-for") ||
    firstHeader(headers, "x-real-ip") ||
    firstHeader(headers, "x-forwarded-for") ||
    "unknown"
  );
}

function clean(value: string | null, max: number): string | null {
  if (!value) return null;
  let text = value;
  try {
    text = decodeURIComponent(value);
  } catch {
    /* keep it as it came */
  }
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return text || null;
}

/** Returns null when tracking can't work at all (no secret is available). */
export function contextFromHeaders(headers: Headers, now = new Date()): RequestContext | null {
  const secret = analyticsSecret();
  if (!secret) return null;

  const ip = clientIp(headers);
  const userAgent = (headers.get("user-agent") ?? "").slice(0, 512);
  const language = (headers.get("accept-language") ?? "").slice(0, 40);
  const salt = daySalt(secret, now);

  const country = (headers.get("x-vercel-ip-country") ?? "").trim().toUpperCase();

  return {
    visitor: visitorId(salt, ip, userAgent, language),
    network: networkKey(salt, ip),
    userAgent,
    bot: isBot(userAgent),
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    region: clean(headers.get("x-vercel-ip-country-region"), 80),
    city: clean(headers.get("x-vercel-ip-city"), 80),
  };
}

/** Stores one event. Resolves to true if it was stored. Never throws. */
export async function recordEvent(event: TrackEvent, ctx: RequestContext): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();

    if (event.kind === "player") {
      const { data, error } = await supabase.rpc("analytics_player_beat", {
        p_id: event.id,
        p_visitor: ctx.visitor,
        p_phase: event.phase,
        p_seconds: event.seconds,
        p_reconnects: event.reconnects,
        p_errors: event.errors,
      });
      if (error) throw new Error(error.message);
      return data === true;
    }

    const touch = event.kind === "pageview" ? event.touch : false;
    const app = event.kind === "pageview" || event.kind === "install" ? event.app : false;
    const ua = parseUserAgent(ctx.userAgent, { touch, installedApp: app });

    const args: Record<string, unknown> = {
      p_visitor: ctx.visitor,
      p_country: ctx.country,
      p_region: ctx.region,
      p_city: ctx.city,
      p_device: ua.device,
      p_browser: ua.browser,
      p_os: ua.os,
      p_is_app: app,
    };

    switch (event.kind) {
      case "pageview":
        Object.assign(args, {
          p_type: "pageview",
          p_path: event.path,
          p_referrer: event.referrer,
          p_is_returning: event.returning,
          p_is_landing: event.landing,
        });
        break;
      case "click":
        Object.assign(args, {
          p_type: event.what === "sermon" ? "sermon_click" : "prayer_click",
          p_ref_id: event.id,
        });
        break;
      case "devotion_play":
        Object.assign(args, { p_type: "devotion_play", p_ref_id: event.id, p_label: event.mode });
        break;
      case "devotion_finish":
        Object.assign(args, { p_type: "devotion_finish", p_ref_id: event.id });
        break;
      case "install":
        Object.assign(args, { p_type: "install" });
        break;
    }

    const { data, error } = await supabase.rpc("analytics_track_event", args);
    if (error) throw new Error(error.message);
    return data === true;
  } catch (err) {
    console.error("statistics: could not record an event -", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Counts a Feedback or Prayer Request form that was just saved. Only the TYPE
 * is recorded - never the name, email or message. Never throws, so a problem
 * here can never stop a visitor's message from being sent.
 */
export async function recordFormSubmission(
  type: "feedback" | "prayer",
  headers: Headers,
): Promise<void> {
  try {
    const ctx = contextFromHeaders(headers);
    if (!ctx || ctx.bot) return;
    const ua = parseUserAgent(ctx.userAgent);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("analytics_track_event", {
      p_type: "form_submit",
      p_visitor: ctx.visitor,
      p_label: type,
      p_country: ctx.country,
      p_region: ctx.region,
      p_city: ctx.city,
      p_device: ua.device,
      p_browser: ua.browser,
      p_os: ua.os,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("statistics: could not count a form submission -", err instanceof Error ? err.message : err);
  }
}
