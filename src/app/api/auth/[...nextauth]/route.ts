import type { NextRequest } from "next/server";
import { POST as authPost } from "@/lib/auth";
import { adaptAuthResponse } from "@/server/auth-response";
export { GET } from "@/lib/auth";

export async function POST(request: NextRequest) {
  return adaptAuthResponse(await authPost(request));
}
