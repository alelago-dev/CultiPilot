/**
 * push-notifications-panel.tsx
 *
 * Activa/desactiva avisos push reales (llegan aunque PlantCare este
 * cerrado) para la cuenta conectada. Requiere sesion iniciada -- sin eso
 * no hay a quien asociarle la suscripcion del lado del servidor -- y un
 * navegador con soporte de Push API (la mayoria de los de escritorio y
 * Android; Safari/iOS solo si la PWA esta instalada en la pantalla de
 * inicio).
 *
 * El envio real lo hace supabase/functions/send-reminders, corriendo una
 * vez por dia via pg_cron: mira las tareas abiertas y vencidas/de hoy del
 * snapshot de cada usuario y le manda un push a cada suscripcion activa
 * que todavia no recibio aviso hoy.
 */

"use client";

import { useEffect, useState } from "react";

import type { AccountStatus } from "@/components/app-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getExistingPushSubscription, getPushSupportStatus, subscribeToPush, unsubscribeFromPush, type PushSupportStatus } from "@/lib/push-notifications";

export function PushNotificationsPanel({ accountStatus }: { accountStatus: AccountStatus }) {
  const [supportStatus, setSupportStatus] = useState<PushSupportStatus>("unsupported");
  const [isActive, setIsActive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    // getPushSupportStatus() es sincronica, pero setearla directo en el
    // cuerpo del efecto dispara el lint react-hooks/set-state-in-effect
    // (cascading renders). Se difiere un microtask, igual que el patron ya
    // usado en PlantQrPanel con sus .then()/.catch().
    Promise.resolve().then(() => {
      if (cancelled) return;
      const status = getPushSupportStatus();
      setSupportStatus(status);
      if (status !== "ready") return;

      getExistingPushSubscription().then((subscription) => {
        if (!cancelled) setIsActive(Boolean(subscription));
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!accountStatus.isSignedIn) {
    return (
      <section aria-labelledby="push-notifications-title" className="push-notifications-panel">
        <p className="plant-calculation-eyebrow">Avisos reales</p>
        <h4 id="push-notifications-title">Notificaciones aunque la app esté cerrada</h4>
        <p>Iniciá sesión arriba para poder activarlas: la suscripción queda asociada a tu cuenta, no a este navegador suelto.</p>
      </section>
    );
  }

  if (supportStatus === "unsupported") {
    return (
      <section aria-labelledby="push-notifications-title" className="push-notifications-panel">
        <p className="plant-calculation-eyebrow">Avisos reales</p>
        <h4 id="push-notifications-title">Notificaciones aunque la app esté cerrada</h4>
        <p>Este navegador no soporta notificaciones push. En iPhone/iPad funciona si instalás PlantCare a la pantalla de inicio primero.</p>
      </section>
    );
  }

  if (supportStatus === "no-vapid-key") return null;

  async function handleToggle() {
    setIsBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient() as unknown as Parameters<typeof subscribeToPush>[0];
      if (isActive) {
        await unsubscribeFromPush(supabase);
        setIsActive(false);
        setMessage("Avisos desactivados en este navegador.");
      } else {
        const result = await subscribeToPush(supabase, accountStatus.userId);
        if (result === "granted") {
          setIsActive(true);
          setMessage("Avisos activados. Si tenés tareas vencidas o de hoy, llega un aviso una vez por día.");
        } else if (result === "denied") {
          setMessage("El navegador bloqueó el permiso de notificaciones. Habilitalo en la configuración del sitio e intentá de nuevo.");
        } else {
          setMessage("No se pudo activar el aviso en este navegador.");
        }
      }
    } catch {
      setMessage("No se pudo guardar la suscripción. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section aria-labelledby="push-notifications-title" className="push-notifications-panel">
      <div>
        <p className="plant-calculation-eyebrow">Avisos reales</p>
        <h4 id="push-notifications-title">Notificaciones aunque la app esté cerrada</h4>
        <p>
          Si tenés tareas abiertas vencidas o de hoy, PlantCare te manda un aviso una vez por día, aunque no tengas la
          app abierta. Se activa por navegador: si usás el celular y la compu, activalo en cada uno.
        </p>
      </div>
      <button className={isActive ? "secondary-button" : "primary-button"} disabled={isBusy} onClick={handleToggle} type="button">
        {isBusy ? "Guardando..." : isActive ? "Desactivar avisos" : "Activar avisos"}
      </button>
      {message ? <p className="push-notifications-status" role="status">{message}</p> : null}
    </section>
  );
}
