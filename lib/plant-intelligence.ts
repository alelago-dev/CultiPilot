import type {
  CalendarEvent,
  CareEntry,
  DataPoint,
  Plant,
  PlantAnalysisContext,
  PlantMeasurement,
  Task
} from "@/lib/types";

export function buildPlantAnalysisContext({
  calendarEvents,
  entries,
  measurements,
  plant,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  measurements: PlantMeasurement[];
  plant: Plant;
  tasks: Task[];
}): PlantAnalysisContext {
  const plantEntries = entries.filter((entry) => entry.plantId === plant.id);
  const plantEvents = calendarEvents.filter((event) => event.plantId === plant.id);
  const plantMeasurements = measurements.filter((measurement) => measurement.plantId === plant.id);
  const plantTasks = tasks.filter((task) => task.plantId === plant.id);

  return {
    calendarEvents: plantEvents,
    entries: plantEntries,
    measurements: plantMeasurements,
    missingData: getMissingAnalysisData({ measurements: plantMeasurements, plant }),
    plant,
    tasks: plantTasks,
    timelineSummary: buildTimelineSummary({ entries: plantEntries, measurements: plantMeasurements, plant })
  };
}

export function getMissingAnalysisData({
  measurements,
  plant
}: {
  measurements: PlantMeasurement[];
  plant: Plant;
}) {
  const missing: string[] = [];
  const latestMeasurement = measurements.at(-1);

  if (!plant.startedAt) missing.push("fecha de inicio");
  if (!plant.variety) missing.push("genetica o variedad");
  if (!plant.stage) missing.push("etapa actual");
  if (!plant.pot) missing.push("litros o tipo de maceta");
  if (!plant.substrate) missing.push("sustrato");
  if (!plant.lighting) missing.push("iluminacion");
  if (!latestMeasurement) {
    missing.push("mediciones historicas");
    return missing;
  }

  if (latestMeasurement.temperatureC === undefined) missing.push("temperatura");
  if (latestMeasurement.ambientHumidityPercent === undefined) missing.push("humedad ambiental");
  if (latestMeasurement.substrateMoisturePercent === undefined) missing.push("humedad de sustrato");
  if (latestMeasurement.heightCm === undefined) missing.push("altura");

  return missing;
}

function buildTimelineSummary({
  entries,
  measurements,
  plant
}: {
  entries: CareEntry[];
  measurements: PlantMeasurement[];
  plant: Plant;
}): DataPoint[] {
  const latestMeasurement = measurements.at(-1);

  return [
    {
      capturedAt: plant.startedAt,
      label: "Inicio declarado",
      origin: "user",
      value: plant.startedAt
    },
    {
      label: "Etapa",
      origin: "user",
      value: plant.stage
    },
    {
      capturedAt: latestMeasurement?.measuredAt,
      label: "Ultima temperatura",
      origin: latestMeasurement?.temperatureC === undefined ? "missing" : latestMeasurement.source === "sensor" ? "measurement" : "user",
      unit: "C",
      value: latestMeasurement?.temperatureC ?? null
    },
    {
      capturedAt: latestMeasurement?.measuredAt,
      label: "Ultima humedad de sustrato",
      origin:
        latestMeasurement?.substrateMoisturePercent === undefined
          ? "missing"
          : latestMeasurement.source === "sensor"
            ? "measurement"
            : "user",
      unit: "%",
      value: latestMeasurement?.substrateMoisturePercent ?? null
    },
    {
      label: "Entradas de bitacora",
      origin: "calculated",
      value: entries.length
    }
  ];
}
