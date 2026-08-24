import type { DataPoint, Plant, PlantEnvironmentalAlertSettings, PlantMeasurement } from "@/lib/types";

export type EnvironmentalStatus = "critical" | "high" | "in-range" | "low" | "missing";

type StageTarget = {
  label: string;
  ppfdMax?: number;
  ppfdMin?: number;
  vpdMax?: number;
  vpdMin?: number;
};

export type EnvironmentalAssessment = {
  evidence: DataPoint[];
  messages: string[];
  missingInputs: string[];
  ppfdStatus: EnvironmentalStatus;
  target: StageTarget;
  vpdBasis: "air" | "leaf";
  vpdKpa?: number;
  vpdStatus: EnvironmentalStatus;
};

export type ConfiguredEnvironmentalAlert = {
  direction: "above" | "below";
  label: string;
  limit: number;
  unit: string;
  value: number;
};

export type EnvironmentalTrendAlert = ConfiguredEnvironmentalAlert & {
  consecutiveReadings: number;
  durationMinutes: number;
  firstMeasuredAt: string;
  lastMeasuredAt: string;
  trend: "rising" | "falling" | "stable";
};

const targets: Record<string, StageTarget> = {
  seed: { label: "Semilla / plantin", ppfdMin: 100, ppfdMax: 250, vpdMin: 0.4, vpdMax: 0.8 },
  vegetative: { label: "Vegetativo", ppfdMin: 250, ppfdMax: 600, vpdMin: 0.8, vpdMax: 1.2 },
  earlyFlower: { label: "Floracion temprana", ppfdMin: 500, ppfdMax: 800, vpdMin: 0.8, vpdMax: 1.2 },
  lateFlower: { label: "Floracion media / tardia", ppfdMin: 600, ppfdMax: 900, vpdMin: 1.2, vpdMax: 1.6 },
  harvest: { label: "Cosecha", vpdMin: 0.8, vpdMax: 1.2 }
};

export function assessPlantEnvironment(plant: Plant, measurement?: PlantMeasurement): EnvironmentalAssessment {
  const target = getStageTarget(plant.stage);
  const missingInputs: string[] = [];
  const messages: string[] = [];

  if (measurement?.temperatureC === undefined) missingInputs.push("temperatura");
  if (measurement?.ambientHumidityPercent === undefined) missingInputs.push("humedad ambiental");

  const vpdBasis = measurement?.leafTemperatureC === undefined ? "air" : "leaf";
  const vpdKpa =
    measurement?.temperatureC !== undefined && measurement.ambientHumidityPercent !== undefined
      ? measurement.leafTemperatureC === undefined
        ? calculateAirVpd(measurement.temperatureC, measurement.ambientHumidityPercent)
        : calculateLeafVpd(measurement.temperatureC, measurement.leafTemperatureC, measurement.ambientHumidityPercent)
      : undefined;
  const vpdStatus = compareToRange(vpdKpa, target.vpdMin, target.vpdMax, { maximum: 1.6, minimum: 0.4 });
  const ppfdStatus = compareToRange(measurement?.ppfdUmolM2S, target.ppfdMin, target.ppfdMax);

  if (target.vpdMin === undefined || target.vpdMax === undefined) {
    messages.push(`No hay una banda VPD asociada a la etapa declarada "${plant.stage}". El VPD se calcula, pero no se clasifica.`);
  } else if (vpdStatus === "critical") {
    messages.push("VPD en zona crítica: confirmá la lectura y corregí temperatura, humedad o ventilación hacia el rango de la etapa.");
  } else if (vpdStatus === "low") {
    messages.push("VPD bajo: reducí humedad relativa o aumentá gradualmente temperatura y renovación de aire hasta acercarte al rango de la etapa.");
  } else if (vpdStatus === "high") {
    messages.push("VPD alto: aumentá humedad relativa o reducí gradualmente temperatura e intensidad térmica hasta acercarte al rango de la etapa.");
  } else if (vpdStatus === "in-range") {
    messages.push("La ultima relacion entre temperatura y humedad esta dentro del rango orientativo para la etapa declarada.");
  }

  if (measurement?.ppfdUmolM2S === undefined) {
    missingInputs.push("PPFD a nivel de la copa");
  } else if (ppfdStatus === "low") {
    messages.push("PPFD bajo: aumentá gradualmente potencia o acercá la luminaria, midiendo nuevamente en varios puntos de la copa.");
  } else if (ppfdStatus === "high") {
    messages.push("PPFD alto: reducí gradualmente potencia o aumentá distancia, y verificá la nueva lectura y la respuesta de la copa.");
  }

  return {
    evidence: [
      {
        capturedAt: measurement?.measuredAt,
        label: "Temperatura",
        origin: measurement ? (measurement.source === "sensor" ? "measurement" : "user") : "missing",
        unit: "C",
        value: measurement?.temperatureC ?? null
      },
      {
        capturedAt: measurement?.measuredAt,
        label: "Humedad ambiental",
        origin: measurement ? (measurement.source === "sensor" ? "measurement" : "user") : "missing",
        unit: "%",
        value: measurement?.ambientHumidityPercent ?? null
      },
      {
        capturedAt: measurement?.measuredAt,
        label: "Temperatura foliar",
        origin:
          measurement?.leafTemperatureC === undefined
            ? "missing"
            : measurement.source === "sensor"
              ? "measurement"
              : "user",
        unit: "C",
        value: measurement?.leafTemperatureC ?? null
      },
      {
        capturedAt: measurement?.measuredAt,
        label: vpdBasis === "leaf" ? "VPD foliar estimado" : "VPD de aire estimado",
        note:
          vpdBasis === "leaf"
            ? "Calculado con temperatura ambiental, temperatura foliar y humedad relativa."
            : "Calculado con temperatura del aire y humedad relativa; no supone que la hoja este mas fria.",
        origin: vpdKpa === undefined ? "missing" : "calculated",
        unit: "kPa",
        value: vpdKpa ?? null
      },
      {
        capturedAt: measurement?.measuredAt,
        label: "PPFD",
        origin: measurement ? (measurement.source === "sensor" ? "measurement" : "user") : "missing",
        unit: "umol/m2/s",
        value: measurement?.ppfdUmolM2S ?? null
      }
    ],
    messages,
    missingInputs,
    ppfdStatus,
    target,
    vpdBasis,
    vpdKpa,
    vpdStatus
  };
}

export function calculateAirVpd(temperatureC: number, relativeHumidityPercent: number) {
  const saturationVaporPressure = calculateSaturationVaporPressure(temperatureC);
  const boundedHumidity = Math.min(100, Math.max(0, relativeHumidityPercent));
  return Number((saturationVaporPressure * (1 - boundedHumidity / 100)).toFixed(2));
}

export function calculateLeafVpd(airTemperatureC: number, leafTemperatureC: number, relativeHumidityPercent: number) {
  const boundedHumidity = Math.min(100, Math.max(0, relativeHumidityPercent));
  const actualVaporPressure = calculateSaturationVaporPressure(airTemperatureC) * (boundedHumidity / 100);
  return Number((calculateSaturationVaporPressure(leafTemperatureC) - actualVaporPressure).toFixed(2));
}

export function getConfiguredEnvironmentalAlerts(settings: PlantEnvironmentalAlertSettings | undefined, measurement: PlantMeasurement | undefined, vpdKpa: number | undefined) {
  if (!settings || !measurement) return [];
  const alerts: ConfiguredEnvironmentalAlert[] = [];
  addConfiguredRangeAlerts(alerts, "Temperatura", measurement.temperatureC, settings.temperatureMinC, settings.temperatureMaxC, "°C");
  addConfiguredRangeAlerts(alerts, "Humedad ambiental", measurement.ambientHumidityPercent, settings.humidityMinPercent, settings.humidityMaxPercent, "%");
  addConfiguredRangeAlerts(alerts, "VPD calculado", vpdKpa, settings.vpdMinKpa, settings.vpdMaxKpa, " kPa");
  addConfiguredRangeAlerts(alerts, "Humedad de sustrato", measurement.substrateMoisturePercent, settings.substrateMoistureMinPercent, settings.substrateMoistureMaxPercent, "%");
  return alerts;
}

export function getEnvironmentalTrendAlerts(
  settings: PlantEnvironmentalAlertSettings | undefined,
  plant: Plant,
  measurements: PlantMeasurement[]
): EnvironmentalTrendAlert[] {
  if (!settings) return [];
  const minimumReadings = Math.max(2, settings.minimumConsecutiveReadings ?? 3);
  const minimumDuration = Math.max(0, settings.minimumDurationMinutes ?? 30);
  const hysteresisPercent = Math.max(0, settings.hysteresisPercent ?? 3);
  const ordered = measurements
    .filter((measurement) => measurement.plantId === plant.id)
    .sort((first, second) => first.measuredAt.localeCompare(second.measuredAt));
  const definitions = [
    { label: "Temperatura", min: settings.temperatureMinC, max: settings.temperatureMaxC, unit: "°C", value: (measurement: PlantMeasurement) => measurement.temperatureC },
    { label: "Humedad ambiental", min: settings.humidityMinPercent, max: settings.humidityMaxPercent, unit: "%", value: (measurement: PlantMeasurement) => measurement.ambientHumidityPercent },
    { label: "VPD calculado", min: settings.vpdMinKpa, max: settings.vpdMaxKpa, unit: " kPa", value: (measurement: PlantMeasurement) => assessPlantEnvironment(plant, measurement).vpdKpa },
    { label: "Humedad de sustrato", min: settings.substrateMoistureMinPercent, max: settings.substrateMoistureMaxPercent, unit: "%", value: (measurement: PlantMeasurement) => measurement.substrateMoisturePercent }
  ];

  return definitions.flatMap((definition) => {
    let active: { direction: "above" | "below"; firstMeasuredAt: string; firstValue: number; limit: number; readings: number } | undefined;
    let latestValue: number | undefined;
    let lastMeasuredAt = "";

    ordered.forEach((measurement) => {
      const value = definition.value(measurement);
      if (value === undefined) return;
      latestValue = value;
      lastMeasuredAt = measurement.measuredAt;

      if (!active) {
        if (definition.min !== undefined && value < definition.min) active = { direction: "below", firstMeasuredAt: measurement.measuredAt, firstValue: value, limit: definition.min, readings: 1 };
        else if (definition.max !== undefined && value > definition.max) active = { direction: "above", firstMeasuredAt: measurement.measuredAt, firstValue: value, limit: definition.max, readings: 1 };
        return;
      }

      const margin = Math.abs(active.limit) * (hysteresisPercent / 100);
      const recovered = active.direction === "above" ? value <= active.limit - margin : value >= active.limit + margin;
      if (recovered) {
        active = undefined;
      } else {
        active.readings += 1;
      }
    });

    if (!active || latestValue === undefined || !lastMeasuredAt) return [];
    const durationMinutes = Math.max(0, Math.round((new Date(lastMeasuredAt).getTime() - new Date(active.firstMeasuredAt).getTime()) / 60_000));
    if (active.readings < minimumReadings || durationMinutes < minimumDuration) return [];
    const delta = latestValue - active.firstValue;
    return [{
      consecutiveReadings: active.readings,
      direction: active.direction,
      durationMinutes,
      firstMeasuredAt: active.firstMeasuredAt,
      label: definition.label,
      lastMeasuredAt,
      limit: active.limit,
      trend: Math.abs(delta) < Math.max(0.01, Math.abs(active.firstValue) * 0.01) ? "stable" : delta > 0 ? "rising" : "falling",
      unit: definition.unit,
      value: latestValue
    }];
  });
}

function addConfiguredRangeAlerts(alerts: ConfiguredEnvironmentalAlert[], label: string, value: number | undefined, minimum: number | undefined, maximum: number | undefined, unit: string) {
  if (value === undefined) return;
  if (minimum !== undefined && value < minimum) alerts.push({ direction: "below", label, limit: minimum, unit, value });
  if (maximum !== undefined && value > maximum) alerts.push({ direction: "above", label, limit: maximum, unit, value });
}

function compareToRange(
  value?: number,
  minimum?: number,
  maximum?: number,
  danger?: { maximum: number; minimum: number }
): EnvironmentalStatus {
  if (value === undefined || minimum === undefined || maximum === undefined) return "missing";
  if (danger && (value < danger.minimum || value > danger.maximum)) return "critical";
  if (value < minimum) return "low";
  if (value > maximum) return "high";
  return "in-range";
}

function calculateSaturationVaporPressure(temperatureC: number) {
  return 0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
}

function getStageTarget(stage: string): StageTarget {
  const normalized = stage.toLowerCase();

  if (normalized.includes("flor") && normalized.includes("tard")) return targets.lateFlower;
  if (normalized.includes("flor")) return targets.earlyFlower;
  if (normalized.includes("veget") || normalized.includes("crecimiento")) return targets.vegetative;
  if (normalized.includes("cosecha") || normalized.includes("secado") || normalized.includes("curado")) return targets.harvest;
  if (normalized.includes("semilla") || normalized.includes("plantin") || normalized.includes("plántula")) return targets.seed;
  return { label: `Etapa declarada: ${stage || "sin informar"}` };
}
