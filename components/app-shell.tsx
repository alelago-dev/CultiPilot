"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CopyValueButton } from "@/components/copy-button";
import { GeneticFinderWizard } from "@/components/genetic-finder-wizard";
import { PlantTimeline } from "@/components/plant-timeline";
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
import { getSectionHref, navigationByLocale, type AppSection, type NavigationItem } from "@/lib/navigation";
import { getGeneticsCatalogAlphabetically, type GeneticReferenceEntry } from "@/lib/genetics-catalog";
import { requestReminderNotification } from "@/lib/notifications";
import { seedCatalog } from "@/lib/seed-catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type {
  CalendarEvent,
  CalendarEventKind,
  CalendarEventOccurrence,
  CareEntry,
  Dictionary,
  GrowSpace,
  Locale,
  Plant,
  Task
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
  entries: CareEntry[];
  events: CalendarEvent[];
  habitDates: string[];
  plants: Plant[];
  savedAt: string;
  tasks: Task[];
};

type AccountStatus = {
  email: string;
  isConfigured: boolean;
  isSignedIn: boolean;
  message: string;
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
const calendarQuickActions: Array<{
  description: string;
  emoji: string;
  kind: CalendarEventKind;
  label: string;
  title: string;
}> = [
  {
    description: "Evento manual agregado desde el calendario para revisar riego.",
    emoji: "💧",
    kind: "watering",
    label: "Riego",
    title: "💧 Riego"
  },
  {
    description: "Evento manual agregado desde el calendario para registrar una foto.",
    emoji: "📷",
    kind: "photo",
    label: "Foto",
    title: "📷 Foto"
  },
  {
    description: "Evento manual agregado desde el calendario para limpieza o mantenimiento.",
    emoji: "🧹",
    kind: "cleaning",
    label: "Limpieza",
    title: "🧹 Limpieza"
  },
  {
    description: "Evento manual agregado desde el calendario para poda declarada por el usuario.",
    emoji: "✂️",
    kind: "review",
    label: "Poda",
    title: "✂️ Poda"
  },
  {
    description: "Evento manual agregado desde el calendario para defoliar o quitar hojas segun decision del usuario.",
    emoji: "🍃",
    kind: "review",
    label: "Defoliar",
    title: "🍃 Defoliar"
  },
  {
    description: "Evento manual agregado desde el calendario para revision o fumigacion declarada por el usuario.",
    emoji: "🐛",
    kind: "review",
    label: "Fumigar",
    title: "🐛 Fumigar"
  }
];
const storageKeys = {
  calendarDate: "plantcare-calendar-selected-date",
  entries: "plantcare-journal-entries",
  events: "plantcare-calendar-events",
  habitDates: "plantcare-habit-dates",
  onboarding: "plantcare-onboarding-complete",
  plants: "plantcare-plants",
  quickChecks: "plantcare-quick-checks",
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
  const [taskState, setTaskState] = useStoredState(storageKeys.tasks, tasks);
  const [eventState, setEventState] = useStoredState(storageKeys.events, calendarEvents);
  const [entryState, setEntryState] = useStoredState(storageKeys.entries, entries);
  const [habitDates, setHabitDates] = useStoredState<string[]>(storageKeys.habitDates, []);
  const [weather, setWeather] = useState<WeatherReadiness>(() => getStoredWeatherSnapshot() ?? getWeatherReadiness("Ubicacion sin conectar"));
  const [weatherStatus, setWeatherStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(() => ({
    email: "",
    isConfigured: isSupabaseConfigured(),
    isSignedIn: false,
    message: isSupabaseConfigured()
      ? "Conecta una cuenta para guardar datos por usuario."
      : "Demo local: falta configurar Supabase para sincronizar entre navegadores.",
    userId: ""
  }));
  const [remoteSyncReady, setRemoteSyncReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(storageKeys.onboarding) !== "true"
  );
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
  const todayHref = getSectionHref(locale, "today");
  const calendarHref = getSectionHref(locale, "calendar");
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
      entries: entryState,
      events: eventState,
      habitDates,
      plants: plantState,
      savedAt: new Date().toISOString(),
      tasks: taskState
    };
  }

  function applySnapshot(snapshot: Partial<AppSnapshot>) {
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
  }

  async function saveRemoteSnapshot(nextSnapshot = getCurrentSnapshot()) {
    if (!accountStatus.userId || !isSupabaseConfigured()) return;

    try {
      const supabase = getSupabaseBrowserClient() as unknown as SnapshotTableClient;
      const { error } = await supabase.from("user_app_snapshots").upsert({
        key: remoteSnapshotKey,
        payload: nextSnapshot as unknown as Json,
        user_id: accountStatus.userId
      });

      if (error) throw error;

      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "Datos guardados por usuario."
      }));
    } catch {
      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "No se pudo guardar online. Revisa Supabase o la conexion."
      }));
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
        setAccountStatus({
          email,
          isConfigured: true,
          isSignedIn: true,
          message: "Datos cargados desde tu cuenta.",
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

        setAccountStatus({
          email,
          isConfigured: true,
          isSignedIn: true,
          message: "Cuenta conectada. Se guardara una copia online.",
          userId
        });
      }
      setRemoteSyncReady(true);
    } catch {
      setAccountStatus({
        email,
        isConfigured: true,
        isSignedIn: true,
        message: "Cuenta conectada, pero falta aplicar la tabla user_app_snapshots en Supabase.",
        userId
      });
    }
  }

  async function handleSendMagicLink(email: string) {
    if (!isSupabaseConfigured()) {
      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
      }));
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.href
        }
      });

      if (error) throw error;

      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        email,
        message: "Te enviamos un enlace de acceso. Abrilo para conectar tu cuenta."
      }));
    } catch {
      setAccountStatus((currentStatus) => ({
        ...currentStatus,
        message: "No se pudo enviar el enlace de acceso."
      }));
    }
  }

  async function handleSignOut() {
    if (!isSupabaseConfigured()) return;

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      setRemoteSyncReady(false);
      setAccountStatus({
        email: "",
        isConfigured: true,
        isSignedIn: false,
        message: "Sesion cerrada. Los datos locales siguen en este navegador.",
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
      spaceId: spaces[0]?.id ?? "space-patio",
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
        spaceId: spaces[0]?.id ?? "space-patio",
        stage: "Inicio",
        startedAt: input.startDate,
        substrate: input.substrate,
        variety: selectedSeed?.name ?? "Semilla horticola"
      };
    });
    const nextEvents: CalendarEvent[] = nextPlants.flatMap((plant) => {
      const plantEvents: CalendarEvent[] = [{
        completedDates: [],
        description: `Evento creado desde el alta rapida de planta para ${plant.name}.`,
        id: createEventId("event-review"),
        kind: "review",
        plantId: plant.id,
        source: "horticultural",
        startDate: input.startDate,
        title: "Revision inicial"
      }];

      if (input.reminderOffset > 0) {
        plantEvents.push({
        completedDates: [],
        description: `Recordatorio horticola declarado en el alta rapida para ${plant.name}.`,
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
        source: "horticultural",
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
        spaceId: spaces[0]?.id ?? "space-patio",
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

    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;

      const user = data.session?.user;
      if (user?.id) {
        void loadRemoteSnapshot(user.id, user.email ?? "Cuenta conectada");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (user?.id) {
        void loadRemoteSnapshot(user.id, user.email ?? "Cuenta conectada");
        return;
      }

      setRemoteSyncReady(false);
      setAccountStatus({
        email: "",
        isConfigured: true,
        isSignedIn: false,
        message: "Conecta una cuenta para guardar datos por usuario.",
        userId: ""
      });
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
    // Runs once to attach Supabase auth listeners; loadRemoteSnapshot is intentionally invoked from auth callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!remoteSyncReady || !accountStatus.userId) return;

    const timeoutId = window.setTimeout(() => {
      void saveRemoteSnapshot();
    }, 900);

    return () => window.clearTimeout(timeoutId);
    // saveRemoteSnapshot reads the current snapshot from state; these dependencies are the autosave trigger surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus.userId, entryState, eventState, habitDates, plantState, remoteSyncReady, taskState]);

  function handleClearCultivationData() {
    setPlantState([]);
    setTaskState([]);
    setEventState([]);
    setEntryState([]);
    setHabitDates([]);
    persistStoredState(storageKeys.plants, []);
    persistStoredState(storageKeys.tasks, []);
    persistStoredState(storageKeys.events, []);
    persistStoredState(storageKeys.entries, []);
    persistStoredState(storageKeys.habitDates, []);
    removeStoredState(storageKeys.calendarDate);
    removeStoredState(storageKeys.quickChecks);
    removeStoredState(storageKeys.weatherConsent);
    removeStoredState(storageKeys.weatherSnapshot);
  }

  return (
    <main className="min-h-screen pb-28 text-moss-950 lg:pb-0">
      <header className="app-header sticky top-0 z-20 border-b border-moss-950/10 bg-paper/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3" href={todayHref} aria-label="PlantCare Calendar">
            <BrandLogo />
            <span>
              <span className="block text-xs font-black uppercase text-moss-700">PlantCare</span>
              <span className="block text-lg font-black leading-none tracking-tight text-moss-950">Calendar</span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 rounded-lg border border-moss-950/10 bg-white/82 p-1 shadow-sm lg:flex">
            {navItems.map((item) => (
              <a
                className={currentSection === item.key ? "desktop-nav-item active" : "desktop-nav-item"}
                href={getSectionHref(locale, item.key)}
                key={item.key}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <InstallAppButton />
            <a className="secondary-button account-header-link" href={`${getSectionHref(locale, "privacy")}#cuenta`}>
              Cuenta
            </a>
            <LegalInfoSummary />
            <div className="hidden items-center gap-2 rounded-lg border border-emerald-700/15 bg-white/88 px-3 py-2 text-sm font-bold text-moss-900 shadow-sm sm:flex">
              <span className="status-dot" aria-hidden="true" />
              Demo seguro
            </div>
          </div>
        </div>
      </header>

      {shouldShowFirstCultivation ? (
        <FirstCultivationScreen onCreateFirstCultivation={handleCreateFirstCultivation} />
      ) : null}

      {!shouldShowFirstCultivation && currentSection === "today" ? (
        <TodaySection
          accountStatus={accountStatus}
          agendaItems={agendaItems}
          careScore={careScore}
          dictionary={dictionary}
          onSaveRemoteSnapshot={() => saveRemoteSnapshot()}
          onSendMagicLink={handleSendMagicLink}
          onSignOut={handleSignOut}
          onToggleTask={handleToggleTask}
          openTasks={openTasks}
          calendarEvents={eventState}
          tasks={taskState}
          plants={plantState}
          streakCount={streakCount}
          weatherStatus={weatherStatus}
          onUseDeviceWeather={handleUseDeviceWeather}
          weather={weather}
        />
      ) : null}

      {!shouldShowFirstCultivation && currentSection === "seeds" ? (
        <SeedsSection
          calendarHref={calendarHref}
          locale={locale}
          onCreateManualEvents={handleAddManualEvents}
        />
      ) : null}
      {!shouldShowFirstCultivation && currentSection === "spaces" ? (
        <SpacesSection calendarEvents={eventState} entries={entryState} plants={plantState} spaces={spaces} tasks={taskState} />
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
          onSaveRemoteSnapshot={() => saveRemoteSnapshot()}
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

      <nav className="mobile-tab-bar" aria-label="Navegacion principal">
        {navItems.map((item) => (
          <a className={currentSection === item.key ? "mobile-tab active" : "mobile-tab"} href={getSectionHref(locale, item.key)} key={item.key}>
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.short}</span>
          </a>
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
            Carga banco, registro, genetica, espacio y primeros recordatorios. Para cultivos regulados, todo queda como
            dato declarado manualmente por el usuario.
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
                  Estos recordatorios no calculan tareas de cultivo. Solo guardan fechas elegidas por el usuario para
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
  accountStatus,
  agendaItems,
  careScore,
  calendarEvents,
  dictionary,
  onSaveRemoteSnapshot,
  onSendMagicLink,
  onSignOut,
  onUseDeviceWeather,
  onToggleTask,
  openTasks,
  plants,
  streakCount,
  tasks,
  weather,
  weatherStatus
}: {
  accountStatus: AccountStatus;
  agendaItems: AgendaItem[];
  careScore: number;
  calendarEvents: CalendarEvent[];
  dictionary: Dictionary;
  onSaveRemoteSnapshot: () => void;
  onSendMagicLink: (email: string) => void;
  onSignOut: () => void;
  onUseDeviceWeather: () => void;
  onToggleTask: (item: AgendaItem) => void;
  openTasks: number;
  plants: Plant[];
  streakCount: number;
  tasks: Task[];
  weather: WeatherReadiness;
  weatherStatus: string;
}) {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-5 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <div className="intro-panel">
          <div className="intro-copy min-w-0">
            <p className="eyebrow text-emerald-800">{dictionary.hero.kicker}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-moss-950 sm:text-3xl">PlantCare Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">{dictionary.hero.body}</p>
          </div>
          <div className="intro-visual" aria-hidden="true">
            <LeafCluster variant="hero" />
          </div>
          <div className="summary-grid">
            <MiniStat label="Cultivos" value={plants.length.toString()} />
            <MiniStat featured label="Pendientes" value={openTasks.toString()} />
            <MiniStat label="Racha" value={`${streakCount} dias`} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-5 sm:px-6 lg:px-8">
        <GrowCommandPanel calendarEvents={calendarEvents} plants={plants} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-5 sm:px-6 lg:px-8">
        <HomeAccountPanel
          accountStatus={accountStatus}
          onSaveRemoteSnapshot={onSaveRemoteSnapshot}
          onSendMagicLink={onSendMagicLink}
          onSignOut={onSignOut}
        />
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <section className="surface p-4 sm:p-5" aria-labelledby="today-title">
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
        </section>

        <section className="surface p-4 sm:p-5" aria-labelledby="weather-title">
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
                  <dt className="text-xs font-black uppercase text-stone-500">{item.label}</dt>
                  <dd className="mt-2 text-2xl font-black tracking-tight text-moss-950">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
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
      <div className="grow-command-leaves" aria-hidden="true">
        <LeafCluster variant="soft" />
      </div>
      <div className="grow-command-copy">
        <p className="eyebrow text-mint-50/80">Vista tipo grow tracker</p>
        <h2 id="grow-command-title">Tu cultivo, de un vistazo</h2>
        <p>
          Plantas, etapas declaradas, calendario y registro visual en una sola pantalla. Para cultivos regulados, esta
          vista solo ordena datos manuales.
        </p>
        <div className="grow-command-badges">
          <span>Registro manual</span>
          <span>Sin ubicacion exacta</span>
          <span>Demo offline</span>
        </div>
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
            <p className="text-[11px] font-black uppercase text-stone-500">Proximos eventos</p>
            <div className="mt-3 grid gap-2">
              {upcomingEvents.map((event) => (
                <div className="grow-event-row" key={event.id}>
                  <span className={`event-legend ${getEventClass(event.kind)}`}>{getEventKindLabel(event.kind)}</span>
                  <span>
                    <strong>{event.title}</strong>
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
          <button className="primary-button" onClick={onSaveRemoteSnapshot} type="button">
            Guardar ahora
          </button>
          <button className="secondary-button" onClick={onSignOut} type="button">
            Cerrar sesion
          </button>
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
          <button className="primary-button" disabled={!accountStatus.isConfigured} type="submit">
            Iniciar sesion
          </button>
          <p>{accountStatus.message}</p>
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
    <section className="surface p-4 sm:p-5" aria-labelledby="season-title">
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
    </section>
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
  plants,
  spaces,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  plants: Plant[];
  spaces: GrowSpace[];
  tasks: Task[];
}) {
  const [query, setQuery] = useState("");
  const [referenceGeneticId, setReferenceGeneticId] = useState("");
  const [referencePotCount, setReferencePotCount] = useState(4);
  const [popupGenetic, setPopupGenetic] = useState<GeneticReferenceEntry | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedReferenceGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === referenceGeneticId);
  const visibleSpaces = spaces
    .map((space) => {
      const matchingPlants = plants.filter((plant) => {
        const matchesSpace = space.name.toLowerCase().includes(normalizedQuery);
        const matchesPlant = [plant.name, plant.variety, plant.stage].join(" ").toLowerCase().includes(normalizedQuery);
        return plant.spaceId === space.id && (!normalizedQuery || matchesSpace || matchesPlant);
      });

      return { ...space, plants: matchingPlants };
    })
    .filter((space) => !normalizedQuery || space.name.toLowerCase().includes(normalizedQuery) || space.plants.length > 0);

  return (
    <section className="mx-auto mt-7 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader eyebrow="Cultivos" title="Espacios y plantas" />
        <label className="grid min-w-64 gap-1 text-sm font-black text-moss-950">
          Buscar
          <input
            aria-label="Buscar por espacio o planta"
            className="form-control"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre de planta o espacio"
            value={query}
          />
        </label>
      </div>

      <div className="genetics-reference-panel mt-5 rounded-lg border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Referencia rapida</p>
            <h3 className="genetics-panel-title mt-1 text-lg font-black">Elegir semilla y ver caracteristicas</h3>
            <p className="genetics-panel-copy mt-1 text-sm font-bold leading-6">
              Esta ficha es solo lectura para comparar datos publicados. La cantidad de macetas la declara el usuario.
            </p>
          </div>
          <div className="grid min-w-72 gap-2 sm:grid-cols-[1fr_140px]">
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
            <article className="surface overflow-hidden" key={space.id}>
              <div className="space-banner">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-white">{space.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-mint-50/86">
                    {space.region} - {space.mode}
                  </p>
                </div>
                <span className="rounded-md bg-white/16 px-3 py-1.5 text-xs font-black text-white">{space.privacyLevel}</span>
              </div>
              <div className="grid gap-0 divide-y divide-moss-950/10 p-4">
                {space.plants.map((plant) => (
                    <PlantSpaceRow
                      calendarEvents={calendarEvents}
                      entries={entries}
                      key={plant.id}
                      onOpenGenetic={setPopupGenetic}
                      plant={plant}
                      tasks={tasks}
                    />
                  ))}
              </div>
            </article>
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

      {popupGenetic ? <GeneticInfoPopup genetic={popupGenetic} onClose={() => setPopupGenetic(null)} /> : null}
    </section>
  );
}

function PlantSpaceRow({
  calendarEvents,
  entries,
  onOpenGenetic,
  plant,
  tasks
}: {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  onOpenGenetic: (genetic: GeneticReferenceEntry) => void;
  plant: Plant;
  tasks: Task[];
}) {
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
      <PlantGeneticSummary genetic={plantGenetic} onOpenGenetic={onOpenGenetic} plant={plant} />
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <PlantFact label="Maceta" value={plant.pot} />
        <PlantFact label="Sustrato" value={plant.substrate} />
        <PlantFact label="Luz" value={plant.lighting} />
        <PlantFact label="Modo" value={plant.mode} />
      </dl>
      <PlantStageProgress plant={plant} />
      <PlantUtilityPanel calendarEvents={calendarEvents} entries={entries} plant={plant} />
      <PlantTimeline calendarEvents={calendarEvents} entries={entries} plant={plant} tasks={tasks} />
    </details>
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
    const nextTitle = window.prompt("Editar nombre de la tarea", occurrence.title)?.trim();

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
          <div className="view-toggle" aria-label="Vista de calendario">
            <button className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")} type="button">
              Mes
            </button>
            <button className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")} type="button">
              Semana
            </button>
          </div>
        </div>
      </div>
      <div className="calendar-layout mt-4">
        <aside className="calendar-sidebar">
          <button
            className="calendar-create-button"
            onClick={() => setQuickEventStatus("Elegí una accion: Riego, Foto, Limpieza, Poda, Defoliar o Fumigar.")}
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
            {calendarQuickActions.map((action) => (
              <button
                className={`event-legend event-action ${getEventClass(action.kind)}`}
                key={action.label}
                onClick={() => handleQuickEvent(action)}
                type="button"
              >
                <span aria-hidden="true">{action.emoji}</span>
                <span>{action.label}</span>
              </button>
            ))}
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
                  <div className="calendar-event-list">
                    {dayOccurrences.slice(0, 3).map((occurrence) => (
                      <span className={`calendar-event ${getEventClass(occurrence.kind)}`} key={occurrence.occurrenceId}>
                        {occurrence.title}
                      </span>
                    ))}
                    {dayOccurrences.length > 3 ? <span className="calendar-event event-review">+{dayOccurrences.length - 3}</span> : null}
                  </div>
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
            ) : (
              <p className="rounded-lg border border-moss-950/10 bg-white/70 p-3 text-sm font-bold text-stone-600">
                No hay eventos para este dia.
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
          <h4 className="mt-2 font-black text-moss-950">{occurrence.title}</h4>
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
          <a className="secondary-button" href={`${getSectionHref(locale, "spaces")}#${plant.id}`}>
            Ver planta
          </a>
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
      <div className="surface p-4 sm:p-5">
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
      </div>

      <section className="surface p-4 sm:p-5" aria-labelledby="new-plant-title">
        <p className="eyebrow text-emerald-800">Alta rapida</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-moss-950 sm:text-2xl" id="new-plant-title">
          Nueva planta
        </h2>
        <DesktopQuickPlantForm onCreateQuickPlant={onCreateQuickPlant} />
        <MobileQuickPlantWizard onCreateQuickPlant={onCreateQuickPlant} />
      </section>
    </section>
  );
}

function PrivacySection({
  accountStatus,
  onClearCultivationData,
  onSaveRemoteSnapshot,
  onSendMagicLink,
  onSignOut
}: {
  accountStatus: AccountStatus;
  onClearCultivationData: () => void;
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
        <button className="secondary-button" type="button">
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
          Para que Nico abra el link desde otro celular o navegador y vea los mismos cultivos, cada usuario tiene que
          entrar con su email. Si Supabase no esta configurado, la app sigue guardando solo en este dispositivo.
        </p>
      </div>

      <div className="account-sync-card">
        <span className={accountStatus.isSignedIn ? "pill pill-green" : "pill pill-amber"}>
          {accountStatus.isSignedIn ? "Cuenta conectada" : accountStatus.isConfigured ? "Sin sesion" : "Demo local"}
        </span>
        <p className="mt-3 text-sm font-bold leading-6 text-stone-700">{accountStatus.message}</p>
        {accountStatus.isSignedIn ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="primary-button" onClick={onSaveRemoteSnapshot} type="button">
              Guardar ahora
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
              placeholder="nico@email.com"
              type="email"
              value={email}
            />
            <button className="primary-button self-end" disabled={!accountStatus.isConfigured} type="submit">
              Iniciar sesion
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
          <h3 className="font-black text-moss-950">{task.title}</h3>
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
  const horticultureSeeds = seedCatalog.filter((seed) => !seed.regulated);
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

function LegalInfoSummary() {
  return (
    <details className="legal-popover">
      <summary>Info legal</summary>
      <div className="legal-popover-panel">
        <p className="font-black text-moss-950">Uso legal y privacidad</p>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          Solo para jurisdicciones donde el cultivo sea legal. La ubicacion debe ser aproximada y el usuario puede
          exportar o eliminar sus datos.
        </p>
      </div>
    </details>
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
        <a className="stepper-button secondary" href={getSectionHref(locale, previousItem.key)}>
          <span aria-hidden="true">←</span>
          <span>
            <small>Anterior</small>
            {previousItem.label}
          </span>
        </a>
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
        <a className="stepper-button primary" href={getSectionHref(locale, nextItem.key)}>
          <span>
            <small>Siguiente</small>
            {nextItem.label}
          </span>
          <span aria-hidden="true">→</span>
        </a>
      ) : (
        <a className="stepper-button primary" href={getSectionHref(locale, "today")}>
          <span>
            <small>Volver</small>
            Hoy
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}
    </nav>
  );
}

function MiniStat({ featured = false, label, value }: { featured?: boolean; label: string; value: string }) {
  return (
    <div className={featured ? "metric-card featured" : "metric-card"}>
      <p className="text-2xl font-black tracking-tight text-moss-950">{value}</p>
      <p className="mt-1 text-xs font-black uppercase text-stone-500">{label}</p>
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
      <div className="plant-utility-card">
        <p className="text-[11px] font-black uppercase text-stone-500">Ambiente declarado</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="plant-signal">{plant.mode}</span>
          <span className="plant-signal">{plant.lighting}</span>
          <span className="plant-signal">{plant.pot}</span>
        </div>
      </div>
    </div>
  );
}

function PlantFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase text-stone-500">{label}</dt>
      <dd className="mt-1 truncate font-bold text-moss-950">{value}</dd>
    </div>
  );
}

function SeedSelect({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const horticultureSeeds = seedCatalog.filter((seed) => !seed.regulated);

  return (
    <label className="grid gap-1 text-sm font-black text-moss-950">
      Variedad o semilla
      <select aria-label="Variedad o semilla" className="form-control" value={value} onChange={(event) => onChange(event.target.value)}>
        {horticultureSeeds.map((seed) => (
          <option key={seed.id} value={seed.id}>
            {seed.crop} - {seed.name}
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
      <span aria-hidden="true" />
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

  if (normalizedStage.includes("cosecha") || normalizedStage.includes("seca")) return "harvest";
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
