import type { DataPoint, Plant, PlantMeasurement } from "@/lib/types";

export type EnvironmentalStatus = "high" | "in-range" | "low" | "missing";

type StageTarget = {
  label: string;
  ppfdMax?: number;
  ppfdMin?: number;
  vpdMax: number;
  vpdMin: number;
};

export type EnvironmentalAssessment = {
  evidence: DataPoint[];
  messages: string[];
  missingInputs: string[];
  ppfdStatus: EnvironmentalStatus;
  target: StageTarget;
  vpdKpa?: number;
  vpdStatus: EnvironmentalStatus;
};

const targets: Record<string, StageTarget> = {
  seed: { label: "Semilla / plantin", ppfdMin: 100, ppfdMax: 250, vpdMin: 0.4, vpdMax: 0.8 },
  vegetative: { label: "Vegetativo", ppfdMin: 250, ppfdMax: 600, vpdMin: 0.8, vpdMax: 1.2 },
  earlyFlower: { label: "Floracion temprana", ppfdMin: 500, ppfdMax: 800, vpdMin: 1.0, vpdMax: 1.3 },
  lateFlower: { label: "Floracion tardia", ppfdMin: 600, ppfdMax: 900, vpdMin: 1.2, vpdMax: 1.5 },
  harvest: { label: "Cosecha", vpdMin: 0.8, vpdMax: 1.2 }
};

export function assessPlantEnvironment(plant: Plant, measurement?: PlantMeasurement): EnvironmentalAssessment {
  const target = getStageTarget(plant.stage);
  const missingInputs: string[] = [];
  const messages: string[] = [];

  if (measurement?.temperatureC === undefined) missingInputs.push("temperatura");
  if (measurement?.ambientHumidityPercent === undefined) missingInputs.push("humedad ambiental");

  const vpdKpa =
    measurement?.temperatureC !== undefined && measurement.ambientHumidityPercent !== undefined
      ? calculateAirVpd(measurement.temperatureC, measurement.ambientHumidityPercent)
      : undefined;
  const vpdStatus = compareToRange(vpdKpa, target.vpdMin, target.vpdMax);
  const ppfdStatus = compareToRange(measurement?.ppfdUmolM2S, target.ppfdMin, target.ppfdMax);

  if (vpdStatus === "low") {
    messages.push("VPD orientativo bajo: revisar exceso de humedad, temperatura y renovacion de aire antes de ajustar equipos.");
  } else if (vpdStatus === "high") {
    messages.push("VPD orientativo alto: revisar aire seco, temperatura y ventilacion antes de ajustar equipos.");
  } else if (vpdStatus === "in-range") {
    messages.push("La ultima relacion entre temperatura y humedad esta dentro del rango orientativo para la etapa declarada.");
  }

  if (measurement?.ppfdUmolM2S === undefined) {
    missingInputs.push("PPFD a nivel de la copa");
  } else if (ppfdStatus === "low") {
    messages.push("PPFD por debajo de la referencia: comprobar medicion, distribucion y especificaciones de la luminaria.");
  } else if (ppfdStatus === "high") {
    messages.push("PPFD por encima de la referencia: comprobar signos de estres y limites de la luminaria antes de modificar potencia o distancia.");
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
        label: "VPD de aire estimado",
        note: "Calculado con temperatura del aire y humedad relativa; no reemplaza una medicion de temperatura foliar.",
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
    vpdKpa,
    vpdStatus
  };
}

export function calculateAirVpd(temperatureC: number, relativeHumidityPercent: number) {
  const saturationVaporPressure = 0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
  const boundedHumidity = Math.min(100, Math.max(0, relativeHumidityPercent));
  return Number((saturationVaporPressure * (1 - boundedHumidity / 100)).toFixed(2));
}

function compareToRange(value?: number, minimum?: number, maximum?: number): EnvironmentalStatus {
  if (value === undefined || minimum === undefined || maximum === undefined) return "missing";
  if (value < minimum) return "low";
  if (value > maximum) return "high";
  return "in-range";
}

function getStageTarget(stage: string): StageTarget {
  const normalized = stage.toLowerCase();

  if (normalized.includes("flor") && normalized.includes("tard")) return targets.lateFlower;
  if (normalized.includes("flor")) return targets.earlyFlower;
  if (normalized.includes("veget") || normalized.includes("crecimiento")) return targets.vegetative;
  if (normalized.includes("cosecha") || normalized.includes("secado")) return targets.harvest;
  return targets.seed;
}
