import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/**
 * send-reminders
 *
 * Corre una vez por dia via pg_cron (ver supabase/schema.sql). Para cada
 * usuario con un snapshot guardado, mira las tareas ("tasks") de su
 * snapshot -- el mismo array que ve la app en Hoy/Calendario -- y busca
 * las que estan abiertas y vencidas o de hoy. Si encuentra alguna y el
 * usuario tiene suscripciones push activas que todavia no recibieron un
 * aviso HOY, manda un push real por cada una.
 *
 * No hay tabla `tasks` propia con estado de notificacion: el snapshot es
 * la fuente de verdad que ya usa el resto de la app (ver comentario sobre
 * `user_app_snapshots` en supabase/schema.sql), asi que esta funcion lee
 * de ahi en vez de duplicar el estado de las tareas en otro lado.
 *
 * No requiere JWT de usuario (se despliega con --no-verify-jwt): la unica
 * llamada valida es la de pg_cron, autenticada con un secreto compartido
 * en el header x-cron-secret contra el setting app.cron_shared_secret.
 */

type SnapshotTask = {
  id?: string;
  status?: string;
  dueDate?: string;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "https://alelago-dev.github.io/plantcare-calendar/";

  if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Funcion sin configurar (faltan secrets)" }, 500);
  }

  const providedSecret = request.headers.get("x-cron-secret");
  if (providedSecret !== cronSecret) return json({ error: "No autorizado" }, 401);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const today = new Date().toISOString().slice(0, 10);

  const { data: snapshots, error: snapshotsError } = await supabase
    .from("user_app_snapshots")
    .select("user_id, payload")
    .eq("key", "primary");
  if (snapshotsError) {
    console.error(snapshotsError);
    return json({ error: "No se pudieron leer los snapshots" }, 500);
  }

  let usersWithDueTasks = 0;
  let pushesSent = 0;
  let pushesFailed = 0;
  let subscriptionsRemoved = 0;

  for (const snapshot of snapshots ?? []) {
    const payload = snapshot.payload as { tasks?: SnapshotTask[] } | null;
    const tasks = Array.isArray(payload?.tasks) ? payload!.tasks! : [];
    const dueTasks = tasks.filter((task) => task.status === "open" && task.dueDate && task.dueDate <= today);
    if (dueTasks.length === 0) continue;

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, last_notified_date")
      .eq("user_id", snapshot.user_id);
    if (subscriptionsError) {
      console.error(subscriptionsError);
      continue;
    }
    if (!subscriptions || subscriptions.length === 0) continue;

    usersWithDueTasks += 1;
    const overdueCount = dueTasks.filter((task) => task.dueDate! < today).length;
    const body =
      dueTasks.length === 1
        ? "Tenes 1 tarea pendiente en PlantCare."
        : `Tenes ${dueTasks.length} tareas pendientes en PlantCare${overdueCount > 0 ? ` (${overdueCount} vencida${overdueCount === 1 ? "" : "s"})` : ""}.`;

    for (const subscription of subscriptions) {
      if (subscription.last_notified_date === today) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { auth: subscription.auth_key, p256dh: subscription.p256dh }
          },
          JSON.stringify({
            body,
            tag: "plantcare-push-reminder",
            title: "PlantCare Calendar",
            // Ruta relativa al scope del service worker (sin barra inicial),
            // para que resuelva bien tanto en localhost como bajo el
            // basePath de GitHub Pages. El service worker la resuelve con
            // `new URL(url, self.registration.scope)`.
            url: "es/hoy/"
          })
        );
        pushesSent += 1;
        await supabase.from("push_subscriptions").update({ last_notified_date: today }).eq("id", subscription.id);
      } catch (error) {
        pushesFailed += 1;
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // El navegador ya no reconoce esta suscripcion (desinstalada,
          // permiso revocado, etc.): no tiene sentido reintentar.
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          subscriptionsRemoved += 1;
        } else {
          console.error("push send failed", statusCode, error);
        }
      }
    }
  }

  return json({ pushesFailed, pushesSent, subscriptionsRemoved, usersWithDueTasks });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
