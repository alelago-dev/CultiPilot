# Avisos push diarios

Esta Edge Function manda una notificacion push real (llega aunque PlantCare este cerrado) a cada suscripcion activa cuyo usuario tenga tareas abiertas vencidas o de hoy, una vez por dia. La dispara `pg_cron` desde la base de datos, no un usuario ni el navegador.

## Activacion

1. Ejecutar `supabase/schema.sql` en el SQL Editor del proyecto (crea `push_subscriptions`, sus permisos RLS y el job de `pg_cron`).
2. Generar un par de claves VAPID (no requiere cuenta, es criptografia pura):
   ```
   npx web-push@3.6.7 generate-vapid-keys --json
   ```
3. Poner la clave publica en `.env.production` como `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (ya vive en el repo: es publica por diseno, igual que la anon key de Supabase).
4. Configurar los secrets de la funcion (nunca se commitean):
   ```
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=https://alelago-dev.github.io/plantcare-calendar/ CRON_SECRET=...
   ```
   `VAPID_PUBLIC_KEY` debe ser la misma clave publica del paso 3. `CRON_SECRET` es un valor random cualquiera, elegido por quien despliega.
5. Desplegar sin verificacion de JWT de usuario (la unica llamada valida es la de `pg_cron`, autenticada por `x-cron-secret`):
   ```
   supabase functions deploy send-reminders --no-verify-jwt
   ```
6. Una unica vez, en el SQL Editor (sin subir estos comandos a ningun repo), configurar los settings que usa el job de cron para llamar a esta funcion:
   ```sql
   alter database postgres set app.cron_shared_secret = 'EL_MISMO_VALOR_QUE_CRON_SECRET';
   alter database postgres set app.functions_base_url = 'https://PROJECT_REF.supabase.co/functions/v1';
   select pg_reload_conf();
   ```
7. En PlantCare, con sesion iniciada, activar "Notificaciones aunque la app esté cerrada" en Hoy. Cada navegador que lo active guarda su propia suscripcion en `push_subscriptions`.

## Que hace en cada corrida

`pg_cron` llama a esta funcion todos los dias a las 09:00 (Argentina). Por cada usuario con un snapshot guardado:

1. Lee `payload.tasks` del snapshot (la misma fuente que usa la app en Hoy/Calendario -- no hay tabla `tasks` propia con estado de notificacion).
2. Filtra tareas abiertas (`status: "open"`) vencidas o de hoy (`dueDate <= hoy`).
3. Si hay alguna y el usuario tiene suscripciones activas que todavia no recibieron aviso hoy, les manda un push con el conteo de tareas (y cuantas estan vencidas).
4. Marca `last_notified_date` en cada suscripcion avisada, para no repetir el mismo dia.
5. Si una suscripcion ya no existe del lado del navegador (404/410 al enviar), la borra.

Responde un resumen JSON: `{ usersWithDueTasks, pushesSent, pushesFailed, subscriptionsRemoved }`.

## Probar a mano

```http
POST https://PROJECT_REF.supabase.co/functions/v1/send-reminders
x-cron-secret: EL_MISMO_VALOR_QUE_CRON_SECRET
```

Sin ese header (o con uno incorrecto) responde 401. Sin los secrets configurados responde 500.
