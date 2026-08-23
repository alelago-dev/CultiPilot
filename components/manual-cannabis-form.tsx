"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { addDays, createEventId, getTodayIso } from "@/lib/calendar-events";
import { CopyValueButton } from "@/components/copy-button";
import { formatDictionaryString } from "@/lib/i18n";
import { getReferenceRow, type SeedType } from "@/lib/cultivation-reference";
import {
  getGeneticsCatalogAlphabetically,
  searchGeneticsByName,
  type GeneticReferenceEntry,
  type GeneticType
} from "@/lib/genetics-catalog";
import type { CalendarEvent, CalendarEventKind, Dictionary } from "@/lib/types";

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

const reviewSuggestionPresetFields: ReminderPresetFields[] = [
  {
    moistureReminder: "0",
    photoReminder: "0"
  },
  {
    maintenanceReminder: "7",
    moistureReminder: "0",
    pestReminder: "7",
    photoReminder: "7",
    recurrenceDays: "7",
    recurrenceEnd: "30"
  },
  {
    maintenanceReminder: "7",
    nutritionReminder: "7",
    pestReminder: "7",
    structureReminder: "7"
  },
  {
    closingReminder: "7",
    dryingReminder: "14",
    photoReminder: "7",
    stageReminder: "7"
  }
];

const geneticsCatalogAlphabetically = getGeneticsCatalogAlphabetically();

export function ManualCannabisForm({
  calendarHref,
  calendarLinkHref,
  dictionary,
  onCreateEvents,
  selectedGeneticName
}: {
  /** Con prefijo del repo: se usa en window.location. */
  calendarHref: string;
  /** Sin prefijo: se usa en next/link, que lo agrega solo. */
  calendarLinkHref: string;
  dictionary: Dictionary;
  onCreateEvents: (events: CalendarEvent[]) => void;
  selectedGeneticName?: string;
}) {
  const manualForm = dictionary.seeds.manualForm;
  const seedTypeOptions = manualForm.seedTypeOptions;
  const reviewSuggestionPresets = manualForm.presets.map((preset, index) => ({
    ...preset,
    fields: reviewSuggestionPresetFields[index]
  }));
  const geneticSelectOptions = [
    { label: manualForm.pickGeneticPlaceholder, value: "No seleccionada" },
    ...geneticsCatalogAlphabetically.map((genetic) => ({
      label: genetic.name,
      value: genetic.name
    }))
  ];

  const [seedType, setSeedType] = useState<SeedType>("feminized");
  const [geneticName, setGeneticName] = useState(selectedGeneticName || "No seleccionada");
  const [daysToFlower, setDaysToFlower] = useState(manualForm.daysToFlowerOptions[0]);
  const [floweringWeeks, setFloweringWeeks] = useState(manualForm.floweringWeeksOptions[0]);
  const [spaceType, setSpaceType] = useState(manualForm.spaceTypeOptions[0]);
  const [indoorSize, setIndoorSize] = useState(manualForm.indoorSizeOptions[0]);
  const [lightType, setLightType] = useState(manualForm.lightTypeOptions[0]);
  const [potLiters, setPotLiters] = useState(manualForm.potOptions[0]);
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
        description: manualForm.eventMoistureDescription,
        kind: "watering",
        title: manualForm.eventMoistureTitle,
        value: moistureReminder
      },
      {
        description: manualForm.eventStageDescription,
        kind: "review",
        title: manualForm.eventStageTitle,
        value: stageReminder
      },
      {
        description: manualForm.eventDryingDescription,
        kind: "review",
        title: manualForm.eventDryingTitle,
        value: dryingReminder
      },
      {
        description: manualForm.eventMaintenanceDescription,
        kind: "cleaning",
        title: manualForm.eventMaintenanceTitle,
        value: maintenanceReminder
      },
      {
        description: manualForm.eventPhotoDescription,
        kind: "photo",
        title: manualForm.eventPhotoTitle,
        value: photoReminder
      },
      {
        description: manualForm.eventStructureDescription,
        kind: "review",
        title: manualForm.eventStructureTitle,
        value: structureReminder
      },
      {
        description: manualForm.eventNutritionDescription,
        kind: "review",
        title: manualForm.eventNutritionTitle,
        value: nutritionReminder
      },
      {
        description: manualForm.eventPestDescription,
        kind: "review",
        title: manualForm.eventPestTitle,
        value: pestReminder
      },
      {
        description: manualForm.eventClosingDescription,
        kind: "review",
        title: manualForm.eventClosingTitle,
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
        const geneticSuffix = formatDictionaryString(manualForm.eventGeneticSuffixTemplate, { name: geneticName });
        const typeSuffix = formatDictionaryString(manualForm.eventTypeSuffixTemplate, {
          type: formatSeedType(seedType, dictionary)
        });

        return {
          completedDates: [],
          description: `${definition.description} ${geneticSuffix} ${typeSuffix}`,
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
      setStatusMessage(manualForm.noManualDatesMessage);
      setShowCalendarLink(false);
      return;
    }

    onCreateEvents(nextEvents);
    setStatusMessage(formatDictionaryString(manualForm.eventsAddedMessageTemplate, { count: String(nextEvents.length) }));
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
    setStatusMessage(formatDictionaryString(manualForm.suggestionAppliedTemplate, { title }));
    setShowCalendarLink(false);
  }

  return (
    <div className="grid gap-4">
      <FormGroup title={manualForm.groupIdentification}>
        <FormSelect dictionary={dictionary} label={manualForm.bankLabel} options={manualForm.bankOptions} recentKey="bank" />
        <GeneticPredictiveSelect dictionary={dictionary} geneticSelectOptions={geneticSelectOptions} value={geneticName} onChange={setGeneticName} />
        <FormSelect dictionary={dictionary} label={manualForm.legalRegistrationLabel} options={manualForm.legalRegistrationOptions} />
      </FormGroup>

      <FormGroup title={manualForm.groupCultivationData}>
        <GeneticDataReference
          daysToFlower={daysToFlower}
          dictionary={dictionary}
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
          seedTypeOptions={seedTypeOptions}
          visualReference={visualReference}
        />
        <FormSelect allowClipboardPaste dictionary={dictionary} label={manualForm.spaceTypeLabel} options={manualForm.spaceTypeOptions} value={spaceType} onChange={setSpaceType} />
        <FormSelect allowClipboardPaste dictionary={dictionary} label={manualForm.indoorSizeLabel} options={manualForm.indoorSizeOptions} recentKey="indoor-size" value={indoorSize} onChange={setIndoorSize} />
        <FormSelect
          allowClipboardPaste
          dictionary={dictionary}
          label={manualForm.lightTypeLabel}
          options={manualForm.lightTypeOptions}
          recentKey="light-type"
          value={lightType}
          onChange={setLightType}
        />
      </FormGroup>

      <FormGroup title={manualForm.groupDatesReminders}>
        <ReviewSuggestionPanel dictionary={dictionary} presets={reviewSuggestionPresets} onApply={applyReviewSuggestion} />
        <FormSelect dictionary={dictionary} label={manualForm.moistureLabel} options={manualForm.reminderOptions} value={moistureReminder} onChange={setMoistureReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.stageLabel} options={manualForm.reminderOptions} value={stageReminder} onChange={setStageReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.dryingLabel} options={manualForm.reminderOptions} value={dryingReminder} onChange={setDryingReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.maintenanceLabel} options={manualForm.reminderOptions} value={maintenanceReminder} onChange={setMaintenanceReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.photoLabel} options={manualForm.reminderOptions} value={photoReminder} onChange={setPhotoReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.structureLabel} options={manualForm.reminderOptions} value={structureReminder} onChange={setStructureReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.nutritionLabel} options={manualForm.reminderOptions} value={nutritionReminder} onChange={setNutritionReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.pestLabel} options={manualForm.reminderOptions} value={pestReminder} onChange={setPestReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.closingLabel} options={manualForm.reminderOptions} value={closingReminder} onChange={setClosingReminder} />
        <FormSelect dictionary={dictionary} label={manualForm.recurrenceLabel} options={manualForm.recurrenceOptions} value={recurrenceDays} onChange={setRecurrenceDays} />
        <FormSelect dictionary={dictionary} label={manualForm.recurrenceEndLabel} options={manualForm.recurrenceEndOptions} value={recurrenceEnd} onChange={setRecurrenceEnd} />
      </FormGroup>

      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-button" type="button" onClick={handleCreateEvents}>
          {manualForm.createEventsButton}
        </button>
        {statusMessage ? <span className="text-sm font-bold text-stone-600">{statusMessage}</span> : null}
        {showCalendarLink ? (
          <Link className="secondary-button" href={calendarLinkHref as Route}>
            {manualForm.viewCalendarLink}
          </Link>
        ) : null}
      </div>

      <p className="text-xs font-bold leading-5 text-stone-600">{manualForm.disclaimerText}</p>
    </div>
  );
}

function ReviewSuggestionPanel({
  dictionary,
  onApply,
  presets
}: {
  dictionary: Dictionary;
  onApply: (fields: ReminderPresetFields, title: string) => void;
  presets: Array<{ fields: ReminderPresetFields; summary: string; title: string }>;
}) {
  const manualForm = dictionary.seeds.manualForm;

  return (
    <div className="review-suggestion-panel sm:col-span-2">
      <div className="review-suggestion-header">
        <div>
          <p>{manualForm.suggestedAgendaLabel}</p>
          <strong>{manualForm.quickManualReviewsLabel}</strong>
        </div>
        <span>{manualForm.editableLabel}</span>
      </div>
      <div className="review-suggestion-grid">
        {presets.map((preset) => (
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
      <p className="review-suggestion-note">{manualForm.presetsNote}</p>
    </div>
  );
}

function GeneticDataReference({
  daysToFlower,
  dictionary,
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
  seedTypeOptions,
  visualReference
}: {
  daysToFlower: string;
  dictionary: Dictionary;
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
  seedTypeOptions: Array<{ label: string; value: string }>;
  visualReference?: ReturnType<typeof getReferenceRow>;
}) {
  const manualForm = dictionary.seeds.manualForm;
  const referenceFloweringWeeks = genetic
    ? formatWeekRange(genetic.flowering_weeks_range, dictionary)
    : visualReference?.flowering_weeks_range ?? dictionary.seeds.notDeclared;
  const referenceDaysToFlower = visualReference?.days_to_flower_range ?? dictionary.seeds.notDeclared;
  const geneticType = genetic ? formatGeneticType(genetic.type, dictionary) : manualForm.geneticTypeReferenceLabel;
  const thcReference = genetic ? formatThcRange(genetic.thc_percent_range, dictionary) : dictionary.seeds.notDeclared;

  return (
    <article className="manual-reference-card sm:col-span-2" aria-label={manualForm.referenceNotAutocompleteLabel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase text-stone-500">{manualForm.referenceNotAutocompleteLabel}</p>
          <h4 className="mt-1 font-black text-moss-950">{genetic?.name ?? manualForm.pickGeneticPlaceholder}</h4>
          <p className="mt-1 text-sm font-bold text-stone-600">
            {genetic ? `${genetic.cross} - ${genetic.source}` : manualForm.referenceHelpText}
          </p>
        </div>
        <span className="mode-badge manual">{dictionary.seeds.modeManual}</span>
      </div>
      <div className="reference-field-grid">
        <ReferenceFieldPair destination={dictionary.seeds.targetDeclaredType} dictionary={dictionary} label={manualForm.geneticTypeReferenceLabel} value={geneticType}>
          <FormSelect
            allowClipboardPaste
            dictionary={dictionary}
            label={dictionary.seeds.targetDeclaredType}
            options={seedTypeOptions}
            value={seedType}
            onChange={onSeedTypeChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair destination={dictionary.seeds.targetDaysToFlower} dictionary={dictionary} label={manualForm.daysToFlowerReferenceLabel} value={referenceDaysToFlower}>
          <FormSelect
            allowClipboardPaste
            dictionary={dictionary}
            label={dictionary.seeds.targetDaysToFlower}
            options={manualForm.daysToFlowerOptions}
            value={daysToFlower}
            onChange={onDaysToFlowerChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair destination={dictionary.seeds.targetFloweringWeeks} dictionary={dictionary} label={manualForm.floweringReferenceLabel} value={referenceFloweringWeeks}>
          <FormSelect
            allowClipboardPaste
            dictionary={dictionary}
            label={dictionary.seeds.targetFloweringWeeks}
            options={manualForm.floweringWeeksOptions}
            value={floweringWeeks}
            onChange={onFloweringWeeksChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair destination={dictionary.seeds.targetPotLiters} dictionary={dictionary} label={manualForm.potReferenceLabel} value={visualReference?.pot_liters_range ?? dictionary.seeds.notDeclared}>
          <FormSelect
            allowClipboardPaste
            dictionary={dictionary}
            label={dictionary.seeds.targetPotLiters}
            options={manualForm.potOptions}
            recentKey="pot-liters"
            value={potLiters}
            onChange={onPotLitersChange}
          />
        </ReferenceFieldPair>
        <ReferenceFieldPair destination={dictionary.seeds.targetGeneticNote} dictionary={dictionary} label={manualForm.thcReferenceLabel} value={thcReference}>
          <FormTextInput
            allowClipboardPaste
            dictionary={dictionary}
            label={dictionary.seeds.targetGeneticNote}
            placeholder={manualForm.thcNotePlaceholder}
            value={geneticNote}
            onChange={onGeneticNoteChange}
          />
        </ReferenceFieldPair>
      </div>
      {genetic?.raw_fields ? <RawFieldsPanel dictionary={dictionary} fields={genetic.raw_fields} /> : null}
    </article>
  );
}

function ReferenceFieldPair({
  children,
  destination,
  dictionary,
  label,
  value
}: {
  children: ReactNode;
  destination: string;
  dictionary: Dictionary;
  label: string;
  value: string;
}) {
  return (
    <div className="reference-field-pair">
      <ReferenceValue destination={destination} dictionary={dictionary} label={label} value={value} />
      <div className="reference-destination-control">{children}</div>
    </div>
  );
}

function ReferenceValue({
  destination,
  dictionary,
  label,
  value
}: {
  destination?: string;
  dictionary: Dictionary;
  label: string;
  value: string;
}) {
  const resolvedDestination = destination ?? getManualReferenceTarget(label, dictionary);

  return (
    <div className="reference-value">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="reference-copy-row">
        <span className="reference-target-field">
          {formatDictionaryString(dictionary.seeds.copyFieldPrefix, { field: resolvedDestination })}
        </span>
        <CopyValueButton label={resolvedDestination} value={value} />
      </div>
    </div>
  );
}

function RawFieldsPanel({
  dictionary,
  fields
}: {
  dictionary: Dictionary;
  fields: NonNullable<GeneticReferenceEntry["raw_fields"]>;
}) {
  return (
    <details className="mt-3 rounded-md border border-moss-950/10 bg-white/70 p-2">
      <summary className="cursor-pointer text-xs font-black uppercase text-stone-500">
        {dictionary.seeds.reference.rawFieldsSummary}
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {Object.entries(fields).map(([label, rawValue]) => {
          const value = rawValue === null ? dictionary.seeds.notDeclared : String(rawValue);
          return <ReferenceValue dictionary={dictionary} key={label} label={label} value={value} />;
        })}
      </div>
    </details>
  );
}

function getManualReferenceTarget(label: string, dictionary: Dictionary) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("floracion") || normalizedLabel.includes("ciclo")) return dictionary.seeds.targetFloweringWeeks;
  if (normalizedLabel.includes("flora")) return dictionary.seeds.targetDaysToFlower;
  if (normalizedLabel.includes("tipo")) return dictionary.seeds.targetDeclaredType;
  if (normalizedLabel.includes("maceta")) return dictionary.seeds.targetPotLiters;
  if (normalizedLabel.includes("luz")) return dictionary.seeds.targetLightType;
  return dictionary.seeds.manualForm.manualTargetGenericLabel;
}

function FormGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="manual-form-group rounded-lg border border-moss-950/10 bg-white/70 p-3">
      <h3 className="text-xs font-black uppercase text-stone-500">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function GeneticPredictiveSelect({
  dictionary,
  geneticSelectOptions,
  onChange,
  value
}: {
  dictionary: Dictionary;
  geneticSelectOptions: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  value: string;
}) {
  const manualForm = dictionary.seeds.manualForm;
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
        {manualForm.searchGeneticLabel}
        <input
          aria-label={manualForm.searchGeneticAriaLabel}
          className="form-control"
          list="manual-genetic-options"
          placeholder={manualForm.searchGeneticPlaceholder}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            onChange(nextQuery.trim() ? nextQuery : "No seleccionada");
          }}
        />
        <datalist id="manual-genetic-options">
          {geneticSelectOptions.slice(1).map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      </label>

      {showResults ? (
        <div className="genetic-suggestion-list" aria-label={manualForm.suggestionsAriaLabel}>
          {results.slice(0, 6).map((genetic) => (
            <button
              className="genetic-suggestion-option"
              key={genetic.id}
              onClick={() => chooseGenetic(genetic)}
              type="button"
            >
              <strong>{genetic.name}</strong>
              <span>{formatGeneticType(genetic.type, dictionary)} - {formatWeekRange(genetic.flowering_weeks_range, dictionary)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedGenetic ? (
        <article className="selected-genetic-card">
          <div>
            <span>{manualForm.selectedGeneticLabel}</span>
            <strong>{selectedGenetic.name}</strong>
            <small>{selectedGenetic.source}</small>
          </div>
          <dl>
            <div>
              <dt>{manualForm.typeLabel}</dt>
              <dd>{formatGeneticType(selectedGenetic.type, dictionary)}</dd>
            </div>
            <div>
              <dt>{manualForm.floweringLabel}</dt>
              <dd>{formatWeekRange(selectedGenetic.flowering_weeks_range, dictionary)}</dd>
            </div>
          </dl>
        </article>
      ) : (
        <p className="genetic-entry-help">{manualForm.noGeneticHelp}</p>
      )}

      <div className="genetic-count-note">
        {formatDictionaryString(manualForm.geneticsAvailableCountTemplate, { count: String(geneticsCatalogAlphabetically.length) })}
      </div>
    </div>
  );
}

function FormSelect({
  allowClipboardPaste = false,
  dictionary,
  label,
  onChange,
  options,
  recentKey,
  value
}: {
  allowClipboardPaste?: boolean;
  dictionary: Dictionary;
  label: string;
  onChange?: (value: string) => void;
  options: string[] | Array<{ label: string; value: string }>;
  recentKey?: string;
  value?: string;
}) {
  const manualForm = dictionary.seeds.manualForm;
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { label: option, value: option } : option));
  const { recentOptions, rememberOption } = useRecentOptions(recentKey, normalizedOptions);
  const [pasteStatus, setPasteStatus] = useState("");
  const isControlled = typeof value === "string";
  const currentValue = value ?? normalizedOptions[0]?.value ?? "";
  const pastedOption =
    isControlled && currentValue && !normalizedOptions.some((option) => option.value === currentValue)
      ? { label: formatDictionaryString(manualForm.pastedOptionLabelTemplate, { value: currentValue }), value: currentValue }
      : null;
  const regularOptions = normalizedOptions.filter((option) => !recentOptions.some((recentOption) => recentOption.value === option.value));

  function applyValue(nextValue: string) {
    rememberOption(nextValue);
    onChange?.(nextValue);
  }

  async function handlePasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setPasteStatus(manualForm.pasteUnsupported);
      return;
    }

    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();

      if (!clipboardText) {
        setPasteStatus(manualForm.pasteEmptyClipboard);
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
      setPasteStatus(formatDictionaryString(manualForm.pastedIntoTemplate, { label }));
    } catch {
      setPasteStatus(manualForm.pasteFailed);
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
            {recentOptions.length > 0 ? <option disabled>{manualForm.recentlyUsedLabel}</option> : null}
            {recentOptions.map((option) => (
              <option key={`recent-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
            {recentOptions.length > 0 ? <option disabled>{manualForm.optionsLabel}</option> : null}
            {regularOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {allowClipboardPaste ? (
            <button className="paste-value-button" onClick={handlePasteFromClipboard} type="button">
              {manualForm.pasteButton}
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
  dictionary,
  label,
  onChange,
  placeholder,
  value
}: {
  allowClipboardPaste?: boolean;
  dictionary: Dictionary;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const manualForm = dictionary.seeds.manualForm;
  const [pasteStatus, setPasteStatus] = useState("");

  async function handlePasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setPasteStatus(manualForm.pasteUnsupported);
      return;
    }

    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();

      if (!clipboardText) {
        setPasteStatus(manualForm.pasteEmptyClipboard);
        return;
      }

      onChange(clipboardText);
      setPasteStatus(formatDictionaryString(manualForm.pastedIntoTemplate, { label }));
    } catch {
      setPasteStatus(manualForm.pasteFailed);
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
              {manualForm.pasteButton}
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

function formatSeedType(type: SeedType, dictionary: Dictionary) {
  if (type === "autoflowering") return dictionary.seeds.geneticTypeAutoflowering;
  if (type === "regular") return dictionary.seeds.geneticTypeRegular;
  return dictionary.seeds.geneticTypeFeminized;
}

function formatGeneticType(type: GeneticType, dictionary: Dictionary) {
  if (type === "autoflowering") return dictionary.seeds.geneticTypeAutoflowering;
  if (type === "faster_flowering") return dictionary.seeds.geneticTypeFasterFlowering;
  if (type === "regular") return dictionary.seeds.geneticTypeRegular;
  return dictionary.seeds.geneticTypeFeminized;
}

function formatWeekRange(range: [number, number], dictionary: Dictionary) {
  return range[0] === range[1] ? `${range[0]} ${dictionary.seeds.weeksUnit}` : `${range[0]}-${range[1]} ${dictionary.seeds.weeksUnit}`;
}

function formatThcRange(range: [number, number], dictionary: Dictionary) {
  if (range[0] === 0 && range[1] === 0) return dictionary.seeds.notDeclared;
  return range[0] === range[1] ? `${range[0]}%` : `${range[0]}-${range[1]}%`;
}

function mapGeneticTypeToSeedType(type: GeneticType): SeedType {
  if (type === "autoflowering") return "autoflowering";
  if (type === "regular") return "regular";
  return "feminized";
}
