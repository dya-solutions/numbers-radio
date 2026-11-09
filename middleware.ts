import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, UNAUTHORIZED_HEADERS } from "@/lib/adminAuth";

/**
 * Protects every page under /admin with a simple username + password box.
 * The username and password come from the ADMIN_USERNAME / ADMIN_PASSWORD
 * environment variables.
 */
export const config = {
  matcher: ["/admin/:path*", "/admin"],
};

export function middleware(req: NextRequest) {
  // If no password is configured, keep the page locked rather than open.
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return new NextResponse(
      "The admin area is not configured yet. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
      { status: 503 },
    );
  }

  if (isAdminAuthorized(req.headers.get("authorization"))) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: UNAUTHORIZED_HEADERS,
  });
}
