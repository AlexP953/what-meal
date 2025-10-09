"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { messaging, getToken, onMessage } from "@/lib/firebase";

export default function EnableNotifications({
  onDone,
}: {
  onDone?: () => void;
}) {
  const { data: session, status } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔹 Verifica si el usuario ya tiene token guardado
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    async function checkToken() {
      try {
        const res = await fetch(`/api/users/${session.user.id}`);
        const data = await res.json();
        const tokens = data?.user?.fcmTokens || data?.user?.fcmToken;
        if (tokens && (Array.isArray(tokens) ? tokens.length > 0 : true)) {
          setEnabled(true);
        } else {
          setEnabled(false);
        }
      } catch (err) {
        console.error("Error comprobando token del usuario:", err);
      }
    }

    checkToken();
  }, [session?.user?.id, status]);

  // 🔹 Activar notificaciones
  async function enablePush() {
    try {
      setLoading(true);

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

      const currentToken = await getToken(messaging!, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (currentToken && session?.user?.id) {
        const res = await fetch(`/api/users/${session.user.id}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: currentToken }),
        });
        if (!res.ok) throw new Error("Error guardando token en backend");

        setEnabled(true);
        console.log("✅ Token guardado correctamente en MongoDB");
      }

      onMessage(messaging!, (payload) => {
        console.log("🔔 Mensaje recibido en foreground:", payload);
        if (payload.notification?.title) {
          console.log("Mostrar notificación personalizada aquí");
          
        }
      });

      if (onDone) onDone();
    } catch (err) {
      console.error("Error al habilitar notificaciones:", err);
    } finally {
      setLoading(false);
    }
  }

  async function disablePush() {
    try {
      setLoading(true);
      if (!session?.user?.id) return;

      await fetch(`/api/users/${session.user.id}/token`, {
        method: "DELETE",
      });

      setEnabled(false);
      if (onDone) onDone();
    } catch (err) {
      console.error("Error desactivando notificaciones:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">Notificaciones</span>

      <button
        onClick={enabled ? disablePush : enablePush}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          enabled ? "bg-green-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
