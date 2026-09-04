import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";
import { STATION_NAME, STATION_TAGLINE, PRODUCT_FAMILY_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: `${STATION_NAME} - ${STATION_TAGLINE}`,
    template: `%s - ${STATION_NAME}`,
  },
  description:
    "Numbers Radio is a Christian radio station. Every Soul Counts. Listen live, follow the program guide, and read a daily devotion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">{children}</main>

        <footer className="border-t border-sand bg-sand/40">
          <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-ink-soft">
            <p className="m-0">
              {STATION_NAME} - {STATION_TAGLINE}
            </p>
            <p className="m-0 mt-1">
              Part of the Numbers family -{" "}
              <a href={PRODUCT_FAMILY_URL} target="_blank" rel="noreferrer">
                trynumbers.com
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
