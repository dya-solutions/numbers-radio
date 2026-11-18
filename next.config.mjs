/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // The logo is a fixed file whose name changes whenever its content does, so
    // the resized copies can be kept for a year instead of being re-checked.
    minimumCacheTTL: 31536000,
  },

  async headers() {
    // Pictures and icons that rarely change: let browsers and the CDN keep them.
    const keepAWeek = [
      { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
    ];
    return [
      // Never cache the admin area (it is password protected and shows live data).
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      { source: "/icons/:path*", headers: keepAWeek },
      { source: "/apple-touch-icon.png", headers: keepAWeek },
      { source: "/favicon.ico", headers: keepAWeek },
    ];
  },
};

export default nextConfig;
