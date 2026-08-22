"use client";

import { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bug, Camera, Droplet, Eye, Leaf, MoonStar, NotebookPen, Scissors, Sparkles, Sun, Thermometer, type LucideIcon } from "lucide-react";

import { Card } from "@/components/card";
import { CopyValueButton } from "@/components/copy-button";
import { GeneticFinderWizard } from "@/components/genetic-finder-wizard";
import { PlantPhotoTimeline } from "@/components/plant-photo-timeline";
import { PlantQrPanel } from "@/components/plant-qr-code";
import { PlantTimeline } from "@/components/plant-timeline";
import { PushNotificationsPanel } from "@/components/push-notifications-panel";
import { TrichomeAnalyzer } from "@/components/trichome-analyzer";
import { SeedsSection } from "@/components/seeds-section";
import {
  buildMonthGrid,
  buildWeekGrid,
  addDays,
  addMonths,
  addYears,
  createEventId,
  expandEventOccurrences,
  fromYearMonthValue,
  getEventKindLabel,
  getMonthStartIso,
  getYearMonthValue,
  getTodayIso,
  parseIsoDate,
  toIsoDate
} from "@/lib/calendar-events";
import {
  getInternalSectionHref,
  getSectionHref,
  navigationByLocale,
  type AppSection,
  type NavigationItem
} from "@/lib/navigation";
import { getGeneticsCatalogAlphabetically, type GeneticReferenceEntry } from "@/lib/genetics-catalog";
import { requestReminderNotification } from "@/lib/notifications";
import { assessPlantEnvironment, getConfiguredEnvironmentalAlerts, type EnvironmentalStatus } from "@/lib/environment-intelligence";
import { buildCultivationSuggestions, type CultivationSuggestion } from "@/lib/cultivation-suggestions";
import { calculateHorticulturePlan, seedCatalog, type HorticulturePlanInput } from "@/lib/seed-catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import {
  locales,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarEventOccurrence,
  type CareEntry,
  type Dictionary,
  type GrowSpace,
  type IrrigationRecipe,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementContext,
  type Locale,
  type Plant,
  type PlantEnvironmentalAlertSettings,
  type PlantMeasurement,
  type PlantStageTransition,
  type PlantInspection,
  type ProductCatalogItem,
  type SensorDevice,
  type Task
} from "@/lib/types";
import { getDeviceWeather, getWeatherReadiness, type WeatherReadiness } from "@/lib/weather";

type AppShellProps = {
  calendarEvents: CalendarEvent[];
  currentSection: AppSection;
  dictionary: Dictionary;
  entries: CareEntry[];
  locale: Locale;
  plants: Plant[];
  spaces: GrowSpace[];
  tasks: Task[];
};

type AgendaItem = {
  id: string;
  title: string;
  description: string;
  status: "open" | "done";
  frequency: Task["frequency"];
  category: Task["category"];
  plantId?: string;
  source: "task" | "event";
  eventId?: string;
  occurrenceDate?: string;
};

type QuickPlantInput = {
  name: string;
  seedId: string;
  startDate: string;
  region: string;
  mode: Plant["mode"];
  pot: string;
  potCount: number;
  substrate: string;
  reminderOffset: number;
  recurrenceDays: number;
};

type FirstCultivationInput = {
  bank: string;
  geneticName: string;
  legalRecordStatus: string;
  light: string;
  mode: Plant["mode"];
  nickname: string;
  pot: string;
  potCount: number;
  setup: string;
  startDate: string;
  substrate: string;
  humidityReminderOffset: number;
  photoReminderOffset: number;
};

type AppSnapshot = {
  acknowledgedEnvironmentalAlerts: string[];
  environmentalAlerts: PlantEnvironmentalAlertSettings[];
  entries: CareEntry[];
  events: CalendarEvent[];
  habitDates: string[];
  measurements: PlantMeasurement[];
  inspections: PlantInspection[];
  plants: Plant[];
  savedAt: string;
  spaces: GrowSpace[];
  tasks: Task[];
  irrigationRecipes: IrrigationRecipe[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  productCatalog: ProductCatalogItem[];
  stageTransitions: PlantStageTransition[];
};

// El tono define el color y el icono del cartel de estado de la cuenta, para
// que cada accion (enviar enlace, entrar, guardar, fallar) se vea distinta.
export type AccountTone = "error" | "info" | "pending" | "success";

type AuthRedirectResult = { kind: "error"; message: string } | { kind: "processing" } | null;

/**
 * Traduce los codigos de error que Supabase devuelve en la URL al volver del
 * enlace del email. Sin esto el usuario solo veia "Sin sesion", sin ninguna
 * pista de por que no habia entrado.
 */
function describeAuthError(errorCode: string | null, errorDescription: string | null) {
  const readable = (errorDescription ?? "").trim();

  if (errorCode === "otp_expired" || /expired/i.test(readable)) {
    return "El enlace ya vencio o se uso antes. Pedi uno nuevo: duran poco y sirven una sola vez.";
  }

  if (errorCode === "access_denied" || /access denied/i.test(readable)) {
    return "Supabase rechazo el enlace. Suele pasar si se abrio en otro navegador o si falta autorizar la URL del sitio en Supabase.";
  }

  return readable ? `No se pudo completar el acceso: ${readable}` : "No se pudo completar el acceso con el enlace del email.";
}

/**
 * Traduce el error que devuelve Supabase al pedir el enlace de acceso.
 *
 * El motivo mas frecuente es el limite de envios: el servicio de email
 * incorporado de Supabase manda como maximo 2 correos por hora, y exige 60
 * segundos entre pedidos del mismo usuario. Con un mensaje generico eso era
 * indistinguible de un email mal escrito o de un problema de conexion.
 */
function describeSendLinkError(error: unknown) {
  const readable = (error instanceof Error ? error.message : typeof error === "string" ? error : "").trim();
  const errorCode = getErrorDetail(error, "code") || getErrorDetail(error, "error_code");
  const status = getErrorDetail(error, "status");
  const combinedError = [readable, errorCode, status].filter(Boolean).join(" ");

  const waitSeconds = readable.match(/after (\d+) seconds?/i)?.[1];

  if (waitSeconds) {
    return `Hay que esperar ${waitSeconds} segundos antes de pedir otro enlace: Supabase no deja pedirlos seguidos.`;
  }

  if (/rate limit|too many requests|429/i.test(combinedError)) {
    return "Se llego al limite de correos que Supabase manda por hora (son 2). Espera un rato y volve a intentar, o configura un servicio de email propio.";
  }

  // Va antes que el chequeo de email invalido: el texto que devuelve Supabase
  // es "Email address not authorized", que tambien contiene "email address" y
  // caeria en el mensaje equivocado ("revisa que este bien escrito"), mandando
  // a corregir una direccion que en realidad esta perfecta.
  if (/not authorized/i.test(combinedError)) {
    return "Mientras el proyecto use el correo de prueba de Supabase, solo llegan enlaces a las direcciones del equipo. Para que entren otras personas hay que configurar un servicio de email propio.";
  }

  if (/unexpected_failure|error sending magic link email|\b500\b/i.test(combinedError)) {
    return "Supabase no pudo enviar el email de acceso. No parece un problema de conexion: revisa Authentication > Logs y la configuracion de SMTP o Email Templates en Supabase.";
  }

  if (/invalid|email address/i.test(combinedError)) {
    return "Supabase no acepto ese email. Revisa que este bien escrito.";
  }

  // Ante un error inesperado Supabase a veces devuelve el cuerpo crudo, que
  // puede ser un JSON vacio: mostrarlo no le sirve a nadie.
  const esTextoUtil = readable.length > 3 && !/^[[{]/.test(readable);

  return esTextoUtil
    ? `No pudimos enviar el enlace: ${readable}`
    : "No pudimos enviar el enlace. Revisa tu conexion e intenta de nuevo en un momento.";
}

function getErrorDetail(error: unknown, key: "code" | "error_code" | "status") {
  if (!error || typeof error !== "object" || !(key in error)) return "";

  const value = (error as Record<string, unknown>)[key];
  return typeof value === "number" || typeof value === "string" ? String(value) : "";
}

/**
 * Lee el resultado que dejo el enlace del email en la URL. Supabase lo manda
 * en el fragmento (#) o en la query (?), segun el tipo de flujo.
 */
function readAuthRedirectResult(): AuthRedirectResult {
  if (typeof window === "undefined") return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const readParam = (name: string) => hashParams.get(name) ?? queryParams.get(name);

  const errorCode = readParam("error_code");
  const errorDescription = readParam("error_description");

  if (readParam("error") || errorCode || errorDescription) {
    return { kind: "error", message: describeAuthError(errorCode, errorDescription) };
  }

  if (readParam("access_token") || readParam("code")) {
    return { kind: "processing" };
  }

  return null;
}

export type AccountStatus = {
  email: string;
  isConfigured: boolean;
  isSignedIn: boolean;
  message: string;
  tone: AccountTone;
  userId: string;
};

type JournalEntryUpdates = Partial<Pick<CareEntry, "createdAt" | "note" | "photoDataUrl" | "plantId" | "tags" | "title">>;

type SnapshotRow = {
  payload: Json;
};

type SnapshotTableClient = {
  from: (table: "user_app_snapshots") => {
    select: (columns: "payload") => {
      eq: (column: "user_id" | "key", value: string) => {
        eq: (column: "user_id" | "key", value: string) => {
          maybeSingle: () => Promise<{ data: SnapshotRow | null; error: unknown }>;
        };
        maybeSingle: () => Promise<{ data: SnapshotRow | null; error: unknown }>;
      };
    };
    upsert: (value: { key: string; payload: Json; user_id: string }) => Promise<{ error: unknown }>;
  };
};

type SensorDeviceRow = {
  active: boolean;
  created_at: string;
  id: string;
  last_seen_at: string | null;
  name: string;
  plant_ref: string;
};

type SensorMeasurementRow = {
  ambient_humidity_percent: number | null;
  id: string;
  leaf_temperature_c: number | null;
  measured_at: string;
  observations: string | null;
  plant_ref: string;
  ppfd_umol_m2_s: number | null;
  substrate_moisture_percent: number | null;
  temperature_c: number | null;
};

type SensorDeviceClient = {
  from: (table: "sensor_devices") => {
    select: (columns: string) => { order: (column: "created_at") => Promise<{ data: SensorDeviceRow[] | null; error: unknown }> };
    update: (value: { active: boolean }) => { eq: (column: "id", value: string) => Promise<{ error: unknown }> };
  };
  rpc: (
    fn: "create_sensor_device",
    args: { device_name: string; target_plant_ref: string }
  ) => Promise<{ data: Array<{ device_id: string; device_token: string }> | null; error: unknown }>;
};

type SensorMeasurementClient = {
  from: (table: "sensor_measurements") => {
    select: (columns: "*") => {
      order: (column: "measured_at", options: { ascending: false }) => {
        limit: (count: number) => Promise<{ data: SensorMeasurementRow[] | null; error: unknown }>;
      };
    };
  };
};

/** Un cultivo ajeno que alguien me dejo mirar. */
type SharedView = {
  ownerId: string;
  ownerLabel: string;
};

type ShareRow = {
  code: string;
  owner_id: string;
  owner_label: string | null;
  viewer_id: string | null;
};

type ShareTableClient = {
  from: (table: "snapshot_shares") => {
    delete: () => {
      eq: (column: "id" | "owner_id" | "viewer_id", value: string) => Promise<{ error: unknown }>;
    };
    insert: (value: { code: string; owner_id: string; owner_label: string }) => Promise<{ error: unknown }>;
    select: (columns: string) => {
      eq: (column: "owner_id" | "viewer_id", value: string) => Promise<{ data: ShareRow[] | null; error: unknown }>;
    };
  };
  rpc: (
    fn: "claim_snapshot_share",
    args: { share_code: string }
  ) => Promise<{ data: Array<{ owner_id: string; owner_label: string | null }> | null; error: unknown }>;
};

/**
 * Codigo de invitacion. Se evitan las letras y numeros que se confunden al
 * leerlos en voz alta o al pasarlos por mensaje (O/0, I/1, S/5).
 */
/**
 * La vista compartida se guarda en sessionStorage y no en localStorage a
 * proposito: cada seccion de la app es una pagina distinta, asi que cambiar de
 * pestana vuelve a montar todo y sin esto se perdia de inmediato. Al ser de
 * sesion, se borra sola al cerrar la pestana, que es el comportamiento seguro.
 */
const viewingShareStorageKey = "plantcare-viewing-share";

function readStoredShare(): SharedView | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(viewingShareStorageKey);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SharedView>;

    return parsed.ownerId ? { ownerId: parsed.ownerId, ownerLabel: parsed.ownerLabel ?? "Otra persona" } : null;
  } catch {
    return null;
  }
}

function writeStoredShare(share: SharedView | null) {
  if (typeof window === "undefined") return;

  if (share) {
    window.sessionStorage.setItem(viewingShareStorageKey, JSON.stringify(share));
  } else {
    window.sessionStorage.removeItem(viewingShareStorageKey);
  }
}

function createShareCode() {
  const alphabet = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

const careScore = 86;
const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const manualPlantId = "plant-manual-regulated";
const geneticsCatalogAlphabetically = getGeneticsCatalogAlphabetically();
const legalBankOptions = ["Catalogo propio", "BSF", "Zig Zag", "Banco legal local", "Otro banco autorizado", "No declarado"];
const legalRecordStatusOptions = ["Confirmado", "Pendiente de verificar", "No aplica"];
const legalSetupOptions = [
  "40 x 40 cm",
  "60 x 60 cm",
  "80 x 80 cm",
  "100 x 100 cm",
  "120 x 120 cm",
  "Terraza",
  "Balcon",
  "Patio",
  "Invernaculo chico",
  "Otro espacio declarado"
];
const legalLightOptions = ["LED", "Sodio", "Mixta", "Luz natural", "No declarado"];
const legalPotOptions = ["No declarado", "3 L", "5 L", "7 L", "10 L", "15 L", "20 L", "25 L", "Otro volumen"];
const legalSubstrateOptions = ["No declarado", "Organico liviano", "Compost y fibra", "Drenante", "Universal", "Otro declarado"];
const firstReminderOptions = ["0", "3", "7", "14"];
const firstReminderLabels = {
  "0": "Sin recordatorio",
  "3": "En 3 dias",
  "7": "En 7 dias",
  "14": "En 14 dias"
};
// Iconos lineales para el calendario, en vez de emoji.
//
// Un emoji se renderiza distinto segun el sistema operativo y nunca lee como
// producto profesional. `kind` solo tiene 4 valores en la base de datos
// (watering/photo/cleaning/review), asi que no alcanza para distinguir poda,
// defoliar, fumigar y fotoperiodo entre si: esas cuatro comparten "review".
// El icono real se resuelve con `getEventIconKey`, que mira la primera
// palabra del titulo (ver mas abajo) y cae a un icono por `kind` si no la
// reconoce. Los titulos guardados antes de este cambio seguian el patron
// "💧 Riego": `normalizeCalendarTitle` descarta el emoji y deja "riego", asi
// que la deteccion funciona igual para eventos viejos y nuevos.
type EventIconKey = "watering" | "photo" | "cleaning" | "prune" | "defoliate" | "spray" | "photoperiod";

const eventIconComponents: Record<EventIconKey, LucideIcon> = {
  watering: Droplet,
  photo: Camera,
  cleaning: Sparkles,
  prune: Scissors,
  defoliate: Leaf,
  spray: Bug,
  photoperiod: MoonStar
};

const eventIconKeyByFirstWord: Record<string, EventIconKey> = {
  riego: "watering",
  foto: "photo",
  limpieza: "cleaning",
  poda: "prune",
  defoliar: "defoliate",
  fumigar: "spray",
  fotoperiodo: "photoperiod"
};

const calendarQuickActions: Array<{
  description: string;
  iconKey: EventIconKey;
  kind: CalendarEventKind;
  label: string;
  title: string;
}> = [
  {
    description: "Evento manual agregado desde el calendario para revisar riego.",
    iconKey: "watering",
    kind: "watering",
    label: "Riego",
    title: "Riego"
  },
  {
    description: "Evento manual agregado desde el calendario para registrar una foto.",
    iconKey: "photo",
    kind: "photo",
    label: "Foto",
    title: "Foto"
  },
  {
    description: "Evento manual agregado desde el calendario para limpieza o mantenimiento.",
    iconKey: "cleaning",
    kind: "cleaning",
    label: "Limpieza",
    title: "Limpieza"
  },
  {
    description: "Evento manual agregado desde el calendario para poda declarada por el usuario.",
    iconKey: "prune",
    kind: "review",
    label: "Poda",
    title: "Poda"
  },
  {
    description: "Evento manual agregado desde el calendario para defoliar o quitar hojas segun decision del usuario.",
    iconKey: "defoliate",
    kind: "review",
    label: "Defoliar",
    title: "Defoliar"
  },
  {
    description: "Evento manual agregado desde el calendario para revision o fumigacion declarada por el usuario.",
    iconKey: "spray",
    kind: "review",
    label: "Fumigar",
    title: "Fumigar"
  },
  {
    description: "Evento manual agregado desde el calendario para el cambio de fotoperiodo a 12/12 (inicio de floracion).",
    iconKey: "photoperiod",
    kind: "review",
    label: "Fotoperiodo 12/12",
    title: "Fotoperiodo 12/12"
  }
];
const storageKeys = {
  acknowledgedEnvironmentalAlerts: "plantcare-acknowledged-environmental-alerts",
  calendarDate: "plantcare-calendar-selected-date",
  entries: "plantcare-journal-entries",
  events: "plantcare-calendar-events",
  habitDates: "plantcare-habit-dates",
  measurements: "plantcare-plant-measurements",
  inspections: "plantcare-plant-inspections",
  irrigationRecipes: "plantcare-irrigation-recipes",
  inventoryItems: "plantcare-inventory-items",
  inventoryMovements: "plantcare-inventory-movements",
  productCatalog: "plantcare-product-catalog",
  stageTransitions: "plantcare-stage-transitions",
  environmentalAlerts: "plantcare-environmental-alerts",
  onboarding: "plantcare-onboarding-complete",
  plants: "plantcare-plants",
  quickChecks: "plantcare-quick-checks",
  spaces: "plantcare-spaces",
  tasks: "plantcare-tasks",
  weatherConsent: "plantcare-weather-consent",
  weatherSnapshot: "plantcare-weather-snapshot"
};

const remoteSnapshotKey = "primary";

export function AppShell({
  calendarEvents,
  currentSection,
  dictionary,
  entries,
  locale,
  plants,
  spaces,
  tasks
}: AppShellProps) {
  const [plantState, setPlantState] = useStoredState(storageKeys.plants, plants);
  // Los espacios (invernadero, balcon, etc.) llegaban como prop fija de demo:
  // no habia forma de crear, renombrar ni borrar uno propio. Ahora es estado
  // como el resto, con el mismo guardado local + remoto.
  const [spaceState, setSpaceState] = useStoredState(storageKeys.spaces, spaces);
  const [taskState, setTaskState] = useStoredState(storageKeys.tasks, tasks);
  const [eventState, setEventState] = useStoredState(storageKeys.events, calendarEvents);
  const [entryState, setEntryState] = useStoredState(storageKeys.entries, entries);
  const [habitDates, setHabitDates] = useStoredState<string[]>(storageKeys.habitDates, []);
  const [measurementState, setMeasurementState] = useStoredState<PlantMeasurement[]>(storageKeys.measurements, []);
  const [inspectionState, setInspectionState] = useStoredState<PlantInspection[]>(storageKeys.inspections, []);
  const [irrigationRecipeState, setIrrigationRecipeState] = useStoredState<IrrigationRecipe[]>(storageKeys.irrigationRecipes, []);
  const [inventoryItemState, setInventoryItemState] = useStoredState<InventoryItem[]>(storageKeys.inventoryItems, []);
  const [inventoryMovementState, setInventoryMovementState] = useStoredState<InventoryMovement[]>(storageKeys.inventoryMovements, []);
  const [productCatalogState, setProductCatalogState] = useStoredState<ProductCatalogItem[]>(storageKeys.productCatalog, []);
  const [stageTransitionState, setStageTransitionState] = useStoredState<PlantStageTransition[]>(storageKeys.stageTransitions, []);
  const [environmentalAlertState, setEnvironmentalAlertState] = useStoredState<PlantEnvironmentalAlertSettings[]>(storageKeys.environmentalAlerts, []);
  const [acknowledgedEnvironmentalAlerts, setAcknowledgedEnvironmentalAlerts] = useStoredState<string[]>(storageKeys.acknowledgedEnvironmentalAlerts, []);
  const [weather, setWeather] = useState<WeatherReadiness>(() => getStoredWeatherSnapshot() ?? getWeatherReadiness("Ubicacion sin conectar"));
  const [weatherStatus, setWeatherStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(() => ({
    email: "",
    isConfigured: isSupabaseConfigured(),
    isSignedIn: false,
    message: isSupabaseConfigured()
      ? "Conecta una cuenta para guardar datos por usuario."
      : "Demo local: falta configurar Supabase para sincronizar entre navegadores.",
    tone: "info",
    userId: ""
  }));
  const [remoteSyncReady, setRemoteSyncReady] = useState(false);
  const [sensorDevices, setSensorDevices] = useState<SensorDevice[]>([]);
  const [sensorStatus, setSensorStatus] = useState("");
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [sharedViews, setSharedViews] = useState<SharedView[]>([]);
  const [viewingShare, setViewingShare] = useState<SharedView | null>(() => readStoredShare());
  const [shareCode, setShareCode] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [sharedNoticeCollapsed, setSharedNoticeCollapsed] = useState(false);

  // Freno de mano para el guardado. Es una referencia y no un estado porque el
  // guardado automatico corre dentro de un temporizador: si mirara el estado,
  // podria leer un valor viejo y escribir sobre los cultivos de otra persona.
  const isViewingSharedRef = useRef(false);
  // Copia de los cultivos propios de antes de entrar a mirar los de otro, para
  // devolverlos al salir sin depender de la red.
  const ownSnapshotBeforeShare = useRef<AppSnapshot | null>(null);
  const lastRestoredUserRef = useRef<string | null>(null);

  // El freno sigue al estado. Importa sobre todo al montar: si la pestana ya
  // venia mirando cultivos ajenos, tiene que quedar frenado antes de que algo
  // pueda guardarse.
  useEffect(() => {
    isViewingSharedRef.current = viewingShare !== null;
  }, [viewingShare]);
  useEffect(() => {
    setSharedNoticeCollapsed(false);
  }, [viewingShare?.ownerId]);
  // El guardado automatico corre en paralelo al manual y a la carga inicial de
  // sesion. Sin esta marca, su mensaje de exito pisaba el "Guardando..." del
  // boton y el "Sesion iniciada como ..." recien mostrado al entrar.
  const manualSaveInFlight = useRef(false);
  // Momento del ultimo mensaje que el usuario provoco a proposito (entrar,
  // guardar a mano, un error). Durante unos segundos el guardado automatico no
  // lo reemplaza, para que dé tiempo a leerlo.
  const lastAnnouncedAt = useRef(0);

  function announceAccount(update: (current: AccountStatus) => AccountStatus) {
    lastAnnouncedAt.current = Date.now();
    setAccountStatus(update);
  }

  function announceAccountStatus(nextStatus: AccountStatus) {
    lastAnnouncedAt.current = Date.now();
    setAccountStatus(nextStatus);
  }
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setShowOnboarding(window.localStorage.getItem(storageKeys.onboarding) !== "true");
  }, []);
  const todayIso = getTodayIso();
  const navItems = navigationByLocale[locale];
  const todayOccurrences = useMemo(
    () => expandEventOccurrences(eventState, todayIso, todayIso),
    [eventState, todayIso]
  );
  const agendaItems = useMemo(
    () => buildAgendaItems(taskState, todayOccurrences),
    [taskState, todayOccurrences]
  );
  const openTasks = agendaItems.filter((task) => task.status === "open").length;
  // Con prefijo: para window.location y notificaciones.
  const todayHref = getSectionHref(locale, "today");
  const calendarHref = getSectionHref(locale, "calendar");
  // Sin prefijo: para los href de next/link, que lo agrega solo.
  const todayLinkHref = getInternalSectionHref(locale, "today");
  const calendarLinkHref = getInternalSectionHref(locale, "calendar");
  const streakCount = getStreakCount(habitDates, todayIso);
  const shouldShowFirstCultivation = plantState.length === 0 && currentSection !== "privacy";
  const currentNavIndex = navItems.findIndex((item) => item.key === currentSection);
  const previousNavItem = currentNavIndex > 0 ? navItems[currentNavIndex - 1] : null;
  const nextNavItem = currentNavIndex >= 0 && currentNavIndex < navItems.length - 1 ? navItems[currentNavIndex + 1] : null;

  function handleToggleTask(item: AgendaItem) {
    if (item.source === "event" && item.eventId && item.occurrenceDate) {
      setEventState((events) => toggleEventCompletion(events, item.eventId!, item.occurrenceDate!));
      rememberHabitDate(item.occurrenceDate);
      return;
    }

    setTaskState((existingTasks) =>
      existingTasks.map((task) =>
        task.id === item.id ? { ...task, status: task.status === "done" ? "open" : "done" } : task
      )
    );
    rememberHabitDate(todayIso);
  }

  function getCurrentSnapshot(): AppSnapshot {
    return {
      acknowledgedEnvironmentalAlerts,
      entries: entryState,
      environmentalAlerts: environmentalAlertState,
      events: eventState,
      habitDates,
      measurements: measurementState,
      inspections: inspectionState,
      irrigationRecipes: irrigationRecipeState,
      inventoryItems: inventoryItemState,
      inventoryMovements: inventoryMovementState,
      productCatalog: productCatalogState,
      stageTransitions: stageTransitionState,
      plants: plantState,
      savedAt: new Date().toISOString(),
      spaces: spaceState,
      tasks: taskState
    };
  }

  function applySnapshot(snapshot: Partial<AppSnapshot>) {
    if (snapshot.acknowledgedEnvironmentalAlerts) {
      setAcknowledgedEnvironmentalAlerts(snapshot.acknowledgedEnvironmentalAlerts);
      persistStoredState(storageKeys.acknowledgedEnvironmentalAlerts, snapshot.acknowledgedEnvironmentalAlerts);
    }
    if (snapshot.spaces) {
      setSpaceState(snapshot.spaces);
      persistStoredState(storageKeys.spaces, snapshot.spaces);
    }
    if (snapshot.plants) {
      setPlantState(snapshot.plants);
      persistStoredState(storageKeys.plants, snapshot.plants);
    }
    if (snapshot.tasks) {
      setTaskState(snapshot.tasks);
      persistStoredState(storageKeys.tasks, snapshot.tasks);
    }
    if (snapshot.events) {
      setEventState(snapshot.events);
      persistStoredState(storageKeys.events, snapshot.events);
    }
    if (snapshot.entries) {
      setEntryState(snapshot.entries);
      persistStoredState(storageKeys.entries, snapshot.entries);
    }
    if (snapshot.habitDates) {
      setHabitDates(snapshot.habitDates);
      persistStoredState(storageKeys.habitDates, snapshot.habitDates);
    }
    if (snapshot.measurements) {
      setMeasurementState(snapshot.measurements);
      persistStoredState(storageKeys.measurements, snapshot.measurements);
    }
    if (snapshot.inspections) { setInspectionState(snapshot.inspections); persistStoredState(storageKeys.inspections, snapshot.inspections); }
    if (snapshot.irrigationRecipes) { setIrrigationRecipeState(snapshot.irrigationRecipes); persistStoredState(storageKeys.irrigationRecipes, snapshot.irrigationRecipes); }
    if (snapshot.inventoryItems) { setInventoryItemState(snapshot.inventoryItems); persistStoredState(storageKeys.inventoryItems, snapshot.inventoryItems); }
    if (snapshot.inventoryMovements) { setInventoryMovementState(snapshot.inventoryMovements); persistStoredState(storageKeys.inventoryMovements, snapshot.inventoryMovements); }
    if (snapshot.productCatalog) { setProductCatalogState(snapshot.productCatalog); persistStoredState(storageKeys.productCatalog, snapshot.productCatalog); }
    if (snapshot.stageTransitions) { setStageTransitionState(snapshot.stageTransitions); persistStoredState(storageKeys.stageTransitions, snapshot.stageTransitions); }
    if (snapshot.environmentalAlerts) {
      setEnvironmentalAlertState(snapshot.environmentalAlerts);
      persistStoredState(storageKeys.environmentalAlerts, snapshot.environmentalAlerts);
    }
  }

  // El guardado automatico corre solo cada vez que cambian los datos, asi que
  // no muestra el estado "Guardando..." para no hacer parpadear el cartel. El
  // guardado manual (boton "Guardar ahora") si lo muestra.
  async function saveRemoteSnapshot(nextSnapshot = getCurrentSnapshot(), options: { manual?: boolean } = {}) {
    // Primer freno: nunca escribir mientras lo que hay en pantalla es de otra
    // persona. Va antes que cualquier otra cosa a proposito.
    if (isViewingSharedRef.current) return;

    if (!accountStatus.userId || !isSupabaseConfigured()) return;

    if (options.manual) {
      manualSaveInFlight.current = true;
      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "Guardando tus datos en la cuenta...",
        tone: "pending"
      }));
    }

    try {
      const supabase = getSupabaseBrowserClient() as unknown as SnapshotTableClient;
      const { error } = await supabase.from("user_app_snapshots").upsert({
        key: remoteSnapshotKey,
        payload: nextSnapshot as unknown as Json,
        user_id: accountStatus.userId
      });

      if (error) throw error;

      if (options.manual) {
        announceAccount((currentStatus) => ({
          ...currentStatus,
          message: "Listo: tus datos quedaron guardados en tu cuenta.",
          tone: "success"
        }));
      } else {
        // El guardado automatico solo habla si no hay nada mas importante en
        // pantalla, para no tapar el mensaje de otra accion.
        const puedeHablar = !manualSaveInFlight.current && Date.now() - lastAnnouncedAt.current > 8000;

        setAccountStatus((currentStatus) =>
          puedeHablar && currentStatus.tone !== "pending"
            ? { ...currentStatus, message: "Cambios guardados automaticamente en tu cuenta.", tone: "info" }
            : currentStatus
        );
      }
    } catch {
      announceAccount((currentStatus) => ({
        ...currentStatus,
        message: "No se pudo guardar online. Revisa tu conexion e intenta de nuevo.",
        tone: "error"
      }));
    } finally {
      if (options.manual) {
        manualSaveInFlight.current = false;
      }
    }
  }

  async function loadRemoteSnapshot(userId: string, email: string) {
    try {
      const supabase = getSupabaseBrowserClient() as unknown as SnapshotTableClient;
      const { data, error } = await supabase
        .from("user_app_snapshots")
        .select("payload")
        .eq("user_id", userId)
        .eq("key", remoteSnapshotKey)
        .maybeSingle();

      if (error) throw error;

      if (data?.payload) {
        applySnapshot(data.payload as Partial<AppSnapshot>);
        announceAccountStatus({
          email,
          isConfigured: true,
          isSignedIn: true,
          message: `Sesion iniciada como ${email}. Cargamos los cultivos guardados en tu cuenta.`,
          tone: "success",
          userId
        });
      } else if (isViewingSharedRef.current) {
        // La cuenta propia no tiene respaldo todavia, pero lo que hay en
        // pantalla es de otra persona: subirlo lo dejaria guardado como propio.
        announceAccountStatus({
          email,
          isConfigured: true,
          isSignedIn: true,
          message: "Todavia no guardaste cultivos propios.",
          tone: "info",
          userId
        });
      } else {
        const firstSnapshot = getCurrentSnapshot();
        const { error: insertError } = await supabase.from("user_app_snapshots").upsert({
          key: remoteSnapshotKey,
          payload: firstSnapshot as unknown as Json,
          user_id: userId
        });

        if (insertError) throw insertError;

        announceAccountStatus({
          email,
          isConfigured: true,
          isSignedIn: true,
          message: `Sesion iniciada como ${email}. Subimos los cultivos de este dispositivo a tu cuenta.`,
          tone: "success",
          userId
        });
      }
      setRemoteSyncReady(true);
      void loadSharedViews(userId);
    } catch {
      announceAccountStatus({
        email,
        isConfigured: true,
        isSignedIn: true,
        message: "Cuenta conectada, pero falta aplicar la tabla user_app_snapshots en Supabase.",
        tone: "error",
        userId
      });
    }
  }

  async function handleSendMagicLink(email: string) {
    if (!isSupabaseConfigured()) {
      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        tone: "error"
      }));
      return;
    }

    setAccountStatus((currentStatus) => ({
      ...currentStatus,
      email,
      message: `Enviando el enlace de acceso a ${email}...`,
      tone: "pending"
    }));

    try {
      const supabase = getSupabaseBrowserClient();
      // URL fija y sin fragmento. Antes se usaba window.location.href: si el
      // usuario habia llegado por el avatar, la direccion terminaba en
      // "#cuenta" y Supabase le pegaba encima su propio "#access_token=...",
      // con lo cual el token quedaba ilegible. Ademas asi hay una sola
      // direccion que autorizar en Supabase.
      const redirectTo = `${window.location.origin}${getSectionHref(locale, "privacy")}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      });

      if (error) throw error;

      announceAccount((currentStatus) => ({
        ...currentStatus,
        email,
        message: `Listo: te enviamos un enlace a ${email}. Abrilo desde este mismo dispositivo para entrar. Puede tardar un minuto; si no llega, revisa la carpeta de spam.`,
        tone: "success"
      }));
    } catch (error) {
      announceAccount((currentStatus) => ({
        ...currentStatus,
        message: describeSendLinkError(error),
        tone: "error"
      }));
    }
  }

  async function loadSharedViews(viewerId: string) {
    try {
      const supabase = getSupabaseBrowserClient() as unknown as ShareTableClient;
      const { data, error } = await supabase
        .from("snapshot_shares")
        .select("code, owner_id, owner_label, viewer_id")
        .eq("viewer_id", viewerId);

      if (error) throw error;

      setSharedViews(
        (data ?? []).map((row) => ({
          ownerId: row.owner_id,
          ownerLabel: row.owner_label ?? "Otra persona"
        }))
      );
    } catch {
      setSharedViews([]);
    }
  }

  async function handleCreateShareCode() {
    if (!accountStatus.userId) return;

    const code = createShareCode();

    setShareMessage("Generando el codigo...");

    try {
      const supabase = getSupabaseBrowserClient() as unknown as ShareTableClient;
      const { error } = await supabase.from("snapshot_shares").insert({
        code,
        owner_id: accountStatus.userId,
        owner_label: accountStatus.email || "Cultivos compartidos"
      });

      if (error) throw error;

      setShareCode(code);
      setShareMessage("Codigo listo. Pasaselo a quien quieras que vea tus cultivos.");
    } catch {
      setShareMessage("No pudimos generar el codigo. Revisa tu conexion e intenta de nuevo.");
    }
  }

  async function handleRedeemShareCode(code: string) {
    if (!accountStatus.userId) return;

    setShareMessage("Validando el codigo...");

    try {
      const supabase = getSupabaseBrowserClient() as unknown as ShareTableClient;
      const { data, error } = await supabase.rpc("claim_snapshot_share", { share_code: code.trim().toUpperCase() });

      if (error) throw error;

      const claimed = data?.[0];

      if (!claimed) throw new Error("Codigo sin resultado");

      const nextView: SharedView = {
        ownerId: claimed.owner_id,
        ownerLabel: claimed.owner_label ?? "Otra persona"
      };

      setSharedViews((current) =>
        current.some((view) => view.ownerId === nextView.ownerId) ? current : [...current, nextView]
      );
      setShareMessage(`Listo: ya podes ver los cultivos de ${nextView.ownerLabel}.`);
    } catch (error) {
      const readable = error instanceof Error ? error.message : "";

      setShareMessage(readable ? `No se pudo usar el codigo: ${readable}` : "No se pudo usar el codigo.");
    }
  }

  /**
   * Pasa a mirar los cultivos de otra persona.
   *
   * El freno de escritura se levanta ANTES de tocar cualquier dato: si se
   * hiciera despues, el guardado automatico podria dispararse en el medio y
   * subir los cultivos ajenos a la cuenta propia.
   */
  async function handleOpenSharedView(share: SharedView, options: { restoring?: boolean } = {}) {
    isViewingSharedRef.current = true;
    // Al restaurar tras cambiar de seccion, lo que hay en pantalla ya es de la
    // otra persona: guardarlo como "copia propia" haria que al salir se
    // recuperen sus cultivos creyendo que son los mios.
    if (!options.restoring && !viewingShare) {
      ownSnapshotBeforeShare.current = getCurrentSnapshot();
    }
    setRemoteSyncReady(false);
    setViewingShare(share);
    writeStoredShare(share);
    setShowAccountDialog(false);

    try {
      const supabase = getSupabaseBrowserClient() as unknown as SnapshotTableClient;
      const consulta = supabase
        .from("user_app_snapshots")
        .select("payload")
        .eq("user_id", share.ownerId)
        .eq("key", remoteSnapshotKey)
        .maybeSingle();

      // Con limite de tiempo: si la consulta no vuelve, el usuario tiene que
      // enterarse. Colgada y en silencio seria lo peor de los dos mundos,
      // porque el aviso de "solo lectura" quedaria puesto sin datos detras.
      const { data, error } = await Promise.race([
        consulta,
        new Promise<{ data: SnapshotRow | null; error: unknown }>((_, reject) =>
          window.setTimeout(() => reject(new Error("tiempo agotado")), 12000)
        )
      ]);

      if (error) throw error;

      if (data?.payload) {
        applySnapshot(data.payload as Partial<AppSnapshot>);
        setShareMessage(`Estas viendo los cultivos de ${share.ownerLabel}.`);
      } else {
        setShareMessage(`${share.ownerLabel} todavia no guardo ningun cultivo.`);
      }
    } catch {
      setShareMessage("No pudimos abrir esos cultivos. Volve a los tuyos y proba de nuevo en un momento.");
    }
  }

  async function handleCloseSharedView() {
    const ownSnapshot = ownSnapshotBeforeShare.current;

    setViewingShare(null);
    writeStoredShare(null);
    setShareMessage("");

    if (ownSnapshot) {
      applySnapshot(ownSnapshot);
      ownSnapshotBeforeShare.current = null;

      // El freno se suelta recien aca, ya con los datos propios en pantalla,
      // para que no quede ni un instante en el que se pueda guardar algo ajeno.
      isViewingSharedRef.current = false;

      if (accountStatus.userId) {
        setRemoteSyncReady(true);
      }

      return;
    }

    // Sin copia en memoria (pasa al volver despues de cambiar de seccion) hay
    // que traer los propios del servidor, y el freno sigue puesto hasta que
    // lleguen.
    if (accountStatus.userId) {
      await loadRemoteSnapshot(accountStatus.userId, accountStatus.email || "Cuenta conectada");
    }

    isViewingSharedRef.current = false;
  }

  async function handleSignOut() {
    if (!isSupabaseConfigured()) return;

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      setRemoteSyncReady(false);
      // Al cerrar sesion no queda ningun permiso ni ninguna vista ajena
      // abierta, y el freno de escritura vuelve a su lugar.
      isViewingSharedRef.current = false;
      ownSnapshotBeforeShare.current = null;
      lastRestoredUserRef.current = null;
      setViewingShare(null);
      writeStoredShare(null);
      setSharedViews([]);
      setShareCode("");
      setShareMessage("");
      announceAccountStatus({
        email: "",
        isConfigured: true,
        isSignedIn: false,
        message: "Sesion cerrada. Los datos locales siguen en este navegador.",
        tone: "info",
        userId: ""
      });
    }
  }

  function rememberHabitDate(isoDate: string) {
    setHabitDates((existingDates) => {
      const nextDates = Array.from(new Set([...existingDates, isoDate])).sort();
      persistStoredState(storageKeys.habitDates, nextDates);
      return nextDates;
    });
  }

  function handleAddManualEvents(events: CalendarEvent[]) {
    const manualPlant: Plant = {
      id: manualPlantId,
      lighting: "Declarado por usuario",
      mode: "Interior",
      name: "Cultivo manual",
      pot: "Declarado por usuario",
      spaceId: spaceState[0]?.id ?? "space-patio",
      stage: "Agenda manual",
      startedAt: todayIso,
      substrate: "Declarado por usuario",
      variety: "Declarada por usuario"
    };
    const nextPlants = plantState.some((plant) => plant.id === manualPlantId)
      ? plantState
      : [...plantState, manualPlant];
    const nextEvents = [...events, ...eventState];

    setPlantState(nextPlants);
    setEventState(nextEvents);
    persistStoredState(storageKeys.plants, nextPlants);
    persistStoredState(storageKeys.events, nextEvents);
    persistCalendarDate(events[0]?.startDate ?? todayIso);
    void requestReminderNotification({
      body: `${events.length} recordatorio(s) manual(es) agregados.`,
      title: "PlantCare Calendar",
      url: calendarHref
    });
  }

  function handleCreateQuickPlant(input: QuickPlantInput) {
    const selectedSeed = seedCatalog.find((seed) => seed.id === input.seedId);
    const eventSource: CalendarEvent["source"] = selectedSeed?.category === "horticultural" ? "horticultural" : "manual";
    const plantName = input.name.trim() || selectedSeed?.crop || "Nueva planta";
    const potCount = Math.max(1, input.potCount);
    const nextPlants: Plant[] = Array.from({ length: potCount }, (_, index) => {
      const plantNumber = index + 1;

      return {
        id: createEventId("plant"),
        lighting: "Definida por usuario",
        mode: input.mode,
        name: potCount > 1 ? `${plantName} #${plantNumber}` : plantName,
        pot: input.pot,
        setup: `Maceta ${plantNumber} de ${potCount}`,
        spaceId: spaceState[0]?.id ?? "space-patio",
        stage: "Inicio",
        startedAt: input.startDate,
        substrate: input.substrate,
        variety: selectedSeed?.name ?? "Semilla declarada"
      };
    });
    const nextEvents: CalendarEvent[] = nextPlants.flatMap((plant) => {
      const plantEvents: CalendarEvent[] = [{
        completedDates: [],
        description: `Evento creado desde el alta rapida de planta para ${plant.name}.`,
        id: createEventId("event-review"),
        kind: "review",
        plantId: plant.id,
        source: eventSource,
        startDate: input.startDate,
        title: "Revision inicial"
      }];

      if (input.reminderOffset > 0) {
        plantEvents.push({
        completedDates: [],
        description: `Recordatorio declarado en el alta rapida para ${plant.name}.`,
        id: createEventId("event-water"),
        kind: "watering",
        plantId: plant.id,
        recurrence:
          input.recurrenceDays > 0
            ? {
                active: true,
                everyDays: input.recurrenceDays
              }
            : undefined,
        source: eventSource,
        startDate: offsetDate(input.startDate, input.reminderOffset),
        title: "Revisar riego"
      });
      }

      return plantEvents;
    });

    const nextPlantState = [...nextPlants, ...plantState];
    const nextEventState = [...nextEvents, ...eventState];

    setPlantState(nextPlantState);
    setEventState(nextEventState);
    persistStoredState(storageKeys.plants, nextPlantState);
    persistStoredState(storageKeys.events, nextEventState);
    void requestReminderNotification({
      body: "Se creo un recordatorio para tu nueva planta.",
      title: "PlantCare Calendar",
      url: getSectionHref(locale, "calendar")
    });
    goToCalendar(nextEvents[0]?.startDate ?? todayIso, locale);
  }

  function handleCreateFirstCultivation(input: FirstCultivationInput) {
    const plantName = input.nickname.trim() || input.geneticName.trim() || "Cultivo legal";
    const potCount = Math.max(1, input.potCount);
    const nextPlants: Plant[] = Array.from({ length: potCount }, (_, index) => {
      const plantNumber = index + 1;

      return {
        bank: input.bank,
        id: createEventId("plant-manual"),
        legalRecordStatus: input.legalRecordStatus,
        lighting: input.light,
        mode: input.mode,
        name: potCount > 1 ? `${plantName} #${plantNumber}` : plantName,
        pot: input.pot,
        setup: `${input.setup} - Maceta ${plantNumber} de ${potCount}`,
        spaceId: spaceState[0]?.id ?? "space-patio",
        stage: "Inicio declarado",
        startedAt: input.startDate,
        substrate: input.substrate,
        variety: input.geneticName.trim() || "Genetica declarada por usuario"
      };
    });
    const nextEvents: CalendarEvent[] = nextPlants.flatMap((plant) => {
      const plantEvents: CalendarEvent[] = [{
        completedDates: [],
        description: `Alta manual de ${plant.name}. Banco: ${input.bank}. Registro legal: ${input.legalRecordStatus}.`,
        id: createEventId("event-review"),
        kind: "review",
        plantId: plant.id,
        source: "manual",
        startDate: input.startDate,
        title: "Inicio de cultivo declarado"
      }];

      if (input.humidityReminderOffset > 0) {
        plantEvents.push({
        completedDates: [],
        description: `Recordatorio manual para revisar humedad de ${plant.name} antes de decidir riego.`,
        id: createEventId("event-water"),
        kind: "watering",
        plantId: plant.id,
        source: "manual",
        startDate: offsetDate(input.startDate, input.humidityReminderOffset),
        title: "Revision de humedad"
      });
      }

      if (input.photoReminderOffset > 0) {
        plantEvents.push({
        completedDates: [],
        description: `Recordatorio manual para sumar foto y nota a la bitacora de ${plant.name}.`,
        id: createEventId("event-photo"),
        kind: "photo",
        plantId: plant.id,
        source: "manual",
        startDate: offsetDate(input.startDate, input.photoReminderOffset),
        title: "Registro fotografico"
      });
      }

      return plantEvents;
    });

    const nextPlantState = [...nextPlants, ...plantState];
    const nextEventState = [...nextEvents, ...eventState];

    setPlantState(nextPlantState);
    setEventState(nextEventState);
    persistStoredState(storageKeys.plants, nextPlantState);
    persistStoredState(storageKeys.events, nextEventState);
    persistCalendarDate(nextEvents[0]?.startDate ?? todayIso);
    void requestReminderNotification({
      body: "Primer cultivo creado con datos manuales.",
      title: "PlantCare Calendar",
      url: calendarHref
    });
    goToCalendar(nextEvents[0]?.startDate ?? todayIso, locale);
  }

  // Cada maceta es una planta propia desde el alta, pero hasta ahora no habia
  // forma de cambiarle nada despues: si dos macetas del mismo espacio tenian
  // geneticas distintas, no se podia reflejar.
  function handleUpdatePlant(plantId: string, updates: Partial<Plant>) {
    const nextPlants = plantState.map((plant) => (plant.id === plantId ? { ...plant, ...updates } : plant));

    setPlantState(nextPlants);
    persistStoredState(storageKeys.plants, nextPlants);
  }

  function handleCreatePlant(plant: Plant) {
    const nextPlants = [plant, ...plantState];
    setPlantState(nextPlants);
    persistStoredState(storageKeys.plants, nextPlants);
  }

  function handleCreateSpace(space: GrowSpace) {
    const nextSpaces = [...spaceState, space];
    setSpaceState(nextSpaces);
    persistStoredState(storageKeys.spaces, nextSpaces);
  }

  function handleUpdateSpace(spaceId: string, updates: Partial<GrowSpace>) {
    const nextSpaces = spaceState.map((space) => (space.id === spaceId ? { ...space, ...updates } : space));
    setSpaceState(nextSpaces);
    persistStoredState(storageKeys.spaces, nextSpaces);
  }

  // Nunca se borra un espacio con macetas adentro sin decir a donde van: si
  // no llega reassignToSpaceId y hay macetas, no hace nada. Tampoco deja
  // borrar el ultimo espacio (siempre tiene que quedar al menos uno).
  function handleDeleteSpace(spaceId: string, reassignToSpaceId?: string) {
    if (spaceState.length <= 1) return;

    const hasPlants = plantState.some((plant) => plant.spaceId === spaceId);
    if (hasPlants && (!reassignToSpaceId || reassignToSpaceId === spaceId)) return;

    const nextSpaces = spaceState.filter((space) => space.id !== spaceId);
    setSpaceState(nextSpaces);
    persistStoredState(storageKeys.spaces, nextSpaces);

    if (hasPlants && reassignToSpaceId) {
      const nextPlants = plantState.map((plant) => (plant.spaceId === spaceId ? { ...plant, spaceId: reassignToSpaceId } : plant));
      setPlantState(nextPlants);
      persistStoredState(storageKeys.plants, nextPlants);
    }
  }

  function handleAddJournalEntry(entry: CareEntry) {
    const nextEntries = [entry, ...entryState];

    setEntryState(nextEntries);
    persistStoredState(storageKeys.entries, nextEntries);
  }

  function handleUpdateJournalEntry(entryId: string, updates: JournalEntryUpdates) {
    const nextEntries = entryState.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry));

    setEntryState(nextEntries);
    persistStoredState(storageKeys.entries, nextEntries);
  }

  function handleDeleteJournalEntry(entryId: string) {
    const nextEntries = entryState.filter((entry) => entry.id !== entryId);

    setEntryState(nextEntries);
    persistStoredState(storageKeys.entries, nextEntries);
  }

  function handleAddMeasurement(measurement: PlantMeasurement) {
    const exists = measurementState.some((item) => item.id === measurement.id);
    const nextMeasurements = exists
      ? measurementState.map((item) => item.id === measurement.id ? measurement : item)
      : [measurement, ...measurementState];

    setMeasurementState(nextMeasurements);
    persistStoredState(storageKeys.measurements, nextMeasurements);
  }

  function handleAcknowledgeEnvironmentalAlert(alertKey: string) {
    const nextAcknowledged = acknowledgedEnvironmentalAlerts.includes(alertKey) ? acknowledgedEnvironmentalAlerts : [...acknowledgedEnvironmentalAlerts, alertKey];
    setAcknowledgedEnvironmentalAlerts(nextAcknowledged);
    persistStoredState(storageKeys.acknowledgedEnvironmentalAlerts, nextAcknowledged);
  }

  function handleDeleteMeasurement(measurementId: string) {
    const nextMeasurements = measurementState.filter((measurement) => measurement.id !== measurementId);

    setMeasurementState(nextMeasurements);
    persistStoredState(storageKeys.measurements, nextMeasurements);
  }

  function handleSaveIrrigationRecipe(recipe: IrrigationRecipe) {
    const nextRecipes = irrigationRecipeState.some((item) => item.id === recipe.id) ? irrigationRecipeState.map((item) => item.id === recipe.id ? recipe : item) : [...irrigationRecipeState, recipe];
    setIrrigationRecipeState(nextRecipes); persistStoredState(storageKeys.irrigationRecipes, nextRecipes);
  }

  function handleSaveInventoryItem(item: InventoryItem, context: InventoryMovementContext = {}) {
    const existing = inventoryItemState.find((current) => current.id === item.id);
    const nextItems = existing ? inventoryItemState.map((current) => current.id === item.id ? item : current) : [...inventoryItemState, item];
    setInventoryItemState(nextItems); persistStoredState(storageKeys.inventoryItems, nextItems);
    const quantityDelta = Number((item.quantity - (existing?.quantity ?? 0)).toFixed(2));
    if (quantityDelta === 0) return;
    const product = productCatalogState.find((current) => current.id === item.catalogProductId);
    const unitsMatch = product?.packageUnit?.trim().toLowerCase() === item.unit.trim().toLowerCase();
    const unitCost = product?.price !== undefined && product.packageQuantity && unitsMatch ? product.price / product.packageQuantity : undefined;
    const movement: InventoryMovement = { currency: unitCost === undefined ? undefined : product?.currency, id: `inventory-movement-${Date.now()}-${item.id}`, inventoryItemId: item.id, itemName: item.name, kind: context.kind ?? (existing ? "adjustment" : "initial"), occurredAt: context.occurredAt ?? new Date().toISOString(), plantIds: context.plantIds, quantityAfter: item.quantity, quantityDelta, reason: context.reason ?? (existing ? "Ajuste manual confirmado por el usuario." : "Existencia inicial declarada por el usuario."), totalCost: unitCost === undefined || quantityDelta >= 0 ? undefined : Number((Math.abs(quantityDelta) * unitCost).toFixed(2)), unit: item.unit, unitCost: unitCost === undefined ? undefined : Number(unitCost.toFixed(4)) };
    const nextMovements = [movement, ...inventoryMovementState];
    setInventoryMovementState(nextMovements); persistStoredState(storageKeys.inventoryMovements, nextMovements);
  }

  function handleSaveProductCatalogItem(item: ProductCatalogItem) {
    const nextItems = productCatalogState.some((existing) => existing.id === item.id) ? productCatalogState.map((existing) => existing.id === item.id ? item : existing) : [...productCatalogState, item];
    setProductCatalogState(nextItems); persistStoredState(storageKeys.productCatalog, nextItems);
  }

  function handleSaveStageTransition(transition: PlantStageTransition) {
    const nextTransitions = [transition, ...stageTransitionState.filter((item) => item.id !== transition.id)];
    setStageTransitionState(nextTransitions); persistStoredState(storageKeys.stageTransitions, nextTransitions);
    handleUpdatePlant(transition.plantId, { stage: transition.toStage });
  }

  function handleSaveInspection(inspection: PlantInspection) {
    const nextInspections = inspectionState.some((item) => item.id === inspection.id) ? inspectionState.map((item) => item.id === inspection.id ? inspection : item) : [inspection, ...inspectionState];
    setInspectionState(nextInspections); persistStoredState(storageKeys.inspections, nextInspections);
  }

  function handleUpdateEnvironmentalAlerts(settings: PlantEnvironmentalAlertSettings) {
    const nextSettings = [...environmentalAlertState.filter((item) => item.plantId !== settings.plantId), settings];
    setEnvironmentalAlertState(nextSettings);
    persistStoredState(storageKeys.environmentalAlerts, nextSettings);
  }

  async function refreshSensorData() {
    if (!accountStatus.userId || !accountStatus.isSignedIn || viewingShare) return;

    try {
      const deviceClient = getSupabaseBrowserClient() as unknown as SensorDeviceClient;
      const measurementClient = getSupabaseBrowserClient() as unknown as SensorMeasurementClient;
      const [devicesResult, measurementsResult] = await Promise.all([
        deviceClient.from("sensor_devices").select("id,plant_ref,name,active,last_seen_at,created_at").order("created_at"),
        measurementClient.from("sensor_measurements").select("*").order("measured_at", { ascending: false }).limit(250)
      ]);

      if (devicesResult.error) throw devicesResult.error;
      if (measurementsResult.error) throw measurementsResult.error;

      setSensorDevices((devicesResult.data ?? []).map((device) => ({
        active: device.active,
        createdAt: device.created_at,
        id: device.id,
        lastSeenAt: device.last_seen_at ?? undefined,
        name: device.name,
        plantId: device.plant_ref
      })));

      const remoteMeasurements: PlantMeasurement[] = (measurementsResult.data ?? []).map((measurement) => ({
        ambientHumidityPercent: measurement.ambient_humidity_percent ?? undefined,
        id: `sensor-${measurement.id}`,
        leafTemperatureC: measurement.leaf_temperature_c ?? undefined,
        measuredAt: measurement.measured_at,
        observations: measurement.observations ?? undefined,
        plantId: measurement.plant_ref,
        ppfdUmolM2S: measurement.ppfd_umol_m2_s ?? undefined,
        source: "sensor",
        substrateMoisturePercent: measurement.substrate_moisture_percent ?? undefined,
        temperatureC: measurement.temperature_c ?? undefined
      }));

      setMeasurementState((current) => {
        const localOnly = current.filter((measurement) => !measurement.id.startsWith("sensor-"));
        const next = [...remoteMeasurements, ...localOnly];
        const currentSensorSignature = current
          .filter((measurement) => measurement.id.startsWith("sensor-"))
          .map((measurement) => `${measurement.id}:${measurement.measuredAt}`)
          .join("|");
        const nextSensorSignature = remoteMeasurements.map((measurement) => `${measurement.id}:${measurement.measuredAt}`).join("|");
        if (currentSensorSignature === nextSensorSignature) return current;
        persistStoredState(storageKeys.measurements, next);
        return next;
      });
      setSensorStatus(remoteMeasurements.length > 0 ? `Ultimas ${remoteMeasurements.length} lecturas sincronizadas.` : "Sensores conectados, todavia sin lecturas.");
    } catch {
      setSensorStatus("Falta aplicar la actualizacion de sensores en Supabase.");
    }
  }

  async function handleCreateSensorDevice(plantId: string, name: string) {
    if (viewingShare || isViewingSharedRef.current) {
      setSensorStatus("La vista compartida es solo lectura. Volve a tus cultivos para conectar sensores.");
      return null;
    }
    if (!accountStatus.isSignedIn) {
      setSensorStatus("Inicia sesion para conectar un sensor a esta maceta.");
      return null;
    }

    try {
      const supabase = getSupabaseBrowserClient() as unknown as SensorDeviceClient;
      const { data, error } = await supabase.rpc("create_sensor_device", {
        device_name: name,
        target_plant_ref: plantId
      });
      if (error) throw error;
      const token = data?.[0]?.device_token ?? null;
      await refreshSensorData();
      setSensorStatus(token ? "Dispositivo creado. Guarda el token: se muestra una sola vez." : "Dispositivo creado.");
      return token;
    } catch {
      setSensorStatus("No se pudo crear el dispositivo. Revisa que el SQL de sensores este aplicado.");
      return null;
    }
  }

  async function handleToggleSensorDevice(deviceId: string, active: boolean) {
    try {
      const supabase = getSupabaseBrowserClient() as unknown as SensorDeviceClient;
      const { error } = await supabase.from("sensor_devices").update({ active }).eq("id", deviceId);
      if (error) throw error;
      await refreshSensorData();
    } catch {
      setSensorStatus("No se pudo cambiar el estado del sensor.");
    }
  }

  function handleAddCalendarEvent(event: CalendarEvent) {
    const nextEvents = [event, ...eventState];

    setEventState(nextEvents);
    persistStoredState(storageKeys.events, nextEvents);
    persistCalendarDate(event.startDate);
    void requestReminderNotification({
      body: `${event.title} agregado al calendario.`,
      title: "PlantCare Calendar",
      url: calendarHref
    });
  }

  function handleUpdateCalendarEvent(eventId: string, updates: Partial<Pick<CalendarEvent, "description" | "startDate" | "title">>) {
    const nextEvents = eventState.map((event) => (event.id === eventId ? { ...event, ...updates } : event));

    setEventState(nextEvents);
    persistStoredState(storageKeys.events, nextEvents);
    if (updates.startDate) {
      persistCalendarDate(updates.startDate);
    }
  }

  function handleDeleteCalendarEvent(eventId: string) {
    const nextEvents = eventState.filter((event) => event.id !== eventId);

    setEventState(nextEvents);
    persistStoredState(storageKeys.events, nextEvents);
  }

  async function updateWeatherFromDevice(loadingMessage = "Esperando permiso de ubicacion...") {
    if (!("geolocation" in navigator)) {
      setWeatherStatus("Este navegador no permite leer ubicacion.");
      return;
    }

    setWeatherStatus(loadingMessage);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setWeatherStatus("Consultando clima real...");
        getDeviceWeather(position.coords.latitude, position.coords.longitude)
          .then((nextWeather) => {
            setWeather(nextWeather);
            window.localStorage.setItem(storageKeys.weatherConsent, "true");
            persistStoredState(storageKeys.weatherSnapshot, nextWeather);
            setWeatherStatus("Clima actualizado.");
          })
          .catch(() => setWeatherStatus("No se pudo consultar Open-Meteo."));
      },
      () => {
        window.localStorage.removeItem(storageKeys.weatherConsent);
        setWeatherStatus("Ubicacion no autorizada. Podes volver a intentarlo desde el navegador.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 600_000,
        timeout: 12_000
      }
    );
  }

  async function handleUseDeviceWeather() {
    await updateWeatherFromDevice();
  }

  useEffect(() => {
    if (window.localStorage.getItem(storageKeys.weatherConsent) !== "true") return;

    const timeoutId = window.setTimeout(() => {
      const storedWeather = getStoredWeatherSnapshot();

      if (storedWeather) {
        setWeather(storedWeather);
        setWeatherStatus("Usando la ubicacion y el clima guardados.");
      }

      async function refreshWeatherIfPermissionIsAlreadyGranted() {
        if (!("permissions" in navigator)) {
          setWeatherStatus("Ubicacion recordada. Actualiza manualmente si el navegador vuelve a pedir permiso.");
          return;
        }

        try {
          const permission = await navigator.permissions.query({ name: "geolocation" });

          if (permission.state === "granted") {
            await updateWeatherFromDevice("Actualizando clima segun tu ubicacion guardada...");
            return;
          }

          if (permission.state === "denied") {
            window.localStorage.removeItem(storageKeys.weatherConsent);
            setWeatherStatus("Ubicacion bloqueada en el navegador. Reactivala desde permisos del sitio.");
            return;
          }

          setWeatherStatus("Ubicacion recordada. El navegador pedira permiso solo si tocas Actualizar clima.");
        } catch {
          setWeatherStatus("Ubicacion recordada. Actualiza manualmente si el navegador vuelve a pedir permiso.");
        }
      }

      void refreshWeatherIfPermissionIsAlreadyGranted();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Lo primero: contar que trajo el enlace del email. Si volvia con error,
    // la app no mostraba nada y parecia que el enlace no hacia nada.
    const redirectResult = readAuthRedirectResult();
    let stuckTimeout: number | undefined;

    if (redirectResult?.kind === "error") {
      announceAccount((currentStatus) => ({
        ...currentStatus,
        message: redirectResult.message,
        tone: "error"
      }));
      // Se limpia la URL para que el error no reaparezca al recargar.
      window.history.replaceState(null, "", window.location.pathname);
    } else if (redirectResult?.kind === "processing") {
      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "Conectando tu cuenta...",
        tone: "pending"
      }));

      // Si el token viene mal, Supabase nunca emite el evento de sesion y el
      // cartel se quedaria girando para siempre.
      stuckTimeout = window.setTimeout(() => {
        setAccountStatus((currentStatus) =>
          currentStatus.tone === "pending" && !currentStatus.isSignedIn
            ? {
                ...currentStatus,
                message: "El enlace no llego a abrir la sesion. Pedi uno nuevo y abrilo en este mismo navegador.",
                tone: "error"
              }
            : currentStatus
        );
      }, 12000);
    }

    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    // Si la pestana ya venia mirando cultivos ajenos, se retoma esa vista en
    // vez de cargar los propios: cambiar de seccion vuelve a montar la app, y
    // sin esto la vista compartida se caia en cada toque del menu.
    function restoreSessionFor(userId: string, email: string) {
      // El evento de sesion llega varias veces seguidas al abrir la app
      // (sesion inicial, ingreso, refresco). Sin esto se disparaban tres
      // cargas identicas y tres guardados.
      if (lastRestoredUserRef.current === userId) return;

      lastRestoredUserRef.current = userId;

      const storedShare = readStoredShare();

      if (storedShare) {
        isViewingSharedRef.current = true;
        announceAccountStatus({
          email,
          isConfigured: true,
          isSignedIn: true,
          message: `Estas viendo los cultivos de ${storedShare.ownerLabel}.`,
          tone: "info",
          userId
        });
        void loadSharedViews(userId);
        void handleOpenSharedView(storedShare, { restoring: true });
        return;
      }

      void loadRemoteSnapshot(userId, email);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;

      const user = data.session?.user;
      if (user?.id) {
        restoreSessionFor(user.id, user.email ?? "Cuenta conectada");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (user?.id) {
        // Se difiere a proposito. Supabase corre este callback sosteniendo un
        // cerrojo interno, y cualquier llamada suya hecha aca adentro queda
        // esperando ese mismo cerrojo: la consulta no falla, se cuelga para
        // siempre, y con ella todas las que vengan despues.
        const userId = user.id;
        const email = user.email ?? "Cuenta conectada";

        window.setTimeout(() => restoreSessionFor(userId, email), 0);
        return;
      }

      setRemoteSyncReady(false);
      // Este evento tambien llega al cargar la pagina sin sesion, justo despues
      // de volver del enlace. Si pisara el mensaje, el error del enlace o el
      // "Conectando tu cuenta..." desaparecerian antes de poder leerlos.
      setAccountStatus((currentStatus) =>
        currentStatus.tone === "error" || currentStatus.tone === "pending"
          ? { ...currentStatus, email: "", isSignedIn: false, userId: "" }
          : {
              email: "",
              isConfigured: true,
              isSignedIn: false,
              message: "Conecta una cuenta para guardar datos por usuario.",
              tone: "info",
              userId: ""
            }
      );
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();

      if (stuckTimeout !== undefined) {
        window.clearTimeout(stuckTimeout);
      }
    };
    // Runs once to attach Supabase auth listeners; loadRemoteSnapshot is intentionally invoked from auth callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Segundo freno, independiente del de saveRemoteSnapshot: mirando cultivos
    // ajenos el guardado automatico ni siquiera se programa.
    if (viewingShare || isViewingSharedRef.current) return;

    if (!remoteSyncReady || !accountStatus.userId) return;

    const timeoutId = window.setTimeout(() => {
      void saveRemoteSnapshot();
    }, 900);

    return () => window.clearTimeout(timeoutId);
    // saveRemoteSnapshot reads the current snapshot from state; these dependencies are the autosave trigger surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus.userId, acknowledgedEnvironmentalAlerts, entryState, environmentalAlertState, eventState, habitDates, inspectionState, inventoryItemState, inventoryMovementState, irrigationRecipeState, measurementState, plantState, productCatalogState, remoteSyncReady, spaceState, stageTransitionState, taskState, viewingShare]);

  useEffect(() => {
    if (!accountStatus.isSignedIn || !accountStatus.userId || viewingShare) {
      setSensorDevices([]);
      return;
    }

    void refreshSensorData();
    const intervalId = window.setInterval(() => void refreshSensorData(), 60_000);
    return () => window.clearInterval(intervalId);
    // La funcion usa la sesion actual; el intervalo se recrea al cambiar de cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus.isSignedIn, accountStatus.userId, viewingShare]);

  function handleClearCultivationData() {
    setPlantState([]);
    setTaskState([]);
    setEventState([]);
    setEntryState([]);
    setHabitDates([]);
    setMeasurementState([]);
    setInspectionState([]);
    setIrrigationRecipeState([]);
    setInventoryItemState([]);
    setInventoryMovementState([]);
    setProductCatalogState([]);
    setStageTransitionState([]);
    setEnvironmentalAlertState([]);
    setAcknowledgedEnvironmentalAlerts([]);
    persistStoredState(storageKeys.plants, []);
    persistStoredState(storageKeys.tasks, []);
    persistStoredState(storageKeys.events, []);
    persistStoredState(storageKeys.entries, []);
    persistStoredState(storageKeys.habitDates, []);
    persistStoredState(storageKeys.measurements, []);
    persistStoredState(storageKeys.inspections, []);
    persistStoredState(storageKeys.irrigationRecipes, []);
    persistStoredState(storageKeys.inventoryItems, []);
    persistStoredState(storageKeys.inventoryMovements, []);
    persistStoredState(storageKeys.productCatalog, []);
    persistStoredState(storageKeys.stageTransitions, []);
    persistStoredState(storageKeys.environmentalAlerts, []);
    persistStoredState(storageKeys.acknowledgedEnvironmentalAlerts, []);
    removeStoredState(storageKeys.calendarDate);
    removeStoredState(storageKeys.quickChecks);
    removeStoredState(storageKeys.weatherConsent);
    removeStoredState(storageKeys.weatherSnapshot);
  }

  function handleExportData() {
    const snapshot = getCurrentSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `plantcare-datos-${todayIso}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen pb-28 text-moss-950 lg:pb-0">
      <header className="app-header sticky top-0 z-20 border-b border-moss-950/10 bg-paper/92 backdrop-blur-xl">
        <div className="app-header-inner mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link className="brand-lockup flex items-center gap-3" href={todayLinkHref as Route} aria-label="PlantCare Calendar, ir a Hoy">
            <BrandLogo />
            <span>
              <span className="block text-xs font-black uppercase text-moss-700">PlantCare</span>
              <span className="block text-lg font-black leading-none tracking-tight text-moss-950">Calendario</span>
            </span>
          </Link>

          <nav aria-label="Secciones principales" className="desktop-navigation hidden items-center gap-1 rounded-lg border border-moss-950/10 bg-white/82 p-1 shadow-sm lg:flex">
            {navItems.map((item) => (
              <Link
                className={currentSection === item.key ? "desktop-nav-item active" : "desktop-nav-item"}
                href={getInternalSectionHref(locale, item.key) as Route}
                key={item.key}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions flex items-center gap-2">
            <Link
              aria-label="Registrar temperatura y humedad para calcular VPD"
              className="header-vpd-button"
              href={`${getInternalSectionHref(locale, "spaces")}#mediciones-ambientales` as Route}
            >
              <Thermometer aria-hidden="true" size={17} strokeWidth={2.5} />
              <span className="sm:hidden">VPD</span>
              <span className="hidden sm:inline">Medir VPD</span>
            </Link>
            <InstallAppButton />
            <LocaleSwitcher currentSection={currentSection} locale={locale} />
            <ThemeToggle />
            <div className="hidden items-center gap-2 rounded-lg border border-emerald-700/15 bg-white/88 px-3 py-2 text-sm font-bold text-moss-900 shadow-sm sm:flex">
              <span className="status-dot" aria-hidden="true" />
              Demo seguro
            </div>
            <AccountAvatarButton accountStatus={accountStatus} onOpen={() => setShowAccountDialog(true)} />
          </div>
        </div>
      </header>

      {showAccountDialog ? (
        <AccountDialog
          accountStatus={accountStatus}
          onClose={() => setShowAccountDialog(false)}
          onCreateShareCode={handleCreateShareCode}
          onOpenSharedView={handleOpenSharedView}
          onRedeemShareCode={handleRedeemShareCode}
          onSaveRemoteSnapshot={() => saveRemoteSnapshot(undefined, { manual: true })}
          onSendMagicLink={handleSendMagicLink}
          onSignOut={handleSignOut}
          privacyHref={getInternalSectionHref(locale, "privacy") as Route}
          shareCode={shareCode}
          shareMessage={shareMessage}
          sharedViews={sharedViews}
        />
      ) : null}

      {viewingShare ? (
        <div className={`shared-view-banner ${sharedNoticeCollapsed ? "is-collapsed" : ""}`} role="status">
          <span className="shared-view-banner-text">
            <strong>{viewingShare.ownerLabel}</strong>
            <span>{sharedNoticeCollapsed ? "Solo lectura" : "Estas viendo sus cultivos en solo lectura. Los cambios no se guardan."}</span>
          </span>
          {sharedNoticeCollapsed ? (
            <button className="shared-view-banner-ghost" onClick={() => setSharedNoticeCollapsed(false)} type="button">
              Ver
            </button>
          ) : (
            <button className="shared-view-banner-ghost" onClick={() => setSharedNoticeCollapsed(true)} type="button">
              Ocultar
            </button>
          )}
          <button className="shared-view-banner-button" onClick={handleCloseSharedView} type="button">
            Mis cultivos
          </button>
        </div>
      ) : null}

      {shouldShowFirstCultivation ? (
        <FirstCultivationScreen onCreateFirstCultivation={handleCreateFirstCultivation} />
      ) : null}

      {!shouldShowFirstCultivation && currentSection === "today" ? (
        <TodaySection
          acknowledgedEnvironmentalAlerts={acknowledgedEnvironmentalAlerts}
          accountStatus={accountStatus}
          agendaItems={agendaItems}
          careScore={careScore}
          dictionary={dictionary}
          environmentalAlerts={environmentalAlertState}
          inspections={inspectionState}
          inventoryItems={inventoryItemState}
          locale={locale}
          onSaveRemoteSnapshot={() => saveRemoteSnapshot(undefined, { manual: true })}
          onAcknowledgeEnvironmentalAlert={handleAcknowledgeEnvironmentalAlert}
          onSaveInventoryItem={handleSaveInventoryItem}
          onSendMagicLink={handleSendMagicLink}
          onSignOut={handleSignOut}
          onToggleTask={handleToggleTask}
          openTasks={openTasks}
          calendarEvents={eventState}
          tasks={taskState}
          plants={plantState.filter((plant) => plant.lifecycle !== "archived")}
          stageTransitions={stageTransitionState}
          measurements={measurementState}
          streakCount={streakCount}
          weatherStatus={weatherStatus}
          onUseDeviceWeather={handleUseDeviceWeather}
          weather={weather}
        />
      ) : null}

      {!shouldShowFirstCultivation && currentSection === "seeds" ? (
        <SeedsSection
          calendarHref={calendarHref}
          calendarLinkHref={calendarLinkHref}
          locale={locale}
          onCreateManualEvents={handleAddManualEvents}
        />
      ) : null}
      {!shouldShowFirstCultivation && currentSection === "spaces" ? (
        <SpacesSection
          calendarEvents={eventState}
          entries={entryState}
          environmentalAlerts={environmentalAlertState}
          measurements={measurementState}
          inspections={inspectionState}
          irrigationRecipes={irrigationRecipeState}
          inventoryItems={inventoryItemState}
          inventoryMovements={inventoryMovementState}
          locale={locale}
          productCatalog={productCatalogState}
          stageTransitions={stageTransitionState}
          onAddJournalEntry={handleAddJournalEntry}
          onAddCalendarEvent={handleAddCalendarEvent}
          onAddMeasurement={handleAddMeasurement}
          onSaveInspection={handleSaveInspection}
          onSaveIrrigationRecipe={handleSaveIrrigationRecipe}
          onSaveInventoryItem={handleSaveInventoryItem}
          onSaveProductCatalogItem={handleSaveProductCatalogItem}
          onSaveStageTransition={handleSaveStageTransition}
          onDeleteMeasurement={handleDeleteMeasurement}
          onUpdateEnvironmentalAlerts={handleUpdateEnvironmentalAlerts}
          onCreateSensorDevice={handleCreateSensorDevice}
          onCreatePlant={handleCreatePlant}
          onCreateSpace={handleCreateSpace}
          onDeleteSpace={handleDeleteSpace}
          onRefreshSensors={refreshSensorData}
          onToggleSensorDevice={handleToggleSensorDevice}
          onUpdatePlant={handleUpdatePlant}
          onUpdateSpace={handleUpdateSpace}
          plants={plantState}
          sensorDevices={sensorDevices}
          sensorStatus={sensorStatus}
          spaces={spaceState}
          tasks={taskState}
        />
      ) : null}
      {!shouldShowFirstCultivation && currentSection === "calendar" ? (
        <CalendarSection
          entries={entryState}
          events={eventState}
          locale={locale}
          onAddCalendarEvent={handleAddCalendarEvent}
          onAddJournalEntry={handleAddJournalEntry}
          onDeleteCalendarEvent={handleDeleteCalendarEvent}
          onDeleteJournalEntry={handleDeleteJournalEntry}
          onToggleOccurrence={(eventId, date) => setEventState((events) => toggleEventCompletion(events, eventId, date))}
          onUpdateCalendarEvent={handleUpdateCalendarEvent}
          onUpdateJournalEntry={handleUpdateJournalEntry}
          plants={plantState}
        />
      ) : null}
      {!shouldShowFirstCultivation && currentSection === "journal" ? (
        <JournalSection
          entries={entryState}
          onCreateQuickPlant={handleCreateQuickPlant}
          onDeleteJournalEntry={handleDeleteJournalEntry}
          onUpdateJournalEntry={handleUpdateJournalEntry}
          plants={plantState}
        />
      ) : null}
      {currentSection === "privacy" ? (
        <PrivacySection
          accountStatus={accountStatus}
          onClearCultivationData={handleClearCultivationData}
          onExportData={handleExportData}
          onSaveRemoteSnapshot={() => saveRemoteSnapshot(undefined, { manual: true })}
          onSendMagicLink={handleSendMagicLink}
          onSignOut={handleSignOut}
        />
      ) : null}

      {showOnboarding && !shouldShowFirstCultivation ? (
        <OnboardingFlow
          onClose={() => {
            window.localStorage.setItem(storageKeys.onboarding, "true");
            setShowOnboarding(false);
          }}
          todayHref={todayHref}
        />
      ) : null}

      {!shouldShowFirstCultivation ? (
        <SectionStepper
          locale={locale}
          nextItem={nextNavItem}
          previousItem={previousNavItem}
        />
      ) : null}

      <nav className="mobile-tab-bar" aria-label="Navegación principal móvil">
        {navItems.map((item) => (
          <Link className={currentSection === item.key ? "mobile-tab active" : "mobile-tab"} href={getInternalSectionHref(locale, item.key) as Route} key={item.key}>
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.short}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}

function FirstCultivationScreen({
  onCreateFirstCultivation
}: {
  onCreateFirstCultivation: (input: FirstCultivationInput) => void;
}) {
  const todayIso = getTodayIso();
  const geneticOptions = [
    "No seleccionada",
    ...geneticsCatalogAlphabetically.map((genetic) => genetic.name),
    "Otra / no listada"
  ];
  const [step, setStep] = useState(0);
  const [bank, setBank] = useState(legalBankOptions[0]);
  const [legalRecordStatus, setLegalRecordStatus] = useState(legalRecordStatusOptions[0]);
  const [geneticName, setGeneticName] = useState(geneticOptions[0]);
  const [customGeneticName, setCustomGeneticName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<Plant["mode"]>("Interior");
  const [setup, setSetup] = useState("80 x 80 cm");
  const [light, setLight] = useState("LED");
  const [pot, setPot] = useState("10 L");
  const [potCount, setPotCount] = useState(4);
  const [substrate, setSubstrate] = useState("No declarado");
  const [startDate, setStartDate] = useState(todayIso);
  const [humidityReminderOffset, setHumidityReminderOffset] = useState(7);
  const [photoReminderOffset, setPhotoReminderOffset] = useState(7);
  const selectedGeneticName = geneticName === "Otra / no listada" ? customGeneticName.trim() : geneticName;
  const stepTitles = ["Identificacion", "Espacio de cultivo", "Fechas y recordatorios"];

  function handleSubmit() {
    onCreateFirstCultivation({
      bank,
      geneticName: selectedGeneticName || "Genetica declarada por usuario",
      humidityReminderOffset,
      legalRecordStatus,
      light,
      mode,
      nickname,
      photoReminderOffset,
      pot,
      potCount,
      setup,
      startDate,
      substrate
    });
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="first-cultivation-shell">
        <div className="first-cultivation-intro">
          <p className="eyebrow text-mint-50/80">Primer cultivo</p>
          <h1>Configuremos tu cultivo paso a paso</h1>
          <p>
            Carga banco, registro, genetica, espacio y primeros recordatorios. Las sugerencias futuras usaran datos
            declarados, catalogos, mediciones reales y estimaciones identificadas.
          </p>
        </div>

        <div className="first-cultivation-card">
          <div className="wizard-steps" aria-label="Pasos del alta inicial">
            {stepTitles.map((title, index) => (
              <button
                aria-current={step === index ? "step" : undefined}
                className={step === index ? "wizard-step active" : "wizard-step"}
                key={title}
                onClick={() => setStep(index)}
                type="button"
              >
                <span>{index + 1}</span>
                {title}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {step === 0 ? (
              <div className="grid gap-3">
                <SectionHeader eyebrow="Datos declarados" title="Identificacion" />
                <GeneticFinderWizard
                  compact
                  onSelectGenetic={(name) => {
                    setGeneticName(name);
                    setCustomGeneticName("");
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormSelect label="Banco o catalogo" onChange={setBank} options={legalBankOptions} value={bank} />
                  <FormSelect
                    label="Registro legal"
                    onChange={setLegalRecordStatus}
                    options={legalRecordStatusOptions}
                    value={legalRecordStatus}
                  />
                  <FormSelect label="Nombre de genetica" onChange={setGeneticName} options={geneticOptions} value={geneticName} />
                  <FormField label="Nombre visible del cultivo" onChange={setNickname} placeholder="Ej. Indoor 80 julio" value={nickname} />
                </div>
                {geneticName === "Otra / no listada" ? (
                  <FormField
                    label="Genetica escrita por el usuario"
                    onChange={setCustomGeneticName}
                    placeholder="Nombre declarado"
                    value={customGeneticName}
                  />
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-3">
                <SectionHeader eyebrow="Setup" title="Espacio de cultivo" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ModeSelect onChange={setMode} value={mode} />
                  <FormSelect label="Tamano/lugar" onChange={setSetup} options={legalSetupOptions} value={setup} />
                  <FormSelect label="Tipo de luz" onChange={setLight} options={legalLightOptions} value={light} />
                  <FormSelect label="Maceta" onChange={setPot} options={legalPotOptions} value={pot} />
                  <FormSelect
                    label="Cantidad de macetas"
                    onChange={(value) => setPotCount(Number(value))}
                    options={["1", "2", "3", "4", "5", "6", "8", "9", "12"]}
                    value={String(potCount)}
                    valueLabels={buildPotCountLabels([1, 2, 3, 4, 5, 6, 8, 9, 12])}
                  />
                  <FormSelect label="Sustrato" onChange={setSubstrate} options={legalSubstrateOptions} value={substrate} />
                </div>
                <div className="rounded-lg border border-emerald-700/20 bg-emerald-50/80 p-3 text-sm font-bold leading-6 text-emerald-950">
                  Cada maceta se guarda como planta independiente. Si son 4 semillas iguales, quedan como #1, #2, #3 y #4
                  para asignar tareas y bitacora por separado.
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-3">
                <SectionHeader eyebrow="Agenda manual" title="Fechas y recordatorios" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Fecha de inicio" onChange={setStartDate} placeholder={todayIso} type="date" value={startDate} />
                  <FormSelect
                    label="Revision de humedad"
                    onChange={(value) => setHumidityReminderOffset(Number(value))}
                    options={firstReminderOptions}
                    value={String(humidityReminderOffset)}
                    valueLabels={firstReminderLabels}
                  />
                  <FormSelect
                    label="Registro fotografico"
                    onChange={(value) => setPhotoReminderOffset(Number(value))}
                    options={firstReminderOptions}
                    value={String(photoReminderOffset)}
                    valueLabels={firstReminderLabels}
                  />
                </div>
                <div className="rounded-lg border border-moss-950/10 bg-paper/80 p-3 text-sm font-bold leading-6 text-stone-700">
                  Estos recordatorios guardan fechas elegidas por el usuario y dejan trazable el origen del dato para
                  que aparezcan en el calendario.
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button className="secondary-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button">
              Atras
            </button>
            {step < stepTitles.length - 1 ? (
              <button className="primary-button" onClick={() => setStep((value) => Math.min(stepTitles.length - 1, value + 1))} type="button">
                Continuar
              </button>
            ) : (
              <button className="primary-button" onClick={handleSubmit} type="button">
                Guardar cultivo e ir al calendario
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TodaySection({
  acknowledgedEnvironmentalAlerts,
  accountStatus,
  agendaItems,
  careScore,
  calendarEvents,
  dictionary,
  environmentalAlerts,
  inspections,
  inventoryItems,
  locale,
  onSaveRemoteSnapshot,
  onAcknowledgeEnvironmentalAlert,
  onSaveInventoryItem,
  onSendMagicLink,
  onSignOut,
  onUseDeviceWeather,
  onToggleTask,
  openTasks,
  plants,
  stageTransitions,
  measurements,
  streakCount,
  tasks,
  weather,
  weatherStatus
}: {
  acknowledgedEnvironmentalAlerts: string[];
  accountStatus: AccountStatus;
  agendaItems: AgendaItem[];
  careScore: number;
  calendarEvents: CalendarEvent[];
  dictionary: Dictionary;
  environmentalAlerts: PlantEnvironmentalAlertSettings[];
  inspections: PlantInspection[];
  inventoryItems: InventoryItem[];
  locale: Locale;
  onSaveRemoteSnapshot: () => void;
  onAcknowledgeEnvironmentalAlert: (alertKey: string) => void;
  onSaveInventoryItem: (item: InventoryItem) => void;
  onSendMagicLink: (email: string) => void;
  onSignOut: () => void;
  onUseDeviceWeather: () => void;
  onToggleTask: (item: AgendaItem) => void;
  openTasks: number;
  plants: Plant[];
  stageTransitions: PlantStageTransition[];
  measurements: PlantMeasurement[];
  streakCount: number;
  tasks: Task[];
  weather: WeatherReadiness;
  weatherStatus: string;
}) {
  const racheDescription = "Dias seguidos marcando al menos una tarea como hecha.";
  const [showRachaHint, setShowRachaHint] = useState(false);

  return (
    <>
      <section className="executive-home mx-auto max-w-7xl px-4 pb-5 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <div className="executive-hero">
          <div className="executive-hero-copy min-w-0">
            <div className="today-context-line"><p className="eyebrow">Panel operativo</p><time dateTime={getTodayIso()}>{formatDisplayDate(getTodayIso())}</time></div>
            <h1>Todo tu cultivo, claro y al día</h1>
            <p>{dictionary.hero.body}</p>
          </div>
          <div className="executive-metrics">
            <MiniStat
              description="Plantas activas que tenes registradas en Espacios."
              href={getInternalSectionHref(locale, "spaces") as Route}
              label="Cultivos"
              value={plants.length.toString()}
            />
            <MiniStat
              description="Tareas de hoy que todavia no marcaste como hechas. Las ves en la lista de abajo."
              featured
              href={"#tareas-hoy" as Route}
              label="Pendientes"
              value={openTasks.toString()}
            />
            <MiniStat
              description={racheDescription}
              label="Racha"
              onSelect={() => setShowRachaHint((current) => !current)}
              value={`${streakCount} dias`}
            />
          </div>
          {showRachaHint ? (
            <p className="stat-hint" role="status">
              {racheDescription}
            </p>
          ) : null}
        </div>

        <div className="executive-overview today-command-grid">
          <GrowCommandPanel calendarEvents={calendarEvents} plants={plants} />
          <HomeAccountPanel
            accountStatus={accountStatus}
            onSaveRemoteSnapshot={onSaveRemoteSnapshot}
            onSendMagicLink={onSendMagicLink}
            onSignOut={onSignOut}
          />
          <PushNotificationsPanel accountStatus={accountStatus} />
        </div>
        <EnvironmentalQuickAccess locale={locale} measurements={measurements} plants={plants} />
        <TodayStageSummary locale={locale} plants={plants} transitions={stageTransitions} />
        <TodayEnvironmentalAlerts acknowledgedAlerts={acknowledgedEnvironmentalAlerts} environmentalAlerts={environmentalAlerts} locale={locale} measurements={measurements} onAcknowledge={onAcknowledgeEnvironmentalAlert} plants={plants} />
        <TodayInspectionFollowUps inspections={inspections} locale={locale} plants={plants} />
        <TodayInventoryAlerts inventoryItems={inventoryItems} onSaveInventoryItem={onSaveInventoryItem} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <Card as="section" aria-labelledby="today-title" className="p-4 sm:p-5" id="tareas-hoy" variant="elevated">
          <SectionHeader eyebrow="Panel principal" title="Tareas de hoy" />
          <div className="mt-5 grid gap-3">
            {agendaItems.length > 0 ? (
              agendaItems.map((task, index) => (
                <TaskCard
                  isPrimary={index === 0 && task.status !== "done"}
                  key={`${task.source}-${task.id}`}
                  onToggle={() => onToggleTask(task)}
                  plant={plants.find((plant) => plant.id === task.plantId)}
                  task={task}
                />
              ))
            ) : (
              <EmptyState
                body="Cuando crees recordatorios o tareas, este panel va a mostrar primero lo urgente."
                title="No hay tareas para hoy"
              />
            )}
          </div>
        </Card>

        <Card as="section" aria-labelledby="weather-title" className="p-4 sm:p-5" variant="subtle">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader eyebrow="Clima" title="Condiciones del espacio" />
            <span className={weather.isLive ? "pill pill-green" : "pill pill-blue"}>
              {weather.isLive ? "Tiempo real" : "Ubicacion pendiente"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
            <div className="weather-panel">
              <p className="eyebrow text-teal-900">{weather.providerLabel}</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-moss-950" id="weather-title">
                {weather.region}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-700">{weather.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="primary-button" onClick={onUseDeviceWeather} type="button">
                  {weather.isLive ? "Actualizar clima" : "Usar ubicacion del dispositivo"}
                </button>
                {weatherStatus ? <span className="text-xs font-black text-stone-600">{weatherStatus}</span> : null}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {weather.preview.map((item) => (
                <div className="metric-tile" key={item.label}>
                  <dt className="text-label">{item.label}</dt>
                  <dd className="mt-2 text-value text-moss-950">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </section>

      <section className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <PlantCareCoach agendaItems={agendaItems} plants={plants} />
          <SeasonInsights calendarEvents={calendarEvents} careScore={careScore} plants={plants} tasks={tasks} />
        </div>
      </section>
    </>
  );
}

function TodayStageSummary({ locale, plants, transitions }: { locale: Locale; plants: Plant[]; transitions: PlantStageTransition[] }) {
  if (plants.length === 0) return null;
  const today = parseIsoDate(getTodayIso()).getTime();
  return <Card as="section" className="today-stage-summary mt-3 p-4 sm:p-5"><SectionHeader eyebrow="Etapas declaradas" title="Tiempo en la etapa actual" /><div>{plants.map((plant) => { const latest = transitions.filter((item) => item.plantId === plant.id).sort((first, second) => second.changedAt.localeCompare(first.changedAt))[0]; const days = latest ? Math.max(0, Math.floor((today - parseIsoDate(latest.changedAt.slice(0, 10)).getTime()) / 86_400_000)) : undefined; return <a href={`${getInternalSectionHref(locale, "spaces")}#${plant.id}`} key={plant.id}><div><strong>{plant.name}</strong><span>{plant.stage}</span></div><p>{latest ? `${days} día${days === 1 ? "" : "s"} desde el cambio declarado el ${formatDisplayDate(latest.changedAt.slice(0, 10))}` : "Sin una fecha de cambio de etapa registrada."}</p></a>; })}</div><p>Este resumen cuenta días calendario desde fechas declaradas. No estima cuándo debería cambiar la etapa.</p></Card>;
}

function TodayInventoryAlerts({ inventoryItems, onSaveInventoryItem }: { inventoryItems: InventoryItem[]; onSaveInventoryItem: (item: InventoryItem, context?: InventoryMovementContext) => void }) {
  const lowStock = inventoryItems.filter((item) => item.minimumQuantity !== undefined && item.quantity <= item.minimumQuantity);
  const today = getTodayIso(); const expiryWindow = offsetDate(today, 30); const expiring = inventoryItems.filter((item) => item.expiresAt && item.expiresAt <= expiryWindow);
  const visibleItems = inventoryItems.filter((item) => lowStock.includes(item) || expiring.includes(item));
  if (visibleItems.length === 0) return null;
  return <Card as="section" className="inventory-alerts mt-3 p-4 sm:p-5"><SectionHeader eyebrow="Datos declarados" title="Inventario para revisar" /><div>{visibleItems.map((item) => { const isLow = lowStock.includes(item); const expiryLabel = item.expiresAt ? item.expiresAt < today ? `Vencimiento declarado: ${formatDisplayDate(item.expiresAt)} (fecha pasada)` : `Vence el ${formatDisplayDate(item.expiresAt)}` : ""; return <article key={item.id}><div><strong>{item.name}</strong><p>{isLow ? `${item.quantity} ${item.unit} disponibles · mínimo configurado: ${item.minimumQuantity} ${item.unit}` : ""}{isLow && expiryLabel ? " · " : ""}{expiryLabel}</p></div>{isLow ? <button className="text-button" onClick={() => onSaveInventoryItem({ ...item, minimumQuantity: undefined })} type="button">Quitar mínimo</button> : null}</article>; })}</div><p>Los avisos usan solamente el mínimo y el vencimiento cargados por el usuario. La ventana de vencimiento es de 30 días y no estima estabilidad del producto.</p></Card>;
}

function TodayInspectionFollowUps({ inspections, locale, plants }: { inspections: PlantInspection[]; locale: Locale; plants: Plant[] }) {
  const today = getTodayIso();
  const open = inspections.filter((inspection) => inspection.status === "open" && inspection.followUpDate).sort((first, second) => first.followUpDate!.localeCompare(second.followUpDate!));
  if (open.length === 0) return null;
  return <Card as="section" className="inspection-followups mt-3 p-4 sm:p-5"><SectionHeader eyebrow="Seguimiento declarado" title="Próximas inspecciones" /><div>{open.slice(0, 6).map((inspection) => { const plant = plants.find((item) => item.id === inspection.plantId); return <article key={inspection.id}><div><strong>{plant?.name ?? "Maceta"} · {inspection.area}</strong><p>{inspection.observation}</p><small>{inspection.followUpDate! <= today ? "Revisión pendiente" : "Próxima revisión"}: {formatDisplayDate(inspection.followUpDate!)}</small></div><Link className="text-button" href={`${getInternalSectionHref(locale, "spaces")}#${inspection.plantId}` as Route}>Ver maceta</Link></article>; })}</div></Card>;
}

function TodayEnvironmentalAlerts({ acknowledgedAlerts, environmentalAlerts, locale, measurements, onAcknowledge, plants }: { acknowledgedAlerts: string[]; environmentalAlerts: PlantEnvironmentalAlertSettings[]; locale: Locale; measurements: PlantMeasurement[]; onAcknowledge: (alertKey: string) => void; plants: Plant[] }) {
  const configuredPlantIds = new Set(environmentalAlerts.map((settings) => settings.plantId));
  const activeAlerts = plants.flatMap((plant) => {
    const latestMeasurement = measurements.filter((measurement) => measurement.plantId === plant.id).sort((first, second) => second.measuredAt.localeCompare(first.measuredAt))[0];
    if (!latestMeasurement) return [];
    const settings = environmentalAlerts.find((item) => item.plantId === plant.id);
    const assessment = assessPlantEnvironment(plant, latestMeasurement);
    return getConfiguredEnvironmentalAlerts(settings, latestMeasurement, assessment.vpdKpa).map((alert) => ({ alert, alertKey: `${latestMeasurement.id}:${alert.label}:${alert.direction}:${alert.value}:${alert.limit}`, measurement: latestMeasurement, plant }));
  }).filter((item) => !acknowledgedAlerts.includes(item.alertKey));

  return (
    <Card as="section" className="today-environment-alerts mt-3 p-4 sm:p-5" aria-labelledby="today-environment-alerts-title">
      <header>
        <div><p className="eyebrow">Límites personalizados</p><h2 id="today-environment-alerts-title">Alertas ambientales</h2><p>Compara la última lectura de cada maceta con los límites que configuraste.</p></div>
        <span className={activeAlerts.length > 0 ? "pill pill-amber" : "pill pill-green"}>{activeAlerts.length > 0 ? `${activeAlerts.length} activa${activeAlerts.length === 1 ? "" : "s"}` : "Sin alertas activas"}</span>
      </header>
      {activeAlerts.length > 0 ? (
        <div className="today-environment-alert-list" role="alert">
          {activeAlerts.slice(0, 8).map(({ alert, alertKey, measurement, plant }) => (
            <article key={`${plant.id}-${alert.label}-${alert.direction}`}>
              <div><strong>{plant.name} · {alert.label}</strong><p>{alert.value}{alert.unit}, {alert.direction === "below" ? "por debajo del mínimo" : "por encima del máximo"} {alert.limit}{alert.unit}.</p><small>Última lectura: {formatMeasurementDate(measurement.measuredAt)} · {formatMeasurementSource(measurement.source)}</small></div>
              <div className="today-environment-alert-actions"><button className="text-button" onClick={() => onAcknowledge(alertKey)} type="button">Marcar revisada</button><Link className="text-button" href={`${getInternalSectionHref(locale, "spaces")}#${plant.id}` as Route}>Ver maceta</Link></div>
            </article>
          ))}
        </div>
      ) : (
        <p className="today-environment-alert-empty">{configuredPlantIds.size > 0 ? `Ninguna última lectura supera los límites configurados en ${configuredPlantIds.size} maceta${configuredPlantIds.size === 1 ? "" : "s"}.` : "Todavía no configuraste límites personalizados. Podés hacerlo desde la ficha de cada maceta."}</p>
      )}
      <p className="today-environment-alert-note">Son avisos explicables basados en la última medición guardada; no representan un diagnóstico ni modifican equipos automáticamente.</p>
    </Card>
  );
}

function EnvironmentalQuickAccess({ locale, measurements, plants }: { locale: Locale; measurements: PlantMeasurement[]; plants: Plant[] }) {
  const measuredPlantIds = new Set(measurements.map((measurement) => measurement.plantId));
  const pendingCount = plants.filter((plant) => !measuredPlantIds.has(plant.id)).length;
  const latestByPlant = plants.map((plant) => ({ latest: measurements.filter((measurement) => measurement.plantId === plant.id).sort((first, second) => second.measuredAt.localeCompare(first.measuredAt))[0], plant }));

  return (
    <Card as="section" className="environment-quick-access mt-5 p-4 sm:p-5">
      <div>
        <p className="eyebrow">Carga rápida</p>
        <h2>Mediciones ambientales</h2>
        <p>Registrá temperatura y humedad por maceta para calcular VPD. La temperatura foliar y los demás datos son opcionales.</p>
      </div>
      <div className="environment-quick-access-action">
        <span>{pendingCount > 0 ? `${pendingCount} maceta${pendingCount === 1 ? "" : "s"} sin mediciones` : "Todas las macetas tienen historial"}</span>
        <Link className="primary-button" href={`${getInternalSectionHref(locale, "spaces")}#mediciones-ambientales` as Route}>
          Registrar medición
        </Link>
      </div>
      <div className="environment-freshness-list">
        {latestByPlant.map(({ latest, plant }) => <Link href={`${getInternalSectionHref(locale, "spaces")}#${plant.id}` as Route} key={plant.id}><strong>{plant.name}</strong><span>{latest ? `Última medición: ${formatMeasurementAge(latest.measuredAt)}` : "Sin mediciones"}</span>{latest ? <small>{formatMeasurementDate(latest.measuredAt)} · {formatMeasurementSource(latest.source)}</small> : null}</Link>)}
      </div>
    </Card>
  );
}

function GrowCommandPanel({
  calendarEvents,
  plants
}: {
  calendarEvents: CalendarEvent[];
  plants: Plant[];
}) {
  const todayIso = getTodayIso();
  const upcomingEvents = calendarEvents
    .filter((event) => event.startDate >= todayIso)
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
    .slice(0, 3);
  const stages = [
    { id: "sprout", label: "Semilla" },
    { id: "leaf", label: "Vegetativo" },
    { id: "flower", label: "Floracion" },
    { id: "harvest", label: "Cosecha" }
  ];

  return (
    <section className="grow-command" aria-labelledby="grow-command-title">
      <div className="grow-command-copy">
        <p className="eyebrow text-mint-50/80">Centro operativo</p>
        <h2 id="grow-command-title">Estado activo</h2>
        <p>Resumen de plantas, etapas declaradas y proximos eventos manuales.</p>
      </div>
      <div className="grow-command-board">
        <div className="grow-phase-rail" aria-label="Etapas declaradas">
          {stages.map((stage) => {
            const stageCount = plants.filter((plant) => getPlantStage(plant.stage) === stage.id).length;

            return (
              <div className="grow-phase-step" key={stage.id}>
                <span className={`grow-phase-dot ${stage.id}`} />
                <strong>{stageCount}</strong>
                <small>{stage.label}</small>
              </div>
            );
          })}
        </div>
        <div className="grow-command-grid">
          <div className="grow-command-card accent">
            <p className="text-[11px] font-black uppercase text-mint-50/75">Plantas activas</p>
            <div className="mt-3 grid gap-2">
              {plants.slice(0, 3).map((plant) => (
                <div className="grow-mini-plant" key={plant.id}>
                  <PlantAvatar plant={plant} />
                  <span>
                    <strong>{plant.name}</strong>
                    <small>{plant.stage}</small>
                  </span>
                </div>
              ))}
              {plants.length === 0 ? <p className="text-sm font-bold text-mint-50/80">Todavia no hay cultivos cargados.</p> : null}
            </div>
          </div>
          <div className="grow-command-card">
            <p className="text-label">Proximos eventos</p>
            <div className="mt-3 grid gap-2">
              {upcomingEvents.map((event) => (
                <div className="grow-event-row" key={event.id}>
                  <span className={`event-legend ${getEventClass(event.kind)}`}>{getEventKindLabel(event.kind)}</span>
                  <span>
                    <strong>{displayEventTitle(event.title)}</strong>
                    <small>{event.startDate}</small>
                  </span>
                </div>
              ))}
              {upcomingEvents.length === 0 ? <p className="text-sm font-bold text-stone-600">Sin eventos manuales proximos.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Cartel de estado de la cuenta. Se muestra siempre (con sesion o sin ella)
// para que cada accion deje un rastro visible: antes el usuario apretaba
// "Iniciar sesion" y no pasaba nada a la vista.
// Las clases van escritas enteras y no armadas con `account-feedback-${tone}`:
// Tailwind escanea el codigo buscando nombres de clase literales y descarta del
// CSS final los que no encuentra, asi que un nombre construido en tiempo de
// ejecucion se queda sin estilos (el cartel salia transparente).
const accountFeedbackClassByTone: Record<AccountTone, string> = {
  error: "account-feedback account-feedback-error",
  info: "account-feedback account-feedback-info",
  pending: "account-feedback account-feedback-pending",
  success: "account-feedback account-feedback-success"
};

const accountFeedbackIconByTone: Record<AccountTone, string> = {
  error: "!",
  info: "i",
  pending: "",
  success: "✓"
};

function AccountFeedback({ status }: { status: AccountStatus }) {
  if (!status.message) return null;

  return (
    <p aria-live="polite" className={accountFeedbackClassByTone[status.tone]} role="status">
      {status.tone === "pending" ? (
        <span aria-hidden="true" className="account-feedback-spinner" />
      ) : (
        <span aria-hidden="true" className="account-feedback-icon">
          {accountFeedbackIconByTone[status.tone]}
        </span>
      )}
      <span className="account-feedback-text">{status.message}</span>
    </p>
  );
}

function HomeAccountPanel({
  accountStatus,
  onSaveRemoteSnapshot,
  onSendMagicLink,
  onSignOut
}: {
  accountStatus: AccountStatus;
  onSaveRemoteSnapshot: () => void;
  onSendMagicLink: (email: string) => void;
  onSignOut: () => void;
}) {
  const [email, setEmail] = useState(accountStatus.email);
  const isBusy = accountStatus.tone === "pending";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();

    if (!nextEmail) return;

    onSendMagicLink(nextEmail);
  }

  return (
    <section className="home-account-panel" aria-labelledby="home-account-title">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={accountStatus.isSignedIn ? "pill pill-green" : "pill pill-amber"}>
            {accountStatus.isSignedIn ? "Cuenta conectada" : accountStatus.isConfigured ? "Iniciar sesion" : "Demo local"}
          </span>
          <span className="pill pill-soft">Guardado por usuario</span>
        </div>
        <h2 id="home-account-title">Tus cultivos en cualquier navegador</h2>
        <p>
          Entra con email para que la informacion no dependa del celular o la compu. Cada usuario conserva sus espacios,
          macetas, calendario y bitacora.
        </p>
      </div>

      {accountStatus.isSignedIn ? (
        <div className="home-account-actions">
          <span>{accountStatus.email}</span>
          <button
            className="primary-button"
            disabled={isBusy}
            onClick={onSaveRemoteSnapshot}
            type="button"
          >
            {isBusy ? "Guardando..." : "Guardar ahora"}
          </button>
          <button className="secondary-button" onClick={onSignOut} type="button">
            Cerrar sesion
          </button>
          <AccountFeedback status={accountStatus} />
        </div>
      ) : (
        <form className="home-account-form" onSubmit={handleSubmit}>
          <input
            aria-label="Email para iniciar sesion"
            className="form-control"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            type="email"
            value={email}
          />
          <button className="primary-button" disabled={!accountStatus.isConfigured || isBusy} type="submit">
            {isBusy ? "Enviando..." : "Iniciar sesion"}
          </button>
          <AccountFeedback status={accountStatus} />
        </form>
      )}
    </section>
  );
}

function PlantCareCoach({ agendaItems, plants }: { agendaItems: AgendaItem[]; plants: Plant[] }) {
  const [checkedSignals, setCheckedSignals] = useStoredState<string[]>(storageKeys.quickChecks, []);
  const topPlant = plants[0];
  const openItems = agendaItems.filter((item) => item.status === "open");
  const signals = [
    { id: "leaves", label: "Hojas", hint: "color, manchas o puntas" },
    { id: "substrate", label: "Sustrato", hint: "humedad al tacto" },
    { id: "pests", label: "Plagas", hint: "revisión visual" },
    { id: "light", label: "Luz", hint: "ubicación declarada" },
    { id: "photo", label: "Foto", hint: "comparar evolución" }
  ];

  function toggleSignal(signalId: string) {
    setCheckedSignals((currentSignals) => {
      const nextSignals = currentSignals.includes(signalId)
        ? currentSignals.filter((id) => id !== signalId)
        : [...currentSignals, signalId];
      persistStoredState(storageKeys.quickChecks, nextSignals);
      return nextSignals;
    });
  }

  return (
    <section className="coach-panel p-4 sm:p-5" aria-labelledby="coach-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="Chequeo rapido" title="Estado de tus plantas" />
        <span className="pill pill-blue">Manual</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        Inspirado en las mejores apps de plantas: una rutina corta para observar, registrar y decidir vos. No diagnostica
        ni calcula automaticamente.
      </p>
      <div className="coach-focus mt-4">
        <div className="flex items-center gap-3">
          {topPlant ? <PlantAvatar plant={topPlant} /> : <span className="plant-avatar" aria-hidden="true" />}
          <div>
            <p className="text-xs font-black uppercase text-stone-500">Foco sugerido</p>
            <p className="font-black text-moss-950">{openItems[0]?.title ?? "Registrar observacion"}</p>
            <p className="text-sm text-stone-600">{topPlant?.name ?? "Crear una planta para comenzar"}</p>
          </div>
        </div>
      </div>
      <div className="coach-grid mt-4">
        {signals.map((signal) => (
          <button
            className={checkedSignals.includes(signal.id) ? "coach-check active" : "coach-check"}
            key={signal.id}
            onClick={() => toggleSignal(signal.id)}
            type="button"
          >
            <span>{checkedSignals.includes(signal.id) ? "OK" : ""}</span>
            <strong>{signal.label}</strong>
            <small>{signal.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function SeasonInsights({
  calendarEvents,
  careScore,
  plants,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  careScore: number;
  plants: Plant[];
  tasks: Task[];
}) {
  const todayIso = getTodayIso();
  const nextMilestone = calendarEvents
    .filter((event) => event.kind === "review" && event.startDate >= todayIso)
    .sort((first, second) => first.startDate.localeCompare(second.startDate))[0];
  const nextMilestonePlant = plants.find((plant) => plant.id === nextMilestone?.plantId);
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : careScore;

  return (
    <Card as="section" aria-labelledby="season-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="Mi temporada" title="Resumen activo" />
        <span className="pill pill-green">{completionRate}% tareas hechas</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {plants.slice(0, 3).map((plant) => (
          <div className="metric-tile" key={plant.id}>
            <div className="flex items-center gap-2">
              <PlantStateIcon stage={plant.stage} />
              <p className="font-black text-moss-950">{plant.name}</p>
            </div>
            <p className="mt-3 text-2xl font-black text-moss-950">{getElapsedDays(plant.startedAt, todayIso)}</p>
            <p className="text-xs font-black uppercase text-stone-500">dias desde fecha cargada</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-moss-950/10 bg-paper/80 p-3">
        <p className="text-xs font-black uppercase text-stone-500">Proximo hito declarado</p>
        <p className="mt-1 font-black text-moss-950">
          {nextMilestone
            ? `${nextMilestone.title} - ${nextMilestonePlant?.name ?? "planta"} - ${nextMilestone.startDate}`
            : "Sin hitos manuales proximos"}
        </p>
      </div>
    </Card>
  );
}

function OnboardingFlow({ onClose, todayHref }: { onClose: () => void; todayHref: string }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      body: "Elegir si vas a registrar cannabis legal o cultivos horticolas no regulados. Cada flujo mantiene sus limites.",
      title: "Que vas a cultivar?"
    },
    {
      body: "Interior, exterior o invernadero. Esto solo configura el contexto visual inicial.",
      title: "Donde?"
    },
    {
      body: "Listo. Tu panel queda preparado con tareas, calendario, diario y privacidad.",
      title: "Asi se ve tu panel"
    }
  ];
  const currentStep = steps[step];

  function finish() {
    onClose();
    window.location.href = todayHref;
  }

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <section className="onboarding-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-emerald-800">Primer uso</p>
            <h2 className="mt-1 text-2xl font-black text-moss-950" id="onboarding-title">
              {currentStep.title}
            </h2>
          </div>
          <button className="secondary-button" onClick={onClose} type="button">
            Saltar por ahora
          </button>
        </div>
        <div className="onboarding-illustration" aria-hidden="true">
          <PlantStateIcon stage={step === 2 ? "Floracion" : step === 1 ? "Vegetativo" : "Plantin"} />
        </div>
        <p className="mt-4 text-sm font-bold leading-6 text-stone-700">{currentStep.body}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {step > 0 ? (
            <button className="secondary-button" onClick={() => setStep((value) => value - 1)} type="button">
              Atras
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button className="primary-button" onClick={() => setStep((value) => value + 1)} type="button">
              Continuar
            </button>
          ) : (
            <button className="primary-button" onClick={finish} type="button">
              Ir a Hoy
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function SpacesSection({
  calendarEvents,
  entries,
  environmentalAlerts,
  inspections,
  irrigationRecipes,
  inventoryItems,
  inventoryMovements,
  locale,
  productCatalog,
  stageTransitions,
  measurements,
  onAddCalendarEvent,
  onAddJournalEntry,
  onAddMeasurement,
  onSaveInspection,
  onSaveStageTransition,
  onSaveIrrigationRecipe,
  onSaveInventoryItem,
  onSaveProductCatalogItem,
  onDeleteMeasurement,
  onUpdateEnvironmentalAlerts,
  onCreateSensorDevice,
  onCreatePlant,
  onCreateSpace,
  onDeleteSpace,
  onRefreshSensors,
  onToggleSensorDevice,
  onUpdatePlant,
  onUpdateSpace,
  plants,
  sensorDevices,
  sensorStatus,
  spaces,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  environmentalAlerts: PlantEnvironmentalAlertSettings[];
  inspections: PlantInspection[];
  irrigationRecipes: IrrigationRecipe[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  locale: Locale;
  productCatalog: ProductCatalogItem[];
  stageTransitions: PlantStageTransition[];
  measurements: PlantMeasurement[];
  onAddCalendarEvent: (event: CalendarEvent) => void;
  onAddJournalEntry: (entry: CareEntry) => void;
  onAddMeasurement: (measurement: PlantMeasurement) => void;
  onSaveInspection: (inspection: PlantInspection) => void;
  onSaveIrrigationRecipe: (recipe: IrrigationRecipe) => void;
  onSaveInventoryItem: (item: InventoryItem, context?: InventoryMovementContext) => void;
  onSaveProductCatalogItem: (item: ProductCatalogItem) => void;
  onSaveStageTransition: (transition: PlantStageTransition) => void;
  onDeleteMeasurement: (measurementId: string) => void;
  onUpdateEnvironmentalAlerts: (settings: PlantEnvironmentalAlertSettings) => void;
  onCreateSensorDevice: (plantId: string, name: string) => Promise<string | null>;
  onCreatePlant: (plant: Plant) => void;
  onCreateSpace: (space: GrowSpace) => void;
  onDeleteSpace: (spaceId: string, reassignToSpaceId?: string) => void;
  onRefreshSensors: () => Promise<void>;
  onToggleSensorDevice: (deviceId: string, active: boolean) => Promise<void>;
  onUpdatePlant: (plantId: string, updates: Partial<Plant>) => void;
  onUpdateSpace: (spaceId: string, updates: Partial<GrowSpace>) => void;
  plants: Plant[];
  sensorDevices: SensorDevice[];
  sensorStatus: string;
  spaces: GrowSpace[];
  tasks: Task[];
}) {
  const [query, setQuery] = useState("");
  const [referenceGeneticId, setReferenceGeneticId] = useState("");
  const [referencePotCount, setReferencePotCount] = useState(4);
  const [popupGenetic, setPopupGenetic] = useState<GeneticReferenceEntry | null>(null);
  const activePlants = plants.filter((plant) => plant.lifecycle !== "archived");
  const archivedPlants = plants.filter((plant) => plant.lifecycle === "archived");
  const [measurementPlantId, setMeasurementPlantId] = useState(activePlants[0]?.id ?? "");
  const normalizedQuery = query.trim().toLowerCase();
  const selectedReferenceGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === referenceGeneticId);
  const visibleSpaces = spaces
    .map((space) => {
      const matchingPlants = plants.filter((plant) => {
        const matchesSpace = space.name.toLowerCase().includes(normalizedQuery);
        const matchesPlant = [plant.name, plant.variety, plant.stage].join(" ").toLowerCase().includes(normalizedQuery);
        return plant.lifecycle !== "archived" && plant.spaceId === space.id && (!normalizedQuery || matchesSpace || matchesPlant);
      });
      // Cuenta todas las macetas del espacio (activas y archivadas): una
      // maceta archivada tambien necesita que la reasignen antes de poder
      // borrar el espacio, aunque no aparezca en la lista de abajo.
      const totalPlantCount = plants.filter((plant) => plant.spaceId === space.id).length;

      return { ...space, plants: matchingPlants, totalPlantCount };
    })
    .filter((space) => !normalizedQuery || space.name.toLowerCase().includes(normalizedQuery) || space.plants.length > 0);

  return (
    <section className="mx-auto mt-7 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="spaces-command-header">
        <div>
          <SectionHeader eyebrow="Cultivos" title="Espacios y plantas" />
          <p className="spaces-command-copy">Explorá cada ambiente, abrí una maceta para ver su historial o registrá una medición sin perder contexto.</p>
        </div>
        <div className="spaces-command-actions">
        <label className="spaces-search-control">
          Buscar
          <input
            aria-label="Buscar por espacio o planta"
            className="form-control"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre de planta o espacio"
            type="search"
            value={query}
          />
        </label>
        <CreateSpaceForm onCreateSpace={onCreateSpace} />
        </div>
      </div>

      <Card as="section" className="environment-entry-card mt-5 p-4 sm:p-5" id="mediciones-ambientales" variant="elevated">
        <div className="environment-entry-heading">
          <SectionHeader eyebrow="Carga por maceta" title="Mediciones ambientales" />
          <span className="environment-entry-badge">Temperatura + humedad → VPD</span>
        </div>
        <p className="environment-entry-copy">
          Elegí una maceta y cargá una lectura manual. Temperatura y humedad permiten calcular VPD; el resto de los campos es opcional.
        </p>
        {activePlants.length > 0 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.45fr)_1fr]">
            <label className="grid content-start gap-1 text-sm font-black text-moss-950">
              Planta o maceta
              <select className="form-control" onChange={(event) => setMeasurementPlantId(event.target.value)} value={measurementPlantId}>
                {activePlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.pot}</option>)}
              </select>
            </label>
            {activePlants.find((plant) => plant.id === measurementPlantId) ? (
              <PlantMeasurementForm
                onAddMeasurement={onAddMeasurement}
                onDone={() => undefined}
                plant={activePlants.find((plant) => plant.id === measurementPlantId)!}
                resetAfterSave
              />
            ) : null}
          </div>
        ) : <EmptyState body="Creá una planta o maceta antes de registrar mediciones." title="No hay macetas disponibles" />}
      </Card>

      <ProductCatalogPanel items={productCatalog} onSaveItem={onSaveProductCatalogItem} plants={activePlants} />
      <InventoryPanel items={inventoryItems} movements={inventoryMovements} onSaveItem={onSaveInventoryItem} products={productCatalog} />
      <BatchIrrigationPanel inventoryItems={inventoryItems} onAddMeasurement={onAddMeasurement} onSaveInventoryItem={onSaveInventoryItem} onSaveRecipe={onSaveIrrigationRecipe} plants={activePlants} products={productCatalog} recipes={irrigationRecipes} />

      <div className="genetics-reference-panel mt-5 rounded-lg border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Referencia rapida</p>
            <h3 className="genetics-panel-title mt-1 text-lg font-black">Elegir semilla y ver caracteristicas</h3>
            <p className="genetics-panel-copy mt-1 text-sm font-bold leading-6">
              Esta ficha es solo lectura para comparar datos publicados. La cantidad de macetas la declara el usuario.
            </p>
          </div>
          <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:min-w-72 sm:grid-cols-[1fr_140px]">
            <label className="grid gap-1 text-sm font-black">
              Genetica de referencia
              <select
                className="form-control"
                value={referenceGeneticId}
                onChange={(event) => setReferenceGeneticId(event.target.value)}
              >
                <option value="">Seleccionar genetica</option>
                {geneticsCatalogAlphabetically.map((genetic) => (
                  <option key={genetic.id} value={genetic.id}>
                    {genetic.name} - {formatGeneticType(genetic.type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-black">
              Cantidad
              <select
                className="form-control"
                value={referencePotCount}
                onChange={(event) => setReferencePotCount(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 8, 9, 12].map((count) => (
                  <option key={count} value={count}>
                    {count} maceta{count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button genetics-reference-button sm:col-span-2"
              disabled={!selectedReferenceGenetic}
              onClick={() => selectedReferenceGenetic && setPopupGenetic(selectedReferenceGenetic)}
              type="button"
            >
              Ver ficha
            </button>
          </div>
        </div>
        {selectedReferenceGenetic ? (
          <div className="genetic-pot-grid mt-4" aria-label="Macetas declaradas para la genetica seleccionada">
            {Array.from({ length: referencePotCount }, (_, index) => (
              <article className="genetic-pot-card" key={`${selectedReferenceGenetic.id}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <p>{selectedReferenceGenetic.name}</p>
                  <small>Maceta {index + 1} - misma genetica</small>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {visibleSpaces.length > 0 ? (
          visibleSpaces.map((space) => (
            <Card as="article" className="min-w-0 overflow-hidden" key={space.id}>
              <div className="space-banner">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-white">{space.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-mint-50/86">
                    {space.region} - {space.mode}
                  </p>
                </div>
                <div className="space-banner-meta">
                  <span>{space.plants.length} maceta{space.plants.length === 1 ? "" : "s"}</span>
                  <span>{space.privacyLevel}</span>
                </div>
              </div>
              <SpaceManageControls
                allSpaces={spaces}
                onDeleteSpace={onDeleteSpace}
                onUpdateSpace={onUpdateSpace}
                space={space}
                totalPlantCount={space.totalPlantCount}
              />
              <div className="grid gap-0 divide-y divide-moss-950/10 p-4">
                {space.plants.map((plant) => (
                    <PlantSpaceRow
                      calendarEvents={calendarEvents}
                      entries={entries}
                      environmentalAlertSettings={environmentalAlerts.find((settings) => settings.plantId === plant.id)}
                      measurements={measurements.filter((measurement) => measurement.plantId === plant.id)}
                      inspections={inspections.filter((inspection) => inspection.plantId === plant.id)}
                      stageTransitions={stageTransitions.filter((transition) => transition.plantId === plant.id)}
                      key={plant.id}
                      locale={locale}
                      onAddJournalEntry={onAddJournalEntry}
                      onAddCalendarEvent={onAddCalendarEvent}
                      onAddMeasurement={onAddMeasurement}
                      onSaveInspection={onSaveInspection}
                      onSaveStageTransition={onSaveStageTransition}
                      onDeleteMeasurement={onDeleteMeasurement}
                      onUpdateEnvironmentalAlerts={onUpdateEnvironmentalAlerts}
                      onCreateSensorDevice={onCreateSensorDevice}
                      onRefreshSensors={onRefreshSensors}
                      onOpenGenetic={setPopupGenetic}
                      onToggleSensorDevice={onToggleSensorDevice}
                      onUpdatePlant={onUpdatePlant}
                      plant={plant}
                      sensorDevices={sensorDevices.filter((device) => device.plantId === plant.id)}
                      sensorStatus={sensorStatus}
                      tasks={tasks}
                    />
                  ))}
              </div>
            </Card>
          ))
        ) : (
          <div className="lg:col-span-2">
            <EmptyState
              body="No hay coincidencias con tu busqueda. Proba limpiar el filtro o crear un cultivo desde el alta inicial."
              title="No encontramos cultivos"
            />
          </div>
        )}
      </div>

      <ArchivedCyclesPanel entries={entries} measurements={measurements} onCreatePlant={onCreatePlant} onUpdatePlant={onUpdatePlant} plants={archivedPlants} />

      {popupGenetic ? <GeneticInfoPopup genetic={popupGenetic} onClose={() => setPopupGenetic(null)} /> : null}
    </section>
  );
}

function CreateSpaceForm({ onCreateSpace }: { onCreateSpace: (space: GrowSpace) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GrowSpace["mode"]>("Exterior");
  const [region, setRegion] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState<GrowSpace["privacyLevel"]>("Region aproximada");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    onCreateSpace({
      id: createEventId("space"),
      mode,
      name: name.trim(),
      privacyLevel,
      region: region.trim() || "Sin declarar"
    });
    setName("");
    setRegion("");
    setMessage("Espacio creado.");
    setIsOpen(false);
  }

  return (
    <div className="space-create-control">
      <button className="secondary-button" onClick={() => setIsOpen((current) => !current)} type="button">
        {isOpen ? "Cancelar" : "+ Nuevo espacio"}
      </button>
      {isOpen ? (
        <form className="space-create-form" onSubmit={submit}>
          <label>
            Nombre
            <input className="form-control" onChange={(event) => setName(event.target.value)} placeholder="Ej: Carpa 60x60" required value={name} />
          </label>
          <label>
            Modalidad
            <select className="form-control" onChange={(event) => setMode(event.target.value as GrowSpace["mode"])} value={mode}>
              <option value="Exterior">Exterior</option>
              <option value="Interior">Interior</option>
              <option value="Invernadero">Invernadero</option>
            </select>
          </label>
          <label>
            Región declarada
            <input className="form-control" onChange={(event) => setRegion(event.target.value)} placeholder="Ej: Zona sur, CABA" value={region} />
          </label>
          <label>
            Privacidad
            <select className="form-control" onChange={(event) => setPrivacyLevel(event.target.value as GrowSpace["privacyLevel"])} value={privacyLevel}>
              <option value="Region aproximada">Región aproximada</option>
              <option value="Interior privado">Interior privado</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Crear espacio</button>
        </form>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

// Cada card de espacio ofrece editar sus datos y borrarlo. Nunca se elimina
// en silencio con macetas adentro: si hay al menos una (activa o archivada),
// primero hay que elegir a que otro espacio se mudan.
function SpaceManageControls({
  allSpaces,
  onDeleteSpace,
  onUpdateSpace,
  space,
  totalPlantCount
}: {
  allSpaces: GrowSpace[];
  onDeleteSpace: (spaceId: string, reassignToSpaceId?: string) => void;
  onUpdateSpace: (spaceId: string, updates: Partial<GrowSpace>) => void;
  space: GrowSpace;
  totalPlantCount: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [mode, setMode] = useState<GrowSpace["mode"]>(space.mode);
  const [region, setRegion] = useState(space.region);
  const [privacyLevel, setPrivacyLevel] = useState<GrowSpace["privacyLevel"]>(space.privacyLevel);
  const otherSpaces = allSpaces.filter((item) => item.id !== space.id);
  const [reassignToSpaceId, setReassignToSpaceId] = useState(otherSpaces[0]?.id ?? "");
  const hasPlants = totalPlantCount > 0;
  const canDelete = allSpaces.length > 1 && (!hasPlants || Boolean(reassignToSpaceId));

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    onUpdateSpace(space.id, { mode, name: name.trim(), privacyLevel, region: region.trim() || "Sin declarar" });
    setIsEditing(false);
  }

  function handleDelete() {
    if (!canDelete) return;

    const targetName = otherSpaces.find((item) => item.id === reassignToSpaceId)?.name ?? "otro espacio";
    const confirmMessage = hasPlants
      ? `Eliminar "${space.name}"? Sus ${totalPlantCount} maceta${totalPlantCount === 1 ? "" : "s"} (incluidas las archivadas) se mueven a "${targetName}".`
      : `Eliminar el espacio "${space.name}"? No tiene macetas. Esta acción no se puede deshacer.`;
    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) return;

    onDeleteSpace(space.id, hasPlants ? reassignToSpaceId : undefined);
  }

  return (
    <div className="space-manage-controls">
      <div className="space-manage-actions">
        <button className="text-button" onClick={() => setIsEditing((current) => !current)} type="button">
          {isEditing ? "Cancelar edición" : "Editar espacio"}
        </button>
        {allSpaces.length > 1 ? (
          <>
            {hasPlants ? (
              <label className="space-reassign-picker">
                Mover macetas a
                <select className="form-control" onChange={(event) => setReassignToSpaceId(event.target.value)} value={reassignToSpaceId}>
                  {otherSpaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            ) : null}
            <button className="danger-button" disabled={!canDelete} onClick={handleDelete} type="button">
              Eliminar espacio
            </button>
          </>
        ) : (
          <span className="space-manage-hint">No se puede borrar: tiene que quedar al menos un espacio.</span>
        )}
      </div>
      {isEditing ? (
        <form className="space-edit-form" onSubmit={saveEdit}>
          <label>
            Nombre
            <input className="form-control" onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            Modalidad
            <select className="form-control" onChange={(event) => setMode(event.target.value as GrowSpace["mode"])} value={mode}>
              <option value="Exterior">Exterior</option>
              <option value="Interior">Interior</option>
              <option value="Invernadero">Invernadero</option>
            </select>
          </label>
          <label>
            Región declarada
            <input className="form-control" onChange={(event) => setRegion(event.target.value)} value={region} />
          </label>
          <label>
            Privacidad
            <select className="form-control" onChange={(event) => setPrivacyLevel(event.target.value as GrowSpace["privacyLevel"])} value={privacyLevel}>
              <option value="Region aproximada">Región aproximada</option>
              <option value="Interior privado">Interior privado</option>
            </select>
          </label>
          <button className="secondary-button" type="submit">Guardar cambios</button>
        </form>
      ) : null}
    </div>
  );
}

function PlantSpaceRow({
  calendarEvents,
  entries,
  environmentalAlertSettings,
  inspections,
  locale,
  measurements,
  onAddCalendarEvent,
  onAddJournalEntry,
  onAddMeasurement,
  onSaveInspection,
  onSaveStageTransition,
  onDeleteMeasurement,
  onUpdateEnvironmentalAlerts,
  onCreateSensorDevice,
  onRefreshSensors,
  onOpenGenetic,
  onToggleSensorDevice,
  onUpdatePlant,
  plant,
  stageTransitions,
  sensorDevices,
  sensorStatus,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  environmentalAlertSettings?: PlantEnvironmentalAlertSettings;
  inspections: PlantInspection[];
  locale: Locale;
  measurements: PlantMeasurement[];
  onAddCalendarEvent: (event: CalendarEvent) => void;
  onAddJournalEntry: (entry: CareEntry) => void;
  onAddMeasurement: (measurement: PlantMeasurement) => void;
  onSaveInspection: (inspection: PlantInspection) => void;
  onSaveStageTransition: (transition: PlantStageTransition) => void;
  onDeleteMeasurement: (measurementId: string) => void;
  onUpdateEnvironmentalAlerts: (settings: PlantEnvironmentalAlertSettings) => void;
  onCreateSensorDevice: (plantId: string, name: string) => Promise<string | null>;
  onRefreshSensors: () => Promise<void>;
  onOpenGenetic: (genetic: GeneticReferenceEntry) => void;
  onToggleSensorDevice: (deviceId: string, active: boolean) => Promise<void>;
  onUpdatePlant: (plantId: string, updates: Partial<Plant>) => void;
  plant: Plant;
  stageTransitions: PlantStageTransition[];
  sensorDevices: SensorDevice[];
  sensorStatus: string;
  tasks: Task[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const plantGenetic = findGeneticByPlant(plant);

  return (
    <details className="plant-row-details" id={plant.id}>
      <summary>
        <PlantAvatar plant={plant} />
        <span className="min-w-0 flex-1">
          <span className="block font-black text-moss-950">{plant.name}</span>
          <span className="mt-1 block text-sm text-stone-600">{plant.variety}</span>
        </span>
        <span className="pill pill-green">{plant.stage}</span>
      </summary>

      {isEditing ? (
        <PlantEditorForm
          onCancel={() => setIsEditing(false)}
          onSave={(updates) => {
            onUpdatePlant(plant.id, updates);
            setIsEditing(false);
          }}
          plant={plant}
        />
      ) : (
        <>
          <div className="plant-row-toolbar">
            <button className="secondary-button" onClick={() => setIsEditing(true)} type="button">
              Editar esta maceta
            </button>
            <PlantCycleControls onUpdatePlant={onUpdatePlant} plant={plant} />
          </div>
          <TrichomeAnalyzer onAddJournalEntry={onAddJournalEntry} plant={plant} />
          <PlantGeneticSummary genetic={plantGenetic} onOpenGenetic={onOpenGenetic} plant={plant} />
          <PlantCalculationSummary genetic={plantGenetic} plant={plant} />
          <PlantDataCalculations measurements={measurements} onUpdatePlant={onUpdatePlant} plant={plant} />
          <PlantExportPanel alertSettings={environmentalAlertSettings} calendarEvents={calendarEvents} entries={entries} measurements={measurements} plant={plant} tasks={tasks} />
          <PlantQrPanel locale={locale} plant={plant} />
          <PlantPhotoTimeline entries={entries} inspections={inspections} measurements={measurements} plant={plant} />
          <PlantEnvironmentPanel
            measurements={measurements}
            alertSettings={environmentalAlertSettings}
            onAddMeasurement={onAddMeasurement}
            onDeleteMeasurement={onDeleteMeasurement}
            onUpdateAlertSettings={onUpdateEnvironmentalAlerts}
            plant={plant}
          />
          <PlantInspectionPanel inspections={inspections} onSaveInspection={onSaveInspection} plant={plant} />
          <PlantStageHistoryPanel onSaveTransition={onSaveStageTransition} plant={plant} transitions={stageTransitions} />
          <PlantWeeklySummary
            calendarEvents={calendarEvents}
            entries={entries}
            measurements={measurements}
            plant={plant}
            tasks={tasks}
          />
          <PlantPeriodComparison measurements={measurements} plant={plant} />
          <PlantDataCoverage measurements={measurements} plant={plant} />
          <PlantSensorPanel
            devices={sensorDevices}
            onCreateSensorDevice={onCreateSensorDevice}
            onRefreshSensors={onRefreshSensors}
            onToggleSensorDevice={onToggleSensorDevice}
            plant={plant}
            status={sensorStatus}
          />
          <PlantSuggestionsPanel
            calendarEvents={calendarEvents}
            genetic={plantGenetic}
            measurements={measurements}
            onAddCalendarEvent={onAddCalendarEvent}
            plant={plant}
          />
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <PlantFact label="Maceta" value={plant.pot} />
            <PlantFact label="Sustrato" value={plant.substrate} />
            <PlantFact label="Luz" value={plant.lighting} />
            <PlantFact label="Modo" value={plant.mode} />
          </dl>
        </>
      )}

      <PlantStageProgress plant={plant} />
      <PlantQuickNote onAddJournalEntry={onAddJournalEntry} plant={plant} />
      <PlantUtilityPanel calendarEvents={calendarEvents} entries={entries} plant={plant} />
      <PlantTimeline calendarEvents={calendarEvents} entries={entries} environmentalAlertSettings={environmentalAlertSettings} measurements={measurements} plant={plant} stageTransitions={stageTransitions} tasks={tasks} />
    </details>
  );
}

function PlantStageHistoryPanel({ onSaveTransition, plant, transitions }: { onSaveTransition: (transition: PlantStageTransition) => void; plant: Plant; transitions: PlantStageTransition[] }) {
  const [isAdding, setIsAdding] = useState(false); const [toStage, setToStage] = useState(""); const [changedAt, setChangedAt] = useState(getTodayIso()); const [note, setNote] = useState(""); const [status, setStatus] = useState("");
  const sorted = [...transitions].sort((first, second) => second.changedAt.localeCompare(first.changedAt));
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!toStage.trim()) return; if (toStage.trim().toLowerCase() === plant.stage.trim().toLowerCase()) { setStatus("La nueva etapa debe ser diferente de la etapa actual."); return; } onSaveTransition({ changedAt, fromStage: plant.stage, id: `stage-${plant.id}-${Date.now()}`, note: note.trim() || undefined, plantId: plant.id, source: "user", toStage: toStage.trim() }); setToStage(""); setNote(""); setIsAdding(false); setStatus("Cambio de etapa registrado con la fecha declarada."); }
  return <section className="plant-stage-history"><header><div><p className="plant-calculation-eyebrow">Fenología declarada</p><h4>Historial de etapas</h4><span>Etapa actual: {plant.stage}</span></div><button className="secondary-button" onClick={() => setIsAdding((current) => !current)} type="button">{isAdding ? "Cancelar" : "Registrar cambio"}</button></header>{isAdding ? <form onSubmit={submit}><label>Nueva etapa<input className="form-control" onChange={(event) => setToStage(event.target.value)} placeholder="Nombre declarado por el usuario" required value={toStage} /></label><label>Fecha del cambio<input className="form-control" max={getTodayIso()} min={plant.startedAt} onChange={(event) => setChangedAt(event.target.value)} required type="date" value={changedAt} /></label><label className="stage-note">Nota opcional<textarea className="form-control" onChange={(event) => setNote(event.target.value)} rows={2} value={note} /></label><button className="primary-button" type="submit">Guardar cambio de etapa</button></form> : null}{status ? <p role="status">{status}</p> : null}<div className="stage-history-list">{sorted.length ? sorted.map((transition) => <article key={transition.id}><div><strong>{transition.fromStage} → {transition.toStage}</strong><p>{transition.note || "Sin nota adicional."}</p></div><span>{formatDisplayDate(transition.changedAt.slice(0, 10))} · usuario</span></article>) : <p>No hay cambios de etapa fechados. La etapa actual no recibe una fecha retroactiva.</p>}</div></section>;
}

function PlantWeeklySummary({
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
}) {
  const today = getTodayIso();
  const startDate = offsetDate(today, -6);
  const isInWindow = (value: string) => {
    const date = value.slice(0, 10);
    return date >= startDate && date <= today;
  };
  const weeklyMeasurements = measurements.filter((measurement) => isInWindow(measurement.measuredAt));
  const weeklyEntries = entries.filter((entry) => entry.plantId === plant.id && isInWindow(entry.createdAt));
  const irrigationCount = weeklyMeasurements.filter((measurement) => measurement.waterAmountMl !== undefined).length;
  const photoCount = weeklyMeasurements.filter((measurement) => measurement.photoDataUrl).length + weeklyEntries.filter((entry) => entry.photoDataUrl).length;
  const noteCount = weeklyEntries.length + weeklyMeasurements.filter((measurement) => measurement.observations).length;
  const completedActions = calendarEvents
    .filter((event) => event.plantId === plant.id)
    .flatMap((event) => event.completedDates)
    .filter(isInWindow).length;
  const openTasks = tasks.filter((task) => task.plantId === plant.id && task.status === "open").length;
  const chronological = [...weeklyMeasurements].sort((first, second) => first.measuredAt.localeCompare(second.measuredAt));
  const vpdValues = chronological.flatMap((measurement) => {
    const value = assessPlantEnvironment(plant, measurement).vpdKpa;
    return value === undefined ? [] : [value];
  });
  const latestMeasurement = chronological.at(-1);
  const latestAssessment = assessPlantEnvironment(plant, latestMeasurement);
  const missingEnvironment = latestAssessment.missingInputs.filter((item) => item !== "PPFD a nivel de la copa");
  const vpdSummary = getWeeklyVpdSummary(vpdValues);
  const hasActivity = weeklyMeasurements.length + weeklyEntries.length + completedActions > 0;

  return (
    <section className="plant-weekly-summary" aria-label={`Resumen semanal de ${plant.name}`}>
      <header>
        <div>
          <p className="plant-calculation-eyebrow">Resumen verificable</p>
          <h4>Últimos 7 días</h4>
          <span>{formatDisplayDate(startDate)} al {formatDisplayDate(today)} · etapa declarada: {plant.stage}</span>
        </div>
        <span className="pill pill-blue">{hasActivity ? "Con actividad" : "Sin registros"}</span>
      </header>
      <dl className="plant-weekly-metrics">
        <WeeklyMetric label="Mediciones" value={weeklyMeasurements.length} />
        <WeeklyMetric label="Riegos registrados" value={irrigationCount} />
        <WeeklyMetric label="Notas" value={noteCount} />
        <WeeklyMetric label="Fotos" value={photoCount} />
        <WeeklyMetric label="Acciones hechas" value={completedActions} />
        <WeeklyMetric label="Pendientes actuales" value={openTasks} />
      </dl>
      <div className="plant-weekly-findings">
        <p><strong>VPD:</strong> {vpdSummary}</p>
        {missingEnvironment.length > 0 ? <p><strong>Falta para calcular VPD:</strong> {missingEnvironment.join(", ")} en la última lectura.</p> : null}
        {!hasActivity ? <p>No se agregaron fechas ni valores: este resumen solo cuenta registros existentes dentro del período.</p> : null}
      </div>
    </section>
  );
}

type PeriodMetric = { count: number; value?: number };
type PeriodComparisonDatum = { current: PeriodMetric; label: string; previous: PeriodMetric; unit: string };
type PeriodDiagnosis = { kind: "insight" | "insufficient" | "stable"; text: string };

function PlantPeriodComparison({ measurements, plant }: { measurements: PlantMeasurement[]; plant: Plant }) {
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);
  const { comparisons, currentStart, diagnosis, previousEnd, previousStart, today } = buildPeriodComparison(measurements, plant, periodDays);
  const comparableCount = comparisons.filter((item) => item.current.value !== undefined && item.previous.value !== undefined).length;

  return (
    <section className="plant-period-comparison" aria-label={`Comparación de períodos de ${plant.name}`}>
      <header>
        <div><p className="plant-calculation-eyebrow">Comparación verificable</p><h4>Período actual vs. anterior</h4><span>{formatDisplayDate(currentStart)}–{formatDisplayDate(today)} frente a {formatDisplayDate(previousStart)}–{formatDisplayDate(previousEnd)}</span></div>
        <div className="period-comparison-controls"><label>Ventana<select className="form-control" onChange={(event) => setPeriodDays(Number(event.target.value) as 7 | 30)} value={periodDays}><option value="7">7 días</option><option value="30">30 días</option></select></label><span className="pill pill-blue">{comparableCount} métricas comparables</span></div>
      </header>
      <div className="period-comparison-grid">
        {comparisons.map((item) => <PeriodComparisonMetric key={item.label} {...item} />)}
      </div>
      <div className={`period-diagnosis period-diagnosis-${diagnosis.kind}`} role={diagnosis.kind === "insight" ? "status" : undefined}>
        <p className="plant-calculation-eyebrow">{diagnosis.kind === "insight" ? "Explicación más probable" : "Lectura del período"}</p>
        <p>{diagnosis.text}</p>
      </div>
      <p>Promedios y diferencias calculados únicamente con registros disponibles. La cantidad de muestras puede variar entre métricas; esto es una correlación entre lo que registraste, no una causa confirmada.</p>
    </section>
  );
}

function buildPeriodComparison(measurements: PlantMeasurement[], plant: Plant, periodDays: 7 | 30) {
  const today = getTodayIso();
  const currentStart = offsetDate(today, -(periodDays - 1));
  const previousEnd = offsetDate(today, -periodDays);
  const previousStart = offsetDate(today, -(periodDays * 2 - 1));
  const inRange = (measurement: PlantMeasurement, start: string, end: string) => measurement.measuredAt.slice(0, 10) >= start && measurement.measuredAt.slice(0, 10) <= end;
  const current = measurements.filter((measurement) => inRange(measurement, currentStart, today));
  const previous = measurements.filter((measurement) => inRange(measurement, previousStart, previousEnd));
  const metric = (records: PlantMeasurement[], select: (measurement: PlantMeasurement) => number | undefined): PeriodMetric => {
    const values = records.flatMap((measurement) => { const value = select(measurement); return value === undefined ? [] : [value]; });
    return { count: values.length, value: values.length === 0 ? undefined : Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2)) };
  };
  const totalWater = (records: PlantMeasurement[]): PeriodMetric => {
    const values = records.flatMap((measurement) => measurement.waterAmountMl === undefined ? [] : [measurement.waterAmountMl]);
    return { count: values.length, value: values.length === 0 ? undefined : Number(values.reduce((total, value) => total + value, 0).toFixed(1)) };
  };
  const comparisons: PeriodComparisonDatum[] = [
    { current: metric(current, (item) => item.temperatureC), label: "Temperatura promedio", previous: metric(previous, (item) => item.temperatureC), unit: " °C" },
    { current: metric(current, (item) => item.ambientHumidityPercent), label: "Humedad promedio", previous: metric(previous, (item) => item.ambientHumidityPercent), unit: "%" },
    { current: metric(current, (item) => assessPlantEnvironment(plant, item).vpdKpa), label: "VPD promedio calculado", previous: metric(previous, (item) => assessPlantEnvironment(plant, item).vpdKpa), unit: " kPa" },
    { current: totalWater(current), label: "Agua registrada total", previous: totalWater(previous), unit: " ml" },
    { current: metric(current, (item) => item.heightCm), label: "Altura promedio registrada", previous: metric(previous, (item) => item.heightCm), unit: " cm" }
  ];
  const diagnosis = buildPeriodDiagnosis(current, previous, plant, comparisons);
  return { comparisons, currentStart, diagnosis, previousEnd, previousStart, today };
}

/**
 * Intenta dar una explicacion honesta de por que cambio (o no) lo que se ve
 * en `comparisons`, en vez de dejar solo los numeros crudos como antes.
 *
 * No es un diagnostico certero: es una correlacion entre el estado de VPD
 * (que ya combina temperatura y humedad, calculado por assessPlantEnvironment
 * segun la etapa declarada) y el crecimiento en altura registrado, entre el
 * periodo actual y el anterior. Se devuelve siempre un mensaje -- incluso
 * cuando no hay hallazgo, para distinguir explicitamente "no encontramos una
 * explicacion" de "no hay datos suficientes para buscarla".
 *
 * Umbrales elegidos para evitar sobre-interpretar muestras chicas: se pide
 * un minimo de 3 lecturas de VPD comparables en cada periodo, y un corrimiento
 * de al menos 30 puntos porcentuales en la proporcion fuera de rango antes de
 * llamarlo un cambio notable.
 */
function buildPeriodDiagnosis(current: PlantMeasurement[], previous: PlantMeasurement[], plant: Plant, comparisons: PeriodComparisonDatum[]): PeriodDiagnosis {
  const MIN_SAMPLES = 3;
  const NOTABLE_SHIFT = 0.3;

  const currentVpd = summarizeVpdOutOfRange(current, plant);
  const previousVpd = summarizeVpdOutOfRange(previous, plant);

  if (!currentVpd || !previousVpd || currentVpd.total < MIN_SAMPLES || previousVpd.total < MIN_SAMPLES) {
    return {
      kind: "insufficient",
      text: "Todavía no hay suficientes lecturas de temperatura y humedad en ambos períodos (se necesitan al menos 3 en cada uno) para estimar si el ambiente cambió. Sumá más mediciones para que esta lectura sea confiable."
    };
  }

  const shift = currentVpd.outOfRangeShare - previousVpd.outOfRangeShare;
  const currentPct = Math.round(currentVpd.outOfRangeShare * 100);
  const previousPct = Math.round(previousVpd.outOfRangeShare * 100);
  const heightDatum = comparisons.find((item) => item.label === "Altura promedio registrada");
  const heightChange =
    heightDatum && heightDatum.current.value !== undefined && heightDatum.previous.value !== undefined
      ? Number((heightDatum.current.value - heightDatum.previous.value).toFixed(2))
      : undefined;

  if (shift >= NOTABLE_SHIFT) {
    if (heightChange !== undefined && heightChange <= 0.5) {
      return {
        kind: "insight",
        text: `Explicación más consistente con tus datos: el VPD estuvo fuera del rango orientativo para "${plant.stage}" en ${currentPct}% de las mediciones de este período (era ${previousPct}% en el anterior), y en el mismo lapso la altura promedio registrada casi no cambió (${heightChange > 0 ? "+" : ""}${heightChange} cm). Un VPD fuera de rango suele ir asociado a estrés que frena el crecimiento — es la lectura más consistente con lo que registraste, no una causa confirmada.`
      };
    }
    return {
      kind: "insight",
      text: `El VPD estuvo fuera del rango orientativo para "${plant.stage}" en ${currentPct}% de las mediciones de este período, frente a ${previousPct}% en el anterior. Vale la pena revisar temperatura, humedad y ventilación — todavía no hay otro dato (como la altura registrada) que confirme un efecto.`
    };
  }

  if (shift <= -NOTABLE_SHIFT) {
    const heightNote = heightChange !== undefined && heightChange > 0 ? ` En el mismo período, la altura promedio registrada aumentó ${heightChange} cm.` : "";
    return {
      kind: "insight",
      text: `El VPD estuvo fuera del rango orientativo en ${currentPct}% de las mediciones de este período, una mejora frente al ${previousPct}% del anterior.${heightNote}`
    };
  }

  return {
    kind: "stable",
    text: `El VPD se mantuvo relativamente estable entre períodos (${currentPct}% de las mediciones fuera de rango en este período, ${previousPct}% en el anterior): no encontramos un cambio ambiental claro que explique otras diferencias de esta comparación.`
  };
}

function summarizeVpdOutOfRange(records: PlantMeasurement[], plant: Plant) {
  const statuses = records.map((item) => assessPlantEnvironment(plant, item).vpdStatus).filter((status) => status !== "missing");
  if (statuses.length === 0) return undefined;
  const outOfRange = statuses.filter((status) => status !== "in-range").length;
  return { outOfRangeShare: outOfRange / statuses.length, total: statuses.length };
}

function PeriodComparisonMetric({ current, label, previous, unit }: { current: PeriodMetric; label: string; previous: PeriodMetric; unit: string }) {
  const comparable = current.value !== undefined && previous.value !== undefined;
  const difference = comparable ? Number((current.value! - previous.value!).toFixed(2)) : undefined;
  return (
    <article className={comparable ? "is-comparable" : "is-missing"}>
      <span>{label}</span>
      <strong>{current.value === undefined ? "Sin datos actuales" : `${current.value}${unit}`}</strong>
      <small>Actual: {current.count} registro{current.count === 1 ? "" : "s"} · Anterior: {previous.count}</small>
      <p>{difference === undefined ? "Faltan registros en uno de los períodos." : `Cambio calculado: ${difference > 0 ? "+" : ""}${difference}${unit}`}</p>
    </article>
  );
}

function PlantDataCoverage({ measurements, plant }: { measurements: PlantMeasurement[]; plant: Plant }) {
  const startDate = offsetDate(getTodayIso(), -29);
  const recent = measurements.filter((measurement) => measurement.measuredAt.slice(0, 10) >= startDate);
  const coverage = [["Temperatura", recent.filter((item) => item.temperatureC !== undefined).length], ["Humedad ambiental", recent.filter((item) => item.ambientHumidityPercent !== undefined).length], ["Temperatura foliar", recent.filter((item) => item.leafTemperatureC !== undefined).length], ["PPFD", recent.filter((item) => item.ppfdUmolM2S !== undefined).length], ["Sustrato", recent.filter((item) => item.substrateMoisturePercent !== undefined).length], ["Altura", recent.filter((item) => item.heightCm !== undefined).length], ["Riego", recent.filter((item) => item.waterAmountMl !== undefined).length], ["Fotos", recent.filter((item) => item.photoDataUrl).length]] as const;
  const covered = coverage.filter(([, count]) => count > 0).length;
  return <section className="plant-data-coverage" aria-label={`Cobertura de datos de ${plant.name}`}><header><div><p className="plant-calculation-eyebrow">Calidad del historial</p><h4>Cobertura de los últimos 30 días</h4><span>Cuenta solamente campos realmente registrados desde {formatDisplayDate(startDate)}.</span></div><span className="pill pill-blue">{covered} de {coverage.length} variables</span></header><dl>{coverage.map(([label, count]) => <div className={count === 0 ? "is-missing" : ""} key={label}><dt>{label}</dt><dd>{count === 0 ? "Sin datos" : `${count} registro${count === 1 ? "" : "s"}`}</dd></div>)}</dl><p>La ausencia de una variable no implica un problema de cultivo; solo indica que no fue registrada durante esta ventana.</p></section>;
}

function ProductCatalogPanel({ items, onSaveItem, plants }: { items: ProductCatalogItem[]; onSaveItem: (item: ProductCatalogItem) => void; plants: Plant[] }) {
  const [name, setName] = useState(""); const [brand, setBrand] = useState(""); const [category, setCategory] = useState<ProductCatalogItem["category"]>("nutrient"); const [composition, setComposition] = useState(""); const [stages, setStages] = useState(""); const [mode, setMode] = useState<Plant["mode"] | "">(""); const [packageQuantity, setPackageQuantity] = useState(""); const [packageUnit, setPackageUnit] = useState("ml"); const [price, setPrice] = useState(""); const [currency, setCurrency] = useState("ARS"); const [sourceUrl, setSourceUrl] = useState(""); const [sourceCheckedAt, setSourceCheckedAt] = useState(getTodayIso()); const [selectedPlantId, setSelectedPlantId] = useState(plants[0]?.id ?? ""); const [status, setStatus] = useState("");
  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const cleanSource = sourceUrl.trim(); if (cleanSource && !/^https?:\/\//i.test(cleanSource)) { setStatus("La fuente debe comenzar con http:// o https://."); return; } onSaveItem({ brand: brand.trim() || undefined, category, compatibleModes: mode ? [mode] : [], compatibleStages: stages.split(",").map((item) => item.trim()).filter(Boolean), composition: composition.trim() || undefined, currency: price ? currency.trim().toUpperCase() || undefined : undefined, id: `product-${Date.now()}`, name: name.trim(), packageQuantity: parseOptionalNumber(packageQuantity), packageUnit: packageUnit.trim() || undefined, price: parseOptionalNumber(price), sourceCheckedAt: cleanSource ? sourceCheckedAt || undefined : undefined, sourceUrl: cleanSource || undefined }); setName(""); setBrand(""); setComposition(""); setStages(""); setPrice(""); setSourceUrl(""); setStatus("Producto agregado al catálogo privado."); }
  return <Card as="section" className="product-catalog-panel mt-5 p-4 sm:p-5"><SectionHeader eyebrow="Referencia declarada" title="Catálogo y comparación de productos" /><p>Guardá datos de la etiqueta o de una fuente verificable. PlantCare compara compatibilidad declarada y precio unitario; no prescribe dosis ni diagnostica necesidades.</p><form onSubmit={submit}><label>Producto<input className="form-control" onChange={(event) => setName(event.target.value)} required value={name} /></label><label>Marca opcional<input className="form-control" onChange={(event) => setBrand(event.target.value)} value={brand} /></label><label>Categoría<select className="form-control" onChange={(event) => setCategory(event.target.value as ProductCatalogItem["category"])} value={category}><option value="nutrient">Nutriente</option><option value="substrate">Sustrato</option><option value="treatment">Tratamiento</option><option value="other">Otro</option></select></label><label>Composición declarada<input className="form-control" onChange={(event) => setComposition(event.target.value)} placeholder="Copiar etiqueta, sin inferir" value={composition} /></label><label>Etapas declaradas<input className="form-control" onChange={(event) => setStages(event.target.value)} placeholder="Vegetativo, floración" value={stages} /></label><label>Modalidad declarada<select className="form-control" onChange={(event) => setMode(event.target.value as Plant["mode"] | "")} value={mode}><option value="">Sin especificar</option><option value="Interior">Interior</option><option value="Exterior">Exterior</option><option value="Invernadero">Invernadero</option></select></label><label>Contenido<input className="form-control" min="0" onChange={(event) => setPackageQuantity(event.target.value)} step="0.01" type="number" value={packageQuantity} /></label><label>Unidad<input className="form-control" onChange={(event) => setPackageUnit(event.target.value)} value={packageUnit} /></label><label>Precio<input className="form-control" min="0" onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} /></label><label>Moneda<input className="form-control" onChange={(event) => setCurrency(event.target.value)} value={currency} /></label><label>Fuente<input className="form-control" onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." type="url" value={sourceUrl} /></label><label>Fuente revisada<input className="form-control" onChange={(event) => setSourceCheckedAt(event.target.value)} type="date" value={sourceCheckedAt} /></label><button className="primary-button" type="submit">Guardar referencia</button></form>{status ? <p role="status">{status}</p> : null}<div className="product-comparison"><label>Comparar para una maceta<select className="form-control" onChange={(event) => setSelectedPlantId(event.target.value)} value={selectedPlantId}><option value="">Sin seleccionar</option>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.stage} · {plant.mode}</option>)}</select></label><div>{items.map((item) => { const normalizedStage = selectedPlant?.stage.trim().toLowerCase() ?? ""; const stageMatch = item.compatibleStages.length === 0 || !selectedPlant ? undefined : item.compatibleStages.some((stage) => normalizedStage.includes(stage.toLowerCase()) || stage.toLowerCase().includes(normalizedStage)); const modeMatch = item.compatibleModes.length === 0 || !selectedPlant ? undefined : item.compatibleModes.includes(selectedPlant.mode); const unitPrice = item.price !== undefined && item.packageQuantity ? item.price / item.packageQuantity : undefined; const missing = [!item.composition && "composición", item.price === undefined && "precio", !item.packageQuantity && "contenido", !item.sourceUrl && "fuente", item.compatibleStages.length === 0 && "etapa compatible", item.compatibleModes.length === 0 && "modalidad compatible"].filter(Boolean) as string[]; return <article key={item.id}><header><div><strong>{item.name}</strong><span>{item.brand || "Marca no declarada"} · {item.category}</span></div><span className={`pill ${stageMatch === false || modeMatch === false ? "pill-amber" : stageMatch && modeMatch ? "pill-green" : "pill-blue"}`}>{stageMatch === false || modeMatch === false ? "Revisar compatibilidad" : stageMatch && modeMatch ? "Coincide con lo declarado" : "Compatibilidad incompleta"}</span></header><p>{item.composition || "Composición no registrada."}</p><dl><div><dt>Precio</dt><dd>{item.price === undefined ? "Sin dato" : `${item.currency || ""} ${item.price}`}</dd></div><div><dt>Precio unitario</dt><dd>{unitPrice === undefined ? "No calculable" : `${item.currency || ""} ${unitPrice.toFixed(2)} / ${item.packageUnit || "unidad"}`}</dd></div><div><dt>Etapa</dt><dd>{stageMatch === undefined ? "No declarada" : stageMatch ? "Compatible declarada" : "No coincide"}</dd></div><div><dt>Modalidad</dt><dd>{modeMatch === undefined ? "No declarada" : modeMatch ? "Compatible declarada" : "No coincide"}</dd></div></dl>{missing.length ? <small>Datos faltantes: {missing.join(", ")}.</small> : null}{item.sourceUrl ? <a href={item.sourceUrl} rel="noreferrer" target="_blank">Ver fuente{item.sourceCheckedAt ? ` · revisada ${formatDisplayDate(item.sourceCheckedAt)}` : ""}</a> : null}</article>; })}</div></div></Card>;
}

function InventoryPanel({ items, movements, onSaveItem, products }: { items: InventoryItem[]; movements: InventoryMovement[]; onSaveItem: (item: InventoryItem, context?: InventoryMovementContext) => void; products: ProductCatalogItem[] }) {
  const [catalogProductId, setCatalogProductId] = useState(""); const [name, setName] = useState(""); const [category, setCategory] = useState<InventoryItem["category"]>("nutrient"); const [quantity, setQuantity] = useState(""); const [unit, setUnit] = useState("ml"); const [minimum, setMinimum] = useState(""); const [lotNumber, setLotNumber] = useState(""); const [expiresAt, setExpiresAt] = useState(""); const [status, setStatus] = useState("");
  function selectProduct(id: string) { setCatalogProductId(id); const product = products.find((item) => item.id === id); if (!product) return; setName(product.name); setCategory(product.category); setUnit(product.packageUnit || "unidad"); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const parsedQuantity = parseOptionalNumber(quantity); if (!name.trim() || parsedQuantity === undefined) return; const product = products.find((item) => item.id === catalogProductId); onSaveItem({ catalogProductId: product?.id, category, expiresAt: expiresAt || undefined, id: `inventory-${Date.now()}`, lotNumber: lotNumber.trim() || undefined, minimumQuantity: parseOptionalNumber(minimum), name: name.trim(), quantity: parsedQuantity, sourceUrl: product?.sourceUrl, unit: unit.trim() || "unidad" }); setCatalogProductId(""); setName(""); setQuantity(""); setMinimum(""); setLotNumber(""); setExpiresAt(""); setStatus("Insumo guardado en tu inventario."); }
  return <Card as="section" className="inventory-panel mt-5 p-4 sm:p-5"><SectionHeader eyebrow="Control propio" title="Inventario de insumos" /><p>Podés vincular una referencia del catálogo o cargar un insumo libre. Cantidades, lotes, vencimientos y mínimos siempre son declarados por el usuario.</p><form onSubmit={submit}><label>Producto del catálogo<select className="form-control" onChange={(event) => selectProduct(event.target.value)} value={catalogProductId}><option value="">Carga libre</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Nombre<input className="form-control" onChange={(event) => setName(event.target.value)} required value={name} /></label><label>Categoría<select className="form-control" onChange={(event) => setCategory(event.target.value as InventoryItem["category"])} value={category}><option value="nutrient">Nutriente</option><option value="substrate">Sustrato</option><option value="treatment">Tratamiento</option><option value="other">Otro</option></select></label><label>Cantidad<input className="form-control" min="0" onChange={(event) => setQuantity(event.target.value)} required step="0.01" type="number" value={quantity} /></label><label>Unidad<input className="form-control" onChange={(event) => setUnit(event.target.value)} value={unit} /></label><label>Mínimo para aviso<input className="form-control" min="0" onChange={(event) => setMinimum(event.target.value)} step="0.01" type="number" value={minimum} /></label><label>Lote opcional<input className="form-control" onChange={(event) => setLotNumber(event.target.value)} value={lotNumber} /></label><label>Vencimiento opcional<input className="form-control" onChange={(event) => setExpiresAt(event.target.value)} type="date" value={expiresAt} /></label><button className="primary-button" type="submit">Agregar insumo</button></form><div className="inventory-list">{items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.quantity} {item.unit}{item.minimumQuantity === undefined ? "" : ` · mínimo ${item.minimumQuantity}`}{item.lotNumber ? ` · lote ${item.lotNumber}` : ""}{item.expiresAt ? ` · vence ${formatDisplayDate(item.expiresAt)}` : ""}</span></div><div><button className="text-button" onClick={() => onSaveItem({ ...item, quantity: Number((item.quantity + 1).toFixed(2)) }, { kind: "adjustment", reason: "Ingreso manual de una unidad." })} type="button">+1</button><button className="text-button" disabled={item.quantity <= 0} onClick={() => onSaveItem({ ...item, quantity: Number(Math.max(0, item.quantity - 1).toFixed(2)) }, { kind: "adjustment", reason: "Egreso manual de una unidad." })} type="button">−1</button></div></article>)}</div><section className="inventory-movements"><h4>Últimos movimientos</h4>{movements.length ? <div>{movements.slice(0, 10).map((movement) => <article key={movement.id}><div><strong>{movement.itemName} · {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta} {movement.unit}</strong><p>{movement.reason}</p><small>{formatMeasurementDate(movement.occurredAt)} · saldo {movement.quantityAfter} {movement.unit}{movement.plantIds?.length ? ` · ${movement.plantIds.length} maceta${movement.plantIds.length === 1 ? "" : "s"}` : ""}</small></div>{movement.totalCost !== undefined ? <span>{movement.currency || ""} {movement.totalCost.toFixed(2)}</span> : null}</article>)}</div> : <p>Todavía no hay movimientos registrados.</p>}</section>{status ? <p role="status">{status}</p> : null}</Card>;
}

function BatchIrrigationPanel({ inventoryItems, onAddMeasurement, onSaveInventoryItem, onSaveRecipe, plants, products, recipes }: { inventoryItems: InventoryItem[]; onAddMeasurement: (measurement: PlantMeasurement) => void; onSaveInventoryItem: (item: InventoryItem, context?: InventoryMovementContext) => void; onSaveRecipe: (recipe: IrrigationRecipe) => void; plants: Plant[]; products: ProductCatalogItem[]; recipes: IrrigationRecipe[] }) {
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [measuredAt, setMeasuredAt] = useState(getLocalDateTimeValue());
  const [water, setWater] = useState(""); const [ph, setPh] = useState(""); const [ec, setEc] = useState(""); const [ppm, setPpm] = useState(""); const [observations, setObservations] = useState("");
  const [recipeName, setRecipeName] = useState(""); const [status, setStatus] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState(""); const [inventoryAmountPerPlant, setInventoryAmountPerPlant] = useState("");
  const selectedInventoryItem = inventoryItems.find((item) => item.id === inventoryItemId); const selectedProduct = products.find((item) => item.id === selectedInventoryItem?.catalogProductId); const previewPerPlant = parseOptionalNumber(inventoryAmountPerPlant); const previewTotal = previewPerPlant === undefined ? undefined : previewPerPlant * selectedPlantIds.length; const previewUnitCost = selectedProduct?.price !== undefined && selectedProduct.packageQuantity && selectedProduct.packageUnit?.trim().toLowerCase() === selectedInventoryItem?.unit.trim().toLowerCase() ? selectedProduct.price / selectedProduct.packageQuantity : undefined; const previewCost = previewTotal !== undefined && previewUnitCost !== undefined ? previewTotal * previewUnitCost : undefined;
  function togglePlant(id: string) { setSelectedPlantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function loadRecipe(id: string) { const recipe = recipes.find((item) => item.id === id); if (!recipe) return; setWater(recipe.waterAmountMl?.toString() ?? ""); setPh(recipe.irrigationPh?.toString() ?? ""); setEc(recipe.irrigationEcMsCm?.toString() ?? ""); setPpm(recipe.irrigationPpm?.toString() ?? ""); setObservations(recipe.observations ?? ""); setInventoryItemId(recipe.inventoryItemId ?? ""); setInventoryAmountPerPlant(recipe.inventoryAmountPerPlant?.toString() ?? ""); setStatus(`Receta “${recipe.name}” cargada; revisá los valores antes de registrar.`); }
  function saveRecipe() { if (!recipeName.trim()) { setStatus("Escribí un nombre para guardar la receta."); return; } if (![water, ph, ec, ppm, observations].some((value) => value.trim())) { setStatus("Cargá al menos un valor o una observación para la receta."); return; } onSaveRecipe({ id: `recipe-${Date.now()}`, inventoryAmountPerPlant: parseOptionalNumber(inventoryAmountPerPlant), inventoryItemId: inventoryItemId || undefined, irrigationEcMsCm: parseOptionalNumber(ec), irrigationPh: parseOptionalNumber(ph), irrigationPpm: parseOptionalNumber(ppm), name: recipeName.trim(), observations: observations.trim() || undefined, waterAmountMl: parseOptionalNumber(water) }); setRecipeName(""); setStatus("Receta propia guardada."); }
  function registerBatch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (selectedPlantIds.length === 0) { setStatus("Seleccioná al menos una maceta."); return; } if (![water, ph, ec, ppm, observations].some((value) => value.trim())) { setStatus("Cargá al menos un valor o una observación."); return; } const inventoryItem = inventoryItems.find((item) => item.id === inventoryItemId); const perPlant = parseOptionalNumber(inventoryAmountPerPlant); if (inventoryItem && (perPlant === undefined || perPlant <= 0)) { setStatus("Indicá una cantidad mayor que cero por maceta para confirmar el consumo."); return; } const totalUse = inventoryItem && perPlant !== undefined ? perPlant * selectedPlantIds.length : 0; if (totalUse > (inventoryItem?.quantity ?? 0)) { setStatus(`Stock insuficiente: se necesitan ${totalUse} ${inventoryItem?.unit ?? ""}.`); return; } const iso = new Date(measuredAt).toISOString(); selectedPlantIds.forEach((plantId, index) => onAddMeasurement({ id: `measurement-${plantId}-${Date.now()}-${index}`, irrigationEcMsCm: parseOptionalNumber(ec), irrigationPh: parseOptionalNumber(ph), irrigationPpm: parseOptionalNumber(ppm), measuredAt: iso, observations: observations.trim() ? `Registro por lote: ${observations.trim()}` : "Registro de riego por lote.", plantId, source: "manual", waterAmountMl: parseOptionalNumber(water) })); if (inventoryItem && totalUse > 0) onSaveInventoryItem({ ...inventoryItem, quantity: Number((inventoryItem.quantity - totalUse).toFixed(2)) }, { kind: "consumption", occurredAt: iso, plantIds: selectedPlantIds, reason: `Consumo confirmado en riego por lote para ${selectedPlantIds.length} maceta${selectedPlantIds.length === 1 ? "" : "s"}.` }); setStatus(`Riego guardado como ${selectedPlantIds.length} registros independientes${inventoryItem && totalUse > 0 ? `; se descontaron ${totalUse} ${inventoryItem.unit} de ${inventoryItem.name}${previewCost === undefined ? "" : ` (costo registrado ${selectedProduct?.currency ?? ""} ${previewCost.toFixed(2)})`}` : ""}.`); }
  return <Card as="section" className="batch-irrigation-panel mt-5 p-4 sm:p-5"><SectionHeader eyebrow="Acción múltiple" title="Registrar riego por lote" /><p>Elegí macetas y cargá únicamente los valores realmente aplicados o medidos. Se crea una medición separada para cada maceta.</p><form onSubmit={registerBatch}><fieldset><legend>Macetas</legend><div className="batch-plant-picker">{plants.map((plant) => <label key={plant.id}><input checked={selectedPlantIds.includes(plant.id)} onChange={() => togglePlant(plant.id)} type="checkbox" /> {plant.name} · {plant.pot}</label>)}</div></fieldset><div className="batch-irrigation-fields"><label>Fecha y hora<input className="form-control" onChange={(event) => setMeasuredAt(event.target.value)} type="datetime-local" value={measuredAt} /></label><label>Agua (ml)<input className="form-control" min="0" onChange={(event) => setWater(event.target.value)} type="number" value={water} /></label><label>pH medido<input className="form-control" max="14" min="0" onChange={(event) => setPh(event.target.value)} step="0.01" type="number" value={ph} /></label><label>EC (mS/cm)<input className="form-control" min="0" onChange={(event) => setEc(event.target.value)} step="0.01" type="number" value={ec} /></label><label>PPM medidos<input className="form-control" min="0" onChange={(event) => setPpm(event.target.value)} type="number" value={ppm} /></label><label>Observación<input className="form-control" onChange={(event) => setObservations(event.target.value)} value={observations} /></label></div><div className="batch-inventory-row"><label>Insumo a descontar<select className="form-control" onChange={(event) => setInventoryItemId(event.target.value)} value={inventoryItemId}><option value="">No descontar</option>{inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit}</option>)}</select></label><label>Cantidad por maceta<input className="form-control" disabled={!inventoryItemId} min="0" onChange={(event) => setInventoryAmountPerPlant(event.target.value)} step="0.01" type="number" value={inventoryAmountPerPlant} /></label><span>Total a descontar: {previewTotal === undefined ? "—" : `${Number(previewTotal.toFixed(2))} ${selectedInventoryItem?.unit ?? ""}`}<br />Costo del consumo: {previewCost === undefined ? "No calculable con los datos disponibles" : `${selectedProduct?.currency ?? ""} ${previewCost.toFixed(2)}`}</span></div><div className="batch-recipe-row"><label>Usar receta<select className="form-control" defaultValue="" onChange={(event) => loadRecipe(event.target.value)}><option value="">Seleccionar</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label><label>Guardar valores como receta<input className="form-control" onChange={(event) => setRecipeName(event.target.value)} placeholder="Nombre propio" value={recipeName} /></label><button className="secondary-button" onClick={saveRecipe} type="button">Guardar receta</button><button className="primary-button" type="submit">Registrar y confirmar consumo</button></div>{status ? <p role="status">{status}</p> : null}</form></Card>;
}

function PlantInspectionPanel({ inspections, onSaveInspection, plant }: { inspections: PlantInspection[]; onSaveInspection: (inspection: PlantInspection) => void; plant: Plant }) {
  const [isAdding, setIsAdding] = useState(false); const [category, setCategory] = useState<PlantInspection["category"]>("symptom"); const [area, setArea] = useState("Hojas"); const [severity, setSeverity] = useState<PlantInspection["severity"]>("low"); const [observation, setObservation] = useState(""); const [followUpDate, setFollowUpDate] = useState(""); const [photoDataUrl, setPhotoDataUrl] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!observation.trim()) return; onSaveInspection({ area, category, followUpDate: followUpDate || undefined, id: `inspection-${plant.id}-${Date.now()}`, inspectedAt: new Date().toISOString(), observation: observation.trim(), photoDataUrl: photoDataUrl || undefined, plantId: plant.id, severity, status: "open" }); setObservation(""); setFollowUpDate(""); setPhotoDataUrl(""); setIsAdding(false); }
  const sorted = [...inspections].sort((first, second) => second.inspectedAt.localeCompare(first.inspectedAt));
  return <section className="plant-inspection-panel"><header><div><p className="plant-calculation-eyebrow">Scouting documentado</p><h4>Inspecciones de esta maceta</h4><span>{sorted.filter((item) => item.status === "open").length} seguimiento{sorted.filter((item) => item.status === "open").length === 1 ? "" : "s"} abierto{sorted.filter((item) => item.status === "open").length === 1 ? "" : "s"}</span></div><button className="secondary-button" onClick={() => setIsAdding((current) => !current)} type="button">{isAdding ? "Cerrar" : "Nueva inspección"}</button></header>{isAdding ? <form className="inspection-form" onSubmit={submit}><label>Tipo observado<select className="form-control" onChange={(event) => setCategory(event.target.value as PlantInspection["category"])} value={category}><option value="symptom">Síntoma observado</option><option value="pest">Plaga observada</option><option value="structure">Estructura</option><option value="other">Otro</option></select></label><label>Zona<input className="form-control" onChange={(event) => setArea(event.target.value)} value={area} /></label><label>Severidad declarada<select className="form-control" onChange={(event) => setSeverity(event.target.value as PlantInspection["severity"])} value={severity}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label><label>Revisar nuevamente<input className="form-control" min={getTodayIso()} onChange={(event) => setFollowUpDate(event.target.value)} type="date" value={followUpDate} /></label><label className="inspection-wide">Observación<textarea className="form-control" onChange={(event) => setObservation(event.target.value)} required rows={2} value={observation} /></label><label className="inspection-wide">Foto opcional<input accept="image/*" className="form-control" onChange={async (event) => { const file = event.target.files?.[0]; setPhotoDataUrl(file ? await readPhotoFileAsDataUrl(file) : ""); }} type="file" /></label><p className="inspection-wide">Se registra lo observado por el usuario; PlantCare no genera un diagnóstico.</p><button className="primary-button" type="submit">Guardar inspección</button></form> : null}<div className="inspection-list">{sorted.slice(0, 6).map((inspection) => <article key={inspection.id}><div><strong>{inspection.category === "pest" ? "Plaga observada" : inspection.category === "symptom" ? "Síntoma observado" : inspection.category === "structure" ? "Estructura" : "Otra observación"} · {inspection.area} · severidad {inspection.severity === "low" ? "baja" : inspection.severity === "medium" ? "media" : "alta"}</strong><p>{inspection.observation}</p><small>{formatMeasurementDate(inspection.inspectedAt)}{inspection.followUpDate ? ` · revisión ${formatDisplayDate(inspection.followUpDate)}` : ""} · {inspection.status === "open" ? "abierta" : "resuelta"}</small></div>{inspection.photoDataUrl ? <span aria-label={`Inspección de ${plant.name}`} className="inspection-photo" role="img" style={{ backgroundImage: `url(${inspection.photoDataUrl})` }} /> : null}{inspection.status === "open" ? <button className="text-button" onClick={() => onSaveInspection({ ...inspection, status: "resolved" })} type="button">Marcar resuelta</button> : null}</article>)}</div></section>;
}

function PlantCycleControls({ onUpdatePlant, plant }: { onUpdatePlant: (plantId: string, updates: Partial<Plant>) => void; plant: Plant }) {
  const [isClosing, setIsClosing] = useState(false);
  const [completedAt, setCompletedAt] = useState(getTodayIso());
  const [closingNotes, setClosingNotes] = useState("");
  const [wetWeight, setWetWeight] = useState("");
  const [dryWeight, setDryWeight] = useState("");
  const [cycleOutcome, setCycleOutcome] = useState<NonNullable<Plant["cycleOutcome"]>>("completed");
  const [lessonsLearned, setLessonsLearned] = useState("");

  function closeCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completedAt) return;
    onUpdatePlant(plant.id, { closingNotes: closingNotes.trim() || undefined, completedAt, cycleOutcome, finalDryWeightG: parseOptionalNumber(dryWeight), finalWetWeightG: parseOptionalNumber(wetWeight), lessonsLearned: lessonsLearned.trim() || undefined, lifecycle: "archived" });
    setIsClosing(false);
  }

  return (
    <div className="plant-cycle-controls">
      <button className="text-button" onClick={() => setIsClosing((current) => !current)} type="button">
        {isClosing ? "Cancelar cierre" : "Cerrar y archivar ciclo"}
      </button>
      {isClosing ? (
        <form onSubmit={closeCycle}>
          <p>El historial no se borra. La fecha y la nota quedan declaradas por vos.</p>
          <label>Fecha de cierre<input className="form-control" max={getTodayIso()} onChange={(event) => setCompletedAt(event.target.value)} required type="date" value={completedAt} /></label>
          <label>Resultado declarado<select className="form-control" onChange={(event) => setCycleOutcome(event.target.value as NonNullable<Plant["cycleOutcome"]>)} value={cycleOutcome}><option value="completed">Completado</option><option value="partial">Resultado parcial</option><option value="stopped">Interrumpido</option></select></label>
          <label>Peso húmedo final (g, opcional)<input className="form-control" min="0" onChange={(event) => setWetWeight(event.target.value)} step="0.1" type="number" value={wetWeight} /></label>
          <label>Peso seco final (g, opcional)<input className="form-control" min="0" onChange={(event) => setDryWeight(event.target.value)} step="0.1" type="number" value={dryWeight} /></label>
          <label>Nota de cierre (opcional)<textarea className="form-control" onChange={(event) => setClosingNotes(event.target.value)} rows={2} value={closingNotes} /></label>
          <label>Aprendizajes para el próximo ciclo<textarea className="form-control" onChange={(event) => setLessonsLearned(event.target.value)} rows={2} value={lessonsLearned} /></label>
          <button className="secondary-button" type="submit">Confirmar cierre</button>
        </form>
      ) : null}
    </div>
  );
}

function ArchivedCyclesPanel({
  entries,
  measurements,
  onCreatePlant,
  onUpdatePlant,
  plants
}: {
  entries: CareEntry[];
  measurements: PlantMeasurement[];
  onCreatePlant: (plant: Plant) => void;
  onUpdatePlant: (plantId: string, updates: Partial<Plant>) => void;
  plants: Plant[];
}) {
  const [firstId, setFirstId] = useState(plants[0]?.id ?? "");
  const [secondId, setSecondId] = useState(plants[1]?.id ?? plants[0]?.id ?? "");
  if (plants.length === 0) return null;
  const first = plants.find((plant) => plant.id === firstId) ?? plants[0];
  const second = plants.find((plant) => plant.id === secondId) ?? plants[Math.min(1, plants.length - 1)];

  return (
    <Card as="section" className="archived-cycles-panel mt-5 p-4 sm:p-5">
      <SectionHeader eyebrow="Histórico por maceta" title="Ciclos cerrados" />
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">Los ciclos archivados conservan sus fechas y registros. Elegí dos para comparar datos existentes.</p>
      <div className="archived-cycle-selectors">
        <CycleSelector label="Primer ciclo" onChange={setFirstId} plants={plants} value={first.id} />
        <CycleSelector label="Segundo ciclo" onChange={setSecondId} plants={plants} value={second.id} />
      </div>
      <div className="archived-cycle-comparison">
        <ArchivedCycleCard entries={entries} measurements={measurements} onClone={onCreatePlant} onReopen={() => onUpdatePlant(first.id, { closingNotes: undefined, completedAt: undefined, cycleOutcome: undefined, finalDryWeightG: undefined, finalWetWeightG: undefined, lessonsLearned: undefined, lifecycle: "active" })} plant={first} />
        <ArchivedCycleCard entries={entries} measurements={measurements} onClone={onCreatePlant} onReopen={() => onUpdatePlant(second.id, { closingNotes: undefined, completedAt: undefined, cycleOutcome: undefined, finalDryWeightG: undefined, finalWetWeightG: undefined, lessonsLearned: undefined, lifecycle: "active" })} plant={second} />
      </div>
    </Card>
  );
}

function CycleSelector({ label, onChange, plants, value }: { label: string; onChange: (value: string) => void; plants: Plant[]; value: string }) {
  return <label>{label}<select className="form-control" onChange={(event) => onChange(event.target.value)} value={value}>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.startedAt} → {plant.completedAt}</option>)}</select></label>;
}

function ArchivedCycleCard({ entries, measurements, onClone, onReopen, plant }: { entries: CareEntry[]; measurements: PlantMeasurement[]; onClone: (plant: Plant) => void; onReopen: () => void; plant: Plant }) {
  const plantMeasurements = measurements.filter((measurement) => measurement.plantId === plant.id);
  const plantEntries = entries.filter((entry) => entry.plantId === plant.id);
  const irrigationCount = plantMeasurements.filter((measurement) => measurement.waterAmountMl !== undefined).length;
  const photoCount = plantMeasurements.filter((measurement) => measurement.photoDataUrl).length + plantEntries.filter((entry) => entry.photoDataUrl).length;
  const vpdValues = plantMeasurements.flatMap((measurement) => {
    const value = assessPlantEnvironment(plant, measurement).vpdKpa;
    return value === undefined ? [] : [value];
  });
  const averageVpd = vpdValues.length > 0 ? Number((vpdValues.reduce((total, value) => total + value, 0) / vpdValues.length).toFixed(2)) : undefined;

  return (
    <article>
      <header><div><strong>{plant.name}</strong><span>{plant.variety} · {plant.pot}</span></div><span className="pill pill-blue">Archivado</span></header>
      <dl>
        <PlantFact label="Inicio declarado" value={formatDisplayDate(plant.startedAt)} />
        <PlantFact label="Cierre declarado" value={plant.completedAt ? formatDisplayDate(plant.completedAt) : "Sin fecha"} />
        <PlantFact label="Duración registrada" value={plant.completedAt ? `${getDaysBetween(plant.startedAt, plant.completedAt)} días` : "Sin dato"} />
        <PlantFact label="Mediciones" value={plantMeasurements.length.toString()} />
        <PlantFact label="Riegos" value={irrigationCount.toString()} />
        <PlantFact label="Fotos" value={photoCount.toString()} />
        <PlantFact label="Notas" value={plantEntries.length.toString()} />
        <PlantFact label="VPD promedio calculado" value={averageVpd === undefined ? "Sin datos suficientes" : `${averageVpd} kPa (${vpdValues.length} lecturas)`} />
        <PlantFact label="Resultado declarado" value={plant.cycleOutcome === "completed" ? "Completado" : plant.cycleOutcome === "partial" ? "Parcial" : plant.cycleOutcome === "stopped" ? "Interrumpido" : "Sin declarar"} />
        <PlantFact label="Peso húmedo declarado" value={plant.finalWetWeightG === undefined ? "Sin dato" : `${plant.finalWetWeightG} g`} />
        <PlantFact label="Peso seco declarado" value={plant.finalDryWeightG === undefined ? "Sin dato" : `${plant.finalDryWeightG} g`} />
      </dl>
      {plant.closingNotes ? <p className="archived-cycle-notes">{plant.closingNotes}</p> : null}
      {plant.lessonsLearned ? <p className="archived-cycle-lessons"><strong>Aprendizajes:</strong> {plant.lessonsLearned}</p> : null}
      <div className="archived-cycle-actions"><button className="text-button" onClick={onReopen} type="button">Reabrir ciclo</button><CloneCycleForm onClone={onClone} plant={plant} /></div>
    </article>
  );
}

function CloneCycleForm({ onClone, plant }: { onClone: (plant: Plant) => void; plant: Plant }) {
  const [isOpen, setIsOpen] = useState(false); const [name, setName] = useState(`${plant.name} nuevo ciclo`); const [startDate, setStartDate] = useState(getTodayIso()); const [stage, setStage] = useState(plantStageOptions[0]); const [message, setMessage] = useState("");
  function clone(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const cloned: Plant = { bank: plant.bank, id: `plant-clone-${Date.now()}`, legalRecordStatus: plant.legalRecordStatus, lifecycle: "active", lighting: plant.lighting, mode: plant.mode, name: name.trim() || `${plant.name} nuevo ciclo`, photoperiodHours: plant.photoperiodHours, pot: plant.pot, setup: plant.setup, spaceId: plant.spaceId, stage, startedAt: startDate, substrate: plant.substrate, variety: plant.variety }; onClone(cloned); setMessage("Nueva maceta creada sin copiar historial ni resultados."); setIsOpen(false); }
  return <div className="clone-cycle-control"><button className="text-button" onClick={() => setIsOpen((current) => !current)} type="button">{isOpen ? "Cancelar clonación" : "Nuevo ciclo con esta configuración"}</button>{isOpen ? <form onSubmit={clone}><label>Nombre de la nueva maceta<input className="form-control" onChange={(event) => setName(event.target.value)} required value={name} /></label><label>Fecha de inicio<input className="form-control" onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} /></label><label>Etapa inicial declarada<select className="form-control" onChange={(event) => setStage(event.target.value)} value={stage}>{plantStageOptions.map((option) => <option key={option}>{option}</option>)}</select></label><p>Se copian variedad, espacio, maceta, sustrato, luz y setup. No se copian tareas, mediciones, fotos, inspecciones ni resultados.</p><button className="secondary-button" type="submit">Crear ciclo independiente</button></form> : null}{message ? <p role="status">{message}</p> : null}</div>;
}

function getDaysBetween(startIso: string, endIso: string) {
  const start = parseIsoDate(startIso).getTime();
  const end = parseIsoDate(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function WeeklyMetric({ label, value }: { label: string; value: number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function getWeeklyVpdSummary(values: number[]) {
  if (values.length === 0) return "sin lecturas suficientes de temperatura y humedad";
  if (values.length === 1) return `${values[0]} kPa calculado en una única lectura; todavía no hay tendencia`;
  const first = values[0];
  const latest = values.at(-1) ?? first;
  const difference = latest - first;
  const direction = Math.abs(difference) < 0.05 ? "estable" : difference > 0 ? "en aumento" : "en descenso";
  return `${direction}, de ${first} a ${latest} kPa entre la primera y la última lectura comparable`;
}

const plantStageOptions = ["Semilla", "Plantin", "Vegetativo", "Floracion temprana", "Floracion tardia", "Cosecha", "Secado", "Curado"];
const plantPotOptions = ["3 L", "5 L", "7 L", "10 L", "15 L", "20 L", "25 L"];
const plantSubstrateOptions = ["Organico liviano", "Organico aireado", "Compost y fibra", "Drenante", "Universal"];
const plantLightingOptions = ["Sol directo", "Sol de manana", "Media sombra", "Luz artificial", "Mixta"];
const otherGeneticValue = "__otra__";

/**
 * Un <select> no puede mostrar un valor que no esta entre sus opciones: lo
 * ignora y muestra el primero. Si la maceta trae un dato cargado desde otro
 * formulario con otra lista, guardar se lo cambiaria sin avisar. Con esto el
 * valor actual siempre esta disponible.
 */
function withCurrentValue(options: string[], value: string) {
  return options.includes(value) || !value ? options : [value, ...options];
}

/**
 * Edicion de una maceta puntual.
 *
 * El alta crea N macetas de una sola vez con la misma genetica, y hasta ahora
 * ese dato quedaba congelado. Con esto cada maceta puede declarar su propia
 * genetica, etapa y ambiente sin tocar a las demas del mismo espacio.
 */
function PlantEditorForm({
  onCancel,
  onSave,
  plant
}: {
  onCancel: () => void;
  onSave: (updates: Partial<Plant>) => void;
  plant: Plant;
}) {
  const matchingGenetic = geneticsCatalogAlphabetically.find(
    (genetic) => normalizeLookupText(genetic.name) === normalizeLookupText(plant.variety)
  );
  const [name, setName] = useState(plant.name);
  const [geneticId, setGeneticId] = useState(matchingGenetic?.id ?? otherGeneticValue);
  const [customVariety, setCustomVariety] = useState(matchingGenetic ? "" : plant.variety);
  const [stage, setStage] = useState(plant.stage);
  const [pot, setPot] = useState(plant.pot);
  const [substrate, setSubstrate] = useState(plant.substrate);
  const [lighting, setLighting] = useState(plant.lighting);
  const [mode, setMode] = useState<Plant["mode"]>(plant.mode);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === geneticId);
    const nextVariety = selectedGenetic ? selectedGenetic.name : customVariety.trim() || plant.variety;

    onSave({
      lighting,
      mode,
      name: name.trim() || plant.name,
      pot,
      stage,
      substrate,
      variety: nextVariety
    });
  }

  return (
    <form className="plant-editor" onSubmit={handleSubmit}>
      <p className="plant-editor-title">Editar {plant.name}</p>
      <p className="plant-editor-hint">Los cambios afectan solo a esta maceta, no al resto del espacio.</p>

      <div className="plant-editor-grid">
        <label className="grid gap-1 text-sm font-black text-moss-950">
          Nombre
          <input className="form-control" onChange={(event) => setName(event.target.value)} type="text" value={name} />
        </label>

        <label className="grid gap-1 text-sm font-black text-moss-950">
          Genetica
          <select className="form-control" onChange={(event) => setGeneticId(event.target.value)} value={geneticId}>
            {geneticsCatalogAlphabetically.map((genetic) => (
              <option key={genetic.id} value={genetic.id}>
                {genetic.name} - {formatGeneticType(genetic.type)}
              </option>
            ))}
            <option value={otherGeneticValue}>Otra / escribirla a mano</option>
          </select>
        </label>

        {geneticId === otherGeneticValue ? (
          <label className="grid gap-1 text-sm font-black text-moss-950">
            Nombre de la genetica
            <input
              className="form-control"
              onChange={(event) => setCustomVariety(event.target.value)}
              placeholder="Como figura en tu registro"
              type="text"
              value={customVariety}
            />
          </label>
        ) : null}

        <FormSelect label="Etapa" onChange={setStage} options={withCurrentValue(plantStageOptions, stage)} value={stage} />
        <FormSelect label="Maceta" onChange={setPot} options={withCurrentValue(plantPotOptions, pot)} value={pot} />
        <FormSelect
          label="Sustrato"
          onChange={setSubstrate}
          options={withCurrentValue(plantSubstrateOptions, substrate)}
          value={substrate}
        />
        <FormSelect
          label="Luz"
          onChange={setLighting}
          options={withCurrentValue(plantLightingOptions, lighting)}
          value={lighting}
        />
        <ModeSelect onChange={setMode} value={mode} />
      </div>

      <div className="plant-editor-actions">
        <button className="primary-button" type="submit">
          Guardar cambios
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Nota rapida de una maceta puntual.
 *
 * Antes habia que ir a Diario y elegir la planta de una lista; con cuatro
 * macetas llamadas casi igual era facil anotar en la equivocada. Aca la nota
 * ya queda asociada a la maceta que se esta mirando.
 */
function PlantQuickNote({
  onAddJournalEntry,
  plant
}: {
  onAddJournalEntry: (entry: CareEntry) => void;
  plant: Plant;
}) {
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNote = note.trim();

    if (!trimmedNote) return;

    onAddJournalEntry({
      createdAt: getTodayIso(),
      id: `entry-${plant.id}-${Date.now()}`,
      note: trimmedNote,
      plantId: plant.id,
      tags: ["Nota de maceta"],
      title: title.trim() || "Nota rapida"
    });

    setNote("");
    setTitle("");
    setSavedMessage("Nota guardada en esta maceta.");
    window.setTimeout(() => setSavedMessage(""), 4000);
  }

  return (
    <form className="plant-quick-note" onSubmit={handleSubmit}>
      <p className="plant-quick-note-title">Anotar algo de esta maceta</p>
      <p className="plant-quick-note-hint">
        Queda guardado solo en {plant.name} y aparece abajo, en su historial.
      </p>

      <input
        aria-label={`Titulo de la nota para ${plant.name}`}
        className="form-control"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titulo (opcional)"
        type="text"
        value={title}
      />
      <textarea
        aria-label={`Nota para ${plant.name}`}
        className="form-control"
        onChange={(event) => setNote(event.target.value)}
        placeholder="Ej: a esta le puse menos agua, tiene las hojas mas claras que las otras"
        rows={3}
        value={note}
      />
      <div className="plant-quick-note-actions">
        <button className="primary-button" disabled={!note.trim()} type="submit">
          Guardar nota
        </button>
        {savedMessage ? (
          <span className="plant-quick-note-saved" role="status">
            {savedMessage}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function PlantGeneticSummary({
  genetic,
  onOpenGenetic,
  plant
}: {
  genetic?: GeneticReferenceEntry;
  onOpenGenetic: (genetic: GeneticReferenceEntry) => void;
  plant: Plant;
}) {
  return (
    <div className="plant-genetic-summary mt-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="plant-genetic-eyebrow text-[11px] font-black uppercase">Genetica declarada</p>
          <p className="plant-genetic-name mt-1 font-black">{genetic?.name ?? plant.variety}</p>
          <p className="plant-genetic-source mt-1 text-sm font-bold leading-6">
            {genetic ? genetic.source : "No hay ficha publicada vinculada en el catalogo."}
          </p>
        </div>
        {genetic ? (
          <button className="secondary-button plant-genetic-button" onClick={() => onOpenGenetic(genetic)} type="button">
            Ver ficha completa
          </button>
        ) : null}
      </div>
      {genetic ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <PlantFact label="Tipo" value={formatGeneticType(genetic.type)} />
          <PlantFact label="Floracion" value={formatRange(genetic.flowering_weeks_range, "sem")} />
          <PlantFact label="THC" value={formatThcRange(genetic.thc_percent_range)} />
          <PlantFact label="Linaje" value={genetic.cross} />
        </dl>
      ) : (
        <p className="plant-genetic-empty mt-3 text-xs font-bold leading-5">
          Para ver datos aca, elegi una genetica del catalogo al cargar el cultivo o agregala al catalogo de referencia.
        </p>
      )}
    </div>
  );
}

function PlantCalculationSummary({ genetic, plant }: { genetic?: GeneticReferenceEntry; plant: Plant }) {
  const plan = calculateHorticulturePlan({
    catalogHarvestWindow: genetic ? formatRange(genetic.flowering_weeks_range, "semanas") : undefined,
    indoorSize: getPlantIndoorSize(plant),
    lightType: getPlantLightType(plant.lighting),
    potLiters: getPlantPotLiters(plant.pot),
    seedId: getSeedProfileIdForPlant(plant, genetic),
    userSeedType: genetic ? formatGeneticType(genetic.type) : undefined
  });
  const visibleDataPoints = plan.dataPoints.filter((point) => ["Maceta", "Luz", "Espacio", "Ventana"].includes(point.label));

  return (
    <section className="plant-calculation-panel mt-3" aria-label={`Estimaciones de ${plant.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="plant-calculation-eyebrow">Motor de datos</p>
          <h4 className="plant-calculation-title">Estimacion de esta maceta</h4>
          <p className="plant-calculation-copy">{plan.note}</p>
        </div>
        <span className={plan.automaticEnabled ? "mode-badge automatic" : "mode-badge manual"}>
          {plan.automaticEnabled ? "Datos suficientes" : "Faltan datos"}
        </span>
      </div>

      <dl className="plant-calculation-grid">
        <PlantFact label="Sustrato estimado" value={plan.substrateLiters} />
        <PlantFact label="Agua estimada" value={plan.waterAmount} />
        <PlantFact label="Revision" value={plan.waterCheck} />
        <PlantFact label="Ciclo" value={plan.harvestWindow} />
      </dl>

      {plan.missingInputs.length > 0 ? (
        <div className="plant-calculation-missing">
          <p>Para mejorar la estimacion falta:</p>
          <ul>
            {plan.missingInputs.map((inputName) => (
              <li key={inputName}>{inputName}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="plant-calculation-source-row" aria-label="Origen de los datos usados">
        {visibleDataPoints.map((point) => (
          <span className="plant-calculation-source" key={point.label}>
            {point.label}: {formatDataOrigin(point.source)}
          </span>
        ))}
      </div>
    </section>
  );
}

function PlantDataCalculations({ measurements, onUpdatePlant, plant }: { measurements: PlantMeasurement[]; onUpdatePlant: (plantId: string, updates: Partial<Plant>) => void; plant: Plant }) {
  const [photoperiodHours, setPhotoperiodHours] = useState(plant.photoperiodHours?.toString() ?? "");
  const [savedMessage, setSavedMessage] = useState("");
  const sorted = [...measurements].sort((first, second) => second.measuredAt.localeCompare(first.measuredAt));
  const latestPpfdMeasurement = sorted.find((measurement) => measurement.ppfdUmolM2S !== undefined);
  const latestIrrigation = sorted.find((measurement) => hasCalculationIrrigationData(measurement));
  const declaredHours = parseOptionalNumber(photoperiodHours);
  const dli = latestPpfdMeasurement?.ppfdUmolM2S !== undefined && declaredHours !== undefined ? Number(((latestPpfdMeasurement.ppfdUmolM2S * declaredHours * 3600) / 1_000_000).toFixed(2)) : undefined;
  const drainagePercent = latestIrrigation?.waterAmountMl !== undefined && latestIrrigation.waterAmountMl > 0 && latestIrrigation.runoffAmountMl !== undefined ? Number(((latestIrrigation.runoffAmountMl / latestIrrigation.waterAmountMl) * 100).toFixed(1)) : undefined;
  const phDifference = calculateDifference(latestIrrigation?.runoffPh, latestIrrigation?.irrigationPh);
  const ecDifference = calculateDifference(latestIrrigation?.runoffEcMsCm, latestIrrigation?.irrigationEcMsCm);
  const today = getTodayIso();
  const waterSevenDays = sumWaterSince(sorted, offsetDate(today, -6));
  const waterThirtyDays = sumWaterSince(sorted, offsetDate(today, -29));
  const recentMeasurements = sorted.filter((measurement) => measurement.measuredAt.slice(0, 10) >= offsetDate(today, -29));
  const temperatureRange = getRecordedRange(recentMeasurements.flatMap((measurement) => measurement.temperatureC === undefined ? [] : [measurement.temperatureC]));
  const humidityRange = getRecordedRange(recentMeasurements.flatMap((measurement) => measurement.ambientHumidityPercent === undefined ? [] : [measurement.ambientHumidityPercent]));

  function savePhotoperiod() {
    if (declaredHours !== undefined && (declaredHours <= 0 || declaredHours > 24)) { setSavedMessage("Las horas de luz deben ser mayores que 0 y no superar 24."); return; }
    onUpdatePlant(plant.id, { photoperiodHours: declaredHours });
    setSavedMessage(declaredHours === undefined ? "Fotoperiodo eliminado." : "Fotoperiodo declarado guardado.");
  }

  return (
    <section className="plant-data-calculations" aria-label={`Cálculos de ${plant.name}`}>
      <header><div><p className="plant-calculation-eyebrow">Fórmulas y datos</p><h4>Cálculos de esta maceta</h4></div><span className="pill pill-blue">Sin valores supuestos</span></header>
      <div className="calculation-photoperiod-input">
        <label>Horas de luz declaradas<input className="form-control" inputMode="decimal" max="24" min="0.01" onChange={(event) => { setPhotoperiodHours(event.target.value); setSavedMessage(""); }} step="0.25" type="number" value={photoperiodHours} /></label>
        <button className="secondary-button" onClick={savePhotoperiod} type="button">Guardar horas</button>
        {savedMessage ? <span role="status">{savedMessage}</span> : null}
      </div>
      <div className="calculation-result-grid">
        <CalculationResult formula="DLI = PPFD × horas × 3600 ÷ 1.000.000" label="DLI calculado" missing={[latestPpfdMeasurement ? "" : "PPFD medido", declaredHours === undefined ? "horas de luz declaradas" : ""].filter(Boolean)} source={latestPpfdMeasurement ? `PPFD del ${formatMeasurementDate(latestPpfdMeasurement.measuredAt)} + dato declarado` : ""} value={dli === undefined ? undefined : `${dli} mol/m²/día`} />
        <CalculationResult formula="Drenaje ÷ agua aplicada × 100" label="Porcentaje de drenaje" missing={getDrainageMissingInputs(latestIrrigation)} source={latestIrrigation ? `Registro del ${formatMeasurementDate(latestIrrigation.measuredAt)}` : ""} value={drainagePercent === undefined ? undefined : `${drainagePercent}%`} />
        <CalculationResult formula="pH drenaje − pH de entrada" label="Diferencia de pH" missing={getDifferenceMissingInputs(latestIrrigation?.irrigationPh, latestIrrigation?.runoffPh, "pH de entrada", "pH de drenaje")} source={latestIrrigation ? `Registro del ${formatMeasurementDate(latestIrrigation.measuredAt)}` : ""} value={phDifference === undefined ? undefined : formatSignedNumber(phDifference)} />
        <CalculationResult formula="EC drenaje − EC de entrada" label="Diferencia de EC" missing={getDifferenceMissingInputs(latestIrrigation?.irrigationEcMsCm, latestIrrigation?.runoffEcMsCm, "EC de entrada", "EC de drenaje")} source={latestIrrigation ? `Registro del ${formatMeasurementDate(latestIrrigation.measuredAt)}` : ""} value={ecDifference === undefined ? undefined : `${formatSignedNumber(ecDifference)} mS/cm`} />
      </div>
      <dl className="calculation-history-totals">
        <PlantFact label="Agua últimos 7 días" value={`${waterSevenDays.total} ml (${waterSevenDays.records} registros)`} />
        <PlantFact label="Agua últimos 30 días" value={`${waterThirtyDays.total} ml (${waterThirtyDays.records} registros)`} />
        <PlantFact label="Temperatura últimos 30 días" value={temperatureRange ? `${temperatureRange.minimum}–${temperatureRange.maximum} °C (${temperatureRange.count})` : "Sin mediciones"} />
        <PlantFact label="Humedad últimos 30 días" value={humidityRange ? `${humidityRange.minimum}–${humidityRange.maximum}% (${humidityRange.count})` : "Sin mediciones"} />
      </dl>
      <p className="calculation-disclaimer">Resultados calculados a partir de datos medidos o declarados. No son mediciones nuevas ni recomendaciones de dosis.</p>
    </section>
  );
}

function CalculationResult({ formula, label, missing, source, value }: { formula: string; label: string; missing: string[]; source: string; value?: string }) {
  return <article className={value ? "has-result" : "is-missing"}><span>{label}</span><strong>{value ?? "Faltan datos"}</strong><small>{formula}</small>{value ? <p>Fuente: {source}</p> : <p>Falta: {missing.join(", ") || "datos comparables del mismo registro"}.</p>}</article>;
}

type ExportPeriod = "7-days" | "30-days" | "cycle" | "all";
type ExportCell = { type?: "DateTime" | "Number" | "String"; value: number | string | undefined };

function PlantExportPanel({ alertSettings, calendarEvents, entries, measurements, plant, tasks }: { alertSettings?: PlantEnvironmentalAlertSettings; calendarEvents: CalendarEvent[]; entries: CareEntry[]; measurements: PlantMeasurement[]; plant: Plant; tasks: Task[] }) {
  const [period, setPeriod] = useState<ExportPeriod>("cycle");
  const [reportStatus, setReportStatus] = useState("");
  const bounds = getExportPeriodBounds(period, plant);
  const filteredMeasurements = measurements.filter((measurement) => isDateInExportBounds(measurement.measuredAt, bounds));
  const filteredEntries = entries.filter((entry) => entry.plantId === plant.id && isDateInExportBounds(entry.createdAt, bounds));
  const filteredEvents = calendarEvents.filter((event) => event.plantId === plant.id && isDateInExportBounds(event.startDate, bounds));
  const filteredTasks = tasks.filter((task) => task.plantId === plant.id && (period === "all" || (task.dueDate ? isDateInExportBounds(task.dueDate, bounds) : false)));

  function exportCsv() {
    const rows = buildMeasurementExportRows(filteredMeasurements, plant);
    downloadTextFile(`plantcare-${sanitizeFilename(plant.name)}-${period}.csv`, `\uFEFF${rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n")}`, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const workbook = buildExcelXmlWorkbook({ alertSettings, bounds, calendarEvents: filteredEvents, entries: filteredEntries, historyMeasurements: measurements, measurements: filteredMeasurements, period, plant, tasks: filteredTasks });
    downloadTextFile(`plantcare-${sanitizeFilename(plant.name)}-${period}.xml`, workbook, "application/vnd.ms-excel;charset=utf-8");
  }

  function printReport() {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setReportStatus("El navegador bloqueó la ventana. Habilitá ventanas emergentes e intentá nuevamente.");
      return;
    }
    reportWindow.opener = null;
    reportWindow.document.write(buildPrintablePlantReport({ alertSettings, bounds, calendarEvents: filteredEvents, entries: filteredEntries, historyMeasurements: measurements, measurements: filteredMeasurements, period, plant, tasks: filteredTasks }));
    reportWindow.document.close();
    setReportStatus("Se abrió el informe. Elegí ‘Guardar como PDF’ en el diálogo de impresión.");
  }

  return (
    <section className="plant-export-panel" aria-label={`Exportar datos de ${plant.name}`}>
      <header><div><p className="plant-calculation-eyebrow">Respaldo auditable</p><h4>Exportar esta maceta</h4></div><span className="pill pill-blue">{formatDisplayDate(bounds.start)} → {formatDisplayDate(bounds.end)}</span></header>
      <div>
        <label>Período<select className="form-control" onChange={(event) => setPeriod(event.target.value as ExportPeriod)} value={period}><option value="7-days">Últimos 7 días</option><option value="30-days">Últimos 30 días</option><option value="cycle">Ciclo registrado</option><option value="all">Todo el historial</option></select></label>
        <button className="secondary-button" disabled={filteredMeasurements.length === 0} onClick={exportCsv} type="button">CSV de mediciones</button>
        <button className="primary-button" onClick={exportExcel} type="button">Libro para Excel</button>
        <button className="secondary-button" onClick={printReport} type="button">Informe PDF</button>
      </div>
      <p>Excel incluye Resumen, Mediciones, Riegos, Comparaciones, Alertas, Bitácora, Calendario y Tareas. Informe PDF agrega comparaciones de 7/30 días, alertas actuales y hasta seis fotos recientes.</p>
      {reportStatus ? <p className="plant-export-status" role="status">{reportStatus}</p> : null}
    </section>
  );
}

function getExportPeriodBounds(period: ExportPeriod, plant: Plant) {
  const today = getTodayIso();
  if (period === "7-days") return { end: today, start: offsetDate(today, -6) };
  if (period === "30-days") return { end: today, start: offsetDate(today, -29) };
  if (period === "cycle") return { end: plant.completedAt ?? today, start: plant.startedAt || today };
  return { end: "9999-12-31", start: "1970-01-01" };
}

function isDateInExportBounds(value: string, bounds: { end: string; start: string }) { const date = value.slice(0, 10); return date >= bounds.start && date <= bounds.end; }

function buildMeasurementExportRows(measurements: PlantMeasurement[], plant: Plant): Array<Array<number | string | undefined>> {
  return [["Fecha/hora", "Origen", "Temperatura °C", "Temperatura foliar °C", "Humedad %", "VPD calculado kPa", "Base VPD", "Sustrato %", "PPFD µmol/m²/s", "Altura cm", "Observaciones", "Foto presente"], ...measurements.map((measurement) => {
    const assessment = assessPlantEnvironment(plant, measurement);
    return [measurement.measuredAt, formatMeasurementSource(measurement.source), measurement.temperatureC, measurement.leafTemperatureC, measurement.ambientHumidityPercent, assessment.vpdKpa, assessment.vpdBasis === "leaf" ? "foliar" : "aire", measurement.substrateMoisturePercent, measurement.ppfdUmolM2S, measurement.heightCm, measurement.observations, measurement.photoDataUrl ? "Sí" : "No"];
  })];
}

function buildExcelXmlWorkbook({ alertSettings, bounds, calendarEvents, entries, historyMeasurements, measurements, period, plant, tasks }: { alertSettings?: PlantEnvironmentalAlertSettings; bounds: { end: string; start: string }; calendarEvents: CalendarEvent[]; entries: CareEntry[]; historyMeasurements: PlantMeasurement[]; measurements: PlantMeasurement[]; period: ExportPeriod; plant: Plant; tasks: Task[] }) {
  const measurementRows = buildMeasurementExportRows(measurements, plant).map((row, rowIndex) => row.map((value, columnIndex) => ({ type: rowIndex === 0 ? "String" : columnIndex === 0 && value ? "DateTime" : typeof value === "number" ? "Number" : "String", value: rowIndex > 0 && columnIndex === 0 && value ? toExcelDateTime(String(value)) : value }) satisfies ExportCell));
  const irrigationRows: ExportCell[][] = [["Fecha/hora", "Agua ml", "pH entrada", "EC entrada mS/cm", "PPM entrada", "Drenaje ml", "Drenaje % calculado", "pH drenaje", "Diferencia pH calculada", "EC drenaje mS/cm", "Diferencia EC calculada"].map((value) => ({ value }))];
  measurements.filter(hasCalculationIrrigationData).forEach((measurement) => irrigationRows.push([
    { type: "DateTime", value: measurement.measuredAt }, { type: "Number", value: measurement.waterAmountMl }, { type: "Number", value: measurement.irrigationPh }, { type: "Number", value: measurement.irrigationEcMsCm }, { type: "Number", value: measurement.irrigationPpm }, { type: "Number", value: measurement.runoffAmountMl },
    { type: "Number", value: measurement.waterAmountMl && measurement.runoffAmountMl !== undefined ? Number(((measurement.runoffAmountMl / measurement.waterAmountMl) * 100).toFixed(1)) : undefined }, { type: "Number", value: measurement.runoffPh }, { type: "Number", value: calculateDifference(measurement.runoffPh, measurement.irrigationPh) }, { type: "Number", value: measurement.runoffEcMsCm }, { type: "Number", value: calculateDifference(measurement.runoffEcMsCm, measurement.irrigationEcMsCm) }
  ]));
  const comparisonRows = ([7, 30] as const).flatMap((days) => buildPeriodComparison(historyMeasurements, plant, days).comparisons.map((item) => [days, item.label, item.current.value, item.current.count, item.previous.value, item.previous.count, item.current.value !== undefined && item.previous.value !== undefined ? Number((item.current.value - item.previous.value).toFixed(2)) : undefined, item.unit.trim()]));
  const latestMeasurement = [...historyMeasurements].sort((first, second) => second.measuredAt.localeCompare(first.measuredAt))[0];
  const latestAssessment = assessPlantEnvironment(plant, latestMeasurement);
  const alertRows = getConfiguredEnvironmentalAlerts(alertSettings, latestMeasurement, latestAssessment.vpdKpa).map((alert) => [latestMeasurement?.measuredAt, alert.label, alert.value, alert.unit.trim(), alert.direction === "below" ? "Debajo del mínimo" : "Encima del máximo", alert.limit, "Calculado desde última medición y límite del usuario"]);
  const sheets = [
    { name: "Resumen", rows: [[{ value: "Campo" }, { value: "Valor" }, { value: "Origen" }], ...[["Maceta", plant.name, "usuario"], ["Variedad", plant.variety, "usuario"], ["Etapa", plant.stage, "usuario"], ["Inicio", plant.startedAt, "usuario"], ["Cierre", plant.completedAt, plant.completedAt ? "usuario" : "faltante"], ["Período exportado", `${bounds.start} a ${bounds.end}`, "selección de usuario"], ["Fotoperiodo horas", plant.photoperiodHours, plant.photoperiodHours === undefined ? "faltante" : "usuario"], ["Registros de medición", measurements.length, "calculado"]].map((row) => row.map((value) => ({ type: typeof value === "number" ? "Number" : "String", value }) satisfies ExportCell))] },
    { name: "Mediciones", rows: measurementRows },
    { name: "Riegos", rows: irrigationRows },
    { name: "Comparaciones", rows: exportRows(["Ventana días", "Métrica", "Período actual", "Muestras actuales", "Período anterior", "Muestras anteriores", "Diferencia calculada", "Unidad"], comparisonRows) },
    { name: "Alertas", rows: exportRows(["Fecha/hora", "Métrica", "Valor", "Unidad", "Dirección", "Límite del usuario", "Origen"], alertRows, [0]) },
    { name: "Bitacora", rows: exportRows(["Fecha/hora", "Título", "Nota", "Etiquetas", "Foto presente"], entries.map((entry) => [entry.createdAt, entry.title, entry.note, entry.tags.join("; "), entry.photoDataUrl ? "Sí" : "No"]), [0]) },
    { name: "Calendario", rows: exportRows(["Fecha inicial", "Título", "Descripción", "Tipo", "Recurrencia", "Fechas completadas"], calendarEvents.map((event) => [event.startDate, event.title, event.description, event.kind, event.recurrence?.active ? `Cada ${event.recurrence.everyDays} días` : "No", event.completedDates.join("; ")]), [0]) },
    { name: "Tareas", rows: exportRows(["Fecha", "Título", "Descripción", "Estado", "Frecuencia", "Categoría"], tasks.map((task) => [task.dueDate, task.title, task.description, task.status, task.frequency, task.category]), [0]) }
  ];
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>${escapeXml(`PlantCare ${plant.name}`)}</Title><Description>${escapeXml(`Exportación ${period}; valores medidos, declarados y calculados diferenciados`)}</Description></DocumentProperties><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DDEFE6" ss:Pattern="Solid"/></Style></Styles>${sheets.map(toExcelWorksheet).join("")}</Workbook>`;
}

function exportRows(headers: string[], rows: Array<Array<number | string | undefined>>, dateColumns: number[] = []): ExportCell[][] { return [headers.map((value) => ({ type: "String", value }) satisfies ExportCell), ...rows.map((row) => row.map((value, columnIndex) => ({ type: dateColumns.includes(columnIndex) && value ? "DateTime" : typeof value === "number" ? "Number" : "String", value: dateColumns.includes(columnIndex) && value ? toExcelDateTime(String(value)) : value }) satisfies ExportCell))]; }
function toExcelDateTime(value: string) { return value.includes("T") ? value : `${value}T00:00:00.000`; }
function toExcelWorksheet(sheet: { name: string; rows: ExportCell[][] }) { return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${sheet.rows.map((row, rowIndex) => `<Row>${row.map((cell) => `<Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ""}><Data ss:Type="${cell.type ?? "String"}">${escapeXml(cell.value ?? "")}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`; }
function escapeXml(value: number | string) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function toCsvCell(value: number | string | undefined) { if (value === undefined) return ""; const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function sanitizeFilename(value: string) { return normalizeLookupText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "maceta"; }
function downloadTextFile(filename: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }

function buildPrintablePlantReport({ alertSettings, bounds, calendarEvents, entries, historyMeasurements, measurements, period, plant, tasks }: { alertSettings?: PlantEnvironmentalAlertSettings; bounds: { end: string; start: string }; calendarEvents: CalendarEvent[]; entries: CareEntry[]; historyMeasurements: PlantMeasurement[]; measurements: PlantMeasurement[]; period: ExportPeriod; plant: Plant; tasks: Task[] }) {
  const sortedMeasurements = [...measurements].sort((first, second) => second.measuredAt.localeCompare(first.measuredAt));
  const latestMeasurement = sortedMeasurements[0];
  const latestAssessment = latestMeasurement ? assessPlantEnvironment(plant, latestMeasurement) : undefined;
  const water = sumWaterSince(sortedMeasurements, bounds.start);
  const irrigationRecords = sortedMeasurements.filter(hasCalculationIrrigationData);
  const photos = [
    ...sortedMeasurements.filter((measurement) => measurement.photoDataUrl).map((measurement) => ({ date: measurement.measuredAt, source: "Medición", url: measurement.photoDataUrl! })),
    ...entries.filter((entry) => entry.photoDataUrl).map((entry) => ({ date: entry.createdAt, source: entry.title || "Bitácora", url: entry.photoDataUrl! }))
  ].sort((first, second) => second.date.localeCompare(first.date)).slice(0, 6);
  const table = (headers: string[], rows: Array<Array<number | string | undefined>>) => rows.length === 0
    ? '<p class="empty">Sin registros en el período seleccionado.</p>'
    : `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const measurementTable = table(["Fecha", "Origen", "Temp.", "HR", "VPD calculado", "PPFD", "Sustrato", "Observaciones"], sortedMeasurements.map((measurement) => {
    const assessment = assessPlantEnvironment(plant, measurement);
    return [formatMeasurementDate(measurement.measuredAt), formatMeasurementSource(measurement.source), measurement.temperatureC === undefined ? undefined : `${measurement.temperatureC} °C`, measurement.ambientHumidityPercent === undefined ? undefined : `${measurement.ambientHumidityPercent}%`, assessment.vpdKpa === undefined ? undefined : `${assessment.vpdKpa} kPa (${assessment.vpdBasis === "leaf" ? "foliar" : "aire"})`, measurement.ppfdUmolM2S, measurement.substrateMoisturePercent === undefined ? undefined : `${measurement.substrateMoisturePercent}%`, measurement.observations];
  }));
  const irrigationTable = table(["Fecha", "Agua", "pH entrada", "EC entrada", "Drenaje", "Drenaje calculado"], irrigationRecords.map((measurement) => [formatMeasurementDate(measurement.measuredAt), measurement.waterAmountMl === undefined ? undefined : `${measurement.waterAmountMl} ml`, measurement.irrigationPh, measurement.irrigationEcMsCm === undefined ? undefined : `${measurement.irrigationEcMsCm} mS/cm`, measurement.runoffAmountMl === undefined ? undefined : `${measurement.runoffAmountMl} ml`, measurement.waterAmountMl && measurement.runoffAmountMl !== undefined ? `${Number(((measurement.runoffAmountMl / measurement.waterAmountMl) * 100).toFixed(1))}%` : undefined]));
  const comparisonTable = table(["Ventana", "Métrica", "Actual", "Anterior", "Cambio"], ([7, 30] as const).flatMap((days) => buildPeriodComparison(historyMeasurements, plant, days).comparisons.map((item) => [ `${days} días`, item.label, item.current.value === undefined ? undefined : `${item.current.value}${item.unit} (${item.current.count})`, item.previous.value === undefined ? undefined : `${item.previous.value}${item.unit} (${item.previous.count})`, item.current.value !== undefined && item.previous.value !== undefined ? `${formatSignedNumber(Number((item.current.value - item.previous.value).toFixed(2)))}${item.unit}` : undefined ])));
  const reportAlerts = getConfiguredEnvironmentalAlerts(alertSettings, latestMeasurement, latestAssessment?.vpdKpa);
  const alertsTable = table(["Fecha", "Métrica", "Valor", "Límite configurado"], reportAlerts.map((alert) => [latestMeasurement ? formatMeasurementDate(latestMeasurement.measuredAt) : undefined, alert.label, `${alert.value}${alert.unit}`, `${alert.direction === "below" ? "Mínimo" : "Máximo"}: ${alert.limit}${alert.unit}`]));
  const photoSection = photos.length === 0 ? '<p class="empty">Sin fotos en el período seleccionado.</p>' : `<div class="photos">${photos.map((photo) => `<figure><img alt="Foto de ${escapeHtml(plant.name)}" src="${escapeHtml(photo.url)}"><figcaption>${escapeHtml(photo.source)} · ${escapeHtml(formatMeasurementDate(photo.date))}</figcaption></figure>`).join("")}</div>`;
  const printablePeriod = period === "all" ? "Todo el historial" : `${formatDisplayDate(bounds.start)} → ${formatDisplayDate(bounds.end)}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PlantCare · ${escapeHtml(plant.name)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#1f3028;font:12px/1.45 Arial,sans-serif}header{border-bottom:3px solid #496b57;padding-bottom:12px}h1{margin:0;font-size:25px}h2{margin:22px 0 8px;color:#274b38;font-size:17px}p{margin:4px 0}.meta,.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.card{border:1px solid #ccd8d0;border-radius:8px;padding:8px}.card span{display:block;color:#64746b;font-size:10px;text-transform:uppercase}.card strong{display:block;margin-top:3px;font-size:13px}.note{margin-top:12px;padding:9px;border-left:4px solid #8baa94;background:#eff5f1}.empty{color:#6b756f;font-style:italic}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #d7dfda;padding:5px;text-align:left;vertical-align:top}th{background:#e9f1ec}.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.photos figure{margin:0;break-inside:avoid}.photos img{display:block;width:100%;max-height:260px;object-fit:contain;background:#edf1ee}.photos figcaption{padding:4px;color:#59675f;font-size:9px}.section{break-inside:avoid}.footer{margin-top:20px;border-top:1px solid #ccd8d0;padding-top:8px;color:#64746b;font-size:9px}@media(max-width:650px){.meta,.metrics{grid-template-columns:repeat(2,1fr)}}@media print{button{display:none}.section{break-inside:auto}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}
  </style></head><body><header><h1>${escapeHtml(plant.name)}</h1><p>${escapeHtml(plant.variety || "Variedad no declarada")} · Informe individual de maceta</p><div class="meta"><div class="card"><span>Período</span><strong>${escapeHtml(printablePeriod)}</strong></div><div class="card"><span>Etapa declarada</span><strong>${escapeHtml(plant.stage || "Sin declarar")}</strong></div><div class="card"><span>Inicio declarado</span><strong>${escapeHtml(plant.startedAt || "Sin dato")}</strong></div><div class="card"><span>Estado</span><strong>${plant.completedAt ? `Cerrado ${escapeHtml(plant.completedAt)}` : "Activo"}</strong></div></div></header>
  <section><h2>Resumen del período</h2><div class="metrics"><div class="card"><span>Mediciones</span><strong>${sortedMeasurements.length}</strong></div><div class="card"><span>Riegos registrados</span><strong>${irrigationRecords.length}</strong></div><div class="card"><span>Agua registrada</span><strong>${water.total} ml</strong></div><div class="card"><span>Bitácora / tareas / eventos</span><strong>${entries.length} / ${tasks.length} / ${calendarEvents.length}</strong></div><div class="card"><span>Último VPD calculable</span><strong>${latestAssessment?.vpdKpa === undefined ? "Faltan temperatura y humedad" : `${latestAssessment.vpdKpa} kPa (${latestAssessment.vpdBasis === "leaf" ? "foliar" : "aire"})`}</strong></div><div class="card"><span>Fotoperíodo declarado</span><strong>${plant.photoperiodHours === undefined ? "Sin dato" : `${plant.photoperiodHours} h`}</strong></div></div><p class="note">El VPD es calculado con la fórmula de Tetens. Si falta temperatura foliar se informa VPD del aire y no se inventa una diferencia con la hoja. Este informe resume datos declarados, medidos y calculados; no prescribe dosis ni cambios de equipos.</p></section>
  <section><h2>Alertas según límites actuales</h2>${alertsTable}</section><section><h2>Comparaciones de 7 y 30 días</h2>${comparisonTable}</section><section><h2>Mediciones ambientales</h2>${measurementTable}</section><section><h2>Riegos</h2>${irrigationTable}</section><section><h2>Bitácora</h2>${table(["Fecha", "Título", "Nota", "Etiquetas"], entries.map((entry) => [formatMeasurementDate(entry.createdAt), entry.title, entry.note, entry.tags.join(", ")]))}</section><section><h2>Calendario y tareas</h2>${table(["Fecha", "Tipo", "Título", "Estado / descripción"], [...calendarEvents.map((event) => [event.startDate, "Calendario", event.title, event.description]), ...tasks.map((task) => [task.dueDate, "Tarea", task.title, task.status])])}</section><section><h2>Fotos recientes (${photos.length} de hasta 6)</h2>${photoSection}</section><p class="footer">Generado por PlantCare Calendar el ${escapeHtml(new Date().toLocaleString("es"))}. Informe exclusivo de ${escapeHtml(plant.name)}. Usá Imprimir → Guardar como PDF.</p><script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script></body></html>`;
}

function escapeHtml(value: number | string) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

function hasCalculationIrrigationData(measurement: PlantMeasurement) {
  return [measurement.waterAmountMl, measurement.runoffAmountMl, measurement.irrigationPh, measurement.runoffPh, measurement.irrigationEcMsCm, measurement.runoffEcMsCm].some((value) => value !== undefined);
}

function calculateDifference(output: number | undefined, input: number | undefined) { return output === undefined || input === undefined ? undefined : Number((output - input).toFixed(2)); }
function getDrainageMissingInputs(measurement?: PlantMeasurement) { if (!measurement) return ["agua aplicada", "drenaje medido en el mismo registro"]; return [measurement.waterAmountMl === undefined ? "agua aplicada" : "", measurement.runoffAmountMl === undefined ? "drenaje medido" : ""].filter(Boolean); }
function getDifferenceMissingInputs(input: number | undefined, output: number | undefined, inputLabel: string, outputLabel: string) { return [input === undefined ? inputLabel : "", output === undefined ? outputLabel : ""].filter(Boolean); }
function formatSignedNumber(value: number) { return `${value > 0 ? "+" : ""}${value}`; }
function sumWaterSince(measurements: PlantMeasurement[], startDate: string) { const values = measurements.filter((measurement) => measurement.measuredAt.slice(0, 10) >= startDate && measurement.waterAmountMl !== undefined); return { records: values.length, total: Number(values.reduce((total, measurement) => total + (measurement.waterAmountMl ?? 0), 0).toFixed(1)) }; }
function getRecordedRange(values: number[]) { return values.length === 0 ? undefined : { count: values.length, maximum: Math.max(...values), minimum: Math.min(...values) }; }

function PlantEnvironmentPanel({
  alertSettings,
  measurements,
  onAddMeasurement,
  onDeleteMeasurement,
  onUpdateAlertSettings,
  plant
}: {
  alertSettings?: PlantEnvironmentalAlertSettings;
  measurements: PlantMeasurement[];
  onAddMeasurement: (measurement: PlantMeasurement) => void;
  onDeleteMeasurement: (measurementId: string) => void;
  onUpdateAlertSettings: (settings: PlantEnvironmentalAlertSettings) => void;
  plant: Plant;
}) {
  const sortedMeasurements = [...measurements].sort((first, second) => second.measuredAt.localeCompare(first.measuredAt));
  const latestMeasurement = sortedMeasurements[0];
  const assessment = assessPlantEnvironment(plant, latestMeasurement);
  const vpdTrend = getVpdTrend(plant, sortedMeasurements);
  const [isAdding, setIsAdding] = useState(false);

  return (
    <section className="plant-environment-panel mt-3" aria-label={`Ambiente y sensores de ${plant.name}`}>
      <div className="plant-environment-header">
        <div>
          <p className="plant-calculation-eyebrow">Ambiente y sensores</p>
          <h4>VPD y luz de esta maceta</h4>
          <p>
            Usa la etapa declarada ({assessment.target.label}) y la ultima medicion. Los rangos son orientativos y cada resultado muestra su origen.
          </p>
        </div>
        <button className="secondary-button" onClick={() => setIsAdding((current) => !current)} type="button">
          {isAdding ? "Cerrar" : "Registrar medicion"}
        </button>
      </div>

      <div className="plant-environment-metrics">
        <EnvironmentMetric
          label="Temperatura"
          value={latestMeasurement?.temperatureC === undefined ? "Sin dato" : `${latestMeasurement.temperatureC} C`}
        />
        <EnvironmentMetric
          label="Humedad"
          value={latestMeasurement?.ambientHumidityPercent === undefined ? "Sin dato" : `${latestMeasurement.ambientHumidityPercent}%`}
        />
        <EnvironmentMetric
          label={assessment.vpdBasis === "leaf" ? "VPD foliar estimado" : "VPD de aire estimado"}
          status={assessment.vpdStatus}
          value={assessment.vpdKpa === undefined ? "Faltan datos" : `${assessment.vpdKpa} kPa`}
          target={assessment.target.vpdMin === undefined ? "Sin referencia para esta etapa" : `${assessment.target.vpdMin}-${assessment.target.vpdMax} kPa`}
        />
        <EnvironmentMetric
          label="PPFD"
          status={assessment.ppfdStatus}
          value={latestMeasurement?.ppfdUmolM2S === undefined ? "Sin dato" : `${latestMeasurement.ppfdUmolM2S} umol/m2/s`}
          target={
            assessment.target.ppfdMin === undefined
              ? "Sin referencia para esta etapa"
              : `${assessment.target.ppfdMin}-${assessment.target.ppfdMax} umol/m2/s`
          }
        />
      </div>

      <p className="plant-environment-basis">
        {assessment.vpdBasis === "leaf"
          ? "Se uso la temperatura foliar medida."
          : "Sin temperatura foliar: se muestra VPD del aire y no se supone una diferencia fija con la hoja."}
      </p>
      <p className="plant-environment-basis">
        Fórmula: presión de vapor saturado (Tetens) menos presión real de vapor. Resultado calculado, no medido. Tendencia: {vpdTrend}.
      </p>

      {assessment.messages.length > 0 ? (
        <div className="plant-environment-alerts">
          {assessment.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : (
        <p className="plant-environment-missing">
          Para evaluar el ambiente falta: {assessment.missingInputs.join(", ") || "una medicion reciente"}.
        </p>
      )}

      <PlantEnvironmentalAlerts
        measurement={latestMeasurement}
        onUpdate={onUpdateAlertSettings}
        plant={plant}
        settings={alertSettings}
      />

      {sortedMeasurements.length >= 2 ? <EnvironmentalHistoryChart measurements={sortedMeasurements} plant={plant} /> : null}

      {isAdding ? <PlantMeasurementForm onAddMeasurement={onAddMeasurement} onDone={() => setIsAdding(false)} plant={plant} /> : null}

      {sortedMeasurements.length > 0 ? (
        <details className="plant-measurement-history">
          <summary>Historial de mediciones ({sortedMeasurements.length})</summary>
          <MeasurementPhotoGallery measurements={sortedMeasurements} plant={plant} />
          <div className="plant-measurement-list">
            {sortedMeasurements.slice(0, 8).map((measurement) => (
              <MeasurementHistoryCard
                key={measurement.id}
                measurement={measurement}
                onDeleteMeasurement={onDeleteMeasurement}
                onSaveMeasurement={onAddMeasurement}
                plant={plant}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function MeasurementHistoryCard({
  measurement,
  onDeleteMeasurement,
  onSaveMeasurement,
  plant
}: {
  measurement: PlantMeasurement;
  onDeleteMeasurement: (measurementId: string) => void;
  onSaveMeasurement: (measurement: PlantMeasurement) => void;
  plant: Plant;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const assessment = assessPlantEnvironment(plant, measurement);
  const facts = [
    ["Temperatura", formatOptionalMeasurement(measurement.temperatureC, "°C")],
    ["Humedad", formatOptionalMeasurement(measurement.ambientHumidityPercent, "%")],
    [assessment.vpdBasis === "leaf" ? "VPD foliar" : "VPD del aire", formatOptionalMeasurement(assessment.vpdKpa, " kPa", "Calculado")],
    ["Temperatura foliar", formatOptionalMeasurement(measurement.leafTemperatureC, "°C")],
    ["Sustrato", formatOptionalMeasurement(measurement.substrateMoisturePercent, "%")],
    ["PPFD", formatOptionalMeasurement(measurement.ppfdUmolM2S, " µmol/m²/s")],
    ["Altura", formatOptionalMeasurement(measurement.heightCm, " cm")]
  ];

  return (
    <article className="measurement-history-card">
      <header>
        <div>
          <strong>{formatMeasurementDate(measurement.measuredAt)}</strong>
          <span>{formatMeasurementSource(measurement.source)} · {plant.name}</span>
        </div>
        {measurement.source === "sensor" ? (
          <span className="plant-measurement-readonly">Lectura del sensor</span>
        ) : (
          <div className="measurement-history-actions"><button className="text-button" onClick={() => setIsEditing((current) => !current)} type="button">{isEditing ? "Cerrar edición" : "Editar"}</button><button aria-label={`Eliminar medicion del ${formatMeasurementDate(measurement.measuredAt)}`} className="text-button danger" onClick={() => onDeleteMeasurement(measurement.id)} type="button">Eliminar</button></div>
        )}
      </header>
      {isEditing ? <PlantMeasurementForm initialMeasurement={measurement} onAddMeasurement={onSaveMeasurement} onDone={() => setIsEditing(false)} plant={plant} /> : null}
      <dl className="measurement-history-facts">
        {facts.map(([label, value]) => (
          <div className={value === "Sin dato" ? "is-missing" : ""} key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <MeasurementIrrigationSummary measurement={measurement} />
      {measurement.observations ? <p className="measurement-history-observations">{measurement.observations}</p> : null}
      {measurement.photoDataUrl ? (
        // La imagen es un data URL local elegido por el usuario; next/image no la optimiza.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`Registro de ${plant.name} del ${formatMeasurementDate(measurement.measuredAt)}`} className="measurement-history-photo" src={measurement.photoDataUrl} />
      ) : null}
      <small className="measurement-history-origin">
        Los campos cargados son datos del usuario; el VPD es un cálculo derivado de temperatura y humedad.
      </small>
    </article>
  );
}

function PlantEnvironmentalAlerts({
  measurement,
  onUpdate,
  plant,
  settings
}: {
  measurement?: PlantMeasurement;
  onUpdate: (settings: PlantEnvironmentalAlertSettings) => void;
  plant: Plant;
  settings?: PlantEnvironmentalAlertSettings;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [draft, setDraft] = useState(() => alertSettingsToDraft(settings));

  const assessment = assessPlantEnvironment(plant, measurement);
  const alerts = buildConfiguredEnvironmentalAlerts(settings, measurement, assessment.vpdKpa);
  const configuredCount = settings ? Object.entries(settings).filter(([key, value]) => key !== "plantId" && value !== undefined).length : 0;

  function toggleEditing() {
    if (!isEditing) setDraft(alertSettingsToDraft(settings));
    setIsEditing(!isEditing);
    setSavedMessage("");
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validateAlertSettingsDraft(draft);
    if (validationMessage) {
      setSavedMessage(validationMessage);
      return;
    }
    onUpdate({
      humidityMaxPercent: parseOptionalNumber(draft.humidityMaxPercent),
      humidityMinPercent: parseOptionalNumber(draft.humidityMinPercent),
      plantId: plant.id,
      substrateMoistureMaxPercent: parseOptionalNumber(draft.substrateMoistureMaxPercent),
      substrateMoistureMinPercent: parseOptionalNumber(draft.substrateMoistureMinPercent),
      temperatureMaxC: parseOptionalNumber(draft.temperatureMaxC),
      temperatureMinC: parseOptionalNumber(draft.temperatureMinC),
      vpdMaxKpa: parseOptionalNumber(draft.vpdMaxKpa),
      vpdMinKpa: parseOptionalNumber(draft.vpdMinKpa)
    });
    setSavedMessage("Umbrales guardados para esta maceta.");
    setIsEditing(false);
  }

  return (
    <section className="configured-alerts-panel" aria-label={`Alertas configuradas de ${plant.name}`}>
      <header>
        <div>
          <strong>Mis alertas ambientales</strong>
          <span>{configuredCount > 0 ? `${configuredCount} límite${configuredCount === 1 ? "" : "s"} configurado${configuredCount === 1 ? "" : "s"}` : "Sin límites personalizados"}</span>
        </div>
        <button className="text-button" onClick={toggleEditing} type="button">
          {isEditing ? "Cerrar" : "Configurar"}
        </button>
      </header>

      {alerts.length > 0 ? (
        <div className="configured-alert-list" role="alert">
          {alerts.map((alert) => <p key={alert}>{alert}</p>)}
        </div>
      ) : configuredCount > 0 ? (
        <p className="configured-alert-ok">La última lectura no supera tus límites configurados.</p>
      ) : (
        <p className="configured-alert-empty">Definí tus propios límites si querés recibir avisos. PlantCare no agrega umbrales personalizados por defecto.</p>
      )}

      {savedMessage ? <p className="configured-alert-saved" role="status">{savedMessage}</p> : null}
      {isEditing ? (
        <form className="configured-alert-form" onSubmit={saveSettings}>
          <AlertRangeFields draft={draft} label="Temperatura (°C)" maxKey="temperatureMaxC" minKey="temperatureMinC" setDraft={setDraft} />
          <AlertRangeFields draft={draft} label="Humedad ambiental (%)" max="100" maxKey="humidityMaxPercent" min="0" minKey="humidityMinPercent" setDraft={setDraft} />
          <AlertRangeFields draft={draft} label="VPD calculado (kPa)" maxKey="vpdMaxKpa" min="0" minKey="vpdMinKpa" setDraft={setDraft} />
          <AlertRangeFields draft={draft} label="Humedad de sustrato (%)" max="100" maxKey="substrateMoistureMaxPercent" min="0" minKey="substrateMoistureMinPercent" setDraft={setDraft} />
          <p>Los avisos comparan únicamente la última medición guardada con estos límites.</p>
          <button className="secondary-button" type="submit">Guardar alertas</button>
        </form>
      ) : null}
    </section>
  );
}

type AlertSettingsDraft = Record<Exclude<keyof PlantEnvironmentalAlertSettings, "plantId">, string>;

function AlertRangeFields({
  draft,
  label,
  max,
  maxKey,
  min,
  minKey,
  setDraft
}: {
  draft: AlertSettingsDraft;
  label: string;
  max?: string;
  maxKey: keyof AlertSettingsDraft;
  min?: string;
  minKey: keyof AlertSettingsDraft;
  setDraft: Dispatch<SetStateAction<AlertSettingsDraft>>;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <label>Mínimo<input className="form-control" inputMode="decimal" max={max} min={min} onChange={(event) => setDraft((current) => ({ ...current, [minKey]: event.target.value }))} step="0.01" type="number" value={draft[minKey]} /></label>
      <label>Máximo<input className="form-control" inputMode="decimal" max={max} min={min} onChange={(event) => setDraft((current) => ({ ...current, [maxKey]: event.target.value }))} step="0.01" type="number" value={draft[maxKey]} /></label>
    </fieldset>
  );
}

function alertSettingsToDraft(settings?: PlantEnvironmentalAlertSettings): AlertSettingsDraft {
  return {
    humidityMaxPercent: settings?.humidityMaxPercent?.toString() ?? "",
    humidityMinPercent: settings?.humidityMinPercent?.toString() ?? "",
    substrateMoistureMaxPercent: settings?.substrateMoistureMaxPercent?.toString() ?? "",
    substrateMoistureMinPercent: settings?.substrateMoistureMinPercent?.toString() ?? "",
    temperatureMaxC: settings?.temperatureMaxC?.toString() ?? "",
    temperatureMinC: settings?.temperatureMinC?.toString() ?? "",
    vpdMaxKpa: settings?.vpdMaxKpa?.toString() ?? "",
    vpdMinKpa: settings?.vpdMinKpa?.toString() ?? ""
  };
}

function validateAlertSettingsDraft(draft: AlertSettingsDraft) {
  const ranges: Array<[keyof AlertSettingsDraft, keyof AlertSettingsDraft, string]> = [
    ["temperatureMinC", "temperatureMaxC", "temperatura"],
    ["humidityMinPercent", "humidityMaxPercent", "humedad ambiental"],
    ["vpdMinKpa", "vpdMaxKpa", "VPD"],
    ["substrateMoistureMinPercent", "substrateMoistureMaxPercent", "humedad de sustrato"]
  ];
  for (const [minimumKey, maximumKey, label] of ranges) {
    const minimum = parseOptionalNumber(draft[minimumKey]);
    const maximum = parseOptionalNumber(draft[maximumKey]);
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) return `Revisá ${label}: el mínimo no puede superar al máximo.`;
  }
  return "";
}

function buildConfiguredEnvironmentalAlerts(settings: PlantEnvironmentalAlertSettings | undefined, measurement: PlantMeasurement | undefined, vpdKpa: number | undefined) {
  if (!measurement) return [];
  const capturedAt = formatMeasurementDate(measurement.measuredAt);
  return getConfiguredEnvironmentalAlerts(settings, measurement, vpdKpa).map((alert) => `${alert.label}: ${alert.value}${alert.unit}, ${alert.direction === "below" ? "por debajo de tu mínimo" : "por encima de tu máximo"} ${alert.limit}${alert.unit}. Lectura: ${capturedAt}.`);
}

function MeasurementIrrigationSummary({ measurement }: { measurement: PlantMeasurement }) {
  const hasIrrigationData = [measurement.waterAmountMl, measurement.irrigationPh, measurement.irrigationEcMsCm, measurement.irrigationPpm, measurement.runoffAmountMl, measurement.runoffPh, measurement.runoffEcMsCm].some((value) => value !== undefined);
  if (!hasIrrigationData) return null;
  const facts = [
    ["Cantidad", formatOptionalMeasurement(measurement.waterAmountMl, " ml")],
    ["pH medido", formatOptionalMeasurement(measurement.irrigationPh, "")],
    ["EC medida", formatOptionalMeasurement(measurement.irrigationEcMsCm, " mS/cm")],
    ["PPM medidos", formatOptionalMeasurement(measurement.irrigationPpm, " ppm")],
    ["Drenaje", formatOptionalMeasurement(measurement.runoffAmountMl, " ml")],
    ["pH drenaje", formatOptionalMeasurement(measurement.runoffPh, "")],
    ["EC drenaje", formatOptionalMeasurement(measurement.runoffEcMsCm, " mS/cm")]
  ];
  return (
    <section className="measurement-irrigation-summary" aria-label="Datos de riego medidos">
      <div><strong>Riego registrado</strong><small>Valores declarados; PlantCare no convierte EC y ppm ni calcula dosis.</small></div>
      <dl>{facts.map(([label, value]) => <div className={value === "Sin dato" ? "is-missing" : ""} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}

function MeasurementPhotoGallery({ measurements, plant }: { measurements: PlantMeasurement[]; plant: Plant }) {
  const photos = measurements.filter((measurement) => measurement.photoDataUrl);
  const [leftPhotoId, setLeftPhotoId] = useState(photos[0]?.id ?? "");
  const [rightPhotoId, setRightPhotoId] = useState(photos[1]?.id ?? photos[0]?.id ?? "");
  if (photos.length === 0) return null;
  const leftPhoto = photos.find((measurement) => measurement.id === leftPhotoId) ?? photos[0];
  const rightPhoto = photos.find((measurement) => measurement.id === rightPhotoId) ?? photos[Math.min(1, photos.length - 1)];

  return (
    <section className="measurement-photo-gallery" aria-label={`Comparación fotográfica de ${plant.name}`}>
      <div className="measurement-photo-gallery-heading">
        <div>
          <strong>Evolución fotográfica</strong>
          <span>{photos.length} foto{photos.length === 1 ? "" : "s"} registrada{photos.length === 1 ? "" : "s"} en esta maceta</span>
        </div>
        <small>Comparación visual; la app no infiere diagnósticos.</small>
      </div>
      <div className="measurement-photo-comparison">
        <MeasurementPhotoChoice label="Foto anterior" measurement={leftPhoto} onChange={setLeftPhotoId} options={photos} plant={plant} value={leftPhoto.id} />
        <MeasurementPhotoChoice label="Foto posterior" measurement={rightPhoto} onChange={setRightPhotoId} options={photos} plant={plant} value={rightPhoto.id} />
      </div>
    </section>
  );
}

function MeasurementPhotoChoice({
  label,
  measurement,
  onChange,
  options,
  plant,
  value
}: {
  label: string;
  measurement: PlantMeasurement;
  onChange: (value: string) => void;
  options: PlantMeasurement[];
  plant: Plant;
  value: string;
}) {
  return (
    <article>
      <label>
        {label}
        <select className="form-control" onChange={(event) => onChange(event.target.value)} value={value}>
          {options.map((option) => <option key={option.id} value={option.id}>{formatMeasurementDate(option.measuredAt)}</option>)}
        </select>
      </label>
      {/* La imagen es un data URL local elegido por el usuario; next/image no la optimiza. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={`${label} de ${plant.name}, ${formatMeasurementDate(measurement.measuredAt)}`} src={measurement.photoDataUrl} />
      {measurement.observations ? <p>{measurement.observations}</p> : null}
    </article>
  );
}

function formatOptionalMeasurement(value: number | undefined, unit: string, prefix?: string) {
  if (value === undefined) return "Sin dato";
  return `${prefix ? `${prefix}: ` : ""}${value}${unit}`;
}

function PlantSensorPanel({
  devices,
  onCreateSensorDevice,
  onRefreshSensors,
  onToggleSensorDevice,
  plant,
  status
}: {
  devices: SensorDevice[];
  onCreateSensorDevice: (plantId: string, name: string) => Promise<string | null>;
  onRefreshSensors: () => Promise<void>;
  onToggleSensorDevice: (deviceId: string, active: boolean) => Promise<void>;
  plant: Plant;
  status: string;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [deviceName, setDeviceName] = useState(`Sensor ${plant.name}`);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createDevice() {
    setIsCreating(true);
    const token = await onCreateSensorDevice(plant.id, deviceName.trim() || `Sensor ${plant.name}`);
    setNewToken(token);
    setIsCreating(false);
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <details className="plant-sensor-panel mt-3">
      <summary>
        <span>
          <strong>Sensores conectados</strong>
          <small>{devices.length > 0 ? `${devices.length} dispositivo${devices.length === 1 ? "" : "s"}` : "Sin dispositivos"}</small>
        </span>
        <span className="pill pill-green">IoT</span>
      </summary>
      <div className="plant-sensor-content">
        <p>Vincula esta maceta con un ESP32 o gateway. Las lecturas se actualizan cada minuto mientras la app esta abierta.</p>

        {devices.length > 0 ? (
          <div className="plant-sensor-devices">
            {devices.map((device) => (
              <article key={device.id}>
                <div>
                  <strong>{device.name}</strong>
                  <small>{device.lastSeenAt ? `Ultima lectura: ${formatMeasurementDate(device.lastSeenAt)}` : "Esperando primera lectura"}</small>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void onToggleSensorDevice(device.id, !device.active)}
                  type="button"
                >
                  {device.active ? "Desactivar" : "Activar"}
                </button>
              </article>
            ))}
          </div>
        ) : null}

        <div className="plant-sensor-create">
          <label>
            Nombre del dispositivo
            <input className="form-control" onChange={(event) => setDeviceName(event.target.value)} value={deviceName} />
          </label>
          <button className="primary-button" disabled={isCreating} onClick={() => void createDevice()} type="button">
            {isCreating ? "Creando..." : "Conectar sensor"}
          </button>
          <button className="secondary-button" onClick={() => void onRefreshSensors()} type="button">Actualizar lecturas</button>
        </div>

        {newToken ? (
          <div className="plant-sensor-token" role="status">
            <strong>Token del dispositivo</strong>
            <code>{newToken}</code>
            <button className="secondary-button" onClick={() => void copyToken()} type="button">{copied ? "Copiado" : "Copiar token"}</button>
            <p>Guardalo ahora: por seguridad no volvera a mostrarse.</p>
          </div>
        ) : null}
        {status ? <p className="plant-sensor-status">{status}</p> : null}
      </div>
    </details>
  );
}

function PlantSuggestionsPanel({
  calendarEvents,
  genetic,
  measurements,
  onAddCalendarEvent,
  plant
}: {
  calendarEvents: CalendarEvent[];
  genetic?: GeneticReferenceEntry;
  measurements: PlantMeasurement[];
  onAddCalendarEvent: (event: CalendarEvent) => void;
  plant: Plant;
}) {
  const suggestions = buildCultivationSuggestions({ existingEvents: calendarEvents, genetic, measurements, plant });

  function addSuggestion(suggestion: CultivationSuggestion) {
    onAddCalendarEvent({
      completedDates: [],
      description: `${suggestion.description} Motivo: ${suggestion.rationale}`,
      id: createEventId(`suggestion-${plant.id}`),
      kind: suggestion.kind,
      plantId: plant.id,
      source: "horticultural",
      startDate: suggestion.dueDate,
      title: suggestion.title
    });
  }

  return (
    <section className="plant-suggestions-panel mt-3" aria-label={`Sugerencias para ${plant.name}`}>
      <div className="plant-suggestions-header">
        <div>
          <p className="plant-calculation-eyebrow">Asistente explicable</p>
          <h4>Proximas revisiones sugeridas</h4>
          <p>Se basan en datos declarados o medidos. Solo se agregan al calendario cuando vos elegis hacerlo.</p>
        </div>
        <span className="pill pill-green">{suggestions.length} nuevas</span>
      </div>

      {suggestions.length > 0 ? (
        <div className="plant-suggestions-list">
          {suggestions.map((suggestion) => (
            <article className={`plant-suggestion priority-${suggestion.priority}`} key={suggestion.id}>
              <div className="plant-suggestion-title-row">
                <div>
                  <span>{suggestion.priority === "high" ? "Atencion" : suggestion.priority === "medium" ? "Revision" : "Seguimiento"}</span>
                  <h5>{suggestion.title}</h5>
                </div>
                <time dateTime={suggestion.dueDate}>{formatSuggestionDate(suggestion.dueDate)}</time>
              </div>
              <p>{suggestion.description}</p>
              <small>{suggestion.rationale}</small>
              <div className="plant-suggestion-evidence">
                {suggestion.evidence.filter((point) => point.value !== null).slice(0, 4).map((point) => (
                  <span key={point.label}>{point.label}: {String(point.value)}{point.unit ? ` ${point.unit}` : ""} · {formatDataOrigin(point.origin)}</span>
                ))}
              </div>
              {suggestion.missingInputs.length > 0 ? (
                <p className="plant-suggestion-missing">Para mejorarla falta: {suggestion.missingInputs.join(", ")}.</p>
              ) : null}
              <button className="secondary-button" onClick={() => addSuggestion(suggestion)} type="button">
                Agregar al calendario
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="plant-suggestions-empty">No hay sugerencias nuevas: las disponibles ya estan en el calendario.</p>
      )}
    </section>
  );
}

function formatSuggestionDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(`${isoDate}T12:00:00`));
}

function PlantMeasurementForm({
  initialMeasurement,
  onAddMeasurement,
  onDone,
  plant,
  resetAfterSave = false
}: {
  initialMeasurement?: PlantMeasurement;
  onAddMeasurement: (measurement: PlantMeasurement) => void;
  onDone: () => void;
  plant: Plant;
  resetAfterSave?: boolean;
}) {
  const field = (value?: number) => value?.toString() ?? "";
  const [measuredAt, setMeasuredAt] = useState(() => initialMeasurement ? toLocalDateTimeValue(initialMeasurement.measuredAt) : getLocalDateTimeValue());
  const [source, setSource] = useState<PlantMeasurement["source"]>(initialMeasurement?.source ?? "manual");
  const [temperature, setTemperature] = useState(() => field(initialMeasurement?.temperatureC));
  const [leafTemperature, setLeafTemperature] = useState(() => field(initialMeasurement?.leafTemperatureC));
  const [humidity, setHumidity] = useState(() => field(initialMeasurement?.ambientHumidityPercent));
  const [substrateMoisture, setSubstrateMoisture] = useState(() => field(initialMeasurement?.substrateMoisturePercent));
  const [ppfd, setPpfd] = useState(() => field(initialMeasurement?.ppfdUmolM2S));
  const [height, setHeight] = useState(() => field(initialMeasurement?.heightCm));
  const [waterAmount, setWaterAmount] = useState(() => field(initialMeasurement?.waterAmountMl));
  const [irrigationPh, setIrrigationPh] = useState(() => field(initialMeasurement?.irrigationPh));
  const [irrigationEc, setIrrigationEc] = useState(() => field(initialMeasurement?.irrigationEcMsCm));
  const [irrigationPpm, setIrrigationPpm] = useState(() => field(initialMeasurement?.irrigationPpm));
  const [runoffAmount, setRunoffAmount] = useState(() => field(initialMeasurement?.runoffAmountMl));
  const [runoffPh, setRunoffPh] = useState(() => field(initialMeasurement?.runoffPh));
  const [runoffEc, setRunoffEc] = useState(() => field(initialMeasurement?.runoffEcMsCm));
  const [observations, setObservations] = useState(initialMeasurement?.observations ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState(initialMeasurement?.photoDataUrl ?? "");
  const previewAssessment = useMemo(
    () =>
      assessPlantEnvironment(plant, {
        ambientHumidityPercent: parseOptionalNumber(humidity),
        id: "measurement-preview",
        leafTemperatureC: parseOptionalNumber(leafTemperature),
        measuredAt: measuredAt || getLocalDateTimeValue(),
        plantId: plant.id,
        ppfdUmolM2S: parseOptionalNumber(ppfd),
        source,
        temperatureC: parseOptionalNumber(temperature)
      }),
    [humidity, leafTemperature, measuredAt, plant, ppfd, source, temperature]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!temperature && !leafTemperature && !humidity && !substrateMoisture && !ppfd && !height && !waterAmount && !irrigationPh && !irrigationEc && !irrigationPpm && !runoffAmount && !runoffPh && !runoffEc && !observations && !photoDataUrl) return;

    onAddMeasurement({
      ambientHumidityPercent: parseOptionalNumber(humidity),
      id: initialMeasurement?.id ?? `measurement-${plant.id}-${Date.now()}`,
      measuredAt: new Date(measuredAt).toISOString(),
      leafTemperatureC: parseOptionalNumber(leafTemperature),
      observations: observations.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
      plantId: plant.id,
      ppfdUmolM2S: parseOptionalNumber(ppfd),
      source,
      substrateMoisturePercent: parseOptionalNumber(substrateMoisture),
      temperatureC: parseOptionalNumber(temperature),
      heightCm: parseOptionalNumber(height),
      waterAmountMl: parseOptionalNumber(waterAmount),
      irrigationPh: parseOptionalNumber(irrigationPh),
      irrigationEcMsCm: parseOptionalNumber(irrigationEc),
      irrigationPpm: parseOptionalNumber(irrigationPpm),
      runoffAmountMl: parseOptionalNumber(runoffAmount),
      runoffPh: parseOptionalNumber(runoffPh),
      runoffEcMsCm: parseOptionalNumber(runoffEc)
    });
    if (resetAfterSave) {
      setMeasuredAt(getLocalDateTimeValue()); setTemperature(""); setLeafTemperature(""); setHumidity("");
      setSubstrateMoisture(""); setPpfd(""); setHeight(""); setWaterAmount(""); setIrrigationPh(""); setIrrigationEc("");
      setIrrigationPpm(""); setRunoffAmount(""); setRunoffPh(""); setRunoffEc(""); setObservations(""); setPhotoDataUrl("");
    } else onDone();
  }

  return (
    <form className="plant-measurement-form" onSubmit={handleSubmit}>
      <label>
        Fecha y hora
        <input className="form-control" onChange={(event) => setMeasuredAt(event.target.value)} type="datetime-local" value={measuredAt} />
      </label>
      <label>
        Origen
        <select className="form-control" onChange={(event) => setSource(event.target.value as PlantMeasurement["source"])} value={source}>
          <option value="manual">Carga manual</option>
          <option value="device">Dispositivo</option>
        </select>
      </label>
      <label>
        Temperatura (C)
        <input className="form-control" inputMode="decimal" max="60" min="-10" onChange={(event) => setTemperature(event.target.value)} step="0.1" type="number" value={temperature} />
      </label>
      <label>
        Humedad ambiental (%)
        <input className="form-control" inputMode="decimal" max="100" min="0" onChange={(event) => setHumidity(event.target.value)} step="0.1" type="number" value={humidity} />
      </label>
      <label>
        Temperatura de hoja (C, opcional)
        <input className="form-control" inputMode="decimal" max="60" min="-10" onChange={(event) => setLeafTemperature(event.target.value)} step="0.1" type="number" value={leafTemperature} />
      </label>
      <label>
        Humedad de sustrato (%)
        <input className="form-control" inputMode="decimal" max="100" min="0" onChange={(event) => setSubstrateMoisture(event.target.value)} step="0.1" type="number" value={substrateMoisture} />
      </label>
      <label>
        PPFD (umol/m2/s)
        <input className="form-control" inputMode="numeric" min="0" onChange={(event) => setPpfd(event.target.value)} step="1" type="number" value={ppfd} />
      </label>
      <label>
        Altura (cm, opcional)
        <input className="form-control" inputMode="decimal" min="0" onChange={(event) => setHeight(event.target.value)} step="0.1" type="number" value={height} />
      </label>
      <fieldset className="measurement-irrigation-fields">
        <legend>Registro de riego (opcional)</legend>
        <p>Cargá únicamente valores aplicados o medidos. EC y ppm se guardan por separado, sin conversiones automáticas.</p>
        <label>Agua aplicada (ml)<input className="form-control" inputMode="decimal" min="0" onChange={(event) => setWaterAmount(event.target.value)} step="1" type="number" value={waterAmount} /></label>
        <label>pH medido<input className="form-control" inputMode="decimal" max="14" min="0" onChange={(event) => setIrrigationPh(event.target.value)} step="0.01" type="number" value={irrigationPh} /></label>
        <label>EC medida (mS/cm)<input className="form-control" inputMode="decimal" min="0" onChange={(event) => setIrrigationEc(event.target.value)} step="0.01" type="number" value={irrigationEc} /></label>
        <label>PPM medidos<input className="form-control" inputMode="numeric" min="0" onChange={(event) => setIrrigationPpm(event.target.value)} step="1" type="number" value={irrigationPpm} /></label>
        <label>Drenaje recolectado (ml)<input className="form-control" inputMode="decimal" min="0" onChange={(event) => setRunoffAmount(event.target.value)} step="1" type="number" value={runoffAmount} /></label>
        <label>pH del drenaje<input className="form-control" inputMode="decimal" max="14" min="0" onChange={(event) => setRunoffPh(event.target.value)} step="0.01" type="number" value={runoffPh} /></label>
        <label>EC del drenaje (mS/cm)<input className="form-control" inputMode="decimal" min="0" onChange={(event) => setRunoffEc(event.target.value)} step="0.01" type="number" value={runoffEc} /></label>
      </fieldset>
      <label className="plant-measurement-notes">
        Foto (opcional)
        <input accept="image/*" className="form-control" onChange={async (event) => {
          const file = event.target.files?.[0];
          setPhotoDataUrl(file ? await readPhotoFileAsDataUrl(file) : "");
        }} type="file" />
      </label>
      <label className="plant-measurement-notes">
        Observaciones
        <textarea className="form-control" onChange={(event) => setObservations(event.target.value)} rows={2} value={observations} />
      </label>
      <div className={`measurement-vpd-preview status-${previewAssessment.vpdStatus}`} role="status">
        <div>
          <span>VPD calculado en vivo</span>
          <strong>{previewAssessment.vpdKpa === undefined ? "Ingresá temperatura y humedad" : `${previewAssessment.vpdKpa} kPa`}</strong>
        </div>
        <p>
          {previewAssessment.vpdKpa === undefined
            ? `Falta: ${previewAssessment.missingInputs.filter((item) => item !== "PPFD a nivel de la copa").join(", ") || "temperatura y humedad"}.`
            : `${previewAssessment.vpdBasis === "leaf" ? "VPD foliar" : "VPD del aire"} estimado · ${formatEnvironmentalStatus(previewAssessment.vpdStatus)}.`}
        </p>
        <small>
          Fórmula Tetens. {previewAssessment.vpdBasis === "leaf" ? "Usa la temperatura foliar ingresada." : "Sin temperatura foliar, no se supone una diferencia con el aire."}
        </small>
      </div>
      <button className="primary-button" type="submit">{initialMeasurement ? "Guardar cambios" : "Guardar medicion"}</button>
    </form>
  );
}

function getVpdTrend(plant: Plant, measurements: PlantMeasurement[]) {
  const values = measurements
    .map((measurement) => assessPlantEnvironment(plant, measurement).vpdKpa)
    .filter((value): value is number => value !== undefined)
    .slice(0, 2);
  if (values.length < 2) return "faltan al menos dos lecturas comparables";
  const difference = values[0] - values[1];
  if (Math.abs(difference) < 0.05) return "estable frente a la lectura anterior";
  return difference > 0 ? "en aumento frente a la lectura anterior" : "en descenso frente a la lectura anterior";
}

function EnvironmentalHistoryChart({ measurements, plant }: { measurements: PlantMeasurement[]; plant: Plant }) {
  const chronological = [...measurements].sort((first, second) => first.measuredAt.localeCompare(second.measuredAt)).slice(-12);
  const temperature = chronological.flatMap((measurement) =>
    measurement.temperatureC === undefined ? [] : [{ label: formatMeasurementDate(measurement.measuredAt), value: measurement.temperatureC }]
  );
  const humidity = chronological.flatMap((measurement) =>
    measurement.ambientHumidityPercent === undefined ? [] : [{ label: formatMeasurementDate(measurement.measuredAt), value: measurement.ambientHumidityPercent }]
  );
  const vpd = chronological.flatMap((measurement) => {
    const value = assessPlantEnvironment(plant, measurement).vpdKpa;
    return value === undefined ? [] : [{ label: formatMeasurementDate(measurement.measuredAt), value }];
  });

  return (
    <section className="environment-history-chart" aria-label={`Tendencia ambiental de ${plant.name}`}>
      <div className="environment-history-chart-header">
        <div>
          <strong>Tendencia ambiental</strong>
          <span>Últimas {chronological.length} lecturas de esta maceta</span>
        </div>
        <small>Los puntos unen mediciones registradas; no completan períodos sin datos.</small>
      </div>
      <div className="environment-sparkline-grid">
        <MeasurementSparkline color="#c76537" label="Temperatura" points={temperature} unit="°C" />
        <MeasurementSparkline color="#267c8b" label="Humedad" points={humidity} unit="%" />
        <MeasurementSparkline color="#467b45" label="VPD calculado" points={vpd} unit=" kPa" />
      </div>
    </section>
  );
}

function MeasurementSparkline({ color, label, points, unit }: { color: string; label: string; points: Array<{ label: string; value: number }>; unit: string }) {
  const values = points.map((point) => point.value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 34 - ((point.value - minimum) / range) * 28;
    return { ...point, x, y };
  });
  const latest = points.at(-1);

  return (
    <article className="environment-sparkline">
      <div>
        <span>{label}</span>
        <strong>{latest ? `${latest.value}${unit}` : "Sin datos"}</strong>
      </div>
      {coordinates.length > 0 ? (
        <svg aria-label={`${label}: de ${minimum}${unit} a ${maximum}${unit}`} role="img" viewBox="0 0 100 40">
          <polyline fill="none" points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          {coordinates.map((point) => <circle cx={point.x} cy={point.y} fill={color} key={`${point.label}-${point.x}`} r="2.2"><title>{point.label}: {point.value}{unit}</title></circle>)}
        </svg>
      ) : <p>Faltan mediciones comparables.</p>}
      {latest ? <small>{points.length} lectura{points.length === 1 ? "" : "s"} · mín. {minimum}{unit} · máx. {maximum}{unit}</small> : null}
    </article>
  );
}

function formatEnvironmentalStatus(status: EnvironmentalStatus) {
  if (status === "in-range") return "dentro de la banda orientativa de la etapa declarada";
  if (status === "low") return "por debajo de la banda orientativa";
  if (status === "high") return "por encima de la banda orientativa";
  if (status === "critical") return "fuera de la zona orientativa habitual; conviene confirmar la medición";
  return "sin banda disponible para clasificar";
}

function EnvironmentMetric({
  label,
  status = "missing",
  target,
  value
}: {
  label: string;
  status?: EnvironmentalStatus;
  target?: string;
  value: string;
}) {
  return (
    <div className={`plant-environment-metric status-${status}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {target ? <small>Referencia: {target}</small> : null}
    </div>
  );
}

function GeneticInfoPopup({ genetic, onClose }: { genetic: GeneticReferenceEntry; onClose: () => void }) {
  return (
    <div className="genetic-popup-backdrop" role="dialog" aria-modal="true" aria-labelledby="genetic-popup-title">
      <section className="genetic-popup-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Ficha de referencia</p>
            <h2 className="genetic-popup-title mt-1 text-2xl font-black" id="genetic-popup-title">
              {genetic.name}
            </h2>
            <p className="genetic-popup-source mt-1 text-sm font-bold leading-6">{genetic.source}</p>
          </div>
          <button className="secondary-button genetic-popup-close" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
        <div className="genetic-popup-note mt-4 rounded-lg border p-3 text-sm font-bold leading-6">
          Solo ayuda visual: copiar o leer estos datos no completa campos ni calcula riego, luz, flora, cosecha o secado.
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <GeneticPopupFact label="Cruza / linaje" value={genetic.cross} />
          <GeneticPopupFact label="Tipo" value={formatGeneticType(genetic.type)} />
          <GeneticPopupFact label="Floracion publicada" value={formatRange(genetic.flowering_weeks_range, "semanas")} />
          <GeneticPopupFact label="THC publicado" value={formatThcRange(genetic.thc_percent_range)} />
        </dl>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <GeneticPopupText label="Sabor / notas" value={genetic.flavor_notes} />
          <GeneticPopupText label="Efecto / descripcion" value={genetic.effect_notes} />
        </div>
        {genetic.raw_fields ? (
          <details className="genetic-raw-fields mt-3 rounded-lg border p-3">
            <summary className="cursor-pointer text-xs font-black uppercase">
              Campos originales del Excel
            </summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(genetic.raw_fields).map(([label, rawValue]) => (
                <GeneticPopupFact
                  key={label}
                  label={label}
                  value={rawValue === null ? "No declarado" : String(rawValue)}
                />
              ))}
            </dl>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function GeneticPopupFact({ label, value }: { label: string; value: string }) {
  const destination = getReferenceTargetLabel(label);

  return (
    <div className="genetic-popup-fact rounded-md border px-2.5 py-2">
      <dt className="text-[11px] font-black uppercase">{label}</dt>
      <dd className="mt-1 break-words font-black">{value}</dd>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">Campo: {destination}</span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function GeneticPopupText({ label, value }: { label: string; value: string }) {
  const destination = getReferenceTargetLabel(label);

  return (
    <div className="genetic-popup-text rounded-md border p-2.5">
      <p className="text-[11px] font-black uppercase">{label}</p>
      <p className="mt-2 text-sm font-bold leading-6">{value}</p>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">Campo: {destination}</span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function CalendarSection({
  entries,
  events,
  locale,
  onAddCalendarEvent,
  onAddJournalEntry,
  onDeleteCalendarEvent,
  onDeleteJournalEntry,
  onToggleOccurrence,
  onUpdateCalendarEvent,
  onUpdateJournalEntry,
  plants
}: {
  entries: CareEntry[];
  events: CalendarEvent[];
  locale: Locale;
  onAddCalendarEvent: (event: CalendarEvent) => void;
  onAddJournalEntry: (entry: CareEntry) => void;
  onDeleteCalendarEvent: (eventId: string) => void;
  onDeleteJournalEntry: (entryId: string) => void;
  onToggleOccurrence: (eventId: string, date: string) => void;
  onUpdateCalendarEvent: (
    eventId: string,
    updates: Partial<Pick<CalendarEvent, "description" | "startDate" | "title">>
  ) => void;
  onUpdateJournalEntry: (entryId: string, updates: JournalEntryUpdates) => void;
  plants: Plant[];
}) {
  const todayIso = getTodayIso();
  const [anchorDate, setAnchorDate] = useState(() => getStoredCalendarDate(todayIso));
  const [viewMode, setViewMode] = useState<"month" | "week">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "week" : "month"
  );
  const [selectedDate, setSelectedDate] = useState(() => getStoredCalendarDate(todayIso));
  const [isCompactGrid, setIsCompactGrid] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 639px)");
    const handleCompactChange = (event: MediaQueryListEvent) => setIsCompactGrid(event.matches);

    compactQuery.addEventListener("change", handleCompactChange);
    return () => compactQuery.removeEventListener("change", handleCompactChange);
  }, []);
  const calendarPeriodLabel =
    viewMode === "month" ? formatMonthPeriod(anchorDate) : `${formatDisplayDate(firstVisibleWeekDate(anchorDate))} - ${formatDisplayDate(addDays(firstVisibleWeekDate(anchorDate), 6))}`;

  const days = useMemo(
    () => (viewMode === "month" ? buildMonthGrid(anchorDate) : buildWeekGrid(anchorDate)),
    [anchorDate, viewMode]
  );
  const firstDate = days[0]?.isoDate ?? todayIso;
  const lastDate = days[days.length - 1]?.isoDate ?? todayIso;
  const occurrences = useMemo(() => expandEventOccurrences(events, firstDate, lastDate), [events, firstDate, lastDate]);
  const selectedOccurrences = occurrences.filter((occurrence) => occurrence.date === selectedDate);
  const selectedEntries = entries.filter((entry) => entry.createdAt === selectedDate);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [quickEventStatus, setQuickEventStatus] = useState("");
  const [quickEventPlantId, setQuickEventPlantId] = useState(plants[0]?.id ?? manualPlantId);
  const quickEventPlant = plants.find((plant) => plant.id === quickEventPlantId);
  const quickEventPlantValue = quickEventPlant?.id ?? plants[0]?.id ?? manualPlantId;

  function navigateCalendar(direction: -1 | 1) {
    const nextAnchorDate = viewMode === "month" ? addMonths(anchorDate, direction) : addDays(anchorDate, direction * 7);

    setAnchorDate(nextAnchorDate);
    setSelectedDate(nextAnchorDate);
    persistCalendarDate(nextAnchorDate);
  }

  function navigateYear(direction: -1 | 1) {
    const nextAnchorDate = addYears(anchorDate, direction);

    setAnchorDate(nextAnchorDate);
    setSelectedDate(nextAnchorDate);
    persistCalendarDate(nextAnchorDate);
  }

  function goToToday() {
    setAnchorDate(todayIso);
    setSelectedDate(todayIso);
    persistCalendarDate(todayIso);
  }

  function handleMonthPickerChange(value: string) {
    const nextAnchorDate = fromYearMonthValue(value);

    setAnchorDate(nextAnchorDate);
    setSelectedDate(nextAnchorDate);
    persistCalendarDate(nextAnchorDate);
  }

  function handleQuickEvent(action: (typeof calendarQuickActions)[number]) {
    if (hasDuplicateCalendarAction(selectedOccurrences, action.label)) {
      setQuickEventStatus(`Ya existe una tarea de ${action.label} para ${formatDisplayDate(selectedDate)}.`);
      return;
    }

    if (action.kind === "photo") {
      if (!photoInputRef.current) {
        setQuickEventStatus("No se pudo abrir la camara en este navegador.");
        return;
      }

      photoInputRef.current.value = "";
      photoInputRef.current.click();
      return;
    }

    const plantId = quickEventPlantValue;

    onAddCalendarEvent({
      completedDates: [],
      description: quickEventPlant ? `${action.description} Planta/maceta: ${quickEventPlant.name}.` : action.description,
      id: createEventId(`event-${action.kind}`),
      kind: action.kind,
      plantId,
      source: "manual",
      startDate: selectedDate,
      title: action.title
    });
    setQuickEventStatus(`${action.label} agregado al ${formatDisplayDate(selectedDate)}.`);
  }

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const plantId = quickEventPlantValue;
    let photoDataUrl = "";

    if (hasDuplicateCalendarAction(selectedOccurrences, "Foto")) {
      setQuickEventStatus(`Ya existe una tarea de Foto para ${formatDisplayDate(selectedDate)}.`);
      return;
    }

    try {
      photoDataUrl = await readPhotoFileAsDataUrl(file);
    } catch {
      setQuickEventStatus("No se pudo guardar la foto. Proba elegirla desde galeria.");
      return;
    }

    onAddCalendarEvent({
      completedDates: [],
      description: quickEventPlant
        ? `Foto tomada o elegida manualmente para registrar el ultimo estado visual de ${quickEventPlant.name}.`
        : "Foto tomada o elegida manualmente para registrar el ultimo estado visual.",
      id: createEventId("event-photo"),
      kind: "photo",
      plantId,
      source: "manual",
      startDate: selectedDate,
      title: "Foto"
    });
    onAddJournalEntry({
      createdAt: selectedDate,
      id: createEventId("entry-photo"),
      note: quickEventPlant ? `Registro fotografico del ultimo estado de ${quickEventPlant.name}.` : "Registro fotografico del ultimo estado.",
      photoDataUrl,
      plantId,
      tags: ["Foto"],
      title: "Foto del estado"
    });
    setQuickEventStatus(`Foto guardada en bitacora y calendario para ${formatDisplayDate(selectedDate)}.`);
  }

  function handleEditOccurrence(occurrence: CalendarEventOccurrence) {
    const nextTitle = window.prompt("Editar nombre de la tarea", displayEventTitle(occurrence.title))?.trim();

    if (!nextTitle) return;

    const nextDate = window.prompt("Editar fecha de la tarea (AAAA-MM-DD)", occurrence.date)?.trim();

    if (!nextDate) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      setQuickEventStatus("La fecha debe tener formato AAAA-MM-DD.");
      return;
    }

    const hasDuplicate = events.some(
      (event) =>
        event.id !== occurrence.eventId &&
        event.startDate === nextDate &&
        normalizeCalendarTitle(event.title) === normalizeCalendarTitle(nextTitle)
    );

    if (hasDuplicate) {
      setQuickEventStatus(`Ya existe una tarea llamada ${nextTitle} para ${formatDisplayDate(nextDate)}.`);
      return;
    }

    onUpdateCalendarEvent(occurrence.eventId, {
      startDate: nextDate,
      title: nextTitle
    });
    setSelectedDate(nextDate);
    setQuickEventStatus("Tarea editada.");
  }

  function handleDeleteOccurrence(occurrence: CalendarEventOccurrence) {
    const confirmed = window.confirm(`Eliminar "${occurrence.title}" del calendario?`);

    if (!confirmed) return;

    onDeleteCalendarEvent(occurrence.eventId);
    setQuickEventStatus("Tarea eliminada.");
  }

  return (
    <section className="calendar-page mx-auto mt-5 max-w-[1500px] px-3 sm:px-5 lg:px-6">
      <div className="calendar-header">
        <div className="calendar-title-block">
          <p className="eyebrow text-emerald-800">Calendario</p>
          <h1>{calendarPeriodLabel}</h1>
          <p className="calendar-context-copy">Planificá tareas, revisá el historial y registrá acciones por maceta.</p>
        </div>
        <div className="calendar-toolbar" aria-label="Navegacion del calendario">
          <div className="calendar-history-controls">
            <button className="calendar-icon-button" aria-label="Un ano atras" onClick={() => navigateYear(-1)} type="button">
              <span aria-hidden="true">&laquo;</span>
            </button>
            <button
              className="calendar-icon-button"
              aria-label={viewMode === "month" ? "Mes anterior" : "Semana anterior"}
              onClick={() => navigateCalendar(-1)}
              type="button"
            >
              <span aria-hidden="true">&lsaquo;</span>
            </button>
            <button className="today-control" onClick={goToToday} type="button">
              Hoy
            </button>
            <button
              className="calendar-icon-button"
              aria-label={viewMode === "month" ? "Mes siguiente" : "Semana siguiente"}
              onClick={() => navigateCalendar(1)}
              type="button"
            >
              <span aria-hidden="true">&rsaquo;</span>
            </button>
            <button className="calendar-icon-button" aria-label="Un ano adelante" onClick={() => navigateYear(1)} type="button">
              <span aria-hidden="true">&raquo;</span>
            </button>
          </div>
          <label className="calendar-month-picker">
            <span>Mes / ano</span>
            <input
              aria-label="Elegir mes y ano"
              onChange={(event) => handleMonthPickerChange(event.target.value)}
              type="month"
              value={getYearMonthValue(anchorDate)}
            />
          </label>
          <div className="view-toggle" aria-label="Vista de calendario" role="group">
            <button aria-pressed={viewMode === "month"} className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")} type="button">
              Mes
            </button>
            <button aria-pressed={viewMode === "week"} className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")} type="button">
              Semana
            </button>
          </div>
        </div>
      </div>
      <div className="calendar-layout mt-4">
        <aside className="calendar-sidebar">
          <button
            className="calendar-create-button"
            onClick={() =>
              setQuickEventStatus("Elegí una accion: Riego, Foto, Limpieza, Poda, Defoliar, Fumigar o Fotoperiodo 12/12.")
            }
            type="button"
          >
            <span aria-hidden="true">+</span>
            Crear
          </button>
          <label className="calendar-plant-picker">
            <span>Maceta</span>
            <select
              aria-label="Elegir planta o maceta para agregar tarea"
              value={quickEventPlantValue}
              onChange={(event) => setQuickEventPlantId(event.target.value)}
            >
              {plants.length > 0 ? (
                plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))
              ) : (
                <option value={manualPlantId}>Cultivo manual</option>
              )}
            </select>
          </label>
          <div className="calendar-action-stack" aria-label="Agregar evento rapido">
            {calendarQuickActions.map((action) => {
              const ActionIcon = eventIconComponents[action.iconKey];

              return (
                <button
                  className={`event-legend event-action ${getEventClass(action.kind)}`}
                  key={action.label}
                  onClick={() => handleQuickEvent(action)}
                  type="button"
                >
                  <ActionIcon aria-hidden="true" size={15} strokeWidth={2.25} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
          <input
            ref={photoInputRef}
            accept="image/*"
            aria-label="Tomar o elegir foto del cultivo"
            capture="environment"
            className="sr-only"
            onChange={handlePhotoSelected}
            type="file"
          />
          {quickEventStatus ? <span className="calendar-status-pill">{quickEventStatus}</span> : null}
        </aside>
        <div className="calendar-main">
          <div className="calendar-weekdays">
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
              <span key={`${day}-${index}`}>
                {day}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const dayOccurrences = occurrences.filter((occurrence) => occurrence.date === day.isoDate);
              const dayEntries = entries.filter((entry) => entry.createdAt === day.isoDate);
              const visibleDayItems = [
                ...dayOccurrences.map((occurrence) => ({
                  className: getEventClass(occurrence.kind),
                  id: occurrence.occurrenceId,
                  label: displayEventTitle(occurrence.title),
                  type: "event" as const,
                  occurrence
                })),
                ...dayEntries.map((entry) => ({
                  className: "event-note",
                  id: `journal-${entry.id}`,
                  label: entry.title?.trim() || "Nota de bitacora",
                  type: "entry" as const,
                  entry
                }))
              ];

              return (
                <button
                  className={`${day.isCurrentMonth ? "day-cell" : "day-cell muted"} ${selectedDate === day.isoDate ? "selected" : ""}`}
                  key={day.isoDate}
                  onClick={() => {
                    setSelectedDate(day.isoDate);
                    if (viewMode === "month" && !day.isCurrentMonth) {
                      setAnchorDate(getMonthStartIso(day.isoDate));
                    }
                    persistCalendarDate(day.isoDate);
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="calendar-day-number">{day.label}</span>
                    {day.isToday ? <span className="today-dot" aria-label="Hoy" /> : null}
                  </div>
                  {isCompactGrid ? (
                    <div className="calendar-event-icons">
                      {visibleDayItems.slice(0, 3).map((item) => {
                        const ItemIcon = item.type === "event"
                          ? getEventIcon(item.occurrence.kind, item.occurrence.title)
                          : NotebookPen;

                        return (
                          <span
                            aria-hidden="true"
                            className={`calendar-event-icon ${item.className}`}
                            key={item.id}
                          >
                            <ItemIcon size={11} strokeWidth={2.5} />
                          </span>
                        );
                      })}
                      {visibleDayItems.length > 3 ? (
                        <span aria-hidden="true" className="calendar-event-icon-more">
                          +{visibleDayItems.length - 3}
                        </span>
                      ) : null}
                      {visibleDayItems.length > 0 ? (
                        <span className="sr-only">{visibleDayItems.map((item) => item.label).join(", ")}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="calendar-event-list">
                      {visibleDayItems.slice(0, 3).map((item) => (
                        <span className={`calendar-event ${item.className}`} key={item.id}>
                          {item.type === "entry" ? "Nota: " : ""}{item.label}
                        </span>
                      ))}
                      {visibleDayItems.length > 3 ? <span className="calendar-event event-review">+{visibleDayItems.length - 3}</span> : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="calendar-day-panel" aria-live="polite">
          <p className="eyebrow text-emerald-800">Detalle del dia</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-moss-950">{formatDisplayDate(selectedDate)}</h3>
          <div className="mt-4 grid gap-3">
            {selectedOccurrences.length > 0 ? (
              selectedOccurrences.map((occurrence) => (
                <CalendarOccurrenceCard
                  key={occurrence.occurrenceId}
                  locale={locale}
                  occurrence={occurrence}
                  onDelete={() => handleDeleteOccurrence(occurrence)}
                  onEdit={() => handleEditOccurrence(occurrence)}
                  onToggle={() => onToggleOccurrence(occurrence.eventId, occurrence.date)}
                  plant={plants.find((plant) => plant.id === occurrence.plantId)}
                />
              ))
            ) : selectedEntries.length > 0 ? (
              <p className="calendar-journal-day-summary">
                <NotebookPen aria-hidden="true" size={16} strokeWidth={2.25} />
                {selectedEntries.length === 1
                  ? "Hay 1 nota de bitacora en este dia."
                  : `Hay ${selectedEntries.length} notas de bitacora en este dia.`}
              </p>
            ) : (
              <p className="rounded-lg border border-moss-950/10 bg-white/70 p-3 text-sm font-bold text-stone-600">
                No hay eventos ni notas para este dia.
              </p>
            )}
          </div>
          <CalendarDayJournal
            entries={selectedEntries}
            onAddJournalEntry={onAddJournalEntry}
            onDeleteJournalEntry={onDeleteJournalEntry}
            onUpdateJournalEntry={onUpdateJournalEntry}
            plants={plants}
            selectedDate={selectedDate}
          />
        </aside>
      </div>
    </section>
  );
}

function CalendarDayJournal({
  entries,
  onAddJournalEntry,
  onDeleteJournalEntry,
  onUpdateJournalEntry,
  plants,
  selectedDate
}: {
  entries: CareEntry[];
  onAddJournalEntry: (entry: CareEntry) => void;
  onDeleteJournalEntry: (entryId: string) => void;
  onUpdateJournalEntry: (entryId: string, updates: JournalEntryUpdates) => void;
  plants: Plant[];
  selectedDate: string;
}) {
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [title, setTitle] = useState("Revision del dia");
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("Revision");

  function handleSave() {
    const trimmedNote = note.trim();

    if (!trimmedNote) return;

    onAddJournalEntry({
      createdAt: selectedDate,
      id: createEventId("entry-calendar"),
      note: trimmedNote,
      plantId: plantId || undefined,
      tags: [tag],
      title: title.trim() || "Revision del dia"
    });
    setNote("");
    setTitle("Revision del dia");
  }

  return (
    <section className="calendar-journal-card mt-4" aria-labelledby="calendar-journal-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-emerald-800">Bitacora</p>
          <h4 className="mt-1 font-black text-moss-950" id="calendar-journal-title">
            Anotar lo que hiciste
          </h4>
        </div>
        <span className="pill pill-soft">Manual</span>
      </div>

      <div className="mt-3 grid gap-2">
        <FormSelect
          label="Planta"
          onChange={setPlantId}
          options={plants.length > 0 ? plants.map((plant) => plant.id) : [""]}
          value={plantId}
          valueLabels={Object.fromEntries(plants.map((plant) => [plant.id, plant.name]))}
        />
        <FormSelect
          label="Tipo de registro"
          onChange={setTag}
          options={["Revision", "Riego", "Poda", "Nutricion", "Plagas", "Limpieza", "Foto", "Otro"]}
          value={tag}
        />
        <FormField label="Titulo" onChange={setTitle} placeholder="Ej. Revision general" value={title} />
        <label className="grid gap-1 text-sm font-black text-moss-950">
          Nota del dia
          <textarea
            aria-label="Nota del dia"
            className="form-control min-h-28"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. Revise humedad, hojas, plagas, riego realizado, poda, fertilizacion o cualquier observacion."
            value={note}
          />
        </label>
        <button className="primary-button" onClick={handleSave} type="button">
          Guardar en bitacora
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <JournalEntryCard
              entry={entry}
              key={entry.id}
              onDelete={onDeleteJournalEntry}
              onUpdate={onUpdateJournalEntry}
              plants={plants}
              variant="compact"
            />
          ))
        ) : (
          <p className="rounded-lg border border-moss-950/10 bg-white/70 p-3 text-sm font-bold text-stone-600">
            Todavia no hay notas guardadas para este dia.
          </p>
        )}
      </div>
    </section>
  );
}

function JournalEntryCard({
  entry,
  onDelete,
  onUpdate,
  plants,
  variant = "timeline"
}: {
  entry: CareEntry;
  onDelete: (entryId: string) => void;
  onUpdate: (entryId: string, updates: JournalEntryUpdates) => void;
  plants: Plant[];
  variant?: "compact" | "timeline";
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(entry.createdAt);
  const [draftNote, setDraftNote] = useState(entry.note);
  const [draftPlantId, setDraftPlantId] = useState(entry.plantId ?? "");
  const [draftTag, setDraftTag] = useState(entry.tags[0] ?? "Revision");
  const [draftTitle, setDraftTitle] = useState(entry.title);
  const plant = plants.find((candidate) => candidate.id === entry.plantId);
  const articleClassName = variant === "compact" ? "calendar-journal-entry" : "journal-photo-card";
  const imageClassName = variant === "compact" ? "calendar-journal-photo" : "journal-photo";

  function resetDrafts() {
    setDraftDate(entry.createdAt);
    setDraftNote(entry.note);
    setDraftPlantId(entry.plantId ?? "");
    setDraftTag(entry.tags[0] ?? "Revision");
    setDraftTitle(entry.title);
  }

  function handleSave() {
    const nextNote = draftNote.trim();

    if (!nextNote) return;

    onUpdate(entry.id, {
      createdAt: draftDate,
      note: nextNote,
      plantId: draftPlantId || undefined,
      tags: [draftTag],
      title: draftTitle.trim() || "Revision del dia"
    });
    setIsEditing(false);
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const photoDataUrl = await readPhotoFileAsDataUrl(file);
      onUpdate(entry.id, { photoDataUrl });
    } catch {
      window.alert("No se pudo cambiar la foto. Proba elegirla desde galeria.");
    }
  }

  function handleRemovePhoto() {
    const confirmed = window.confirm("Quitar la foto de esta entrada?");

    if (!confirmed) return;

    onUpdate(entry.id, { photoDataUrl: undefined });
  }

  function handleDelete() {
    const confirmed = window.confirm(`Eliminar la entrada "${entry.title}" de la bitacora?`);

    if (!confirmed) return;

    onDelete(entry.id);
  }

  return (
    <article className={articleClassName}>
      {entry.photoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={imageClassName} src={entry.photoDataUrl} alt={`Foto de ${entry.title}`} />
      ) : variant === "timeline" ? (
        <div className={imageClassName} aria-label={`Foto pendiente de ${entry.title}`} />
      ) : null}
      <input
        ref={photoInputRef}
        accept="image/*"
        aria-label={`Cambiar foto de ${entry.title}`}
        className="sr-only"
        onChange={handlePhotoChange}
        type="file"
      />
      <div className={variant === "compact" ? "" : "p-3"}>
        {isEditing ? (
          <div className="journal-edit-form">
            <div className="grid gap-2 sm:grid-cols-2">
              <FormField label="Fecha" onChange={setDraftDate} placeholder="AAAA-MM-DD" type="date" value={draftDate} />
              <FormSelect
                label="Planta"
                onChange={setDraftPlantId}
                options={plants.length > 0 ? ["", ...plants.map((item) => item.id)] : [""]}
                value={draftPlantId}
                valueLabels={{
                  "": "Sin planta",
                  ...Object.fromEntries(plants.map((item) => [item.id, item.name]))
                }}
              />
              <FormSelect
                label="Tipo de registro"
                onChange={setDraftTag}
                options={["Revision", "Riego", "Poda", "Nutricion", "Plagas", "Limpieza", "Foto", "Otro"]}
                value={draftTag}
              />
              <FormField label="Titulo" onChange={setDraftTitle} placeholder="Ej. Revision general" value={draftTitle} />
            </div>
            <label className="grid gap-1 text-sm font-black text-moss-950">
              Nota
              <textarea
                aria-label="Editar nota de bitacora"
                className="form-control min-h-28"
                onChange={(event) => setDraftNote(event.target.value)}
                value={draftNote}
              />
            </label>
            <div className="journal-actions">
              <button className="primary-button" onClick={handleSave} type="button">
                Guardar cambios
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  resetDrafts();
                  setIsEditing(false);
                }}
                type="button"
              >
                Cancelar
              </button>
              <button className="secondary-button" onClick={() => photoInputRef.current?.click()} type="button">
                Cambiar foto
              </button>
              {entry.photoDataUrl ? (
                <button className="secondary-button" onClick={handleRemovePhoto} type="button">
                  Quitar foto
                </button>
              ) : null}
              <button className="danger-button" onClick={handleDelete} type="button">
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase text-stone-500">{plant?.name ?? "Sin planta"}</p>
                <h5 className="mt-1 font-black text-moss-950">{entry.title}</h5>
                <p className="mt-1 text-xs font-bold text-stone-500">{entry.createdAt}</p>
              </div>
              <span className="pill pill-blue">{entry.tags[0] ?? "Nota"}</span>
            </div>
            <p className="mt-2 text-sm font-bold leading-6 text-stone-700">{entry.note}</p>
            <div className="journal-actions mt-3">
              <button className="secondary-button" onClick={() => setIsEditing(true)} type="button">
                Editar
              </button>
              <button className="secondary-button" onClick={() => photoInputRef.current?.click()} type="button">
                Cambiar foto
              </button>
              {entry.photoDataUrl ? (
                <button className="secondary-button" onClick={handleRemovePhoto} type="button">
                  Quitar foto
                </button>
              ) : null}
              <button className="danger-button" onClick={handleDelete} type="button">
                Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function CalendarOccurrenceCard({
  locale,
  occurrence,
  onDelete,
  onEdit,
  onToggle,
  plant
}: {
  locale: Locale;
  occurrence: CalendarEventOccurrence;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  plant?: Plant;
}) {
  const googleCalendarUrl = buildGoogleCalendarUrl(occurrence, plant);

  return (
    <article className="calendar-detail-card">
      <div className="flex items-start gap-3">
        {plant ? <PlantAvatar plant={plant} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`event-legend ${getEventClass(occurrence.kind)}`}>{getEventKindLabel(occurrence.kind)}</span>
            <span className={occurrence.completed ? "pill pill-green" : "pill pill-amber"}>
              {occurrence.completed ? "Hecho" : "Pendiente"}
            </span>
          </div>
          <h4 className="mt-2 font-black text-moss-950">{displayEventTitle(occurrence.title)}</h4>
          <p className="mt-1 text-sm font-semibold text-stone-600">{plant?.name ?? "Planta sin detalle"}</p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{occurrence.description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="secondary-button" onClick={onToggle} type="button">
          {occurrence.completed ? "Marcar pendiente" : "Marcar hecho"}
        </button>
        <button className="secondary-button" onClick={onEdit} type="button">
          Editar
        </button>
        <button className="danger-button" onClick={onDelete} type="button">
          Eliminar
        </button>
        {plant ? (
          <Link className="secondary-button" href={`${getInternalSectionHref(locale, "spaces")}#${plant.id}` as Route}>
            Ver planta
          </Link>
        ) : null}
        <a className="secondary-button" href={googleCalendarUrl} rel="noopener noreferrer" target="_blank">
          Agregar a Google Calendar
        </a>
      </div>
    </article>
  );
}

function JournalSection({
  entries,
  onCreateQuickPlant,
  onDeleteJournalEntry,
  onUpdateJournalEntry,
  plants
}: {
  entries: CareEntry[];
  onCreateQuickPlant: (input: QuickPlantInput) => void;
  onDeleteJournalEntry: (entryId: string) => void;
  onUpdateJournalEntry: (entryId: string, updates: JournalEntryUpdates) => void;
  plants: Plant[];
}) {
  const groupedEntries = groupEntriesByPlantAndDate(entries, plants);

  return (
    <section className="mx-auto mt-7 grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
      <Card className="p-4 sm:p-5">
        <SectionHeader eyebrow="Bitacora" title="Observaciones y fotos" />
        <div className="journal-timeline mt-5">
          {groupedEntries.length > 0 ? (
            groupedEntries.map((group) => (
              <section className="journal-group" key={`${group.plantName}-${group.date}`}>
                <div className="journal-date">
                  <PlantStateIcon stage={group.stage} />
                  <div>
                    <p className="font-black text-moss-950">{group.plantName}</p>
                    <p className="text-xs font-bold text-stone-600">{group.date}</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {group.entries.map((entry) => (
                    <JournalEntryCard
                      entry={entry}
                      key={entry.id}
                      onDelete={onDeleteJournalEntry}
                      onUpdate={onUpdateJournalEntry}
                      plants={plants}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <EmptyState
              body="Las notas y fotos que guardes desde el calendario o el diario van a formar el historial de cada planta."
              title="Todavia no hay bitacora"
            />
          )}
        </div>
      </Card>

      <Card as="section" aria-labelledby="new-plant-title" className="p-4 sm:p-5">
        <p className="eyebrow text-emerald-800">Alta rapida</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-moss-950 sm:text-2xl" id="new-plant-title">
          Nueva planta
        </h2>
        <DesktopQuickPlantForm onCreateQuickPlant={onCreateQuickPlant} />
        <MobileQuickPlantWizard onCreateQuickPlant={onCreateQuickPlant} />
      </Card>
    </section>
  );
}

function PrivacySection({
  accountStatus,
  onClearCultivationData,
  onExportData,
  onSaveRemoteSnapshot,
  onSendMagicLink,
  onSignOut
}: {
  accountStatus: AccountStatus;
  onClearCultivationData: () => void;
  onExportData: () => void;
  onSaveRemoteSnapshot: () => void;
  onSendMagicLink: (email: string) => void;
  onSignOut: () => void;
}) {
  const [cleared, setCleared] = useState(false);
  const [email, setEmail] = useState(accountStatus.email);

  function handleClearClick() {
    const confirmed = window.confirm(
      "Esto elimina cultivos, tareas, eventos del calendario y racha guardados en esta demo. No se puede deshacer. ¿Continuar?"
    );

    if (!confirmed) return;

    onClearCultivationData();
    setCleared(true);
  }

  return (
    <section className="mx-auto mt-8 max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Cumplimiento" title="Privacidad y uso legal" />
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <InfoCard
          title="Consentimiento"
          body="El alta del usuario registra mayoria de edad, privacidad y uso exclusivo en jurisdicciones donde el cultivo sea legal."
        />
        <InfoCard
          title="Datos personales"
          body="La ubicacion se guarda como region aproximada. La app incluye base para exportar o eliminar todos los datos del usuario."
        />
        <InfoCard
          title="Limites del producto"
          body="El contenido se limita a seguimiento horticola general, mantenimiento y registro. No incluye guias para maximizar sustancias controladas ni evadir controles."
        />
      </div>
      <UserDataPanel
        accountStatus={accountStatus}
        email={email}
        onEmailChange={setEmail}
        onSaveRemoteSnapshot={onSaveRemoteSnapshot}
        onSendMagicLink={onSendMagicLink}
        onSignOut={onSignOut}
      />
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="secondary-button" onClick={onExportData} type="button">
          Exportar mis datos
        </button>
        <button className="dark-button" onClick={handleClearClick} type="button">
          Eliminar cultivos demo
        </button>
      </div>
      {cleared ? (
        <p className="mt-3 rounded-lg border border-emerald-700/20 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
          Cultivos, tareas y eventos eliminados de esta demo.
        </p>
      ) : null}
    </section>
  );
}

function UserDataPanel({
  accountStatus,
  email,
  onEmailChange,
  onSaveRemoteSnapshot,
  onSendMagicLink,
  onSignOut
}: {
  accountStatus: AccountStatus;
  email: string;
  onEmailChange: (value: string) => void;
  onSaveRemoteSnapshot: () => void;
  onSendMagicLink: (email: string) => void;
  onSignOut: () => void;
}) {
  const isBusy = accountStatus.tone === "pending";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();

    if (!nextEmail) return;

    onSendMagicLink(nextEmail);
  }

  return (
    <section className="account-sync-panel mt-5 scroll-mt-28" id="cuenta" aria-labelledby="account-sync-title">
      <div className="min-w-0">
        <p className="eyebrow text-emerald-800">Login y guardado por usuario</p>
        <h3 className="mt-1 text-xl font-black tracking-tight text-moss-950" id="account-sync-title">
          Iniciar sesion para ver tus datos en otros navegadores
        </h3>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-stone-700">
          Para abrir la app desde otro celular o navegador y ver los mismos cultivos, hay que entrar con email. Te
          llega un enlace de acceso al correo: no hace falta recordar ninguna contrasena.
        </p>
      </div>

      <div className="account-sync-card">
        <span className={accountStatus.isSignedIn ? "pill pill-green" : "pill pill-amber"}>
          {accountStatus.isSignedIn ? "Cuenta conectada" : accountStatus.isConfigured ? "Sin sesion" : "Demo local"}
        </span>
        <AccountFeedback status={accountStatus} />
        {accountStatus.isSignedIn ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="primary-button" disabled={isBusy} onClick={onSaveRemoteSnapshot} type="button">
              {isBusy ? "Guardando..." : "Guardar ahora"}
            </button>
            <button className="secondary-button" onClick={onSignOut} type="button">
              Cerrar sesion
            </button>
            <span className="pill pill-soft">{accountStatus.email}</span>
          </div>
        ) : (
          <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
            <FormField
              label="Email de usuario"
              onChange={onEmailChange}
              placeholder="tu@email.com"
              type="email"
              value={email}
            />
            <button
              className="primary-button self-end"
              disabled={!accountStatus.isConfigured || isBusy}
              type="submit"
            >
              {isBusy ? "Enviando..." : "Iniciar sesion"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function TaskCard({
  isPrimary,
  onToggle,
  plant,
  task
}: {
  isPrimary: boolean;
  onToggle: () => void;
  plant?: Plant;
  task: AgendaItem;
}) {
  return (
    <article className={`${isPrimary ? "task-row task-priority" : "task-row"} ${getTaskAccentClass(task.category)}`} key={task.id}>
      <button className={task.status === "done" ? "task-check done" : "task-check"} onClick={onToggle} type="button">
        {task.status === "done" ? "OK" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black text-moss-950">{displayEventTitle(task.title)}</h3>
          <span className={task.status === "done" ? "pill pill-green" : "pill pill-amber"}>
            {task.status === "done" ? "Hecha" : "Pendiente"}
          </span>
          {isPrimary ? <span className="pill pill-blue">Prioritaria</span> : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-stone-700">{task.description}</p>
        {plant ? <p className="mt-1 text-xs font-black text-stone-500">{plant.name}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-stone-600">
          <span className="pill pill-soft">{task.frequency}</span>
          <span className="pill pill-blue">{task.category}</span>
        </div>
      </div>
    </article>
  );
}

function DesktopQuickPlantForm({ onCreateQuickPlant }: { onCreateQuickPlant: (input: QuickPlantInput) => void }) {
  return (
    <QuickPlantForm className="quick-plant-desktop mt-5 grid gap-3" onCreateQuickPlant={onCreateQuickPlant} />
  );
}

function MobileQuickPlantWizard({ onCreateQuickPlant }: { onCreateQuickPlant: (input: QuickPlantInput) => void }) {
  return (
    <div className="quick-plant-mobile mt-5 grid gap-3">
      <details className="reference-details" open>
        <summary>Alta guiada en 3 pasos</summary>
        <QuickPlantForm className="mt-3 grid gap-3" onCreateQuickPlant={onCreateQuickPlant} />
      </details>
    </div>
  );
}

function QuickPlantForm({
  className,
  onCreateQuickPlant
}: {
  className: string;
  onCreateQuickPlant: (input: QuickPlantInput) => void;
}) {
  const todayIso = getTodayIso();
  const horticultureSeeds = seedCatalog.filter((seed) => seed.recommendationEnabled);
  const [name, setName] = useState("");
  const [seedId, setSeedId] = useState(horticultureSeeds[0]?.id ?? "tomato-roma");
  const [startDate, setStartDate] = useState(todayIso);
  const [region, setRegion] = useState("Buenos Aires, AR");
  const [mode, setMode] = useState<Plant["mode"]>("Exterior");
  const [pot, setPot] = useState("10 L");
  const [potCount, setPotCount] = useState(1);
  const [substrate, setSubstrate] = useState("Organico liviano");
  const [reminderOffset, setReminderOffset] = useState(3);
  const [recurrenceDays, setRecurrenceDays] = useState(0);

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        onCreateQuickPlant({ name, seedId, startDate, region, mode, pot, potCount, substrate, reminderOffset, recurrenceDays });
      }}
    >
      <FormField label="Nombre" onChange={setName} placeholder="Ej. Tomate patio" value={name} />
      <SeedSelect onChange={setSeedId} value={seedId} />
      <FormField label="Fecha de inicio" onChange={setStartDate} placeholder={todayIso} type="date" value={startDate} />
      <FormSelect label="Region aproximada" onChange={setRegion} options={["Buenos Aires, AR", "Region metropolitana", "Otra region"]} value={region} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormSelect label="Maceta" onChange={setPot} options={["5 L", "10 L", "15 L", "20 L", "25 L"]} value={pot} />
        <FormSelect
          label="Cantidad"
          onChange={(value) => setPotCount(Number(value))}
          options={["1", "2", "3", "4", "6", "8"]}
          value={String(potCount)}
          valueLabels={buildPotCountLabels([1, 2, 3, 4, 6, 8])}
        />
        <FormSelect
          label="Sustrato"
          onChange={setSubstrate}
          options={["Organico liviano", "Compost y fibra", "Drenante", "Universal"]}
          value={substrate}
        />
      </div>
      <ModeSelect onChange={setMode} value={mode} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormSelect
          label="Primer recordatorio"
          onChange={(value) => setReminderOffset(Number(value))}
          options={["0", "1", "3", "7"]}
          value={String(reminderOffset)}
          valueLabels={{ "0": "Sin recordatorio", "1": "Manana", "3": "En 3 dias", "7": "En 7 dias" }}
        />
        <FormSelect
          label="Repetir"
          onChange={(value) => setRecurrenceDays(Number(value))}
          options={["0", "3", "7", "14"]}
          value={String(recurrenceDays)}
          valueLabels={{ "0": "No repetir", "3": "Cada 3 dias", "7": "Cada 7 dias", "14": "Cada 14 dias" }}
        />
      </div>
      <button className="primary-button" type="submit">
        Guardar y crear eventos
      </button>
    </form>
  );
}

// Avatar de cuenta del encabezado. Abre la ventana de login en el momento, en
// vez de mandar a otra pantalla y hacer bajar hasta el formulario.
function AccountAvatarButton({
  accountStatus,
  onOpen
}: {
  accountStatus: AccountStatus;
  onOpen: () => void;
}) {
  const trimmedEmail = accountStatus.email.trim();
  const initial = accountStatus.isSignedIn && trimmedEmail ? trimmedEmail.charAt(0).toUpperCase() : "";
  const label = accountStatus.isSignedIn
    ? `Cuenta conectada como ${trimmedEmail}. Abrir opciones de tu cuenta.`
    : "Iniciar sesion para ver tus cultivos en otros dispositivos";

  return (
    <button
      aria-haspopup="dialog"
      aria-label={label}
      className={accountStatus.isSignedIn ? "account-avatar is-signed-in" : "account-avatar"}
      onClick={onOpen}
      title={label}
      type="button"
    >
      {initial ? (
        <span aria-hidden="true" className="account-avatar-initial">
          {initial}
        </span>
      ) : (
        <svg aria-hidden="true" className="account-avatar-icon" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8.4" r="3.5" stroke="currentColor" strokeWidth="1.9" />
          <path
            d="M5 19.4c0-3.3 3.1-5.4 7-5.4s7 2.1 7 5.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.9"
          />
        </svg>
      )}
    </button>
  );
}

// Ventana de cuenta. Antes el avatar llevaba a la seccion Privacidad y habia
// que bajar hasta encontrar el formulario; ahora el login queda a un toque.
function AccountDialog({
  accountStatus,
  onClose,
  onCreateShareCode,
  onOpenSharedView,
  onRedeemShareCode,
  onSaveRemoteSnapshot,
  onSendMagicLink,
  onSignOut,
  privacyHref,
  shareCode,
  shareMessage,
  sharedViews
}: {
  accountStatus: AccountStatus;
  onClose: () => void;
  onCreateShareCode: () => void;
  onOpenSharedView: (share: SharedView) => void;
  onRedeemShareCode: (code: string) => void;
  onSaveRemoteSnapshot: () => void;
  onSendMagicLink: (email: string) => void;
  onSignOut: () => void;
  privacyHref: Route;
  shareCode: string;
  shareMessage: string;
  sharedViews: SharedView[];
}) {
  const [email, setEmail] = useState(accountStatus.email);
  const [codeInput, setCodeInput] = useState("");
  const emailFieldRef = useRef<HTMLInputElement>(null);
  const isBusy = accountStatus.tone === "pending";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    // Se bloquea el scroll del fondo para que la pagina no se mueva detras.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    emailFieldRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();

    if (!nextEmail) return;

    onSendMagicLink(nextEmail);
  }

  return (
    <div
      className="account-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div aria-labelledby="account-dialog-title" aria-modal="true" className="account-dialog" role="dialog">
        <button aria-label="Cerrar" className="account-dialog-close" onClick={onClose} type="button">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M6.5 6.5l11 11m0-11l-11 11" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>

        <p className="account-dialog-eyebrow">Tu cuenta</p>
        <h2 className="account-dialog-title" id="account-dialog-title">
          {accountStatus.isSignedIn ? "Sesion iniciada" : "Iniciar sesion"}
        </h2>

        {accountStatus.isSignedIn ? (
          <>
            <p className="account-dialog-text">
              Tus cultivos se guardan en tu cuenta, asi los ves igual en el celular y en la computadora.
            </p>
            <p className="account-dialog-email">{accountStatus.email}</p>
            <AccountFeedback status={accountStatus} />
            <div className="account-dialog-actions">
              <button className="primary-button" disabled={isBusy} onClick={onSaveRemoteSnapshot} type="button">
                {isBusy ? "Guardando..." : "Guardar ahora"}
              </button>
              <button className="secondary-button" onClick={onSignOut} type="button">
                Cerrar sesion
              </button>
            </div>

            <div className="account-share">
              <p className="account-share-title">Compartir tus cultivos</p>
              <p className="account-share-hint">
                Genera un codigo y pasaselo a quien quieras. Va a poder mirar tus cultivos, no modificarlos.
              </p>

              {shareCode ? (
                <p className="account-share-code">{shareCode}</p>
              ) : (
                <button className="secondary-button account-share-button" onClick={onCreateShareCode} type="button">
                  Generar codigo
                </button>
              )}

              <p className="account-share-title account-share-title-second">Ver los de otra persona</p>
              <form
                className="account-share-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!codeInput.trim()) return;
                  onRedeemShareCode(codeInput);
                  setCodeInput("");
                }}
              >
                <input
                  aria-label="Codigo que te compartieron"
                  className="form-control"
                  onChange={(event) => setCodeInput(event.target.value)}
                  placeholder="Pega el codigo aca"
                  type="text"
                  value={codeInput}
                />
                <button className="secondary-button" disabled={!codeInput.trim()} type="submit">
                  Usar codigo
                </button>
              </form>

              {sharedViews.length > 0 ? (
                <ul className="account-share-list">
                  {sharedViews.map((view) => (
                    <li key={view.ownerId}>
                      <button className="account-share-open" onClick={() => onOpenSharedView(view)} type="button">
                        Ver los cultivos de {view.ownerLabel}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {shareMessage ? (
                <p className="account-share-message" role="status">
                  {shareMessage}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="account-dialog-text">
              Entra con tu email y te mandamos un enlace de acceso. No hace falta recordar ninguna contrasena.
            </p>
            <AccountFeedback status={accountStatus} />
            <form className="account-dialog-form" onSubmit={handleSubmit}>
              <label className="account-dialog-label" htmlFor="account-dialog-email">
                Email
              </label>
              <input
                autoComplete="email"
                className="form-control"
                id="account-dialog-email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                ref={emailFieldRef}
                type="email"
                value={email}
              />
              <button className="primary-button" disabled={!accountStatus.isConfigured || isBusy} type="submit">
                {isBusy ? "Enviando..." : "Enviarme el enlace"}
              </button>
            </form>
          </>
        )}

        <Link className="account-dialog-link" href={privacyHref} onClick={onClose}>
          Ver privacidad y datos
        </Link>
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setStatus("");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installEvent) {
      setStatus("En el celu: menu del navegador > Agregar a pantalla de inicio.");
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    setStatus(choice.outcome === "accepted" ? "Acceso directo creado." : "Instalacion cancelada.");
    setInstallEvent(null);
  }

  return (
    <span className="install-app-wrapper">
      <button className="secondary-button install-app-button" onClick={handleInstall} type="button">
        Instalar app
      </button>
      {status ? <span className="install-app-status">{status}</span> : null}
    </span>
  );
}

function getInitialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function ThemeToggle() {
  // El atributo data-theme ya lo aplica ThemeScript antes de hidratar (ver
  // components/theme-script.tsx), asi que alcanza con leerlo del DOM en el
  // inicializador perezoso de useState en vez de sincronizarlo en un
  // efecto. Para quien vuelve con modo oscuro guardado puede haber un
  // mismatch de hidratacion puntual en este boton (icono/aria-label);
  // React lo resuelve solo, es el mismo tradeoff que usan la mayoria de
  // los toggles de tema.
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  // La hidratacion de React sobre <html> no conoce data-theme (no forma
  // parte del JSX del layout) y lo saca apenas termina de hidratar, aunque
  // ThemeScript lo haya puesto antes. Este efecto vuelve a aplicarlo (y
  // guarda la preferencia) cada vez que cambia el estado, incluida la
  // primera vez despues de montar: es el uso correcto de un efecto, un
  // sistema externo (el DOM, localStorage) sincronizado con el estado de
  // React, no al reves.
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    window.localStorage.setItem("pc-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return (
    <button
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={theme === "dark"}
      className="header-theme-button"
      onClick={toggleTheme}
      suppressHydrationWarning
      type="button"
    >
      {theme === "dark" ? <Sun aria-hidden="true" size={17} strokeWidth={2.5} /> : <MoonStar aria-hidden="true" size={17} strokeWidth={2.5} />}
    </button>
  );
}

const localeShortLabel: Record<Locale, string> = { en: "EN", es: "ES" };
const localeFullLabel: Record<Locale, string> = { en: "English", es: "Español" };

/**
 * Cada seccion tiene un slug distinto por idioma (Hoy/Today, Espacios/Spaces,
 * etc.), asi que cambiar de idioma no es solo cambiar "/es/" por "/en/" en la
 * URL: hay que resolver la seccion actual contra el slug del OTRO idioma.
 * getInternalSectionHref ya hace exactamente eso.
 */
function LocaleSwitcher({ currentSection, locale }: { currentSection: AppSection; locale: Locale }) {
  return (
    <div aria-label="Idioma" className="header-locale-switcher" role="group">
      {locales.map((item) => (
        <Link
          aria-current={item === locale ? "true" : undefined}
          className={item === locale ? "header-locale-option active" : "header-locale-option"}
          href={getInternalSectionHref(item, currentSection) as Route}
          key={item}
          title={localeFullLabel[item]}
        >
          {localeShortLabel[item]}
        </Link>
      ))}
    </div>
  );
}

function BrandLogo() {
  return (
    <span className="brand-logo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${assetBasePath}/favicon.png`} alt="" />
    </span>
  );
}

function LeafCluster({ variant }: { variant: "hero" | "soft" }) {
  return (
    <svg className={`leaf-cluster ${variant}`} viewBox="0 0 220 150" role="img">
      <defs>
        <linearGradient id={`leaf-gradient-${variant}`} x1="22" x2="190" y1="18" y2="142">
          <stop stopColor="#6f8f2f" />
          <stop offset="0.52" stopColor="#24766f" />
          <stop offset="1" stopColor="#e2b457" />
        </linearGradient>
      </defs>
      <path
        d="M109 126c-3-31-3-58 0-92m0 43c-28-25-54-34-82-28 16 28 39 43 74 43m10-16c29-25 55-34 83-28-16 28-40 43-75 43m-14-35C91 27 74 12 48 7c1 31 18 54 52 66m24-17c14-29 31-44 57-49-1 31-18 54-52 66m-18-20c-2-31 4-55 19-73 18 28 18 54-2 81"
        fill="none"
        stroke={`url(#leaf-gradient-${variant})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
      />
      <circle cx="178" cy="30" r="16" fill="#fff0c8" opacity="0.92" />
      <circle cx="39" cy="112" r="10" fill="#dff1f1" opacity="0.95" />
    </svg>
  );
}

function SectionStepper({
  locale,
  nextItem,
  previousItem
}: {
  locale: Locale;
  nextItem: NavigationItem | null;
  previousItem: NavigationItem | null;
}) {
  return (
    <nav className="section-stepper" aria-label="Avanzar entre secciones">
      {previousItem ? (
        <Link className="stepper-button secondary" href={getInternalSectionHref(locale, previousItem.key) as Route}>
          <span aria-hidden="true">←</span>
          <span>
            <small>Anterior</small>
            {previousItem.label}
          </span>
        </Link>
      ) : (
        <span className="stepper-button disabled" aria-disabled="true">
          <span aria-hidden="true">←</span>
          <span>
            <small>Anterior</small>
            Inicio
          </span>
        </span>
      )}

      {nextItem ? (
        <Link className="stepper-button primary" href={getInternalSectionHref(locale, nextItem.key) as Route}>
          <span>
            <small>Siguiente</small>
            {nextItem.label}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <Link className="stepper-button primary" href={getInternalSectionHref(locale, "today") as Route}>
          <span>
            <small>Volver</small>
            Hoy
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </nav>
  );
}

function MiniStat({
  description,
  featured = false,
  href,
  label,
  onSelect,
  value
}: {
  description: string;
  featured?: boolean;
  href?: Route;
  label: string;
  onSelect?: () => void;
  value: string;
}) {
  const className = featured ? "metric-card featured" : "metric-card";
  const content = (
    <>
      {/*
        La card "featured" fuerza sus propios colores por CSS con reglas
        !important mas viejas que esto (`.metric-card.featured p:first-child`
        y `main .uppercase`), asi que no hace falta pisarlas aca. La clase
        `uppercase` se deja puesta a proposito, aunque `.text-label` ya la
        aplique por CSS: esa clase es justamente lo que la regla vieja usa
        para reconocer el texto y ponerlo legible sobre el fondo oscuro. Sacarla
        dejaba la etiqueta en blanco sobre blanco (bug real que aparecio al
        probar este cambio).
      */}
      <p className="text-value text-moss-950">{value}</p>
      <p className="mt-1 text-label uppercase">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link className={className} href={href} title={description} aria-label={`${label}: ${value}. ${description}`}>
        {content}
      </Link>
    );
  }

  if (onSelect) {
    return (
      <button
        aria-label={`${label}: ${value}. ${description}`}
        className={className}
        onClick={onSelect}
        title={description}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} title={description} aria-label={`${label}: ${value}. ${description}`}>
      {content}
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="eyebrow text-emerald-800">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-moss-950 sm:text-2xl">{title}</h2>
    </div>
  );
}

function PlantAvatar({ plant }: { plant: Plant }) {
  return (
    <span className="plant-avatar" aria-hidden="true">
      <PlantStateIcon stage={plant.stage} />
    </span>
  );
}

function PlantStateIcon({ stage }: { stage: string }) {
  const currentStage = getPlantStage(stage);

  return (
    <span className={`plant-state-icon ${currentStage}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function PlantStageProgress({ plant }: { plant: Plant }) {
  const stages = ["Semilla", "Vegetativo", "Floracion", "Cosecha"];
  const currentIndex = getPlantStageIndex(plant.stage);

  return (
    <div className="plant-progress" aria-label={`Etapa declarada de ${plant.name}: ${plant.stage}`}>
      <div className="mt-4 flex items-center justify-between gap-2">
        {stages.map((stage, index) => (
          <div className="plant-progress-step" key={stage}>
            <span className={index <= currentIndex ? "plant-progress-dot active" : "plant-progress-dot"} />
            <span>{stage}</span>
          </div>
        ))}
      </div>
      <div className="plant-progress-track">
        <span style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }} />
      </div>
    </div>
  );
}

function PlantUtilityPanel({
  calendarEvents,
  entries,
  plant
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  plant: Plant;
}) {
  const todayIso = getTodayIso();
  const nextEvent = getNextDeclaredEvent(plant.id, calendarEvents, todayIso);
  const lastEntry = getLastCareEntry(plant.id, entries);

  return (
    <div className="plant-utility-panel">
      <div className="plant-utility-card featured">
        <p className="text-[11px] font-black uppercase text-stone-500">Proxima accion declarada</p>
        <p className="mt-1 font-black text-moss-950">{nextEvent?.title ?? "Sin eventos proximos"}</p>
        <p className="mt-1 text-sm text-stone-600">
          {nextEvent ? `${nextEvent.startDate} - ${getDaysUntilLabel(nextEvent.startDate, todayIso)}` : "Creala desde Semillas o Calendario"}
        </p>
      </div>
      <div className="plant-utility-card">
        <p className="text-[11px] font-black uppercase text-stone-500">Ultimo registro</p>
        <p className="mt-1 font-black text-moss-950">{lastEntry?.title ?? "Sin entradas todavia"}</p>
        <p className="mt-1 text-sm text-stone-600">{lastEntry?.createdAt ?? "Usa Diario para agregar fotos y notas"}</p>
      </div>
    </div>
  );
}

function PlantFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase text-stone-500">{label}</dt>
      <dd className="mt-1 break-words font-bold leading-snug text-moss-950">{value}</dd>
    </div>
  );
}

function SeedSelect({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const horticultureSeeds = seedCatalog.filter((seed) => seed.recommendationEnabled);

  return (
    <label className="grid gap-1 text-sm font-black text-moss-950">
      Variedad o semilla
      <select aria-label="Variedad o semilla" className="form-control" value={value} onChange={(event) => onChange(event.target.value)}>
        {horticultureSeeds.map((seed) => (
          <option key={seed.id} value={seed.id}>
            {seed.crop} - {seed.name}{seed.regulated ? " · legal/regulado" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeSelect({ onChange, value }: { onChange: (value: Plant["mode"]) => void; value: Plant["mode"] }) {
  return (
    <label className="grid gap-1 text-sm font-black text-moss-950">
      Modalidad
      <select aria-label="Modalidad" className="form-control" value={value} onChange={(event) => onChange(event.target.value as Plant["mode"])}>
        <option>Exterior</option>
        <option>Interior</option>
        <option>Invernadero</option>
      </select>
    </label>
  );
}

function FormField({
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "date" | "email" | "text";
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-black text-moss-950">
      {label}
      <input
        aria-label={label}
        className="form-control"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function FormSelect({
  label,
  onChange,
  options,
  value,
  valueLabels
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
  valueLabels?: Record<string, string>;
}) {
  return (
    <label className="grid gap-1 text-sm font-black text-moss-950">
      {label}
      <select aria-label={label} className="form-control" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {valueLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="info-card p-5">
      <h3 className="font-black text-moss-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">{body}</p>
    </article>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <article className="empty-state">
      <span aria-hidden="true">✦</span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  );
}

function getTaskPriority(task: AgendaItem) {
  if (task.status === "done") return 10;
  if (task.category === "Riego") return 0;
  if (task.category === "Registro") return 1;
  return 2;
}

function getTaskAccentClass(category: Task["category"]) {
  if (category === "Riego") return "task-accent-water";
  if (category === "Registro") return "task-accent-photo";
  if (category === "Mantenimiento") return "task-accent-clean";
  return "task-accent-review";
}

function getEventClass(kind: CalendarEventOccurrence["kind"]) {
  if (kind === "watering") return "event-water";
  if (kind === "photo") return "event-photo";
  if (kind === "cleaning") return "event-clean";
  return "event-review";
}

/**
 * Icono lineal que representa al evento en la vista compacta del calendario.
 *
 * `kind` solo distingue watering/photo/cleaning/review, y review cubre poda,
 * defoliar, fumigar y fotoperiodo por igual: sin mirar el titulo esos cuatro
 * se verian identicos. Por eso primero se busca la primera palabra del
 * titulo (normalizada, sin acentos ni simbolos) en `eventIconKeyByFirstWord`;
 * esto funciona tanto para titulos nuevos ("Poda") como para los que se
 * guardaron antes de este cambio con un emoji adelante ("✂️ Poda"), porque
 * `normalizeCalendarTitle` descarta el emoji igual. Si no reconoce la
 * palabra (el usuario le puso otro nombre a la tarea) cae a un icono por
 * `kind`, con Eye como generico para "review".
 */
function getEventIcon(kind: CalendarEventOccurrence["kind"], title: string): LucideIcon {
  const firstWord = normalizeCalendarTitle(title).split(" ")[0] ?? "";
  const iconKey = eventIconKeyByFirstWord[firstWord];

  if (iconKey) return eventIconComponents[iconKey];
  if (kind === "watering") return eventIconComponents.watering;
  if (kind === "photo") return eventIconComponents.photo;
  if (kind === "cleaning") return eventIconComponents.cleaning;

  return Eye;
}

/**
 * Titulo listo para mostrar como texto (encabezados de tarjeta, no el icono).
 *
 * Los eventos guardados antes de este cambio tienen el emoji adelante del
 * titulo ("💧 Riego"): ahora que ese emoji se reemplazo por un icono lineal
 * en el calendario, dejarlo tambien en el texto del titulo se ve fuera de
 * lugar. Esto lo saca solo cuando el primer token es justo ese simbolo
 * decorativo, sin tocar el resto del titulo ni el dato guardado.
 */
function displayEventTitle(title: string) {
  const trimmed = title.trim();
  const firstToken = trimmed.split(/\s+/)[0] ?? "";

  if (firstToken && !/[\p{L}\p{N}]/u.test(firstToken)) {
    return trimmed.slice(firstToken.length).trim() || trimmed;
  }

  return trimmed;
}

function hasDuplicateCalendarAction(occurrences: CalendarEventOccurrence[], actionLabel: string) {
  const normalizedAction = normalizeCalendarTitle(actionLabel);

  return occurrences.some((occurrence) => normalizeCalendarTitle(occurrence.title).includes(normalizedAction));
}

function normalizeCalendarTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildAgendaItems(tasks: Task[], occurrences: CalendarEventOccurrence[]): AgendaItem[] {
  const taskItems: AgendaItem[] = tasks.map((task) => ({
    category: task.category,
    description: task.description,
    frequency: task.frequency,
    id: task.id,
    plantId: task.plantId,
    source: "task",
    status: task.status,
    title: task.title
  }));
  const eventItems: AgendaItem[] = occurrences.map((occurrence) => ({
    category: eventKindToTaskCategory(occurrence.kind),
    description: occurrence.description,
    eventId: occurrence.eventId,
    frequency: "Manual",
    id: occurrence.occurrenceId,
    occurrenceDate: occurrence.date,
    plantId: occurrence.plantId,
    source: "event",
    status: occurrence.completed ? "done" : "open",
    title: occurrence.title
  }));

  return [...taskItems, ...eventItems].sort((first, second) => getTaskPriority(first) - getTaskPriority(second));
}

function eventKindToTaskCategory(kind: CalendarEventOccurrence["kind"]): Task["category"] {
  if (kind === "watering") return "Riego";
  if (kind === "cleaning") return "Mantenimiento";
  if (kind === "photo") return "Registro";
  return "Observacion";
}

function getNextDeclaredEvent(plantId: string, events: CalendarEvent[], todayIso: string) {
  return events
    .filter((event) => event.plantId === plantId && event.startDate >= todayIso)
    .sort((first, second) => first.startDate.localeCompare(second.startDate))[0];
}

function getLastCareEntry(plantId: string, entries: CareEntry[]) {
  return entries
    .filter((entry) => entry.plantId === plantId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
}

function getDaysUntilLabel(targetIso: string, todayIso: string) {
  const diff = new Date(`${targetIso}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime();
  const days = Math.ceil(diff / 86_400_000);

  if (days === 0) return "hoy";
  if (days === 1) return "manana";
  return `en ${days} dias`;
}

function formatDisplayDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00`));
}

function formatMonthPeriod(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric"
  }).format(parseIsoDate(getMonthStartIso(isoDate)));
}

function firstVisibleWeekDate(anchorIsoDate: string) {
  const date = parseIsoDate(anchorIsoDate);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);

  return toIsoDate(date);
}

function buildGoogleCalendarUrl(occurrence: CalendarEventOccurrence, plant?: Plant) {
  const startDate = formatGoogleCalendarDate(occurrence.date);
  const endDate = formatGoogleCalendarDate(offsetDate(occurrence.date, 1));
  const details = [
    occurrence.description,
    plant ? `Planta: ${plant.name}` : "",
    "Creado desde PlantCare Calendar. Evento declarado manualmente por el usuario."
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    dates: `${startDate}/${endDate}`,
    details,
    text: `PlantCare: ${occurrence.title}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatGoogleCalendarDate(isoDate: string) {
  return isoDate.replaceAll("-", "");
}

function offsetDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function toggleEventCompletion(events: CalendarEvent[], eventId: string, date: string) {
  return events.map((event) => {
    if (event.id !== eventId) return event;

    const isCompleted = event.completedDates.includes(date);

    return {
      ...event,
      completedDates: isCompleted
        ? event.completedDates.filter((completedDate) => completedDate !== date)
        : [...event.completedDates, date]
    };
  });
}

function groupEntriesByPlantAndDate(entries: CareEntry[], plants: Plant[]) {
  const groups = new Map<string, { date: string; entries: CareEntry[]; plantName: string; stage: string }>();

  entries.forEach((entry) => {
    const plant = plants.find((candidate) => candidate.id === entry.plantId);
    const plantName = plant?.name ?? "Sin planta";
    const stage = plant?.stage ?? "Semilla";
    const key = `${plantName}-${entry.createdAt}`;
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.entries.push(entry);
      return;
    }

    groups.set(key, {
      date: entry.createdAt,
      entries: [entry],
      plantName,
      stage
    });
  });

  return Array.from(groups.values()).sort((first, second) => second.date.localeCompare(first.date));
}

function getElapsedDays(startedAt: string, todayIso: string) {
  const diff = new Date(`${todayIso}T00:00:00`).getTime() - new Date(`${startedAt}T00:00:00`).getTime();

  return Math.max(0, Math.floor(diff / 86_400_000));
}

function findGeneticByPlant(plant: Plant) {
  const lookupValues = [plant.variety, plant.name].map(normalizeLookupText).filter(Boolean);
  const exactMatch = geneticsCatalogAlphabetically.find((genetic) =>
    lookupValues.some((value) => normalizeLookupText(genetic.name) === value)
  );

  if (exactMatch) return exactMatch;

  return geneticsCatalogAlphabetically.find((genetic) => {
    const geneticName = normalizeLookupText(genetic.name);
    return lookupValues.some((value) => value.length >= 4 && (geneticName.includes(value) || value.includes(geneticName)));
  });
}

function formatGeneticType(type: GeneticReferenceEntry["type"]) {
  if (type === "autoflowering") return "Automatica";
  if (type === "faster_flowering") return "Rapida";
  if (type === "regular") return "Regular";
  return "Feminizada";
}

function formatRange([min, max]: [number, number], unit: string) {
  return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;
}

function formatThcRange([min, max]: [number, number]) {
  if (min === 0 && max === 0) return "No declarado";
  return min === max ? `${min}%` : `${min}-${max}%`;
}

function getPlantPotLiters(pot: string) {
  const match = pot.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;

  return Number(match[1].replace(",", "."));
}

function getPlantLightType(lighting: string): HorticulturePlanInput["lightType"] | undefined {
  const normalizedLighting = normalizeLookupText(lighting);

  if (!normalizedLighting) return undefined;
  if (normalizedLighting.includes("led") || normalizedLighting.includes("artificial")) return "led";
  if (normalizedLighting.includes("sol")) return "sun";
  if (normalizedLighting.includes("mixta") || normalizedLighting.includes("mixto")) return "mixed";

  return undefined;
}

function getPlantIndoorSize(plant: Plant): HorticulturePlanInput["indoorSize"] | undefined {
  if (plant.mode !== "Interior") return "large";

  const setupText = normalizeLookupText(`${plant.setup ?? ""} ${plant.pot ?? ""}`);
  const centimeterMatch = setupText.match(/(?:^|\D)(60|80|100|120|150|200)(?:\D|$)/);

  if (!centimeterMatch) return undefined;

  const size = Number(centimeterMatch[1]);
  if (size <= 80) return "small";
  if (size <= 120) return "medium";
  return "large";
}

function getSeedProfileIdForPlant(plant: Plant, genetic?: GeneticReferenceEntry) {
  const lookupValues = [plant.variety, plant.name].map(normalizeLookupText).filter(Boolean);
  const exactSeed = seedCatalog.find((seed) =>
    lookupValues.some((value) => normalizeLookupText(seed.name) === value || normalizeLookupText(seed.crop) === value)
  );

  if (exactSeed) return exactSeed.id;
  if (!genetic) return "regulated-manual";
  if (genetic.type === "autoflowering") return "cannabis-autoflowering";
  if (genetic.type === "regular") return "cannabis-photoperiod-regular";
  return "cannabis-photoperiod-feminized";
}

function formatDataOrigin(origin: string) {
  if (origin === "catalog") return "catalogo";
  if (origin === "calculated") return "calculado";
  if (origin === "measurement") return "medicion";
  if (origin === "suggestion") return "sugerencia";
  if (origin === "user") return "usuario";
  return "faltante";
}

function buildPotCountLabels(counts: number[]) {
  return Object.fromEntries(counts.map((count) => [String(count), `${count} maceta${count === 1 ? "" : "s"}`]));
}

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getReferenceTargetLabel(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("floracion") || normalizedLabel.includes("ciclo")) return "Semanas de floracion";
  if (normalizedLabel.includes("flora")) return "Dias a flora";
  if (normalizedLabel.includes("maceta")) return "Maceta en litros";
  if (normalizedLabel.includes("luz")) return "Tipo de luz";
  if (normalizedLabel.includes("tipo") || normalizedLabel.includes("variante")) return "Tipo declarado";
  if (normalizedLabel.includes("cruza") || normalizedLabel.includes("linaje")) return "Nota de genetica";
  if (normalizedLabel.includes("thc")) return "Nota de referencia";
  if (normalizedLabel.includes("fuente")) return "Nota de fuente";
  if (normalizedLabel.includes("riego")) return "Nota de riego manual";
  return "Nota manual";
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getPlantStage(stage: string) {
  const normalizedStage = stage.toLowerCase();

  if (normalizedStage.includes("cosecha") || normalizedStage.includes("seca") || normalizedStage.includes("curad")) return "harvest";
  if (normalizedStage.includes("flora") || normalizedStage.includes("flor")) return "flower";
  if (normalizedStage.includes("crec") || normalizedStage.includes("veget")) return "leaf";
  return "sprout";
}

function getPlantStageIndex(stage: string) {
  const currentStage = getPlantStage(stage);

  if (currentStage === "harvest") return 3;
  if (currentStage === "flower") return 2;
  if (currentStage === "leaf") return 1;
  return 0;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getLocalDateTimeValue() {
  const now = new Date();
  const offsetAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return offsetAdjusted.toISOString().slice(0, 16);
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const offsetAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetAdjusted.toISOString().slice(0, 16);
}

function formatMeasurementDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatMeasurementAge(value: string) {
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (elapsedDays === 0) return "hoy";
  if (elapsedDays === 1) return "hace 1 día";
  return `hace ${elapsedDays} días`;
}

function formatMeasurementSource(source: PlantMeasurement["source"]) {
  if (source === "sensor") return "Sensor";
  if (source === "device") return "Dispositivo";
  return "Carga manual";
}

function getStreakCount(habitDates: string[], todayIso: string) {
  const uniqueDates = new Set(habitDates);
  let count = 0;
  let cursor = todayIso;

  while (uniqueDates.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}

function readPhotoFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No se pudo leer la foto seleccionada."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("No se pudo leer la foto seleccionada.")));
    reader.readAsDataURL(file);
  });
}

function useStoredState<T>(key: string, initialState: T) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(key);

      if (storedValue) {
        setState(JSON.parse(storedValue) as T);
      }
    } finally {
      setHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(key, JSON.stringify(state));
    }
  }, [hydrated, key, state]);

  return [state, setState] as const;
}

function goToCalendar(selectedDate: string, locale: Locale) {
  persistCalendarDate(selectedDate);
  window.location.assign(getSectionHref(locale, "calendar"));
}

function getStoredCalendarDate(fallbackDate: string) {
  if (typeof window === "undefined") {
    return fallbackDate;
  }

  return window.localStorage.getItem(storageKeys.calendarDate) ?? fallbackDate;
}

function getStoredWeatherSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(storageKeys.weatherSnapshot);

    return storedValue ? (JSON.parse(storedValue) as WeatherReadiness) : null;
  } catch {
    return null;
  }
}

function persistStoredState<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function removeStoredState(key: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}

function persistCalendarDate(selectedDate: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKeys.calendarDate, selectedDate);
  }
}
