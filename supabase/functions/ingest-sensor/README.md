# Entrada de sensores

Esta Edge Function recibe mediciones de un ESP32, Raspberry Pi u otro gateway sin exponer la clave `service_role` en el dispositivo.

## Activacion

1. Ejecutar `supabase/schema.sql` en el SQL Editor del proyecto.
2. Iniciar sesion en PlantCare y crear un dispositivo con la funcion `create_sensor_device` (la interfaz para administrar dispositivos se agregara en la siguiente etapa).
3. Desplegar con `supabase functions deploy ingest-sensor --no-verify-jwt`.
4. Guardar el token devuelto por `create_sensor_device` en el dispositivo. Supabase solo conserva su hash y el token no puede recuperarse despues.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estan disponibles dentro de una Edge Function desplegada. Nunca copiar `SUPABASE_SERVICE_ROLE_KEY` al navegador o al sensor.

## Peticion del dispositivo

```http
POST https://PROJECT_REF.supabase.co/functions/v1/ingest-sensor
Authorization: Bearer TOKEN_DEL_DISPOSITIVO
Content-Type: application/json
```

```json
{
  "temperatureC": 24.6,
  "leafTemperatureC": 23.4,
  "ambientHumidityPercent": 61,
  "substrateMoisturePercent": 48,
  "ppfdUmolM2S": 520,
  "measuredAt": "2026-08-21T18:30:00Z",
  "observations": "Lectura automatica del sensor principal"
}
```

La funcion valida rangos, identifica la planta mediante el token, guarda `source = 'sensor'` y actualiza `last_seen_at`.
