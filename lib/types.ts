export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

export type Dictionary = {
  hero: {
    kicker: string;
    title: string;
    body: string;
  };
};

export type GrowMode = "Exterior" | "Interior" | "Invernadero";

export type DataOrigin = "catalog" | "calculated" | "measurement" | "missing" | "suggestion" | "user";

export type DataConfidence = "high" | "low" | "medium" | "unknown";

export type DataPoint<T = string | number | boolean | null> = {
  capturedAt?: string;
  confidence?: DataConfidence;
  label: string;
  note?: string;
  origin: DataOrigin;
  unit?: string;
  value: T;
};

export type GrowSpace = {
  id: string;
  name: string;
  mode: GrowMode;
  region: string;
  privacyLevel: "Region aproximada" | "Interior privado";
};

export type Plant = {
  id: string;
  spaceId: string;
  name: string;
  variety: string;
  startedAt: string;
  stage: string;
  mode: GrowMode;
  pot: string;
  substrate: string;
  lighting: string;
  photoperiodHours?: number;
  bank?: string;
  legalRecordStatus?: string;
  setup?: string;
  lifecycle?: "active" | "archived";
  completedAt?: string;
  closingNotes?: string;
  finalWetWeightG?: number;
  finalDryWeightG?: number;
  cycleOutcome?: "completed" | "partial" | "stopped";
  lessonsLearned?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: "open" | "done";
  frequency: "Manual" | "Diaria" | "Semanal" | "Recurrente";
  category: "Riego" | "Mantenimiento" | "Observacion" | "Registro";
  dueDate?: string;
  plantId?: string;
};

export type CareEntry = {
  id: string;
  plantId?: string;
  title: string;
  createdAt: string;
  note: string;
  photoDataUrl?: string;
  tags: string[];
};

export type PlantMeasurement = {
  id: string;
  plantId: string;
  measuredAt: string;
  source: "device" | "manual" | "sensor";
  temperatureC?: number;
  leafTemperatureC?: number;
  ambientHumidityPercent?: number;
  substrateMoisturePercent?: number;
  heightCm?: number;
  waterAmountMl?: number;
  irrigationPh?: number;
  irrigationEcMsCm?: number;
  irrigationPpm?: number;
  runoffAmountMl?: number;
  runoffPh?: number;
  runoffEcMsCm?: number;
  ppfdUmolM2S?: number;
  lighting?: string;
  observations?: string;
  photoDataUrl?: string;
};

export type SensorDevice = {
  id: string;
  plantId: string;
  name: string;
  active: boolean;
  lastSeenAt?: string;
  createdAt: string;
};

export type PlantEnvironmentalAlertSettings = {
  plantId: string;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  humidityMinPercent?: number;
  humidityMaxPercent?: number;
  vpdMinKpa?: number;
  vpdMaxKpa?: number;
  substrateMoistureMinPercent?: number;
  substrateMoistureMaxPercent?: number;
};

export type IrrigationRecipe = {
  id: string;
  name: string;
  waterAmountMl?: number;
  irrigationPh?: number;
  irrigationEcMsCm?: number;
  irrigationPpm?: number;
  observations?: string;
  inventoryItemId?: string;
  inventoryAmountPerPlant?: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: "nutrient" | "substrate" | "treatment" | "other";
  quantity: number;
  unit: string;
  minimumQuantity?: number;
  notes?: string;
};

export type PlantInspection = {
  id: string;
  plantId: string;
  inspectedAt: string;
  category: "pest" | "symptom" | "structure" | "other";
  area: string;
  severity: "low" | "medium" | "high";
  observation: string;
  photoDataUrl?: string;
  followUpDate?: string;
  status: "open" | "resolved";
};

export type PlantAnalysisContext = {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  measurements: PlantMeasurement[];
  missingData: string[];
  plant: Plant;
  tasks: Task[];
  timelineSummary: DataPoint[];
};

export type PlantInsight = {
  id: string;
  createdAt: string;
  plantId: string;
  title: string;
  body: string;
  evidence: DataPoint[];
  kind: "alert" | "comparison" | "missing-data" | "trend";
  source: "calculated" | "suggestion";
};

export type CalendarDay = {
  isoDate: string;
  label: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  items: string[];
};

export type CalendarEventKind = "watering" | "photo" | "cleaning" | "review";

export type CalendarEventRecurrence = {
  active: boolean;
  everyDays: number;
  endDate?: string;
};

export type CalendarEvent = {
  id: string;
  plantId: string;
  title: string;
  description: string;
  kind: CalendarEventKind;
  startDate: string;
  recurrence?: CalendarEventRecurrence;
  completedDates: string[];
  source: "manual" | "horticultural";
};

export type CalendarEventOccurrence = {
  occurrenceId: string;
  eventId: string;
  plantId: string;
  title: string;
  description: string;
  kind: CalendarEventKind;
  date: string;
  completed: boolean;
  source: CalendarEvent["source"];
};
