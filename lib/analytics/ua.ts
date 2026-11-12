/**
 * Reads a browser's "User-Agent" text into three plain labels (device type,
 * browser, operating system) and spots robots. Nothing else is kept from it -
 * the raw text is never stored.
 *
 * Pure functions with no imports, so they are easy to test.
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface UaInfo {
  device: DeviceType;
  browser: string;
  os: string;
}

/**
 * Known robots, crawlers, link-preview fetchers, uptime monitors and scripts.
 * ("bot" is matched as a whole word so phone brands such as "CUBOT" are not.)
 */
const BOT_PATTERN =
  /(?:bot\b|bot[\/;)]|spider|crawl|slurp|mediapartners|facebookexternalhit|embedly|link ?preview|headless|phantomjs|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|statuscake|datadog|newrelic|curl\/|wget|python-requests|python-urllib|aiohttp|httpclient|http-client|java\/|okhttp|go-http-client|node-fetch|axios|libwww|scrapy|postman|insomnia|vercel-screenshot|vercel-favicon|google-read-aloud|bingpreview|yandex|baidu|ahrefs|semrush|mj12|petalbot|bytespider|ccbot|perplexity|applebot|whatsapp\/|slackbot|twitterbot|linkedinbot|pinterest|discordbot|telegrambot)/i;

/** True for robots - or when there is no User-Agent at all (real browsers always send one). */
export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 12) return true;
  return BOT_PATTERN.test(ua);
}

/**
 * `touch` is true when the browser says it has a touch screen. It tells an
 * iPad that asks for "desktop sites" (which says it is a Mac) from a real Mac.
 * `installedApp` is true when the site was opened as an installed app.
 */
export function parseUserAgent(
  ua: string,
  { touch = false, installedApp = false }: { touch?: boolean; installedApp?: boolean } = {},
): UaInfo {
  const s = ua ?? "";

  // ---- operating system ----
  let os = "Other";
  if (/Windows Phone/i.test(s)) os = "Windows Phone";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/iPhone|iPod|iPad/i.test(s)) os = "iOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/CrOS/i.test(s)) os = "ChromeOS";
  else if (/Macintosh|Mac OS X/i.test(s)) os = touch ? "iOS" : "macOS";
  else if (/Linux|X11/i.test(s)) os = "Linux";

  // ---- device type ----
  let device: DeviceType = "desktop";
  if (/iPad|Tablet|PlayBook|Silk\//i.test(s)) device = "tablet";
  else if (os === "Android" && !/Mobile/i.test(s)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Windows Phone/i.test(s)) device = "mobile";
  else if (os === "iOS") device = "tablet"; // iPad pretending to be a Mac

  // ---- browser ----
  let browser = "Other";
  if (/FBAN|FBAV|FB_IAB/i.test(s)) browser = "Facebook app";
  else if (/Instagram/i.test(s)) browser = "Instagram app";
  else if (/TikTok|musical_ly|BytedanceWebview/i.test(s)) browser = "TikTok app";
  else if (/Edg(?:e|A|iOS)?\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera|OPT\//.test(s)) browser = "Opera";
  else if (/SamsungBrowser/i.test(s)) browser = "Samsung Internet";
  else if (/UCBrowser/i.test(s)) browser = "UC Browser";
  else if (/Firefox\/|FxiOS/i.test(s)) browser = "Firefox";
  else if (/Chrome\/|CriOS|Chromium/i.test(s)) browser = "Chrome";
  else if (/MSIE |Trident\//.test(s)) browser = "Internet Explorer";
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = "Safari";
  else if (os === "iOS") {
    // iPhone/iPad web views have no "Safari/" word. An installed home-screen
    // app is Safari under the hood; anything else is another app's browser.
    browser = installedApp ? "Safari" : "In-app browser";
  }

  return { device, browser, os };
}
