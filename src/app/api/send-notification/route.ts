import { notificationsEnabled } from "@/shared/config";
import { notificationsDisabled } from "@/server/notifications/disabled";

export async function POST(req: Request) {
  if (!notificationsEnabled) return notificationsDisabled();
  const { POST: send } = await import("@/server/notifications/send");
  return send(req);
}
