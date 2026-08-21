import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

type SensorPayload = {
  ambientHumidityPercent?: number;
  leafTemperatureC?: number;
  measuredAt?: string;
  observations?: string;
  ppfdUmolM2S?: number;
  substrateMoisturePercent?: number;
  temperatureC?: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Falta el token del dispositivo" }, 401);

  try {
    const payload = (await request.json()) as SensorPayload;
    const validationError = validatePayload(payload);
    if (validationError) return json({ error: validationError }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Funcion sin configurar" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const tokenHash = await sha256(token);
    const { data: device, error: deviceError } = await supabase
      .from("sensor_devices")
      .select("id,user_id,plant_id,active")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device?.active) return json({ error: "Token invalido o dispositivo desactivado" }, 401);

    const measuredAt = payload.measuredAt ? new Date(payload.measuredAt) : new Date();
    if (Number.isNaN(measuredAt.getTime())) return json({ error: "measuredAt no es una fecha valida" }, 400);

    const { error: insertError } = await supabase.from("plant_measurements").insert({
      ambient_humidity_percent: payload.ambientHumidityPercent,
      leaf_temperature_c: payload.leafTemperatureC,
      measured_at: measuredAt.toISOString(),
      observations: payload.observations?.slice(0, 500),
      plant_id: device.plant_id,
      ppfd_umol_m2_s: payload.ppfdUmolM2S,
      source: "sensor",
      substrate_moisture_percent: payload.substrateMoisturePercent,
      temperature_c: payload.temperatureC,
      user_id: device.user_id
    });
    if (insertError) throw insertError;

    await supabase.from("sensor_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    return json({ accepted: true, measuredAt: measuredAt.toISOString() });
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo guardar la medicion" }, 500);
  }
});

function validatePayload(payload: SensorPayload) {
  const values = [payload.temperatureC, payload.leafTemperatureC, payload.ambientHumidityPercent, payload.substrateMoisturePercent, payload.ppfdUmolM2S];
  if (values.every((value) => value === undefined)) return "La medicion no contiene valores";
  if (!between(payload.temperatureC, -20, 80)) return "Temperatura fuera de rango";
  if (!between(payload.leafTemperatureC, -20, 80)) return "Temperatura foliar fuera de rango";
  if (!between(payload.ambientHumidityPercent, 0, 100)) return "Humedad ambiental fuera de rango";
  if (!between(payload.substrateMoisturePercent, 0, 100)) return "Humedad de sustrato fuera de rango";
  if (!between(payload.ppfdUmolM2S, 0, 4000)) return "PPFD fuera de rango";
  return undefined;
}

function between(value: number | undefined, minimum: number, maximum: number) {
  return value === undefined || (Number.isFinite(value) && value >= minimum && value <= maximum);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status
  });
}
