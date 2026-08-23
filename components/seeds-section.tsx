"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import { Card } from "@/components/card";
import { GeneticFinderWizard } from "@/components/genetic-finder-wizard";
import { HorticultureCalculator } from "@/components/horticulture-calculator";
import { NutrientCalculator } from "@/components/nutrient-calculator";
import { ManualCannabisForm } from "@/components/manual-cannabis-form";
import { CopyValueButton } from "@/components/copy-button";
import {
  CULTIVATION_REFERENCE,
  type CultivationReferenceRow
} from "@/lib/cultivation-reference";
import {
  getGeneticsCatalogAlphabetically,
  searchGeneticsByName,
  type GeneticReferenceEntry
} from "@/lib/genetics-catalog";
import { formatDictionaryString } from "@/lib/i18n";
import { seedCatalog } from "@/lib/seed-catalog";
import type { CalendarEvent, Dictionary, Locale } from "@/lib/types";

type SeedsSectionProps = {
  calendarHref: string;
  calendarLinkHref: string;
  dictionary: Dictionary;
  locale: Locale;
  onCreateManualEvents: (events: CalendarEvent[]) => void;
};

type SeedTab = "finder" | "manual" | "horticultural" | "setups" | "reference";

const regulatedSeedOptions = seedCatalog.filter((seed) => seed.regulated);
const geneticsCatalogAlphabetically = getGeneticsCatalogAlphabetically();

export function SeedsSection({ calendarHref, calendarLinkHref, dictionary, locale, onCreateManualEvents }: SeedsSectionProps) {
  const [activeTab, setActiveTab] = useState<SeedTab>("finder");
  const [selectedGeneticName, setSelectedGeneticName] = useState("");
  const shouldScrollToGeneticField = useRef(false);
  const tabs: Array<{ id: SeedTab; label: string }> = [
    { id: "finder", label: dictionary.seeds.tabFinder },
    { id: "manual", label: dictionary.seeds.tabManual },
    { id: "horticultural", label: dictionary.seeds.tabHorticultural },
    { id: "setups", label: dictionary.seeds.tabSetups },
    { id: "reference", label: dictionary.seeds.tabReference }
  ];
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const previousTab = activeTabIndex > 0 ? tabs[activeTabIndex - 1] : null;
  const nextTab = activeTabIndex >= 0 && activeTabIndex < tabs.length - 1 ? tabs[activeTabIndex + 1] : null;

  useEffect(() => {
    if (activeTab !== "manual" || !shouldScrollToGeneticField.current) {
      return;
    }

    shouldScrollToGeneticField.current = false;
    window.requestAnimationFrame(() => {
      const geneticField = document.getElementById("manual-genetic-selection");

      geneticField?.scrollIntoView({ behavior: "smooth", block: "start" });
      geneticField?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
  }, [activeTab, selectedGeneticName]);

  return (
    <section className="mx-auto mt-7 max-w-7xl px-4 sm:px-6 lg:px-8" id="seeds">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow={dictionary.seeds.eyebrow} title={dictionary.seeds.title} />
        <span className="pill pill-soft">{dictionary.seeds.legalRulePill}</span>
      </div>

      <div className="mt-4 rounded-lg border border-moss-950/10 bg-white/88 p-3 text-sm font-bold leading-6 text-stone-700">
        {dictionary.seeds.legalBannerText}
        <span className="mt-2 block">
          {dictionary.seeds.reprocannQuestion}{" "}
          <Link className="font-black text-emerald-800 underline underline-offset-4" href={"../privacidad/" as Route}>
            {dictionary.seeds.reprocannLink}
          </Link>
          .
        </span>
      </div>

      <div className="mt-5">
        <div className="seed-tabs" role="tablist" aria-label={dictionary.seeds.tabsAriaLabel}>
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "seed-tab active" : "seed-tab"}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "finder" ? (
            <GeneticFinderWizard
              onSelectGenetic={(name) => {
                shouldScrollToGeneticField.current = true;
                setSelectedGeneticName(name);
                setActiveTab("manual");
              }}
            />
          ) : null}

          {activeTab === "manual" ? (
            <Card as="section" aria-labelledby="manual-seed-title" className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow text-emerald-800">{dictionary.seeds.manualEyebrow}</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-moss-950" id="manual-seed-title">
                    {dictionary.seeds.manualTitle}
                  </h3>
                </div>
                <ModeBadge dictionary={dictionary} mode="manual" />
              </div>
              <div className="mt-4">
                {selectedGeneticName ? (
                  <div className="mb-3 rounded-lg border border-emerald-900/15 bg-mint-100/70 p-3 text-sm font-black text-moss-950">
                    {formatDictionaryString(dictionary.seeds.selectedFromFinder, { name: selectedGeneticName })}
                  </div>
                ) : null}
                <ManualCannabisForm
                  calendarHref={calendarHref}
                  calendarLinkHref={calendarLinkHref}
                  onCreateEvents={onCreateManualEvents}
                  selectedGeneticName={selectedGeneticName}
                />
              </div>
            </Card>
          ) : null}

          {activeTab === "horticultural" ? (
            <>
              <HorticultureCalculator />
              <NutrientCalculator />
            </>
          ) : null}

          {activeTab === "setups" ? <SetupSuggestionsTab dictionary={dictionary} /> : null}

          {activeTab === "reference" ? <ReferenceTab dictionary={dictionary} locale={locale} /> : null}
        </div>

        <nav className="tab-stepper" aria-label={dictionary.seeds.stepperAriaLabel}>
          <button
            className={previousTab ? "stepper-button secondary" : "stepper-button disabled"}
            disabled={!previousTab}
            onClick={() => previousTab && setActiveTab(previousTab.id)}
            type="button"
          >
            <span aria-hidden="true">←</span>
            <span>
              <small>{dictionary.seeds.stepperPrevious}</small>
              {previousTab?.label ?? dictionary.seeds.stepperStart}
            </span>
          </button>
          <button
            className={nextTab ? "stepper-button primary" : "stepper-button disabled"}
            disabled={!nextTab}
            onClick={() => nextTab && setActiveTab(nextTab.id)}
            type="button"
          >
            <span>
              <small>{dictionary.seeds.stepperNext}</small>
              {nextTab?.label ?? dictionary.seeds.stepperEnd}
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </nav>
      </div>
    </section>
  );
}

function SetupSuggestionsTab({ dictionary }: { dictionary: Dictionary }) {
  const setups = dictionary.seeds.setups;
  const [spaceType, setSpaceType] = useState("interior");
  const [setupId, setSetupId] = useState("80x80");
  const [outdoorPlace, setOutdoorPlace] = useState(setups.outdoorPlaces[0]);
  const [greenhousePlace, setGreenhousePlace] = useState(setups.greenhousePlaces[1]);
  const [geneticId, setGeneticId] = useState("");
  const selectedSetup = setups.presets.find((preset) => preset.id === setupId) ?? setups.presets[2];
  const selectedGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === geneticId);
  const isInterior = spaceType === "interior";
  const isGreenhouse = spaceType === "greenhouse";
  const selectedPlace = isInterior ? selectedSetup.label : isGreenhouse ? greenhousePlace : outdoorPlace;

  return (
    <Card as="section" aria-labelledby="setup-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow={setups.eyebrow} id="setup-title" title={setups.title} />
        <ModeBadge dictionary={dictionary} mode="manual" />
      </div>

      <div className="mt-4 rounded-lg border border-moss-950/10 bg-white/88 p-3 text-sm font-bold leading-6 text-stone-700">
        {setups.introText}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="setup-builder">
          <label className="grid gap-1 text-sm font-black text-moss-950">
            {setups.sectorLabel}
            <select className="form-control" value={spaceType} onChange={(event) => setSpaceType(event.target.value)}>
              {setups.spaceTypes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {isInterior ? (
            <label className="grid gap-1 text-sm font-black text-moss-950">
              {setups.tentSizeLabel}
              <select className="form-control" value={setupId} onChange={(event) => setSetupId(event.target.value)}>
                {setups.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isInterior ? (
            <label className="grid gap-1 text-sm font-black text-moss-950">
              {isGreenhouse ? setups.greenhouseTypeLabel : setups.outdoorPlaceLabel}
              <select
                className="form-control"
                value={isGreenhouse ? greenhousePlace : outdoorPlace}
                onChange={(event) => {
                  if (isGreenhouse) {
                    setGreenhousePlace(event.target.value);
                    return;
                  }
                  setOutdoorPlace(event.target.value);
                }}
              >
                {(isGreenhouse ? setups.greenhousePlaces : setups.outdoorPlaces).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-1 text-sm font-black text-moss-950">
            {setups.referenceGeneticLabel}
            <select className="form-control" value={geneticId} onChange={(event) => setGeneticId(event.target.value)}>
              <option value="">{setups.noGeneticSelected}</option>
              {geneticsCatalogAlphabetically.map((genetic) => (
                <option key={genetic.id} value={genetic.id}>
                  {genetic.name} - {formatGeneticType(genetic.type, dictionary)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <article className="setup-hero-card">
          <div>
            <p className="text-[11px] font-black uppercase text-mint-50/80">{setups.selectedSetupLabel}</p>
            <h3>{selectedPlace}</h3>
            <p>{isInterior ? selectedSetup.bestFor : setups.outdoorBestFor}</p>
          </div>
          <span className="setup-grid-preview" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </article>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SetupSuggestionCard
          destination={dictionary.seeds.targetManualNote}
          dictionary={dictionary}
          label={setups.comfortableLabel}
          tone="green"
          value={isInterior ? selectedSetup.comfortable : setups.outdoorComfortableValue}
          note={setups.comfortableNote}
        />
        <SetupSuggestionCard
          destination={dictionary.seeds.targetManualNote}
          dictionary={dictionary}
          label={setups.compactLabel}
          tone="amber"
          value={isInterior ? selectedSetup.compact : setups.outdoorCompactValue}
          note={setups.compactNote}
        />
        <SetupSuggestionCard
          destination={dictionary.seeds.targetManualNote}
          dictionary={dictionary}
          label={setups.airflowLabel}
          tone="blue"
          value={isInterior ? selectedSetup.airflow : setups.outdoorAirflowValue}
          note={setups.airflowNote}
        />
        <SetupSuggestionCard
          destination={dictionary.seeds.targetLightType}
          dictionary={dictionary}
          label={setups.lightFitLabel}
          tone="teal"
          value={isInterior ? selectedSetup.lightFit : setups.outdoorLightValue}
          note={setups.lightFitNote}
        />
        <SetupSuggestionCard
          destination={dictionary.seeds.targetManualNote}
          dictionary={dictionary}
          label={setups.heightLabel}
          tone="soft"
          value={isInterior ? selectedSetup.plantHeight : setups.outdoorHeightValue}
          note={setups.heightNote}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="setup-cheatsheet">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-stone-500">{setups.selectedGeneticLabel}</p>
              <h3 className="mt-1 text-lg font-black text-moss-950">{selectedGenetic?.name ?? setups.noGeneticLabel}</h3>
            </div>
            <span className="mode-badge manual">{dictionary.seeds.modeManual}</span>
          </div>
          {selectedGenetic ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ReferenceFact destination={dictionary.seeds.targetDeclaredType} dictionary={dictionary} label={setups.geneticTypeLabel} value={formatGeneticType(selectedGenetic.type, dictionary)} />
              <ReferenceFact destination={dictionary.seeds.targetFloweringWeeks} dictionary={dictionary} label={setups.floweringPublishedLabel} value={formatRange(selectedGenetic.flowering_weeks_range, dictionary.seeds.weeksUnit)} />
              <ReferenceFact destination={dictionary.seeds.targetReferenceNote} dictionary={dictionary} label={setups.thcPublishedLabel} value={formatThcRange(selectedGenetic.thc_percent_range, dictionary)} />
              <ReferenceFact destination={dictionary.seeds.targetSourceNote} dictionary={dictionary} label={setups.sourceLabel} value={selectedGenetic.source} />
            </div>
          ) : (
            <p className="mt-3 text-sm font-bold leading-6 text-stone-700">
              {setups.pickGeneticHint}
            </p>
          )}
        </article>

        <article className="setup-cheatsheet">
          <p className="text-xs font-black uppercase text-stone-500">{setups.checklistLabel}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {setups.tasks.map((task) => (
              <ManualTaskTemplateCard dictionary={dictionary} key={task.title} task={task} />
            ))}
          </div>
        </article>
      </div>

      <div className="setup-cheatsheet mt-4">
        <p className="text-xs font-black uppercase text-stone-500">{setups.quickRuleLabel}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ReferenceFact destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={setups.potSmallLabel} value={setups.potSmallValue} />
          <ReferenceFact destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={setups.potMediumLabel} value={setups.potMediumValue} />
          <ReferenceFact destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={setups.potLargeLabel} value={setups.potLargeValue} />
        </div>
      </div>
    </Card>
  );
}

function ManualTaskTemplateCard({
  dictionary,
  task
}: {
  dictionary: Dictionary;
  task: {
    cadence: string;
    detail: string;
    title: string;
  };
}) {
  const value = `${task.title} - ${task.cadence}`;

  return (
    <div className="manual-task-template">
      <div className="flex items-start justify-between gap-2">
        <strong>{task.title}</strong>
        <CopyValueButton label={dictionary.seeds.setups.manualTaskFieldLabel} value={value} />
      </div>
      <span className="reference-target-field">{formatDictionaryString(dictionary.seeds.copyFieldPrefix, { field: dictionary.seeds.setups.manualTaskFieldLabel })}</span>
      <span>{task.cadence}</span>
      <p>{task.detail}</p>
    </div>
  );
}

function SetupSuggestionCard({
  destination,
  dictionary,
  label,
  note,
  tone,
  value
}: {
  destination: string;
  dictionary: Dictionary;
  label: string;
  note: string;
  tone: "amber" | "blue" | "green" | "soft" | "teal";
  value: string;
}) {
  return (
    <article className={`setup-card ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <p>{label}</p>
        <CopyValueButton label={destination} value={value} />
      </div>
      <span className="reference-target-field">{formatDictionaryString(dictionary.seeds.copyFieldPrefix, { field: destination })}</span>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function ReferenceTab({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  const reference = dictionary.seeds.reference;
  const [seedId, setSeedId] = useState(regulatedSeedOptions[0]?.id ?? "");
  const [geneticsSearch, setGeneticsSearch] = useState("");
  const [selectedGenetic, setSelectedGenetic] = useState<GeneticReferenceEntry | null>(null);
  const geneticsResults = useMemo(() => searchGeneticsByName(geneticsSearch), [geneticsSearch]);
  const showGeneticsResults = geneticsResults.length > 0 && geneticsSearch !== selectedGenetic?.name;
  const selectedSeed = regulatedSeedOptions.find((seed) => seed.id === seedId);
  const isSpanish = locale === "es";

  return (
    <Card as="section" aria-labelledby="reference-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow={reference.readOnly} id="reference-title" title={reference.title} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill pill-blue">{formatDictionaryString(reference.geneticsLoadedCount, { n: geneticsCatalogAlphabetically.length })}</span>
          <ModeBadge dictionary={dictionary} mode="manual" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-black text-moss-950">
            {reference.regulatedTypesLabel}
            <select className="form-control" value={seedId} onChange={(event) => setSeedId(event.target.value)}>
              {regulatedSeedOptions.map((seed) => (
                <option key={seed.id} value={seed.id}>
                  {seed.crop} - {seed.name}
                </option>
              ))}
            </select>
          </label>

          {selectedSeed ? (
            <div className="rounded-lg border border-moss-950/10 bg-paper/80 p-3">
              <ReferenceLine destination={dictionary.seeds.targetDeclaredType} dictionary={dictionary} label={reference.fieldType} value={selectedSeed.name} />
              <ReferenceLine destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={reference.fieldVariant} value={selectedSeed.seedType} />
              <ReferenceLine destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={reference.fieldNote} value={selectedSeed.careNote} />
            </div>
          ) : null}

          <label className="grid gap-1 text-sm font-black text-moss-950">
            {reference.chooseGeneticLabel}
            <select
              className="form-control"
              value={selectedGenetic?.id ?? ""}
              onChange={(event) => {
                const nextGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === event.target.value) ?? null;
                setSelectedGenetic(nextGenetic);
                setGeneticsSearch(nextGenetic?.name ?? "");
              }}
            >
              <option value="">{reference.noGeneticSelected}</option>
              {geneticsCatalogAlphabetically.map((genetic) => (
                <option key={genetic.id} value={genetic.id}>
                  {genetic.name} - {formatGeneticType(genetic.type, dictionary)} - {genetic.source}
                </option>
              ))}
            </select>
            <span className="text-xs font-bold leading-5 text-stone-600">
              {reference.alphabeticalListHint}
            </span>
          </label>

          <label className="grid gap-1 text-sm font-black text-moss-950">
            {reference.searchGeneticLabel}
            <input
              className="form-control"
              placeholder="Ej. Gorilla, AK 47, Red Skunk Auto, OBG Kush"
              value={geneticsSearch}
              onChange={(event) => setGeneticsSearch(event.target.value)}
            />
          </label>

          {showGeneticsResults ? (
            <div className="grid max-h-64 gap-1 overflow-auto rounded-lg border border-moss-950/10 bg-white/80 p-2">
              {geneticsResults.map((genetic) => (
                <button
                  className="rounded-md px-2.5 py-2 text-left text-sm font-black text-moss-950 transition hover:bg-mint-100"
                  key={genetic.id}
                  type="button"
                  onClick={() => {
                    setSelectedGenetic(genetic);
                    setGeneticsSearch(genetic.name);
                  }}
                >
                  {genetic.name}
                  <span className="ml-2 text-xs font-bold text-stone-500">{formatGeneticType(genetic.type, dictionary)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <details className="reference-details">
            <summary>{reference.byTypeSummary}</summary>
            <div className="mt-3 grid gap-3">
              {CULTIVATION_REFERENCE.map((row) => (
                <CultivationReferenceCard dictionary={dictionary} isSpanish={isSpanish} key={row.type} row={row} />
              ))}
            </div>
          </details>

          <details className="reference-details" open={Boolean(selectedGenetic)}>
            <summary>{reference.geneticsSheetSummary}</summary>
            <GeneticsReferencePanel dictionary={dictionary} genetic={selectedGenetic} />
          </details>
        </div>
      </div>
    </Card>
  );
}

function CultivationReferenceCard({ dictionary, isSpanish, row }: { dictionary: Dictionary; isSpanish: boolean; row: CultivationReferenceRow }) {
  const reference = dictionary.seeds.reference;
  return (
    <article className="rounded-lg border border-moss-950/10 bg-white/76 p-3 text-sm">
      <h4 className="font-black text-moss-950">{isSpanish ? row.label_es : row.label_en}</h4>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <ReferenceFact destination={dictionary.seeds.targetDaysToFlower} dictionary={dictionary} label={reference.fieldDaysToFlower} value={row.days_to_flower_range} />
        <ReferenceFact destination={dictionary.seeds.targetFloweringWeeks} dictionary={dictionary} label={reference.fieldFlowering} value={row.flowering_weeks_range} />
        <ReferenceFact destination={dictionary.seeds.targetPotLiters} dictionary={dictionary} label={reference.fieldPot} value={row.pot_liters_range} />
      </dl>
      <div className="mt-3 grid gap-2">
        <ReferenceTextBlock destination={dictionary.seeds.targetLightType} dictionary={dictionary} label={reference.fieldLight} value={isSpanish ? row.light_notes_es : row.light_notes_en} />
        <ReferenceTextBlock destination={dictionary.seeds.targetManualWateringNote} dictionary={dictionary} label={reference.fieldWatering} value={isSpanish ? row.watering_notes_es : row.watering_notes_en} />
      </div>
    </article>
  );
}

function GeneticsReferencePanel({ dictionary, genetic }: { dictionary: Dictionary; genetic: GeneticReferenceEntry | null }) {
  const reference = dictionary.seeds.reference;
  if (!genetic) {
    return (
      <div className="mt-3 rounded-lg border border-moss-950/10 bg-white/70 p-3 text-sm font-bold leading-6 text-stone-700">
        {reference.chooseGeneticHint}
      </div>
    );
  }

  return (
    <article className="mt-3 rounded-lg border border-moss-950/10 bg-white/76 p-3 text-sm">
      <h4 className="font-black text-moss-950">{genetic.name}</h4>
      <div className="mt-2">
        <ReferenceLine destination={dictionary.seeds.targetSourceNote} dictionary={dictionary} label={reference.fieldSource} value={genetic.source} />
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <ReferenceFact destination={dictionary.seeds.targetGeneticNote} dictionary={dictionary} label={reference.fieldCross} value={genetic.cross} />
        <ReferenceFact destination={dictionary.seeds.targetDeclaredType} dictionary={dictionary} label={reference.fieldType} value={formatGeneticType(genetic.type, dictionary)} />
        <ReferenceFact destination={dictionary.seeds.targetFloweringWeeks} dictionary={dictionary} label={reference.floweringPublished} value={formatRange(genetic.flowering_weeks_range, dictionary.seeds.weeksUnit)} />
        <ReferenceFact destination={dictionary.seeds.targetReferenceNote} dictionary={dictionary} label={reference.thcPublished} value={formatThcRange(genetic.thc_percent_range, dictionary)} />
      </dl>
      <div className="mt-3 grid gap-2">
        <ReferenceTextBlock destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={reference.fieldFlavor} value={genetic.flavor_notes} />
        <ReferenceTextBlock destination={dictionary.seeds.targetManualNote} dictionary={dictionary} label={reference.fieldEffect} value={genetic.effect_notes} />
      </div>
      {genetic.raw_fields ? <RawFieldsReference dictionary={dictionary} fields={genetic.raw_fields} /> : null}
    </article>
  );
}

function ModeBadge({ dictionary, mode }: { dictionary: Dictionary; mode: "automatic" | "manual" }) {
  return (
    <span className={mode === "automatic" ? "mode-badge automatic" : "mode-badge manual"}>
      {mode === "automatic" ? dictionary.seeds.modeAutomatic : dictionary.seeds.modeManual}
    </span>
  );
}

function SectionHeader({ eyebrow, id, title }: { eyebrow: string; id?: string; title: string }) {
  return (
    <div>
      <p className="eyebrow text-emerald-800">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-moss-950 sm:text-2xl" id={id}>
        {title}
      </h2>
    </div>
  );
}

function ReferenceFact({
  destination,
  dictionary,
  label,
  value,
}: {
  destination: string;
  dictionary: Dictionary;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-moss-950/10 bg-paper/80 px-2.5 py-2">
      <dt className="text-[11px] font-black uppercase text-stone-500">{label}</dt>
      <dd className="mt-1 break-words font-black text-moss-950">{value}</dd>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">
          {formatDictionaryString(dictionary.seeds.copyFieldPrefix, { field: destination })}
        </span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function ReferenceLine({
  destination,
  dictionary,
  label,
  value,
}: {
  destination: string;
  dictionary: Dictionary;
  label: string;
  value: string;
}) {
  return (
    <div className="py-1">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase text-stone-500">{label}</p>
        <p className="mt-1 break-words text-sm font-black text-moss-950">{value}</p>
      </div>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">
          {formatDictionaryString(dictionary.seeds.copyFieldPrefix, { field: destination })}
        </span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function ReferenceTextBlock({
  destination,
  dictionary,
  label,
  value,
}: {
  destination: string;
  dictionary: Dictionary;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-moss-950/10 bg-paper/80 p-2.5">
      <p className="text-[11px] font-black uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-stone-700">{value}</p>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">
          {formatDictionaryString(dictionary.seeds.copyFieldPrefix, { field: destination })}
        </span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function RawFieldsReference({
  dictionary,
  fields,
}: {
  dictionary: Dictionary;
  fields: NonNullable<GeneticReferenceEntry["raw_fields"]>;
}) {
  return (
    <details className="mt-3 rounded-lg border border-moss-950/10 bg-paper/80 p-3">
      <summary className="cursor-pointer text-xs font-black uppercase text-stone-500">
        {dictionary.seeds.reference.rawFieldsSummary}
      </summary>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(fields).map(([label, rawValue]) => {
          const value = rawValue === null ? dictionary.seeds.notDeclared : String(rawValue);
          return (
            <ReferenceFact
              key={label}
              destination={getReferenceTargetLabel(label)}
              dictionary={dictionary}
              label={label}
              value={value}
            />
          );
        })}
      </dl>
    </details>
  );
}

function formatRange([min, max]: [number, number], unit: string) {
  return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;
}

function formatThcRange([min, max]: [number, number], dictionary: Dictionary) {
  if (min === 0 && max === 0) return dictionary.seeds.notDeclared;
  return min === max ? `${min}%` : `${min}-${max}%`;
}

function formatGeneticType(type: GeneticReferenceEntry["type"], dictionary: Dictionary) {
  if (type === "autoflowering") return dictionary.seeds.geneticTypeAutoflowering;
  if (type === "faster_flowering") return dictionary.seeds.geneticTypeFasterFlowering;
  if (type === "regular") return dictionary.seeds.geneticTypeRegular;
  return dictionary.seeds.geneticTypeFeminized;
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
