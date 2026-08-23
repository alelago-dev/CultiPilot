"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      // El scope tiene que terminar en barra. Sin ella el navegador rechazaba
      // "/CultiPilot" por estar fuera del maximo permitido
      // ("/CultiPilot/") y lo corregia solo, dejando un error en consola.
      const scope = basePath ? `${basePath}/` : "/";

      navigator.serviceWorker.register(`${basePath}/sw.js`, { scope }).catch(() => {
        // Registration failure should not block the app shell.
      });
    }
  }, []);

  return null;
}
