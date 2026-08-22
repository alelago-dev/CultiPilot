"use client";

export type PushSupportStatus = "unsupported" | "no-vapid-key" | "ready";

/**
 * Interfaz minima y tipada a mano, en vez de SupabaseClient<Database>
 * completo: el mismo criterio que SnapshotTableClient en app-shell.tsx
 * (ver ese comentario) para evitar los problemas de inferencia del
 * generico completo con esta version de @supabase/supabase-js.
 */
type PushSubscriptionsTableClient = {
  from: (table: "push_subscriptions") => {
    upsert: (
      value: { auth_key: string; endpoint: string; p256dh: string; user_id: string },
      options: { onConflict: string }
    ) => Promise<{ error: unknown }>;
    delete: () => {
      eq: (column: "endpoint", value: string) => Promise<{ error: unknown }>;
    };
  };
};

export function getPushSupportStatus(): PushSupportStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "no-vapid-key";
  return "ready";
}

export async function getExistingPushSubscription() {
  if (getPushSupportStatus() !== "ready") return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Pide permiso de notificaciones, crea la suscripcion push del navegador y
 * la guarda en push_subscriptions para este usuario. Requiere estar
 * conectado con una cuenta (userId): sin eso no hay a quien avisarle desde
 * el lado del servidor.
 */
export async function subscribeToPush(supabase: PushSubscriptionsTableClient, userId: string) {
  const supportStatus = getPushSupportStatus();
  if (supportStatus !== "ready") return supportStatus;

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      userVisibleOnly: true
    }));

  const subscriptionJson = subscription.toJSON();
  if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
    return "invalid-subscription" as const;
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth_key: subscriptionJson.keys.auth,
      endpoint: subscriptionJson.endpoint,
      p256dh: subscriptionJson.keys.p256dh,
      user_id: userId
    },
    { onConflict: "endpoint" }
  );

  if (error) throw error;
  return "granted" as const;
}

export async function unsubscribeFromPush(supabase: PushSubscriptionsTableClient) {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/**
 * La Push API pide la clave del servidor de aplicacion como Uint8Array,
 * pero VAPID la entrega como texto base64url. Conversion estandar,
 * documentada en la propia guia de Web Push de MDN.
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
