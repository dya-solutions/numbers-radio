/**
 * The admin password check, shared by middleware.ts and by any admin API
 * route that costs money or changes data. Routes check it again themselves, so
 * they stay locked even if the middleware matcher is ever changed by mistake.
 *
 * Uses only Web APIs (it also runs in the middleware runtime).
 */

/** Same-length-agnostic comparison that does not stop at the first difference. */
function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** True when the Authorization header carries the correct username + password. */
export function isAdminAuthorized(authorization: string | null): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  if (!authorization?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    const binary = atob(authorization.slice(6));
    // Browsers send the credentials as UTF-8 bytes.
    decoded = new TextDecoder().decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
  } catch {
    return false;
  }

  const index = decoded.indexOf(":");
  if (index < 0) return false;
  const user = decoded.slice(0, index);
  const pass = decoded.slice(index + 1);

  // Evaluate both so timing does not reveal which one was wrong.
  const userOk = safeEqual(user, expectedUser);
  const passOk = safeEqual(pass, expectedPass);
  return userOk && passOk;
}

const UNAUTHORIZED_HEADERS = {
  "WWW-Authenticate": 'Basic realm="Numbers Radio Admin", charset="UTF-8"',
};

/**
 * Guard for admin API routes. Returns a Response to send back when the request
 * must be refused, or null when it may go ahead. Besides the password it
 * requires a custom header and a same-origin request, so another website
 * cannot make an already-signed-in admin's browser trigger the call.
 */
export function guardAdminApi(req: Request): Response | null {
  if (!isAdminAuthorized(req.headers.get("authorization"))) {
    return new Response("Authentication required.", {
      status: 401,
      headers: UNAUTHORIZED_HEADERS,
    });
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (
    req.headers.get("x-requested-with") !== "numbers-admin" ||
    (fetchSite && fetchSite !== "same-origin")
  ) {
    return Response.json(
      { ok: false, code: "forbidden", message: "This request is not allowed." },
      { status: 403 },
    );
  }

  return null;
}

export { UNAUTHORIZED_HEADERS };
