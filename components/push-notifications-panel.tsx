/**
 * push-notifications-panel.tsx
 *
 * Activa/desactiva avisos push reales (llegan aunque CultiPilot este
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
import type { Dictionary } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getExistingPushSubscription, getPushSupportStatus, subscribeToPush, unsubscribeFromPush, type PushSupportStatus } from "@/lib/push-notifications";

export function PushNotificationsPanel({ accountStatus, dictionary }: { accountStatus: AccountStatus; dictionary: Dictionary }) {
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
        <p className="plant-calculation-eyebrow">{dictionary.push.eyebrow}</p>
        <h4 id="push-notifications-title">{dictionary.push.title}</h4>
        <p>{dictionary.push.signInPrompt}</p>
      </section>
    );
  }

  if (supportStatus === "unsupported") {
    return (
      <section aria-labelledby="push-notifications-title" className="push-notifications-panel">
        <p className="plant-calculation-eyebrow">{dictionary.push.eyebrow}</p>
        <h4 id="push-notifications-title">{dictionary.push.title}</h4>
        <p>{dictionary.push.unsupported}</p>
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
        setMessage(dictionary.push.deactivatedMessage);
      } else {
        const result = await subscribeToPush(supabase, accountStatus.userId);
        if (result === "granted") {
          setIsActive(true);
          setMessage(dictionary.push.activatedMessage);
        } else if (result === "denied") {
          setMessage(dictionary.push.deniedMessage);
        } else {
          setMessage(dictionary.push.failedMessage);
        }
      }
    } catch {
      setMessage(dictionary.push.errorMessage);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section aria-labelledby="push-notifications-title" className="push-notifications-panel">
      <div>
        <p className="plant-calculation-eyebrow">{dictionary.push.eyebrow}</p>
        <h4 id="push-notifications-title">{dictionary.push.title}</h4>
        <p>
          {dictionary.push.description}
        </p>
      </div>
      <button className={isActive ? "secondary-button" : "primary-button"} disabled={isBusy} onClick={handleToggle} type="button">
        {isBusy ? dictionary.push.saving : isActive ? dictionary.push.deactivate : dictionary.push.activate}
      </button>
      {message ? <p className="push-notifications-status" role="status">{message}</p> : null}
    </section>
  );
}
