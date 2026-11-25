import "server-only";

export function notificationsDisabled() {
  return Response.json({ code: "NOTIFICATIONS_DISABLED" }, { status: 503 });
}
