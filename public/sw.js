const CACHE_NAME = "cultipilot-v65";
const ROUTES = [
  "/",
  "/es/",
  "/es/hoy/",
  "/es/semillas/",
  "/es/espacios/",
  "/es/calendario/",
  "/es/diario/",
  "/es/privacidad/",
  "/en/",
  "/en/today/",
  "/en/seeds/",
  "/en/spaces/",
  "/en/calendar/",
  "/en/journal/",
  "/en/privacy/",
  "/favicon.png",
  "/manifest.webmanifest"
];

function getScopePath() {
  return new URL(self.registration.scope).pathname.replace(/\/$/, "");
}

function withScope(path) {
  return `${getScopePath()}${path}`;
}

function getLocaleFallback(requestUrl) {
  const scopePath = getScopePath();
  const pathname = requestUrl.pathname;

  if (pathname.startsWith(`${scopePath}/en/`)) {
    return withScope("/en/");
  }

  return withScope("/es/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ROUTES.map((route) => withScope(route))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        const requestUrl = new URL(event.request.url);

        return caches
          .match(event.request)
          .then((cached) => cached || caches.match(getLocaleFallback(requestUrl)))
          .then((cached) => cached || caches.match(withScope("/")));
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseCopy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CULTIPILOT_CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      })
    );
  }
});

// Push real, enviado por la Edge Function send-reminders (ver
// supabase/functions/send-reminders). El body es JSON con
// {title, body, tag, url}; url llega relativa al scope de este service
// worker (ej. "es/hoy/") para que resuelva bien tanto en localhost como
// bajo el basePath de GitHub Pages.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "CultiPilot";
  const resolvedUrl = data.url ? new URL(data.url, self.registration.scope).href : self.registration.scope;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      data: { url: resolvedUrl },
      tag: data.tag || "cultipilot-push-reminder"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => client.url === targetUrl);

      if (existingClient) {
        return existingClient.focus();
      }

      return clients.openWindow(targetUrl);
    })
  );
});
