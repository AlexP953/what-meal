import { notificationsEnabled } from "@/shared/config";

// Lazy imports keep the disabled installation independent of Firebase.
export async function getClientMessaging() {
  if (!notificationsEnabled || typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new Error("Missing public Firebase configuration");
  }
  const [{ initializeApp, getApps }, sdk] = await Promise.all([
    import("firebase/app"), import("firebase/messaging"),
  ]);
  if (!(await sdk.isSupported())) return null;
  const app = getApps()[0] ?? initializeApp(config);
  return { messaging: sdk.getMessaging(app), getToken: sdk.getToken, onMessage: sdk.onMessage };
}
