import { NextRequest, NextResponse } from "next/server";

/**
 * Protects every page under /admin with a simple username + password box.
 * The username and password come from the ADMIN_USERNAME / ADMIN_PASSWORD
 * environment variables.
 */
export const config = {
  matcher: ["/admin/:path*", "/admin"],
};

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  // If no password is configured, keep the page locked rather than open.
  if (!expectedUser || !expectedPass) {
    return new NextResponse(
      "The admin area is not configured yet. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
      { status: 503 },
    );
  }

  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const index = decoded.indexOf(":");
    const user = decoded.slice(0, index);
    const pass = decoded.slice(index + 1);

    if (user === expectedUser && pass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Numbers Radio Admin", charset="UTF-8"',
    },
  });
}
