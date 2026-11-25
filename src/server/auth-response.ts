import "server-only";

// Auth.js' React client requires {url}, even for redirect:false and HTTP errors.
// Keep Auth.js' own CSRF processing and cookie headers before adapting its status.
export async function adaptAuthResponse(response: Response): Promise<Response> {
  let destination = response.headers.get("location");
  if (!destination && response.headers.get("content-type")?.includes("application/json")) {
    try { destination = (await response.clone().json()).url; } catch { return response; }
  }
  if (!destination) return response;
  let params: URLSearchParams;
  try { params = new URL(destination).searchParams; } catch { return response; }
  if (params.get("error") !== "CredentialsSignin") return response;
  const code = params.get("code");
  const match = code?.match(/^rate_limited_(\d+)$/);
  if (!match && code !== "persistence_unavailable") return response;
  const headers = new Headers(response.headers);
  if (match) headers.set("Retry-After", String(Math.max(1, Number(match[1]))));
  return new Response(response.body, { status: match ? 429 : 503, headers });
}
