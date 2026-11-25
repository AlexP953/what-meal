// Neutralize the previous worker without loading any former Firebase project.
// Background delivery belongs to the notifications quest.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.registration.unregister());
});
