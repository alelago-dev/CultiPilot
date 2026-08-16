"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import { Card } from "@/components/card";
import { GeneticFinderWizard } from "@/components/genetic-finder-wizard";
import { HorticultureCalculator } from "@/components/horticulture-calculator";
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
import { seedCatalog } from "@/lib/seed-catalog";
import type { CalendarEvent, Locale } from "@/lib/types";

type SeedsSectionProps = {
  calendarHref: string;
  calendarLinkHref: string;
  locale: Locale;
  onCreateManualEvents: (events: CalendarEvent[]) => void;
};

type SeedTab = "finder" | "manual" | "horticultural" | "setups" | "reference";

const tabs: Array<{ id: SeedTab; label: string }> = [
  { id: "finder", label: "Finder" },
  { id: "manual", label: "Mi cultivo" },
  { id: "horticultural", label: "Catalogo horticola" },
  { id: "setups", label: "Setups" },
  { id: "reference", label: "Referencia" }
];

const regulatedSeedOptions = seedCatalog.filter((seed) => seed.regulated);
const geneticsCatalogAlphabetically = getGeneticsCatalogAlphabetically();
const spaceTypeOptions = [
  { id: "interior", label: "Interior" },
  { id: "exterior", label: "Exterior" },
  { id: "greenhouse", label: "Invernaculo" }
];
const outdoorPlaceOptions = [
  "Terraza",
  "Balcon",
  "Patio",
  "Jardin",
  "Region aproximada"
];
const greenhousePlaceOptions = [
  "Mini invernaculo",
  "Invernaculo chico",
  "Invernaculo mediano",
  "Tunel",
  "Otro espacio declarado"
];
const setupPresets = [
  {
    id: "40x40",
    label: "40 x 40 cm",
    comfortable: "1 maceta de 7-10 L",
    compact: "2 macetas de 3-5 L",
    airflow: "Dejar margen libre para riego, poda sanitaria o revision visual.",
    lightFit: "LED compacto de bajo calor; evitar sodio por temperatura y poca altura.",
    plantHeight: "20-45 cm de altura util declarada",
    bestFor: "Plantin, aromatica, planta compacta o prueba de genetica declarada."
  },
  {
    id: "60x60",
    label: "60 x 60 cm",
    comfortable: "1 maceta de 15-20 L o 2 macetas de 7-10 L",
    compact: "4 macetas de 3-5 L si se prioriza variedad y registro individual",
    airflow: "Conviene no llenar toda la base: dejar pasillo visual y espacio para bandeja.",
    lightFit: "LED de panel compacto; sodio solo si el usuario declara extraccion y temperatura controlada.",
    plantHeight: "35-65 cm de altura util declarada",
    bestFor: "Espacio chico con seguimiento simple."
  },
  {
    id: "80x80",
    label: "80 x 80 cm",
    comfortable: "2 macetas de 15-20 L o 4 macetas de 7-11 L",
    compact: "6 macetas de 5-7 L si el usuario declara plantas chicas",
    airflow: "Configuracion equilibrada: 4 macetas deja buena lectura de hojas y acceso al sustrato.",
    lightFit: "LED full spectrum mediano o mixta; sodio solo con control termico declarado.",
    plantHeight: "50-90 cm de altura util declarada",
    bestFor: "Setup mediano: buen balance entre orden, fotos y mantenimiento."
  },
  {
    id: "100x100",
    label: "100 x 100 cm",
    comfortable: "4 macetas de 15-20 L",
    compact: "6 macetas de 10-11 L",
    airflow: "Usar grilla 2x2 para manejo comodo o 3x2 si se acepta menos espacio de acceso.",
    lightFit: "LED mediano/grande; sodio compatible solo con buena extraccion y distancia fisica.",
    plantHeight: "70-110 cm de altura util declarada",
    bestFor: "Varias plantas con bitacora separada."
  },
  {
    id: "120x120",
    label: "120 x 120 cm",
    comfortable: "4 macetas de 20-25 L o 6 macetas de 15 L",
    compact: "9 macetas de 10-11 L",
    airflow: "Priorizar circulacion y acceso frontal; no bloquear esquinas de revision.",
    lightFit: "LED modular, mixta o sodio si el usuario declara control termico suficiente.",
    plantHeight: "80-130 cm de altura util declarada",
    bestFor: "Espacio amplio con calendario por planta."
  }
];
const manualTaskTemplates = [
  {
    title: "Revision de humedad",
    cadence: "Manual o recurrente",
    detail: "Registrar tacto, peso de maceta o sensor antes de decidir si corresponde regar."
  },
  {
    title: "Registro fotografico",
    cadence: "Manual semanal",
    detail: "Tomar fotos comparables por planta para ver evolucion y dejar evidencia de seguimiento."
  },
  {
    title: "Limpieza y mantenimiento",
    cadence: "Manual",
    detail: "Anotar limpieza, filtros, ventilacion, orden de cables o estado general del espacio."
  },
  {
    title: "Trabajo de estructura / poda",
    cadence: "Fecha definida por usuario",
    detail: "Usar solo como recordatorio de una tarea decidida previamente por el cultivador."
  },
  {
    title: "Nutricion / fertilizacion",
    cadence: "Fecha definida por usuario",
    detail: "Registrar producto, dosis declarada por el usuario y observaciones posteriores."
  },
  {
    title: "Prevencion de plagas",
    cadence: "Revision visual",
    detail: "Agendar inspeccion de hojas, sustrato y entorno sin guardar domicilios exactos."
  },
  {
    title: "Cambio de etapa declarado",
    cadence: "Fecha definida por usuario",
    detail: "Marcar hitos cargados manualmente para que el calendario los recuerde."
  },
  {
    title: "Cierre de riego / fertilizacion",
    cadence: "Fecha definida por usuario",
    detail: "Recordar una decision ya tomada por el usuario, sin calcularla desde la genetica."
  }
];

export function SeedsSection({ calendarHref, calendarLinkHref, locale, onCreateManualEvents }: SeedsSectionProps) {
  const [activeTab, setActiveTab] = useState<SeedTab>("finder");
  const [selectedGeneticName, setSelectedGeneticName] = useState("");
  const shouldScrollToGeneticField = useRef(false);
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
        <SectionHeader eyebrow="Semillas" title="Registro y referencia" />
        <span className="pill pill-soft">Regla legal activa</span>
      </div>

      <div className="mt-4 rounded-lg border border-moss-950/10 bg-white/88 p-3 text-sm font-bold leading-6 text-stone-700">
        Para cannabis o cultivos regulados, las referencias son solo lectura y no completan ni calculan campos. Las
        estimaciones automaticas quedan limitadas al catalogo horticola no regulado.
        <span className="mt-2 block">
          ¿Estas registrado en REPROCANN?{" "}
          <Link className="font-black text-emerald-800 underline underline-offset-4" href={"../privacidad/" as Route}>
            Consulta la informacion legal y de privacidad
          </Link>
          .
        </span>
      </div>

      <div className="mt-5">
        <div className="seed-tabs" role="tablist" aria-label="Secciones de semillas">
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
                  <p className="eyebrow text-emerald-800">Carga manual</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-moss-950" id="manual-seed-title">
                    Mi cultivo
                  </h3>
                </div>
                <ModeBadge mode="manual" />
              </div>
              <div className="mt-4">
                {selectedGeneticName ? (
                  <div className="mb-3 rounded-lg border border-emerald-900/15 bg-mint-100/70 p-3 text-sm font-black text-moss-950">
                    Semilla seleccionada desde Finder: {selectedGeneticName}
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

          {activeTab === "horticultural" ? <HorticultureCalculator /> : null}

          {activeTab === "setups" ? <SetupSuggestionsTab /> : null}

          {activeTab === "reference" ? <ReferenceTab locale={locale} /> : null}
        </div>

        <nav className="tab-stepper" aria-label="Avanzar entre solapas de semillas">
          <button
            className={previousTab ? "stepper-button secondary" : "stepper-button disabled"}
            disabled={!previousTab}
            onClick={() => previousTab && setActiveTab(previousTab.id)}
            type="button"
          >
            <span aria-hidden="true">←</span>
            <span>
              <small>Solapa anterior</small>
              {previousTab?.label ?? "Inicio"}
            </span>
          </button>
          <button
            className={nextTab ? "stepper-button primary" : "stepper-button disabled"}
            disabled={!nextTab}
            onClick={() => nextTab && setActiveTab(nextTab.id)}
            type="button"
          >
            <span>
              <small>Siguiente solapa</small>
              {nextTab?.label ?? "Fin"}
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </nav>
      </div>
    </section>
  );
}

function SetupSuggestionsTab() {
  const [spaceType, setSpaceType] = useState("interior");
  const [setupId, setSetupId] = useState("80x80");
  const [outdoorPlace, setOutdoorPlace] = useState(outdoorPlaceOptions[0]);
  const [greenhousePlace, setGreenhousePlace] = useState(greenhousePlaceOptions[1]);
  const [geneticId, setGeneticId] = useState("");
  const selectedSetup = setupPresets.find((preset) => preset.id === setupId) ?? setupPresets[2];
  const selectedGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === geneticId);
  const isInterior = spaceType === "interior";
  const isGreenhouse = spaceType === "greenhouse";
  const selectedPlace = isInterior ? selectedSetup.label : isGreenhouse ? greenhousePlace : outdoorPlace;

  return (
    <Card as="section" aria-labelledby="setup-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="Sugerencias" id="setup-title" title="Setups de carpa y macetas" />
        <ModeBadge mode="manual" />
      </div>

      <div className="mt-4 rounded-lg border border-moss-950/10 bg-white/88 p-3 text-sm font-bold leading-6 text-stone-700">
        Configura el contexto de cultivo legal para tomar decisiones manuales. La app muestra referencias de espacio y
        genetica, pero no calcula cosecha, rendimiento, riego ni labores para cultivos regulados.
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="setup-builder">
          <label className="grid gap-1 text-sm font-black text-moss-950">
            Sector de cultivo
            <select className="form-control" value={spaceType} onChange={(event) => setSpaceType(event.target.value)}>
              {spaceTypeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {isInterior ? (
            <label className="grid gap-1 text-sm font-black text-moss-950">
              Tamano de carpa / indoor
              <select className="form-control" value={setupId} onChange={(event) => setSetupId(event.target.value)}>
                {setupPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isInterior ? (
            <label className="grid gap-1 text-sm font-black text-moss-950">
              {isGreenhouse ? "Tipo de invernaculo" : "Lugar exterior"}
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
                {(isGreenhouse ? greenhousePlaceOptions : outdoorPlaceOptions).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-1 text-sm font-black text-moss-950">
            Genetica de referencia
            <select className="form-control" value={geneticId} onChange={(event) => setGeneticId(event.target.value)}>
              <option value="">Sin genetica seleccionada</option>
              {geneticsCatalogAlphabetically.map((genetic) => (
                <option key={genetic.id} value={genetic.id}>
                  {genetic.name} - {formatGeneticType(genetic.type)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <article className="setup-hero-card">
          <div>
            <p className="text-[11px] font-black uppercase text-mint-50/80">Setup seleccionado</p>
            <h3>{selectedPlace}</h3>
            <p>{isInterior ? selectedSetup.bestFor : "Espacio declarado por el usuario para organizar calendario y bitacora."}</p>
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
          label="Comodo"
          tone="green"
          value={isInterior ? selectedSetup.comfortable : "Definir cantidad de plantas segun acceso, normativa y registro declarado"}
          note="Menos plantas, mas acceso para revisar y registrar."
        />
        <SetupSuggestionCard
          label="Compacto"
          tone="amber"
          value={isInterior ? selectedSetup.compact : "Mantener separacion suficiente para inspeccion visual y fotos"}
          note="Mas macetas, requiere mejor orden y etiquetas claras."
        />
        <SetupSuggestionCard
          label="Circulacion"
          tone="blue"
          value={isInterior ? selectedSetup.airflow : "Dejar margen para caminar, revisar hojas, mover macetas y proteger del clima"}
          note="Pensado para mantenimiento, fotos y lectura visual."
        />
        <SetupSuggestionCard
          label="Luz compatible"
          tone="teal"
          value={isInterior ? selectedSetup.lightFit : "Luz natural declarada; registrar sombra, viento y exposicion aproximada"}
          note="Referencia por calor y espacio; el usuario declara el equipo real."
        />
        <SetupSuggestionCard
          label="Altura util"
          tone="soft"
          value={isInterior ? selectedSetup.plantHeight : "Altura declarada por el usuario segun privacidad, viento y soporte"}
          note="Margen fisico para no perder acceso ni tocar luminaria o techo."
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="setup-cheatsheet">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-stone-500">Genetica seleccionada</p>
              <h3 className="mt-1 text-lg font-black text-moss-950">{selectedGenetic?.name ?? "Sin genetica"}</h3>
            </div>
            <span className="mode-badge manual">Manual</span>
          </div>
          {selectedGenetic ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ReferenceFact label="Tipo" value={formatGeneticType(selectedGenetic.type)} />
              <ReferenceFact label="Floracion publicada" value={formatRange(selectedGenetic.flowering_weeks_range, "semanas")} />
              <ReferenceFact label="THC publicado" value={formatRange(selectedGenetic.thc_percent_range, "%")} />
              <ReferenceFact label="Fuente" value={selectedGenetic.source} />
            </div>
          ) : (
            <p className="mt-3 text-sm font-bold leading-6 text-stone-700">
              Elegi una genetica para ver datos publicados como referencia y copiarlos si queres cargarlos a mano.
            </p>
          )}
        </article>

        <article className="setup-cheatsheet">
          <p className="text-xs font-black uppercase text-stone-500">Checklist manual para calendario</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {manualTaskTemplates.map((task) => (
              <ManualTaskTemplateCard key={task.title} task={task} />
            ))}
          </div>
        </article>
      </div>

      <div className="setup-cheatsheet mt-4">
        <p className="text-xs font-black uppercase text-stone-500">Regla rapida de lectura</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ReferenceFact label="Maceta chica" value="3-7 L: plantines, aromaticas o pruebas" />
          <ReferenceFact label="Maceta media" value="7-15 L: balance entre espacio y manejo" />
          <ReferenceFact label="Maceta grande" value="15-25 L: menos unidades y mas margen de sustrato" />
        </div>
      </div>
    </Card>
  );
}

function ManualTaskTemplateCard({
  task
}: {
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
        <CopyValueButton label="titulo o nota de tarea manual" value={value} />
      </div>
      <span className="reference-target-field">Campo: tarea manual del calendario</span>
      <span>{task.cadence}</span>
      <p>{task.detail}</p>
    </div>
  );
}

function SetupSuggestionCard({
  label,
  note,
  tone,
  value
}: {
  label: string;
  note: string;
  tone: "amber" | "blue" | "green" | "soft" | "teal";
  value: string;
}) {
  return (
    <article className={`setup-card ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <p>{label}</p>
        <CopyValueButton label={getReferenceTargetLabel(label)} value={value} />
      </div>
      <span className="reference-target-field">Campo: {getReferenceTargetLabel(label)}</span>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function ReferenceTab({ locale }: { locale: Locale }) {
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
        <SectionHeader eyebrow="Solo lectura" id="reference-title" title="Referencia" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill pill-blue">{geneticsCatalogAlphabetically.length} geneticas cargadas</span>
          <ModeBadge mode="manual" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-black text-moss-950">
            Tipos regulados disponibles
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
              <ReferenceLine label="Tipo" value={selectedSeed.name} />
              <ReferenceLine label="Variante" value={selectedSeed.seedType} />
              <ReferenceLine label="Nota" value={selectedSeed.careNote} />
            </div>
          ) : null}

          <label className="grid gap-1 text-sm font-black text-moss-950">
            Elegir genetica
            <select
              className="form-control"
              value={selectedGenetic?.id ?? ""}
              onChange={(event) => {
                const nextGenetic = geneticsCatalogAlphabetically.find((genetic) => genetic.id === event.target.value) ?? null;
                setSelectedGenetic(nextGenetic);
                setGeneticsSearch(nextGenetic?.name ?? "");
              }}
            >
              <option value="">Sin genetica seleccionada</option>
              {geneticsCatalogAlphabetically.map((genetic) => (
                <option key={genetic.id} value={genetic.id}>
                  {genetic.name} - {formatGeneticType(genetic.type)} - {genetic.source}
                </option>
              ))}
            </select>
            <span className="text-xs font-bold leading-5 text-stone-600">
              Lista completa ordenada alfabeticamente.
            </span>
          </label>

          <label className="grid gap-1 text-sm font-black text-moss-950">
            Buscar genetica
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
                  <span className="ml-2 text-xs font-bold text-stone-500">{formatGeneticType(genetic.type)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <details className="reference-details">
            <summary>Referencia por tipo</summary>
            <div className="mt-3 grid gap-3">
              {CULTIVATION_REFERENCE.map((row) => (
                <CultivationReferenceCard isSpanish={isSpanish} key={row.type} row={row} />
              ))}
            </div>
          </details>

          <details className="reference-details" open={Boolean(selectedGenetic)}>
            <summary>Ficha de genetica</summary>
            <GeneticsReferencePanel genetic={selectedGenetic} />
          </details>
        </div>
      </div>
    </Card>
  );
}

function CultivationReferenceCard({ isSpanish, row }: { isSpanish: boolean; row: CultivationReferenceRow }) {
  return (
    <article className="rounded-lg border border-moss-950/10 bg-white/76 p-3 text-sm">
      <h4 className="font-black text-moss-950">{isSpanish ? row.label_es : row.label_en}</h4>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <ReferenceFact label="Dias a flora" value={row.days_to_flower_range} />
        <ReferenceFact label="Floracion" value={row.flowering_weeks_range} />
        <ReferenceFact label="Maceta" value={row.pot_liters_range} />
      </dl>
      <div className="mt-3 grid gap-2">
        <ReferenceTextBlock label="Luz" value={isSpanish ? row.light_notes_es : row.light_notes_en} />
        <ReferenceTextBlock label="Riego" value={isSpanish ? row.watering_notes_es : row.watering_notes_en} />
      </div>
    </article>
  );
}

function GeneticsReferencePanel({ genetic }: { genetic: GeneticReferenceEntry | null }) {
  if (!genetic) {
    return (
      <div className="mt-3 rounded-lg border border-moss-950/10 bg-white/70 p-3 text-sm font-bold leading-6 text-stone-700">
        Elegi una genetica del buscador para ver la ficha publicada.
      </div>
    );
  }

  return (
    <article className="mt-3 rounded-lg border border-moss-950/10 bg-white/76 p-3 text-sm">
      <h4 className="font-black text-moss-950">{genetic.name}</h4>
      <div className="mt-2">
        <ReferenceLine label="Fuente" value={genetic.source} />
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <ReferenceFact label="Cruza" value={genetic.cross} />
        <ReferenceFact label="Tipo" value={formatGeneticType(genetic.type)} />
        <ReferenceFact label="Floracion publicada" value={formatRange(genetic.flowering_weeks_range, "semanas")} />
        <ReferenceFact label="THC publicado" value={formatThcRange(genetic.thc_percent_range)} />
      </dl>
      <div className="mt-3 grid gap-2">
        <ReferenceTextBlock label="Sabor" value={genetic.flavor_notes} />
        <ReferenceTextBlock label="Efecto" value={genetic.effect_notes} />
      </div>
      {genetic.raw_fields ? <RawFieldsReference fields={genetic.raw_fields} /> : null}
    </article>
  );
}

function ModeBadge({ mode }: { mode: "automatic" | "manual" }) {
  return (
    <span className={mode === "automatic" ? "mode-badge automatic" : "mode-badge manual"}>
      {mode === "automatic" ? "Automatico" : "Manual"}
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

function ReferenceFact({ label, value }: { label: string; value: string }) {
  const destination = getReferenceTargetLabel(label);

  return (
    <div className="rounded-md border border-moss-950/10 bg-paper/80 px-2.5 py-2">
      <dt className="text-[11px] font-black uppercase text-stone-500">{label}</dt>
      <dd className="mt-1 break-words font-black text-moss-950">{value}</dd>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">Campo: {destination}</span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function ReferenceLine({ label, value }: { label: string; value: string }) {
  const destination = getReferenceTargetLabel(label);

  return (
    <div className="py-1">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase text-stone-500">{label}</p>
        <p className="mt-1 break-words text-sm font-black text-moss-950">{value}</p>
      </div>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">Campo: {destination}</span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function ReferenceTextBlock({ label, value }: { label: string; value: string }) {
  const destination = getReferenceTargetLabel(label);

  return (
    <div className="rounded-md border border-moss-950/10 bg-paper/80 p-2.5">
      <p className="text-[11px] font-black uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-stone-700">{value}</p>
      <div className="reference-copy-row mt-2">
        <span className="reference-target-field">Campo: {destination}</span>
        <CopyValueButton label={destination} value={value} />
      </div>
    </div>
  );
}

function RawFieldsReference({ fields }: { fields: NonNullable<GeneticReferenceEntry["raw_fields"]> }) {
  return (
    <details className="mt-3 rounded-lg border border-moss-950/10 bg-paper/80 p-3">
      <summary className="cursor-pointer text-xs font-black uppercase text-stone-500">
        Campos originales del Excel
      </summary>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(fields).map(([label, rawValue]) => {
          const value = rawValue === null ? "No declarado" : String(rawValue);
          return <ReferenceFact key={label} label={label} value={value} />;
        })}
      </dl>
    </details>
  );
}

function formatRange([min, max]: [number, number], unit: string) {
  return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;
}

function formatThcRange([min, max]: [number, number]) {
  if (min === 0 && max === 0) return "No declarado";
  return min === max ? `${min}%` : `${min}-${max}%`;
}

function formatGeneticType(type: GeneticReferenceEntry["type"]) {
  if (type === "autoflowering") return "Automatica";
  if (type === "faster_flowering") return "Faster flowering";
  if (type === "regular") return "Regular";
  return "Feminizada";
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
