import { assessPlantEnvironment } from "@/lib/environment-intelligence";
import type { GeneticReferenceEntry } from "@/lib/genetics-catalog";
import type { CalendarEvent, CalendarEventKind, DataPoint, Plant, PlantMeasurement, PlantStageTransition } from "@/lib/types";

export type CultivationSuggestion = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  kind: CalendarEventKind;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidence: DataPoint[];
  missingInputs: string[];
};

type SuggestionInput = {
  existingEvents: CalendarEvent[];
  genetic?: GeneticReferenceEntry;
  measurements: PlantMeasurement[];
  plant: Plant;
  stageTransitions?: PlantStageTransition[];
  today?: string;
};

export function buildCultivationSuggestions({
  existingEvents,
  genetic,
  measurements,
  plant,
  stageTransitions = [],
  today = new Date().toISOString().slice(0, 10)
}: SuggestionInput): CultivationSuggestion[] {
  const latest = [...measurements].sort((first, second) => second.measuredAt.localeCompare(first.measuredAt))[0];
  const environment = assessPlantEnvironment(plant, latest);
  const suggestions: CultivationSuggestion[] = [];
  const stage = normalizeStage(plant.stage);
  const floweringStart = findFloweringStartDate(plant.id, stageTransitions);

  if (["critical", "high", "low"].includes(environment.vpdStatus)) {
    suggestions.push({
      id: `${plant.id}-environment-${today}`,
      title: "Revisar ambiente y VPD",
      description: environment.messages.find((message) => message.includes("VPD")) ?? "Revisar temperatura, humedad y ventilacion.",
      dueDate: today,
      kind: "review",
      priority: environment.vpdStatus === "critical" ? "high" : "medium",
      rationale: `La ultima medicion queda fuera del rango orientativo de ${environment.target.vpdMin}-${environment.target.vpdMax} kPa para ${environment.target.label}.`,
      evidence: environment.evidence.filter((point) => ["Temperatura", "Humedad ambiental", "VPD foliar estimado", "VPD de aire estimado"].includes(point.label)),
      missingInputs: environment.missingInputs
    });
  }

  if (["high", "low"].includes(environment.ppfdStatus)) {
    suggestions.push({
      id: `${plant.id}-light-${today}`,
      title: "Revisar intensidad y distribucion de luz",
      description: environment.messages.find((message) => message.includes("PPFD")) ?? "Comprobar PPFD en varios puntos de la copa.",
      dueDate: today,
      kind: "review",
      priority: "medium",
      rationale: `La medicion esta fuera de la referencia orientativa para ${environment.target.label}. Antes de ajustar potencia o altura, confirmar la lectura y las especificaciones de la luminaria.`,
      evidence: environment.evidence.filter((point) => point.label === "PPFD"),
      missingInputs: []
    });
  }

  const stageSuggestion = getStageSuggestion(stage, plant, genetic, floweringStart, today);
  if (stageSuggestion) suggestions.push(stageSuggestion);

  if (stage === "early-flower" || stage === "late-flower") {
    const harvestSuggestion = getHarvestWindowSuggestion(plant, genetic, floweringStart);
    if (harvestSuggestion) suggestions.push(harvestSuggestion);
  }

  suggestions.push({
    id: `${plant.id}-substrate-review-${addDays(today, 3)}`,
    title: "Revisar humedad, drenaje y respuesta de la maceta",
    description: "Registrar humedad del sustrato, peso o tacto de la maceta y respuesta visible antes de decidir riego o nutricion.",
    dueDate: addDays(today, 3),
    kind: "watering",
    priority: "low",
    rationale: plant.substrate
      ? `Revision basada en el sustrato declarado (${plant.substrate}); no calcula cantidad de agua ni fertilizante.`
      : "No hay sustrato declarado, por eso solo se propone una revision general.",
    evidence: [
      { label: "Sustrato", origin: plant.substrate ? "user" : "missing", value: plant.substrate || null },
      { label: "Humedad de sustrato", origin: latest?.substrateMoisturePercent === undefined ? "missing" : latest.source === "sensor" ? "measurement" : "user", unit: "%", value: latest?.substrateMoisturePercent ?? null }
    ],
    missingInputs: [!plant.substrate ? "tipo de sustrato" : "", latest?.substrateMoisturePercent === undefined ? "humedad de sustrato" : ""].filter(Boolean)
  });

  return suggestions.filter((suggestion) => !existingEvents.some((event) =>
    event.plantId === plant.id && event.startDate === suggestion.dueDate && normalize(event.title) === normalize(suggestion.title)
  ));
}

function getStageSuggestion(
  stage: ReturnType<typeof normalizeStage>,
  plant: Plant,
  genetic: GeneticReferenceEntry | undefined,
  floweringStart: string | undefined,
  today: string
): CultivationSuggestion | undefined {
  const geneticEvidence: DataPoint[] = genetic
    ? [
        { label: "Genetica", origin: "catalog", value: genetic.name, note: genetic.source },
        { label: "Floracion publicada", origin: "catalog", value: `${genetic.flowering_weeks_range[0]}-${genetic.flowering_weeks_range[1]}`, unit: "semanas" }
      ]
    : [{ label: "Genetica", origin: "missing", value: null }];
  const floweringDateMissing = genetic && hasDeclaredFloweringWeeks(genetic) && !floweringStart
    ? ["fecha de inicio de floracion (registrala en el historial de etapas)"]
    : [];

  if (stage === "seed") {
    return createStageSuggestion(plant, today, 5, "Revisar desarrollo inicial y necesidad de trasplante", "Observar raices, vigor, drenaje y tamaño real antes de decidir un trasplante.", geneticEvidence, genetic ? [] : ["genetica vinculada"]);
  }
  if (stage === "vegetative") {
    return createStageSuggestion(plant, today, 7, "Revisar estructura y preparacion de la siguiente etapa", "Evaluar altura disponible, vigor, estructura y estado sanitario. La fecha propuesta es una revision, no un pase automatico a flora.", geneticEvidence, [!plant.setup ? "tamaño del espacio" : "", !plant.lighting ? "tipo de luz" : ""].filter(Boolean));
  }
  if (stage === "early-flower") {
    return createStageSuggestion(plant, today, 5, "Revisar copa y desarrollo de floracion", "Registrar cambios, distribucion de luz y estado de hojas antes de decidir poda, defoliacion o nutricion.", geneticEvidence, floweringDateMissing);
  }
  if (stage === "late-flower") {
    return createStageSuggestion(plant, today, 4, "Revisar madurez y estado general", "Registrar observaciones y fotos. La ventana de cosecha estimada (si hay datos suficientes) aparece en una tarjeta aparte; de cualquier forma, confirmar con tricomas antes de cortar.", geneticEvidence, floweringDateMissing);
  }
  return undefined;
}

function hasDeclaredFloweringWeeks(genetic: GeneticReferenceEntry) {
  const [minWeeks, maxWeeks] = genetic.flowering_weeks_range;
  return minWeeks > 0 || maxWeeks > 0;
}

function findFloweringStartDate(plantId: string, transitions: PlantStageTransition[]): string | undefined {
  const floweringDates = transitions
    .filter((transition) => transition.plantId === plantId)
    .filter((transition) => {
      const transitionStage = normalizeStage(transition.toStage);
      return transitionStage === "early-flower" || transitionStage === "late-flower";
    })
    .map((transition) => transition.changedAt.slice(0, 10))
    .sort();
  return floweringDates[0];
}

function getHarvestWindowSuggestion(
  plant: Plant,
  genetic: GeneticReferenceEntry | undefined,
  floweringStart: string | undefined
): CultivationSuggestion | undefined {
  if (!genetic || !floweringStart || !hasDeclaredFloweringWeeks(genetic)) return undefined;

  const [minWeeks, maxWeeks] = genetic.flowering_weeks_range;
  const windowFrom = addDays(floweringStart, minWeeks * 7);
  const windowTo = addDays(floweringStart, maxWeeks * 7);

  return {
    id: `${plant.id}-harvest-window-${windowFrom}`,
    title: "Ventana estimada de cosecha",
    description: `Calculada desde el ${formatIsoForCopy(floweringStart)} (inicio de floracion que registraste) mas las ${minWeeks}-${maxWeeks} semanas de floracion publicadas para ${genetic.name}: entre el ${formatIsoForCopy(windowFrom)} y el ${formatIsoForCopy(windowTo)}. Es una estimacion orientativa, no una fecha exacta: confirmar siempre con revision de tricomas antes de cortar.`,
    dueDate: windowFrom,
    kind: "review",
    priority: "medium",
    rationale: "Estimacion calculada a partir de la fecha de inicio de floracion que declaraste en el historial de etapas y el rango de floracion publicado por el banco de semillas. No reemplaza la revision visual de tricomas.",
    evidence: [
      { label: "Inicio de floracion", origin: "user", value: floweringStart },
      { label: "Floracion publicada", origin: "catalog", value: `${minWeeks}-${maxWeeks}`, unit: "semanas", note: genetic.source },
      { label: "Ventana estimada", origin: "calculated", value: `${windowFrom} a ${windowTo}` }
    ],
    missingInputs: []
  };
}

function formatIsoForCopy(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${isoDate}T12:00:00Z`));
}

function createStageSuggestion(
  plant: Plant,
  today: string,
  offset: number,
  title: string,
  description: string,
  evidence: DataPoint[],
  missingInputs: string[]
): CultivationSuggestion {
  return {
    id: `${plant.id}-stage-${addDays(today, offset)}`,
    title,
    description,
    dueDate: addDays(today, offset),
    kind: "review",
    priority: "medium",
    rationale: `Revision sugerida por la etapa declarada por el usuario: ${plant.stage}.`,
    evidence: [{ label: "Etapa", origin: "user", value: plant.stage }, ...evidence],
    missingInputs
  };
}

function normalizeStage(stage: string) {
  const value = normalize(stage);
  if (value.includes("flor") && value.includes("tard")) return "late-flower" as const;
  if (value.includes("flor")) return "early-flower" as const;
  if (value.includes("veget") || value.includes("crecimiento")) return "vegetative" as const;
  if (value.includes("cosecha") || value.includes("secado")) return "harvest" as const;
  return "seed" as const;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
