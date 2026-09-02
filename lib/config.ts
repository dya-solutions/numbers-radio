/**
 * Central place for small pieces of site configuration.
 * Values that start with NEXT_PUBLIC_ are safe to use in the browser.
 */

export const STATION_NAME = "Numbers Radio";
export const STATION_TAGLINE = "Every Soul Counts";
export const PRODUCT_FAMILY_URL = "https://trynumbers.com";

export const STREAM_URL =
  process.env.NEXT_PUBLIC_STREAM_URL ??
  "https://example-stream.azuracast.com/listen/numbers_radio/radio.mp3";

export const AZURACAST_BASE_URL =
  process.env.NEXT_PUBLIC_AZURACAST_BASE_URL ?? "https://your-station.azuracast.com";

export const AZURACAST_STATION_ID =
  process.env.NEXT_PUBLIC_AZURACAST_STATION_ID ?? "1";
