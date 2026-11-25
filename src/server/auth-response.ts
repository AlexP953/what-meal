import "server-only";

export type LoginFailure = { status: 429; retryAfter: number } | { status: 503 };

// Auth.js' React client requires {url}, even for redirect:false and HTTP errors.
export function adaptAuthResponse(response: Response, failure?: LoginFailure): Response {
  if (!failure) return response;
  const headers = new Headers(response.headers);
  if (failure.status === 429) headers.set("Retry-After", String(failure.retryAfter));
  return new Response(response.body, { status: failure.status, headers });
}

export function withoutSessionCookie(response: Response): Response {
  const cookies = response.headers.getSetCookie();
  const retained = cookies.filter(cookie => !/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/.test(cookie));
  if (retained.length === cookies.length) return response;
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of retained) headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
