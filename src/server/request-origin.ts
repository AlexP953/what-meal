import "server-only";
import { apiError } from "@/server/http-errors";

export function checkMutationOrigin(request: Request) {
  let origin: string;
  try { origin = new URL(process.env.AUTH_URL || request.url).origin; }
  catch { return apiError(403, "FORBIDDEN_ORIGIN", "Origen no permitido"); }
  const supplied = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if ((supplied !== null && supplied !== origin) || (site !== null && site !== "same-origin" && site !== "none")) {
    return apiError(403, "FORBIDDEN_ORIGIN", "Origen no permitido");
  }
}
