/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyABg_5OsBgf7R2uvH9VbCyoexXw3DpAIis",
  authDomain: "what-meal-700e6.firebaseapp.com",
  projectId: "what-meal-700e6",
  storageBucket: "what-meal-700e6.firebasestorage.app",
  messagingSenderId: "293889835144",
  appId: "1:293889835144:web:e2b4b1c5e7d7e4873d1f3d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM Service Worker] Mensaje recibido:", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon.png",
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
