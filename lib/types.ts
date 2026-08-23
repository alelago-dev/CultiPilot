export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

export type Dictionary = {
  hero: {
    kicker: string;
    title: string;
    body: string;
  };
  common: {
    save: string;
    saving: string;
    send: string;
    sending: string;
    back: string;
    continueLabel: string;
    close: string;
    skipForNow: string;
  };
  header: {
    brandTagline: string;
    brandAriaLabel: string;
    navAriaLabel: string;
    mobileNavAriaLabel: string;
    vpdAriaLabel: string;
    vpdShort: string;
    vpdLong: string;
    installButton: string;
    installHintMobile: string;
    installAccepted: string;
    installDismissed: string;
    demoBadge: string;
    themeToLight: string;
    themeToDark: string;
  };
  sharedView: {
    readOnly: string;
    viewingMessage: string;
    show: string;
    hide: string;
    myGrows: string;
  };
  account: {
    avatarSignedInLabel: string;
    avatarSignedOutLabel: string;
    closeAriaLabel: string;
    dialogEyebrow: string;
    dialogTitleSignedIn: string;
    dialogTitleSignedOut: string;
    signedInIntro: string;
    signOut: string;
    shareTitle: string;
    shareHint: string;
    generateCode: string;
    viewOthersTitle: string;
    codeInputAriaLabel: string;
    codePlaceholder: string;
    useCode: string;
    viewGrowsOf: string;
    signedOutIntro: string;
    emailLabel: string;
    emailPlaceholder: string;
    sendLink: string;
    privacyLink: string;
    connectedPill: string;
    signInPill: string;
    localDemoPill: string;
    savedByUserPill: string;
    savedByUserPillHome: string;
    homeTitle: string;
    homeIntro: string;
    saveNow: string;
    emailAriaLabel: string;
    defaultInfoMessage: string;
    demoInfoMessage: string;
  };
  onboarding: {
    eyebrow: string;
    skip: string;
    back: string;
    continueLabel: string;
    goToToday: string;
    steps: Array<{ title: string; body: string }>;
  };
  stepper: {
    ariaLabel: string;
    previous: string;
    next: string;
    start: string;
    backToToday: string;
    today: string;
  };
  push: {
    eyebrow: string;
    title: string;
    signInPrompt: string;
    unsupported: string;
    description: string;
    activate: string;
    deactivate: string;
    saving: string;
    deactivatedMessage: string;
    activatedMessage: string;
    deniedMessage: string;
    failedMessage: string;
    errorMessage: string;
  };
  today: {
    panelEyebrow: string;
    heroTitle: string;
    statsGrowsLabel: string;
    statsGrowsDescription: string;
    statsPendingLabel: string;
    statsPendingDescription: string;
    statsStreakLabel: string;
    statsStreakDescription: string;
    statsStreakValue: string;
    tasksEyebrow: string;
    tasksTitle: string;
    tasksEmptyTitle: string;
    tasksEmptyBody: string;
    taskDone: string;
    taskPending: string;
    taskPriority: string;
    weatherEyebrow: string;
    weatherTitle: string;
    weatherLive: string;
    weatherPending: string;
    weatherRefresh: string;
    weatherUseDevice: string;
    growCommandEyebrow: string;
    growCommandTitle: string;
    growCommandBody: string;
    growCommandStagesAriaLabel: string;
    growCommandStageSeed: string;
    growCommandStageVeg: string;
    growCommandStageFlower: string;
    growCommandStageHarvest: string;
    growCommandActivePlants: string;
    growCommandNoPlants: string;
    growCommandUpcomingEvents: string;
    growCommandNoEvents: string;
    accountConnectedPill: string;
    accountSignInPill: string;
    accountLocalDemoPill: string;
    accountSavedByUserPill: string;
    coachEyebrow: string;
    coachTitle: string;
    coachManualPill: string;
    coachIntro: string;
    coachFocusLabel: string;
    coachFocusFallback: string;
    coachPlantFallback: string;
    coachSignalLeavesLabel: string;
    coachSignalLeavesHint: string;
    coachSignalSubstrateLabel: string;
    coachSignalSubstrateHint: string;
    coachSignalPestsLabel: string;
    coachSignalPestsHint: string;
    coachSignalLightLabel: string;
    coachSignalLightHint: string;
    coachSignalPhotoLabel: string;
    coachSignalPhotoHint: string;
    coachCheckedMark: string;
    seasonEyebrow: string;
    seasonTitle: string;
    seasonTasksDonePercent: string;
    seasonDaysSinceStart: string;
    seasonNextMilestoneLabel: string;
    seasonNextMilestoneValue: string;
    seasonNextMilestoneEmpty: string;
    seasonPlantFallback: string;
    stageSummaryEyebrow: string;
    stageSummaryTitle: string;
    stageSummaryDaysSince: string;
    stageSummaryNoDate: string;
    stageSummaryFooter: string;
    inventoryAlertsEyebrow: string;
    inventoryAlertsTitle: string;
    inventoryAlertsQuantity: string;
    inventoryAlertsExpiredOn: string;
    inventoryAlertsExpiresOn: string;
    inventoryAlertsRemoveMinimum: string;
    inventoryAlertsFooter: string;
    inspectionsEyebrow: string;
    inspectionsTitle: string;
    inspectionsPotFallback: string;
    inspectionsPendingReview: string;
    inspectionsNextReview: string;
    inspectionsViewPlant: string;
    environmentAlertsEyebrow: string;
    environmentAlertsTitle: string;
    environmentAlertsBody: string;
    environmentAlertsActive: string;
    environmentAlertsNoneActive: string;
    environmentAlertsBelowMin: string;
    environmentAlertsAboveMax: string;
    environmentAlertsLastReading: string;
    environmentAlertsAcknowledge: string;
    environmentAlertsViewPlant: string;
    environmentAlertsEmptyConfigured: string;
    environmentAlertsEmptyUnconfigured: string;
    environmentAlertsFooter: string;
    quickAccessEyebrow: string;
    quickAccessTitle: string;
    quickAccessBody: string;
    quickAccessPending: string;
    quickAccessAllUpToDate: string;
    quickAccessRegister: string;
    quickAccessLastMeasurement: string;
    quickAccessNoMeasurements: string;
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

export type PlantStageTransition = {
  id: string;
  plantId: string;
  fromStage: string;
  toStage: string;
  changedAt: string;
  note?: string;
  source: "user";
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
  catalogProductId?: string;
  lotNumber?: string;
  expiresAt?: string;
  sourceUrl?: string;
};

export type InventoryMovement = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  occurredAt: string;
  kind: "initial" | "adjustment" | "consumption";
  quantityDelta: number;
  quantityAfter: number;
  unit: string;
  reason: string;
  plantIds?: string[];
  unitCost?: number;
  totalCost?: number;
  currency?: string;
};

export type InventoryMovementContext = {
  kind?: InventoryMovement["kind"];
  occurredAt?: string;
  reason?: string;
  plantIds?: string[];
};

export type ProductCatalogItem = {
  id: string;
  name: string;
  brand?: string;
  category: InventoryItem["category"];
  composition?: string;
  compatibleStages: string[];
  compatibleModes: GrowMode[];
  packageQuantity?: number;
  packageUnit?: string;
  price?: number;
  currency?: string;
  sourceUrl?: string;
  sourceCheckedAt?: string;
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
