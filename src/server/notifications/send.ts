import "server-only";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";

export async function POST(req: Request) {
  try {
    if (!getApps().length) {
      const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (!credentials) throw new Error("Missing Firebase configuration");
      initializeApp({ credential: cert(JSON.parse(credentials)) });
    }
    const { userId, token, title, body } = await req.json();

    const notifTitle = title || "Notificación desde What Meal";
    const notifBody = body || "¡Hora de registrar tu comida! 🍽️";

    await dbConnect();

    const messaging = getMessaging();

    if (token) {
      const message = {
        token,
        notification: { title: notifTitle, body: notifBody },
        webpush: {
          notification: {
            icon: "/icon.png",
            vibrate: [100, 50, 100],
            actions: [{ action: "open_app", title: "Abrir" }],
          },
        },
      };

      const response = await messaging.send(message);
      return Response.json({ success: true, type: "single-token", id: response });
    }

    if (userId) {
      const user = await User.findById(userId).select("+fcmToken");
      if (!user?.fcmToken) {
        return Response.json(
          { success: false, error: "Usuario sin token o no encontrado" },
          { status: 404 }
        );
      }

      const message = {
        token: user.fcmToken,
        notification: { title: notifTitle, body: notifBody },
        webpush: {
          notification: {
            icon: "/icon.png",
            vibrate: [100, 50, 100],
            actions: [{ action: "open_app", title: "Abrir" }],
          },
        },
      };

      const response = await messaging.send(message);
      return Response.json({ success: true, type: "single-user", id: response });
    }

    const users = await User.find({ fcmToken: { $ne: null } }).select("+fcmToken");
    const tokens = users.map((u) => u.fcmToken).filter((token): token is string => typeof token === "string" && token.length > 0);

    if (tokens.length === 0) {
      return Response.json(
        { success: false, error: "No hay tokens registrados" },
        { status: 404 }
      );
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: notifTitle, body: notifBody },
      webpush: {
        notification: {
          icon: "/icon.png",
          vibrate: [100, 50, 100],
          actions: [{ action: "open_app", title: "Abrir" }],
        },
      },
    });

    return Response.json({
      success: true,
      type: "broadcast",
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch {
    return Response.json({ success: false, error: "Notification failed" }, { status: 500 });
  }
}
