import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import { dbConnect } from "@/lib/db";
import { User } from "@/app/models/User";

const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH!;
const serviceAccount = JSON.parse(fs.readFileSync(path, "utf8"));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(req: Request) {
  try {
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
      const user = await User.findById(userId);
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

    const users = await User.find({ fcmToken: { $ne: null } });
    const tokens = users.map((u) => u.fcmToken);

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
  } catch (err) {
    console.error("Error enviando notificación:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
