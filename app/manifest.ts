import type { MetadataRoute } from "next";

/**
 * Web app manifest - makes the site installable ("Install app" on desktop
 * Chrome/Edge, "Add to Home screen" on phones). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Numbers Christian Radio",
    short_name: "Numbers Radio",
    description:
      "Numbers Christian Radio - Every Soul Counts. Listen live, follow the program guide, and read a daily devotion.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["music", "religion"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
