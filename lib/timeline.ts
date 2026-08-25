import { addDays, expandEventOccurrences, getTodayIso } from "@/lib/calendar-events";
import { assessPlantEnvironment, getConfiguredEnvironmentalAlerts } from "@/lib/environment-intelligence";
import type { CalendarEvent, CareEntry, Plant, PlantEnvironmentalAlertSettings, PlantMeasurement, PlantStageTransition, Task } from "@/lib/types";

export type PlantTimelineType =
  | "event"
  | "alert"
  | "maintenance"
  | "measurement"
  | "observation"
  | "photo"
  | "stage"
  | "task"
  | "watering";

export type PlantTimelineItem = {
  id: string;
  type: PlantTimelineType;
  title: string;
  body: string;
  date: string;
  badge: string;
  status?: "completed" | "pending";
  source: "calculated" | "calendar" | "entry" | "measurement" | "plant" | "stage-transition" | "task";
  photoDataUrl?: string;
};

export const plantTimelineFilters: Array<{ label: string; value: PlantTimelineType | "all" }> = [
  { label: "Todo", value: "all" },
  { label: "Notas", value: "observation" },
  { label: "Fotos", value: "photo" },
  { label: "Riego", value: "watering" },
  { label: "Ambiente", value: "measurement" },
  { label: "Alertas", value: "alert" },
  { label: "Tareas", value: "task" },
  { label: "Etapas", value: "stage" }
];

export function buildPlantTimeline({
  calendarEvents,
  entries,
  environmentalAlertSettings,
  measurements,
  plant,
  stageTransitions,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  environmentalAlertSettings?: PlantEnvironmentalAlertSettings;
  measurements: PlantMeasurement[];
  plant: Plant;
  stageTransitions: PlantStageTransition[];
  tasks: Task[];
}) {
  const today = getTodayIso();
  const futureLimit = addDays(today, 90);
  const plantCalendarEvents = calendarEvents.filter((event) => event.plantId === plant.id);
  const calendarItems: PlantTimelineItem[] = expandEventOccurrences(plantCalendarEvents, "1970-01-01", futureLimit).map(
    (occurrence) => ({
      badge: occurrence.completed ? "Hecho" : "Pendiente",
      body: occurrence.description,
      date: occurrence.date,
      id: `calendar-${occurrence.occurrenceId}`,
      source: "calendar",
      status: occurrence.completed ? "completed" : "pending",
      title: occurrence.title,
      type: mapCalendarKindToTimelineType(occurrence.kind)
    })
  );
  const entryItems: PlantTimelineItem[] = entries
    .filter((entry) => entry.plantId === plant.id)
    .map((entry) => ({
      badge: entry.photoDataUrl ? "Foto" : entry.tags[0] ?? "Nota",
      body: entry.note,
      date: entry.createdAt,
      id: `entry-${entry.id}`,
      photoDataUrl: entry.photoDataUrl,
      source: "entry",
      title: entry.title,
      type: entry.photoDataUrl ? "photo" : "observation"
    }));
  const taskItems: PlantTimelineItem[] = tasks
    .filter((task) => task.plantId === plant.id)
    .map((task) => ({
      badge: task.status === "done" ? "Hecha" : "Pendiente",
      body: task.description,
      date: task.dueDate ?? plant.startedAt,
      id: `task-${task.id}`,
      source: "task",
      status: task.status === "done" ? "completed" : "pending",
      title: task.title,
      type: task.category === "Riego" ? "watering" : "task"
    }));
  const plantMeasurements = measurements.filter((measurement) => measurement.plantId === plant.id);
  const measurementItems: PlantTimelineItem[] = plantMeasurements.map((measurement) => {
    const assessment = assessPlantEnvironment(plant, measurement);
    const values = [
      measurement.temperatureC === undefined ? "" : `${measurement.temperatureC} °C`,
      measurement.ambientHumidityPercent === undefined ? "" : `${measurement.ambientHumidityPercent}% HR`,
      assessment.vpdKpa === undefined ? "" : `VPD ${assessment.vpdKpa} kPa calculado (${assessment.vpdBasis === "leaf-measured" ? "foliar con hoja medida" : "foliar estimado -2,8 °C"})`,
      measurement.ppfdUmolM2S === undefined ? "" : `PPFD ${measurement.ppfdUmolM2S}`,
      measurement.observations ?? ""
    ].filter(Boolean);
    return {
      badge: measurement.source === "sensor" ? "Sensor" : "Medición",
      body: values.join(" · ") || "Registro sin valores ambientales comparables.",
      date: measurement.measuredAt,
      id: `measurement-${measurement.id}`,
      photoDataUrl: measurement.photoDataUrl,
      source: "measurement",
      title: "Medición ambiental",
      type: "measurement"
    };
  });
  const alertItems: PlantTimelineItem[] = plantMeasurements.flatMap((measurement) => {
    const assessment = assessPlantEnvironment(plant, measurement);
    const exceeded = getConfiguredEnvironmentalAlerts(environmentalAlertSettings, measurement, assessment.vpdKpa);
    return exceeded.length === 0 ? [] : [{
      badge: "Alerta calculada",
      body: `${exceeded.map((alert) => `${alert.label} ${alert.value}${alert.unit}, ${alert.direction === "below" ? "menor" : "mayor"} que ${alert.limit}${alert.unit}`).join(" · ")}. Evaluación retrospectiva con los límites personalizados configurados actualmente.`,
      date: measurement.measuredAt,
      id: `alert-${measurement.id}`,
      source: "calculated" as const,
      title: "Límite ambiental superado",
      type: "alert" as const
    }];
  });
  const plantItems: PlantTimelineItem[] = [
    {
      badge: "Inicio",
      body: `Inicio declarado para ${plant.variety}.`,
      date: plant.startedAt,
      id: `plant-start-${plant.id}`,
      source: "plant",
      title: "Inicio del ciclo",
      type: "stage"
    }
  ];
  const stageItems: PlantTimelineItem[] = stageTransitions.filter((transition) => transition.plantId === plant.id).map((transition) => ({ badge: "Declarada por usuario", body: `${transition.fromStage} → ${transition.toStage}.${transition.note ? ` ${transition.note}` : ""}`, date: transition.changedAt, id: `stage-${transition.id}`, source: "stage-transition", title: "Cambio de etapa", type: "stage" }));

  return [...calendarItems, ...entryItems, ...taskItems, ...measurementItems, ...alertItems, ...plantItems, ...stageItems].sort((first, second) => {
    const dateOrder = second.date.localeCompare(first.date);
    return dateOrder === 0 ? first.title.localeCompare(second.title) : dateOrder;
  });
}

function mapCalendarKindToTimelineType(kind: CalendarEvent["kind"]): PlantTimelineType {
  if (kind === "watering") return "watering";
  if (kind === "photo") return "photo";
  if (kind === "cleaning") return "maintenance";
  return "event";
}
