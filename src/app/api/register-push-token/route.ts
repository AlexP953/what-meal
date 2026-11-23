import { notificationsEnabled } from "@/shared/config";
import { notificationsDisabled } from "@/server/notifications/disabled";
export async function POST(req: Request) {
  if (!notificationsEnabled) return notificationsDisabled();
  await req.json();
  return new Response("Token registrado", { status: 200 });
}
