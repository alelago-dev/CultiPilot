"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { addDays, createEventId, getTodayIso } from "@/lib/calendar-events";
import { CopyValueButton } from "@/components/copy-button";
import { getReferenceRow, type SeedType } from "@/lib/cultivation-reference";
import {
  getGeneticsCatalogAlphabetically,
  searchGeneticsByName,
  type GeneticReferenceEntry,
  type GeneticType
} from "@/lib/genetics-catalog";
import type { CalendarEvent, CalendarEventKind } from "@/lib/types";

const seedTypeOptions: Array<{ label: string; value: SeedType }> = [
  { label: "Feminizada", value: "feminized" },
  { label: "Regular", value: "regular" },
  { label: "Automatica", value: "autoflowering" }
];

const bankOptions = [
  "Catalogo propio",
  "BSF",
  "Zig Zag",
  "Banco legal local",
  "Otro banco autorizado",
  "No declarado"
];

const floweringDayOptions = [
  "No declarado",
  "15-30 dias",
  "21-45 dias",
  "30-60 dias",
  "Definir en agenda"
];

const floweringWeekOptions = [
  "No declarado",
  "5-8 semanas",
  "7-9 semanas",
  "8-10 semanas",
  "10-12 semanas",
  "Definir en agenda"
];

const indoorSizeOptions = [
  "No aplica",
  "40 x 40 cm",
  "60 x 60 cm",
  "80 x 80 cm",
  "100 x 100 cm",
  "120 x 120 cm",
  "Otro tamano declarado"
];

const potOptions = ["No declarado", "3 L", "5 L", "7 L", "10 L", "15 L", "20 L", "25 L", "Otro volumen"];

const reminderOptions = [
  { label: "No programado", value: "none" },
  { label: "Hoy", value: "0" },
  { label: "En 3 dias", value: "3" },
  { label: "En 7 dias", value: "7" },
  { label: "En 14 dias", value: "14" }
];

const recurrenceOptions = [
  { label: "No repetir", value: "0" },
  { label: "Cada 3 dias", value: "3" },
  { label: "Cada 7 dias", value: "7" },
  { label: "Cada 14 dias", value: "14" }
];

const recurrenceEndOptions = [
  { label: "Sin fecha de fin", value: "none" },
  { label: "Durante 30 dias", value: "30" },
  { label: "Durante 60 dias", value: "60" },
  { label: "Durante 90 dias", value: "90" }
];

type ReminderPresetFields = Partial<{
  closingReminder: string;
  dryingReminder: string;
  maintenanceReminder: string;
  moistureReminder: string;
  nutritionReminder: string;
  pestReminder: string;
  photoReminder: string;
  recurrenceDays: string;
  recurrenceEnd: string;
  stageReminder: string;
  structureReminder: string;
}>;

const reviewSuggestionPresets: Array<{
  fields: ReminderPresetFields;
  summary: string;
  title: string;
}> = [
  {
    fields: {
      moistureReminder: "0",
      photoReminder: "0"
    },
    summary: "Revision de humedad y registro visual para dejar asentado el estado del dia.",
    title: "Chequeo de hoy"
  },
  {
    fields: {
      maintenanceReminder: "7",
      moistureReminder: "0",
      pestReminder: "7",
      photoReminder: "7",
      recurrenceDays: "7",
      recurrenceEnd: "30"
    },
    summary: "Agenda editable para revisar humedad, foto, mantenimiento y control visual semanal.",
    title: "Rutina semanal"
  },
  {
    fields: {
      maintenanceReminder: "7",
      nutritionReminder: "7",
      pestReminder: "7",
      structureReminder: "7"
    },
    summary: "Recordatorios manuales para revisar estructura, mantenimiento, nutricion y plagas.",
    title: "Revision completa"
  },
  {
    fields: {
      closingReminder: "7",
      dryingReminder: "14",
      photoReminder: "7",
      stageReminder: "7"
    },
    summary: "Hitos editables para registrar cambio de etapa, cierre declarado, foto y secado.",
    title: "Hitos declarados"
  }
];

const geneticsCatalogAlphabetically = getGeneticsCatalogAlphabetically();
const geneticSelectOptions = [
  { label: "No seleccionada", value: "No seleccionada" },
  ...geneticsCatalogAlphabetically.map((genetic) => ({
    label: genetic.name,
    value: genetic.name
  })),
  { label: "Otra / no listada", value: "Otra / no listada" }
];

export function ManualCannabisForm({
  calendarHref,
  onCreateEvents,
  selectedGeneticName
}: {
  calendarHref: string;
  onCreateEvents: (events: CalendarEvent[]) => void;
  selectedGeneticName?: string;
}) {
  const [seedType, setSeedType] = useState<SeedType>("feminized");
  const [geneticName, setGeneticName] = useState(selectedGeneticName || "No seleccionada");
  const [daysToFlower, setDaysToFlower] = useState(floweringDayOptions[0]);
  const [floweringWeeks, setFloweringWeeks] = useState(floweringWeekOptions[0]);
  const [spaceType, setSpaceType] = useState("Interior");
  const [indoorSize, setIndoorSize] = useState(indoorSizeOptions[0]);
  const [lightType, setLightType] = useState("LED");
  const [potLiters, setPotLiters] = useState(potOptions[0]);
  const [geneticNote, setGeneticNote] = useState("");
  const [moistureReminder, setMoistureReminder] = useState("0");
  const [stageReminder, setStageReminder] = useState("none");
  const [dryingReminder, setDryingReminder] = useState("none");
  const [maintenanceReminder, setMaintenanceReminder] = useState("7");
  const [photoReminder, setPhotoReminder] = useState("none");
  const [structureReminder, setStructureReminder] = useState("none");
  const [nutritionReminder, setNutritionReminder] = useState("none");
  const [pestReminder, setPestReminder] = useState("none");
  const [closingReminder, setClosingReminder] = useState("none");
  const [recurrenceDays, setRecurrenceDays] = useState("0");
  const [recurrenceEnd, setRecurrenceEnd] = useState("none");
  const [statusMessage, setStatusMessage] = useState("");
  const [showCalendarLink, setShowCalendarLink] = useState(false);
  const selectedGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.name === geneticName);
  const visualReferenceType = selectedGenetic ? mapGeneticTypeToSeedType(selectedGenetic.type) : seedType;
  const visualReference = getReferenceRow(visualReferenceType);

  function handleCreateEvents() {
    const definitions: Array<{
      description: string;
      kind: CalendarEventKind;
      title: string;
      value: string;
    }> = [
      {
        description: "Fecha declarada manualmente por el usuario para revisar humedad antes de decidir riego.",
        kind: "watering",
        title: "Revision de humedad",
        value: moistureReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para registrar cambio de etapa.",
        kind: "review",
        title: "Cambio de etapa / flora",
        value: stageReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para registrar secado de ramas.",
        kind: "review",
        title: "Secado de ramas",
        value: dryingReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para mantenimiento del espacio.",
        kind: "cleaning",
        title: "Mantenimiento",
        value: maintenanceReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para registrar foto de seguimiento.",
        kind: "photo",
        title: "Registro fotografico",
        value: photoReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para trabajo de estructura o poda.",
        kind: "review",
        title: "Trabajo de estructura / poda",
        value: structureReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para registrar nutricion o fertilizacion.",
        kind: "review",
        title: "Nutricion / fertilizacion",
        value: nutritionReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para prevencion o revision de plagas.",
        kind: "review",
        title: "Prevencion de plagas",
        value: pestReminder
      },
      {
        description: "Fecha declarada manualmente por el usuario para cierre de riego o fertilizacion.",
        kind: "review",
        title: "Cierre de riego / fertilizacion",
        value: closingReminder
      }
    ];
    const todayIso = getTodayIso();
    const everyDays = Number(recurrenceDays);
    const nextEvents = definitions
      .filter((definition) => definition.value !== "none")
      .map((definition) => {
        const startDate = addDays(todayIso, Number(definition.value));
        const recurrenceEndDate =
          everyDays > 0 && recurrenceEnd !== "none" ? addDays(startDate, Number(recurrenceEnd)) : undefined;

        return {
          completedDates: [],
          description: `${definition.description} Genetica: ${geneticName}. Tipo: ${formatSeedType(seedType)}.`,
          id: createEventId("event-manual"),
          kind: definition.kind,
          plantId: "plant-manual-regulated",
          recurrence:
            everyDays > 0
              ? {
                  active: true,
                  endDate: recurrenceEndDate,
                  everyDays
                }
              : undefined,
          source: "manual",
          startDate,
          title: definition.title
        } satisfies CalendarEvent;
      });

    if (nextEvents.length === 0) {
      setStatusMessage("No hay fechas manuales seleccionadas para crear eventos.");
      setShowCalendarLink(false);
      return;
    }

    onCreateEvents(nextEvents);
    setStatusMessage(`${nextEvents.length} evento(s) manual(es) agregados. Abriendo calendario...`);
    setShowCalendarLink(true);
    window.setTimeout(() => {
      window.location.href = calendarHref;
    }, 180);
  }

  function applyReviewSuggestion(fields: ReminderPresetFields, title: string) {
    if (fields.moistureReminder) setMoistureReminder(fields.moistureReminder);
    if (fields.stageReminder) setStageReminder(fields.stageReminder);
    if (fields.dryingReminder) setDryingReminder(fields.dryingReminder);
    if (fields.maintenanceReminder) setMaintenanceReminder(fields.maintenanceReminder);
    if (fields.photoReminder) setPhotoReminder(fields.photoReminder);
    if (fields.structureReminder) setStructureReminder(fields.structureReminder);
    if (fields.nutritionReminder) setNutritionReminder(fields.nutritionReminder);
    if (fields.pestReminder) setPestReminder(fields.pestReminder);
    if (fields.closingReminder) setClosingReminder(fields.closingReminder);
    if (fields.recurrenceDays) setRecurrenceDays(fields.recurrenceDays);
    if (fields.recurrenceEnd) setRecurrenceEnd(fields.recurrenceEnd);
    setStatusMessage(`Sugerencia "${title}" aplicada. Podes ajustar cada desplegable antes de crear eventos.`);
    setShowCalendarLink(false);
  }

  return (
    <div className="grid gap-4">
      <FormGroup title="Identificacion">
        <FormSelect label="Banco o catalogo" options={bankOptions} recentKey="bank" />
        <GeneticPredictiveSelect value={geneticName} onChange={setGeneticName} />
        <FormSelect label="Registro legal" options={["Confirmado", "Pendiente de verificar", "No aplica"]} />
      </FormGroup>

      <FormGroup title="Datos de cultivo">
        <GeneticDataReference
          daysToFlower={daysToFlower}
          floweringWeeks={floweringWeeks}
          genetic={selectedGenetic}
          geneticNote={geneticNote}
          onDaysToFlowerChange={setDaysToFlower}
          onFloweringWeeksChange={setFloweringWeeks}
          onGeneticNoteChange={setGeneticNote}
          onPotLitersChange={setPotLiters}
          onSeedTypeChange={(nextValue) => setSeedType(nextValue as SeedType)}
          potLiters={potLiters}
          seedType={seedType}
          visualReference={visualReference}
        />
        <FormSelect allowClipboardPaste label="Tipo de espacio" options={["Interior", "Exterior", "Invernadero"]} value={spaceType} onChange={setSpaceType} />
        <FormSelect allowClipboardPaste label="Tamano indoor" options={indoorSizeOptions} recentKey="indoor-size" value={indoorSize} onChange={setIndoorSize} />
        <FormSelect
          allowClipboardPaste
          label="Tipo de luz"
          options={["LED", "Sodio", "Mixta", "Luz natural", "No declarado"]}
          recentKey="light-type"
          value={lightType}
          onChange={setLightType}
        />
      </FormGroup>

      <FormGroup title="Fechas y recordatorios">
        <ReviewSuggestionPanel onApply={applyReviewSuggestion} />
        <FormSelect label="Proxima revision de humedad" options={reminderOptions} value={moistureReminder} onChange={setMoistureReminder} />
        <FormSelect label="Cambio de etapa / flora" options={reminderOptions} value={stageReminder} onChange={setStageReminder} />
        <FormSelect label="Secado de ramas" options={reminderOptions} value={dryingReminder} onChange={setDryingReminder} />
        <FormSelect label="Mantenimiento" options={reminderOptions} value={maintenanceReminder} onChange={setMaintenanceReminder} />
        <FormSelect label="Registro fotografico" options={reminderOptions} value={photoReminder} onChange={setPhotoReminder} />
        <FormSelect label="Trabajo de estructura / poda" options={reminderOptions} value={structureReminder} onChange={setStructureReminder} />
        <FormSelect label="Nutricion / fertilizacion" options={reminderOptions} value={nutritionReminder} onChange={setNutritionReminder} />
        <FormSelect label="Prevencion de plagas" options={reminderOptions} value={pestReminder} onChange={setPestReminder} />
        <FormSelect label="Cierre de riego / fertilizacion" options={reminderOptions} value={closingReminder} onChange={setClosingReminder} />
        <FormSelect label="Recurrencia" options={recurrenceOptions} value={recurrenceDays} onChange={setRecurrenceDays} />
        <FormSelect label="Fin recurrencia" options={recurrenceEndOptions} value={recurrenceEnd} onChange={setRecurrenceEnd} />
      </FormGroup>

      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-button" type="button" onClick={handleCreateEvents}>
          Crear eventos manuales
        </button>
        {statusMessage ? <span className="text-sm font-bold text-stone-600">{statusMessage}</span> : null}
        {showCalendarLink ? (
          <Link className="secondary-button" href={calendarHref as Route}>
            Ver calendario
          </Link>
        ) : null}
      </div>

      <p className="text-xs font-bold leading-5 text-stone-600">
        Estos campos sirven para agenda y recordatorios definidos por el usuario. Evita guardar numeros de registro,
        domicilios exactos o datos medicos en esta demo publica.
      </p>
    </div>
  );
}

function ReviewSuggestionPanel({
  onApply
}: {
  onApply: (fields: ReminderPresetFields, title: string) => void;
}) {
  return (
    <div className="review-suggestion-panel sm:col-span-2">
      <div className="review-suggestion-header">
        <div>
          <p>Agenda sugerida</p>
          <strong>Revisiones manuales rapidas</strong>
        </div>
        <span>Editable</span>
      </div>
      <div className="review-suggestion-grid">
        {reviewSuggestionPresets.map((preset) => (
          <button
            className="review-suggestion-card"
            key={preset.title}
            onClick={() => onApply(preset.fields, preset.title)}
            type="button"
          >
            <span>{preset.title}</span>
            <small>{preset.summary}</small>
          </button>
        ))}
      </div>
      <p className="review-suggestion-note">
        Estas sugerencias solo acomodan recordatorios visibles. No calculan fechas, riego, rendimiento ni decisiones de cultivo.
      </p>
    </div>
  );
}

function GeneticDataReference({
  daysToFlower,
  floweringWeeks,
  genetic,
  geneticNote,
  onDaysToFlowerChange,
  onFloweringWeeksChange,
  onGeneticNoteChange,
  onPotLitersChange,
  onSeedTypeChange,
  potLiters,
  seedType,
  visualReference
}: {
  daysToFlower: string;
  floweringWeeks: string;
  genetic?: GeneticReferenceEntry;
  geneticNote: string;
  onDaysToFlowerChange: (value: string) => void;
  onFloweringWeeksChange: (value: string) => void;
  onGeneticNoteChange: (value: string) => void;
  onPotLitersChange: (value: string) => void;
  onSeedTypeChange: (value: string) => void;
  potLiters: string;
  seedType: SeedType;
  visualReference?: ReturnType<typeof getReferenceRow>;
}) {
  const referenceFloweringWeeks = genetic ? formatWeekRange(genetic.flowering_weeks_range) : visualReference?.flowering_weeks_range ?? "No declarado";
  const referenceDaysToFlower = visualReference?.days_to_flower_range ?? "No declarado";
  const geneticType = genetic ? formatGeneticType(genetic.type) : "Segun tipo declarado";
  const thcReference = genetic ? formatThcRange(genetic.thc_percent_range) : "No declarado";

  return (
    <article className="manual-reference-card sm:col-span-2" aria-label="Referencia visual de la genetica seleccionada">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase text-stone-500">Referencia visible, no autocompleta</p>
          <h4 className="mt-1 font-black text-moss-950">{genetic?.name ?? "Elegí una genética para ver datos publicados"}</h4>
          <p className="mt-1 text-sm font-bold text-stone-600">
            {genetic ? `${genetic.cross} - ${genetic.source}` : "Los valores quedan como ayuda para copiar o elegir manualmente."}
          </p>
        </div>
        <span className="mode-badge manual">Manual</span>
      </div>
      <div className="reference-field-grid">
        <ReferenceFieldPair label="Tipo publicado" targetField="Tipo declarado" value={geneticType}>
          <FormSelect
            allowClipboardPaste
            label="Tipo declarado"
            options={seedTypeOptions}
            value={seedType}
            onChange={onSeedTypeChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair label="Dias a flora ref." targetField="Dias a flora" value={referenceDaysToFlower}>
          <FormSelect
            allowClipboardPaste
            label="Dias a flora"
            options={floweringDayOptions}
            value={daysToFlower}
            onChange={onDaysToFlowerChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair label="Floracion/ciclo" targetField="Semanas de floracion" value={referenceFloweringWeeks}>
          <FormSelect
            allowClipboardPaste
            label="Semanas de floracion"
            options={floweringWeekOptions}
            value={floweringWeeks}
            onChange={onFloweringWeeksChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair label="Maceta ref." targetField="Maceta en litros" value={visualReference?.pot_liters_range ?? "No declarado"}>
          <FormSelect
            allowClipboardPaste
            label="Maceta en litros"
            options={potOptions}
            recentKey="pot-liters"
            value={potLiters}
            onChange={onPotLitersChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair label="THC publicado" targetField="Nota manual de genetica" value={thcReference}>
          <FormTextInput
            allowClipboardPaste
            label="Nota manual de genetica"
            placeholder="Ej: THC publicado 18-22%"
            value={geneticNote}
            onChange={onGeneticNoteChange}
          />
        </ReferenceFieldPair>
      </div>
      {genetic?.raw_fields ? <RawFieldsPanel fields={genetic.raw_fields} /> : null}
    </article>
  );
}

function ReferenceFieldPair({
  children,
  label,
  targetField,
  value
}: {
  children: ReactNode;
  label: string;
  targetField: string;
  value: string;
}) {
  return (
    <div className="reference-field-pair">
      <ReferenceValue label={label} targetField={targetField} value={value} />
      <div className="reference-destination-control">{children}</div>
    </div>
  );
}

function ReferenceValue({ label, targetField, value }: { label: string; targetField?: string; value: string }) {
  const destination = targetField ?? getManualReferenceTarget(label);

  return (
    <div className="reference-value">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="reference-copy-row">
        <span className="reference-target-field">Campo: {destination}</span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function RawFieldsPanel({ fields }: { fields: NonNullable<GeneticReferenceEntry["raw_fields"]> }) {
  return (
    <details className="mt-3 rounded-md border border-moss-950/10 bg-white/70 p-2">
      <summary className="cursor-pointer text-xs font-black uppercase text-stone-500">Campos originales del Excel</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {Object.entries(fields).map(([label, rawValue]) => {
          const value = rawValue === null ? "No declarado" : String(rawValue);
          return <ReferenceValue key={label} label={label} value={value} />;
        })}
      </div>
    </details>
  );
}

function getManualReferenceTarget(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("floracion") || normalizedLabel.includes("ciclo")) return "Semanas de floracion";
  if (normalizedLabel.includes("flora")) return "Dias a flora";
  if (normalizedLabel.includes("tipo")) return "Tipo declarado";
  if (normalizedLabel.includes("maceta")) return "Maceta en litros";
  if (normalizedLabel.includes("luz")) return "Tipo de luz";
  return "Campo manual correspondiente";
}

function FormGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="manual-form-group rounded-lg border border-moss-950/10 bg-white/70 p-3">
      <h3 className="text-xs font-black uppercase text-stone-500">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function GeneticPredictiveSelect({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const query = value === "No seleccionada" ? "" : value;
  const results = useMemo(() => searchGeneticsByName(query), [query]);
  const showResults = query.trim().length >= 2 && results.length > 0 && query !== value;
  const selectedGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.name === value);

  function chooseGenetic(genetic: GeneticReferenceEntry) {
    onChange(genetic.name);
  }

  return (
    <div className="genetic-entry-card scroll-mt-28 sm:col-span-2" id="manual-genetic-selection">
      <label className="grid gap-1 text-sm font-black text-moss-950">
        Buscar genetica
        <input
          aria-label="Buscar genetica por nombre, banco o linaje"
          className="form-control"
          list="manual-genetic-options"
          placeholder="Escribi para buscar: Gorilla, Baseball, Kush..."
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            onChange(nextQuery.trim() ? nextQuery : "No seleccionada");
          }}
        />
        <datalist id="manual-genetic-options">
          {geneticSelectOptions.slice(1, -1).map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      </label>

      {showResults ? (
        <div className="genetic-suggestion-list" aria-label="Coincidencias de genetica">
          {results.slice(0, 6).map((genetic) => (
            <button
              className="genetic-suggestion-option"
              key={genetic.id}
              onClick={() => chooseGenetic(genetic)}
              type="button"
            >
              <strong>{genetic.name}</strong>
              <span>{formatGeneticType(genetic.type)} - {formatWeekRange(genetic.flowering_weeks_range)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedGenetic ? (
        <article className="selected-genetic-card">
          <div>
            <span>Genetica seleccionada</span>
            <strong>{selectedGenetic.name}</strong>
            <small>{selectedGenetic.source}</small>
          </div>
          <dl>
            <div>
              <dt>Tipo</dt>
              <dd>{formatGeneticType(selectedGenetic.type)}</dd>
            </div>
            <div>
              <dt>Floracion</dt>
              <dd>{formatWeekRange(selectedGenetic.flowering_weeks_range)}</dd>
            </div>
          </dl>
        </article>
      ) : (
        <p className="genetic-entry-help">
          Busca por nombre o banco. Elegir una genetica solo muestra referencia; no completa dias, luz, riego ni fechas.
        </p>
      )}

      <div className="genetic-count-note">{geneticsCatalogAlphabetically.length} geneticas disponibles en el buscador.</div>
    </div>
  );
}

function FormSelect({
  allowClipboardPaste = false,
  label,
  onChange,
  options,
  recentKey,
  value
}: {
  allowClipboardPaste?: boolean;
  label: string;
  onChange?: (value: string) => void;
  options: string[] | Array<{ label: string; value: string }>;
  recentKey?: string;
  value?: string;
}) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { label: option, value: option } : option));
  const { recentOptions, rememberOption } = useRecentOptions(recentKey, normalizedOptions);
  const [pasteStatus, setPasteStatus] = useState("");
  const isControlled = typeof value === "string";
  const currentValue = value ?? normalizedOptions[0]?.value ?? "";
  const pastedOption =
    isControlled && currentValue && !normalizedOptions.some((option) => option.value === currentValue)
      ? { label: `Pegado: ${currentValue}`, value: currentValue }
      : null;
  const regularOptions = normalizedOptions.filter((option) => !recentOptions.some((recentOption) => recentOption.value === option.value));

  function applyValue(nextValue: string) {
    rememberOption(nextValue);
    onChange?.(nextValue);
  }

  async function handlePasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setPasteStatus("El navegador no permite leer el portapapeles.");
      return;
    }

    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();

      if (!clipboardText) {
        setPasteStatus("No hay texto copiado.");
        return;
      }

      const matchingOption = normalizedOptions.find((option) => {
        const optionLabel = option.label.toLowerCase();
        const optionValue = option.value.toLowerCase();
        const pastedValue = clipboardText.toLowerCase();

        return optionLabel === pastedValue || optionValue === pastedValue;
      });
      const nextValue = matchingOption?.value ?? clipboardText;

      applyValue(nextValue);
      setPasteStatus(`Pegado manualmente en ${label}.`);
    } catch {
      setPasteStatus("No se pudo leer el portapapeles.");
    }
  }

  return (
    <div className="grid gap-1">
      <label className="grid gap-1 text-sm font-black text-moss-950">
        {label}
        <div className={allowClipboardPaste ? "paste-select-row" : ""}>
          <select
            aria-label={label}
            className="form-control"
            defaultValue={isControlled ? undefined : normalizedOptions[0]?.value}
            value={value}
            onChange={(event) => applyValue(event.target.value)}
          >
            {pastedOption ? (
              <option key={`pasted-${pastedOption.value}`} value={pastedOption.value}>
                {pastedOption.label}
              </option>
            ) : null}
            {recentOptions.length > 0 ? <option disabled>Usados recientemente</option> : null}
            {recentOptions.map((option) => (
              <option key={`recent-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
            {recentOptions.length > 0 ? <option disabled>Opciones</option> : null}
            {regularOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {allowClipboardPaste ? (
            <button className="paste-value-button" onClick={handlePasteFromClipboard} type="button">
              Pegar
            </button>
          ) : null}
        </div>
      </label>
      {allowClipboardPaste && pasteStatus ? <span className="paste-status">{pasteStatus}</span> : null}
    </div>
  );
}

function FormTextInput({
  allowClipboardPaste = false,
  label,
  onChange,
  placeholder,
  value
}: {
  allowClipboardPaste?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [pasteStatus, setPasteStatus] = useState("");

  async function handlePasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setPasteStatus("El navegador no permite leer el portapapeles.");
      return;
    }

    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();

      if (!clipboardText) {
        setPasteStatus("No hay texto copiado.");
        return;
      }

      onChange(clipboardText);
      setPasteStatus(`Pegado manualmente en ${label}.`);
    } catch {
      setPasteStatus("No se pudo leer el portapapeles.");
    }
  }

  return (
    <div className="grid gap-1">
      <label className="grid gap-1 text-sm font-black text-moss-950">
        {label}
        <div className={allowClipboardPaste ? "paste-select-row" : ""}>
          <input
            aria-label={label}
            className="form-control"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          {allowClipboardPaste ? (
            <button className="paste-value-button" onClick={handlePasteFromClipboard} type="button">
              Pegar
            </button>
          ) : null}
        </div>
      </label>
      {allowClipboardPaste && pasteStatus ? <span className="paste-status">{pasteStatus}</span> : null}
    </div>
  );
}

function useRecentOptions(key: string | undefined, options: Array<{ label: string; value: string }>) {
  const storageKey = key ? `plantcare-recent-${key}` : "";
  const [recentValues, setRecentValues] = useState<string[]>(() => {
    if (!storageKey || typeof window === "undefined") return [];
    const storedValue = window.localStorage.getItem(storageKey);
    return storedValue ? JSON.parse(storedValue) as string[] : [];
  });

  function rememberOption(value: string) {
    if (!storageKey) return;

    const nextValues = [value, ...recentValues.filter((recentValue) => recentValue !== value)].slice(0, 3);
    setRecentValues(nextValues);
    window.localStorage.setItem(storageKey, JSON.stringify(nextValues));
  }

  return {
    recentOptions: recentValues
      .map((recentValue) => options.find((option) => option.value === recentValue))
      .filter((option): option is { label: string; value: string } => Boolean(option)),
    rememberOption
  };
}

function formatSeedType(type: SeedType) {
  if (type === "autoflowering") return "Automatica";
  if (type === "regular") return "Regular";
  return "Feminizada";
}

function formatGeneticType(type: GeneticType) {
  if (type === "autoflowering") return "Automatica";
  if (type === "faster_flowering") return "Rapida";
  if (type === "regular") return "Regular";
  return "Feminizada";
}

function formatWeekRange(range: [number, number]) {
  return range[0] === range[1] ? `${range[0]} semanas` : `${range[0]}-${range[1]} semanas`;
}

function formatThcRange(range: [number, number]) {
  if (range[0] === 0 && range[1] === 0) return "No declarado";
  return range[0] === range[1] ? `${range[0]}%` : `${range[0]}-${range[1]}%`;
}

function mapGeneticTypeToSeedType(type: GeneticType): SeedType {
  if (type === "autoflowering") return "autoflowering";
  if (type === "regular") return "regular";
  return "feminized";
}
