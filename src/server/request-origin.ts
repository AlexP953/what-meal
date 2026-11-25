import "server-only";
import { apiError } from "@/server/http-errors";

export function applicationOrigin(request?: Request): string {
  if (!request && !process.env.AUTH_URL) throw new Error("AUTH_URL is required for server authentication");
  // Next.js derives request.url's protocol from forwarded headers. Only AUTH_URL
  // establishes HTTPS authority. Without it, support direct HTTP via Host.
  const authority = request?.headers.get("host") || (request ? new URL(request.url).host : "localhost");
  const expected = new URL(process.env.AUTH_URL || `http://${authority}`);
  if (!["http:", "https:"].includes(expected.protocol) || expected.username || expected.password || (!process.env.AUTH_URL && (expected.pathname !== "/" || expected.search || expected.hash))) throw new Error("Invalid origin");
  return expected.origin;
}

export function checkMutationOrigin(request: Request) {
  let origin: string;
  try { origin = applicationOrigin(request); }
  catch { return apiError(403, "FORBIDDEN_ORIGIN", "Origen no permitido"); }
  const supplied = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if ((supplied !== null && supplied !== origin) || (site !== null && site !== "same-origin" && site !== "none")) {
    return apiError(403, "FORBIDDEN_ORIGIN", "Origen no permitido");
  }
}
