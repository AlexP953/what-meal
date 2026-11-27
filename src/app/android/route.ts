import { requireSession } from "@/lib/authz";

export async function GET() {
  const { error } = await requireSession();
  const headers = new Headers({ "Cache-Control": "private, no-store" });

  if (error && error.status !== 401) {
    return new Response(null, { status: 503, headers });
  }

  headers.set("Location", error ? "/login" : "/meals");
  return new Response(null, { status: 307, headers });
}
