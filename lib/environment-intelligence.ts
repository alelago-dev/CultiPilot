import type { DataPoint, Plant, PlantMeasurement } from "@/lib/types";

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
    messages.push("VPD en zona de riesgo orientativa: confirmar la medicion y revisar ambiente y ventilacion antes de cambiar equipos.");
  } else if (vpdStatus === "low") {
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
  if (normalized.includes("cosecha") || normalized.includes("secado")) return targets.harvest;
  if (normalized.includes("semilla") || normalized.includes("plantin") || normalized.includes("plántula")) return targets.seed;
  return { label: `Etapa declarada: ${stage || "sin informar"}` };
}
