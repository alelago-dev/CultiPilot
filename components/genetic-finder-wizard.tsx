"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { formatDictionaryString } from "@/lib/i18n";
import {
  getGeneticsCatalogAlphabetically,
  type GeneticReferenceEntry,
  type GeneticRawFieldValue,
  type GeneticType
} from "@/lib/genetics-catalog";
import type { Dictionary } from "@/lib/types";

type FinderGrowPlace = "any" | "indoor" | "outdoor";
type FinderSeedType = "any" | "autoflowering" | "feminized" | "regular";
type FinderPotency = "any" | "low" | "medium" | "high";
type FinderFlavor =
  | "acid"
  | "citrus"
  | "creamy"
  | "earthy"
  | "fuel"
  | "fruity"
  | "skunk"
  | "spicy"
  | "sweet"
  | "wood";

type FinderState = {
  potency: FinderPotency;
  flavors: FinderFlavor[];
  growPlace: FinderGrowPlace;
  seedType: FinderSeedType;
};

type MatchStatus = "match" | "missing";
type MatchDetail = { label: string; reason: string; status: MatchStatus };
type GeneticMatch = {
  confidence: "high" | "medium" | "low";
  details: MatchDetail[];
  genetic: GeneticReferenceEntry;
  matchedCriteria: number;
  score: number;
  totalCriteria: number;
};

type FinderStep = "place" | "type" | "potency" | "flavors";

type GeneticFinderWizardProps = {
  compact?: boolean;
  dictionary: Dictionary;
  onSelectGenetic?: (genetic: GeneticReferenceEntry) => void;
};

const steps: FinderStep[] = ["place", "type", "potency", "flavors"];
const geneticsCatalog = getGeneticsCatalogAlphabetically();

const initialFinderState: FinderState = {
  potency: "any",
  flavors: [],
  growPlace: "any",
  seedType: "any"
};

export function GeneticFinderWizard({ compact = false, dictionary, onSelectGenetic }: GeneticFinderWizardProps) {
  const finder = dictionary.seeds.finder;
  const enhancementCopy = getFinderEnhancementCopy(dictionary);
  const [finderState, setFinderState] = useState<FinderState>(initialFinderState);
  const [strictMode, setStrictMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];
  const calculation = useMemo(
    () => calculateGeneticMatches(finderState, strictMode, dictionary),
    [dictionary, finderState, strictMode]
  );
  const progress = ((stepIndex + 1) / steps.length) * 100;

  function goNext() {
    setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  }

  function goBack() {
    setStepIndex((value) => Math.max(0, value - 1));
  }

  function toggleFlavor(flavor: FinderFlavor) {
    setFinderState((current) => ({
      ...current,
      flavors: current.flavors.includes(flavor)
        ? current.flavors.filter((selectedFlavor) => selectedFlavor !== flavor)
        : [...current.flavors, flavor]
    }));
  }

  function savePreferences() {
    window.localStorage.setItem("cultipilot-genetic-finder-preferences", JSON.stringify({ finderState, strictMode }));
  }

  function applySavedPreferences() {
    try {
      const stored = window.localStorage.getItem("cultipilot-genetic-finder-preferences");
      if (!stored) return;
      const parsed = JSON.parse(stored) as { finderState?: FinderState; strictMode?: boolean };
      if (parsed.finderState) setFinderState(parsed.finderState);
      if (typeof parsed.strictMode === "boolean") setStrictMode(parsed.strictMode);
      setStepIndex(steps.length - 1);
    } catch {
      window.localStorage.removeItem("cultipilot-genetic-finder-preferences");
    }
  }

  const stepCountText = formatDictionaryString(finder.stepCountTemplate, {
    current: String(stepIndex + 1),
    total: String(steps.length)
  });

  return (
    <section className={compact ? "genetic-finder compact" : "genetic-finder"} aria-labelledby="genetic-finder-title">
      <div className="finder-header">
        <div>
          <p className="eyebrow text-emerald-800">{finder.eyebrow}</p>
          <h3 id="genetic-finder-title">{finder.title}</h3>
          <p>{finder.description}</p>
        </div>
        <span className="mode-badge manual">{finder.modeLabel}</span>
      </div>

      <details className="finder-education">
        <summary>{finder.educationSummary}</summary>
        <div className="finder-education-grid">
          <article>
            <h4>{finder.thcTitle}</h4>
            <p>{finder.thcBody}</p>
          </article>
          <article>
            <h4>{finder.floweringTitle}</h4>
            <p>{finder.floweringBody}</p>
          </article>
          <article>
            <h4>{finder.seedTypeTitle}</h4>
            <p>{finder.seedTypeBody}</p>
          </article>
        </div>
      </details>

      <div className="finder-progress" aria-label={stepCountText}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="finder-step-count">{stepCountText}</p>

      {currentStep === "place" ? (
        <FinderOptionGrid
          options={finder.placeOptions}
          selectedValue={finderState.growPlace}
          onSelect={(growPlace) => {
            setFinderState((current) => ({ ...current, growPlace: growPlace as FinderGrowPlace }));
            goNext();
          }}
        />
      ) : null}

      {currentStep === "type" ? (
        <FinderOptionGrid
          options={finder.seedTypeOptions}
          selectedValue={finderState.seedType}
          onSelect={(seedType) => {
            setFinderState((current) => ({ ...current, seedType: seedType as FinderSeedType }));
            goNext();
          }}
        />
      ) : null}

      {currentStep === "potency" ? (
        <FinderOptionGrid
          options={finder.potencyOptions}
          selectedValue={finderState.potency}
          onSelect={(potency) => {
            setFinderState((current) => ({ ...current, potency: potency as FinderPotency }));
            goNext();
          }}
        />
      ) : null}

      {currentStep === "flavors" ? (
        <div className="finder-flavor-step">
          <h4>{finder.flavorsStepTitle}</h4>
          <p>{finder.flavorsStepHint}</p>
          <div className="finder-flavor-grid">
            {finder.flavorOptions.map((option) => {
              const selected = finderState.flavors.includes(option.id as FinderFlavor);

              return (
                <button
                  className={selected ? "finder-flavor active" : "finder-flavor"}
                  key={option.id}
                  onClick={() => toggleFlavor(option.id as FinderFlavor)}
                  type="button"
                >
                  <span>{option.icon}</span>
                  <strong>{option.label}</strong>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <FinderResults
        calculation={calculation}
        dictionary={dictionary}
        onSelectGenetic={onSelectGenetic}
        onStrictModeChange={setStrictMode}
        strictMode={strictMode}
      />

      <div className="finder-actions">
        <button className="secondary-button" disabled={stepIndex === 0} onClick={goBack} type="button">
          {finder.backButton}
        </button>
        {stepIndex < steps.length - 1 ? (
          <button className="secondary-button" onClick={goNext} type="button">
            {finder.continueFiltersButton}
          </button>
        ) : (
          <button
            className="secondary-button"
            onClick={() => {
              setFinderState(initialFinderState);
              setStrictMode(false);
              setStepIndex(0);
            }}
            type="button"
          >
            {finder.startOverButton}
          </button>
        )}
        <div className="finder-preference-actions">
          <button className="secondary-button" onClick={savePreferences} type="button">{enhancementCopy.savePreferences}</button>
          <button className="secondary-button" onClick={applySavedPreferences} type="button">{enhancementCopy.applyPreferences}</button>
        </div>
      </div>
    </section>
  );
}

function FinderOptionGrid({
  onSelect,
  options,
  selectedValue
}: {
  onSelect: (value: string) => void;
  options: Array<{ id: string; icon: string; label: string; description: string }>;
  selectedValue: string;
}) {
  return (
    <div className="finder-option-grid">
      {options.map((option) => (
        <button
          className={selectedValue === option.id ? "finder-option active" : "finder-option"}
          key={option.id}
          onClick={() => onSelect(option.id)}
          type="button"
        >
          <span>{option.icon}</span>
          <strong>{option.label}</strong>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  );
}

const initialVisibleResultCount = 10;
const additionalResultsPerPage = 20;

function FinderResults({
  calculation,
  dictionary,
  onSelectGenetic,
  onStrictModeChange,
  strictMode
}: {
  calculation: { excludedByMissingData: number; incompleteMatches: number; matches: GeneticMatch[] };
  dictionary: Dictionary;
  onSelectGenetic?: (genetic: GeneticReferenceEntry) => void;
  onStrictModeChange: (value: boolean) => void;
  strictMode: boolean;
}) {
  const finder = dictionary.seeds.finder;
  const copy = getFinderEnhancementCopy(dictionary);
  const matches = calculation.matches;
  const [visibleCount, setVisibleCount] = useState(initialVisibleResultCount);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const favoriteIds = useStoredGeneticIds();
  const favoriteGenetics = favoriteIds
    .map((id) => geneticsCatalog.find((genetic) => genetic.id === id))
    .filter((genetic): genetic is GeneticReferenceEntry => Boolean(genetic));
  const visibleMatches = matches.slice(0, visibleCount);
  const remainingCount = matches.length - visibleMatches.length;
  const comparisonGenetics = comparisonIds
    .map((id) => geneticsCatalog.find((genetic) => genetic.id === id))
    .filter((genetic): genetic is GeneticReferenceEntry => Boolean(genetic));

  function toggleComparison(id: string) {
    setComparisonIds((current) => {
      if (current.includes(id)) return current.filter((currentId) => currentId !== id);
      return current.length < 3 ? [...current, id] : current;
    });
  }

  return (
    <div className="finder-results">
      <div>
        <h4>{finder.resultsTitle}</h4>
        <p>{finder.resultsHint}</p>
      </div>

      <section className="finder-calculation-summary" aria-label={copy.calculationSummary}>
        <div><strong>{geneticsCatalog.length}</strong><span>{copy.evaluated}</span></div>
        <div><strong>{matches.length}</strong><span>{copy.matches}</span></div>
        <div>
          <strong>{strictMode ? calculation.excludedByMissingData : calculation.incompleteMatches}</strong>
          <span>{strictMode ? copy.missingData : copy.incompleteData}</span>
        </div>
        <label>
          <input checked={strictMode} onChange={(event) => onStrictModeChange(event.target.checked)} type="checkbox" />
          <span><strong>{copy.strictMode}</strong><small>{copy.strictModeHint}</small></span>
        </label>
      </section>

      {favoriteGenetics.length > 0 ? (
        <details className="finder-favorites">
          <summary>{copy.favorites} ({favoriteGenetics.length})</summary>
          <div>
            {favoriteGenetics.map((genetic) => (
              <span key={genetic.id}>
                <button disabled={!comparisonIds.includes(genetic.id) && comparisonIds.length >= 3} onClick={() => toggleComparison(genetic.id)} type="button">{genetic.name}</button>
                <button aria-label={`${copy.removeFavorite} ${genetic.name}`} onClick={() => toggleStoredGeneticId(genetic.id, favoriteIds)} type="button">×</button>
              </span>
            ))}
          </div>
        </details>
      ) : null}

      {comparisonGenetics.length > 0 ? (
        <section className="finder-comparison" aria-label={copy.comparison}>
          <header><div><h4>{copy.comparison}</h4><p>{copy.comparisonHint}</p></div><span>{comparisonGenetics.length}/3</span></header>
          <div>
            {comparisonGenetics.map((genetic) => (
              <article key={genetic.id}>
                <button aria-label={`${copy.remove} ${genetic.name}`} onClick={() => toggleComparison(genetic.id)} type="button">×</button>
                <h5>{genetic.name}</h5>
                <dl>
                  <div><dt>{copy.type}</dt><dd>{formatGeneticType(genetic.type, dictionary)}</dd></div>
                  <div><dt>THC</dt><dd>{formatThcRange(genetic.thc_percent_range, dictionary)}</dd></div>
                  <div><dt>{copy.duration}</dt><dd>{formatRange(genetic.flowering_weeks_range, dictionary.seeds.weeksUnit)}</dd></div>
                  <div><dt>{copy.flavor}</dt><dd>{compactText(genetic.flavor_notes, dictionary)}</dd></div>
                </dl>
                <small>{genetic.source}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {matches.length > 0 ? (
        <div className="finder-result-grid">
          {visibleMatches.map((match) => {
            const { genetic } = match;
            const isFavorite = favoriteIds.includes(genetic.id);
            const isCompared = comparisonIds.includes(genetic.id);
            return (
            <article className="finder-result-card" key={genetic.id}>
              <div className="finder-result-main">
                <div>
                  <h5>{genetic.name}</h5>
                  <p className="finder-source">
                    <span>{finder.sourceLabel}</span>
                    {genetic.source}
                  </p>
                </div>
                <button
                  aria-label={`${isFavorite ? copy.removeFavorite : copy.addFavorite} ${genetic.name}`}
                  className={isFavorite ? "finder-favorite active" : "finder-favorite"}
                  onClick={() => toggleStoredGeneticId(genetic.id, favoriteIds)}
                  type="button"
                >{isFavorite ? "★" : "☆"}</button>
              </div>
              <div className="finder-confidence-row">
                <p className="finder-match-summary">{formatMatchSummary(match, dictionary)}</p>
                <span className={`finder-confidence ${match.confidence}`}>{copy.confidence}: {copy[match.confidence]}</span>
              </div>
              <ul className="finder-match-details">
                {match.details.map((detail) => (
                  <li className={detail.status} key={detail.label}><span>{detail.status === "match" ? "✓" : "?"}</span><div><strong>{detail.label}</strong><small>{detail.reason}</small></div></li>
                ))}
              </ul>
              <div className="finder-chip-row">
                <span className={`finder-type-badge ${getGeneticTypeClass(genetic.type)}`}>
                  {formatGeneticType(genetic.type, dictionary)}
                </span>
                <span className="finder-data-badge">{formatRange(genetic.flowering_weeks_range, dictionary.seeds.weeksUnit)}</span>
                <span className="finder-data-badge">{formatThcRange(genetic.thc_percent_range, dictionary)}</span>
              </div>
              <p className="finder-notes">{compactText(genetic.flavor_notes || genetic.effect_notes, dictionary)}</p>
              <div className="finder-card-actions">
                <button className={isCompared ? "secondary-button active" : "secondary-button"} disabled={!isCompared && comparisonIds.length >= 3} onClick={() => toggleComparison(genetic.id)} type="button">
                  {isCompared ? copy.removeComparison : copy.compare}
                </button>
                {onSelectGenetic ? <button className="finder-use-button" onClick={() => onSelectGenetic(genetic)} type="button">{finder.addSeedButton}</button> : null}
              </div>
            </article>
          );})}
        </div>
      ) : (
        <div className="finder-empty">{finder.emptyResultsMessage}</div>
      )}

      {remainingCount > 0 ? (
        <button
          className="secondary-button"
          onClick={() => setVisibleCount((value) => value + additionalResultsPerPage)}
          type="button"
        >
          {formatDictionaryString(finder.showMoreButtonTemplate, { remaining: String(remainingCount) })}
        </button>
      ) : null}
    </div>
  );
}

function calculateGeneticMatches(finderState: FinderState, strictMode: boolean, dictionary: Dictionary) {
  let excludedByMissingData = 0;
  let incompleteMatches = 0;
  const matches: GeneticMatch[] = [];

  geneticsCatalog.forEach((genetic) => {
    const evaluation = evaluateGenetic(genetic, finderState, dictionary);
    if (!evaluation.compatible) return;
    if (evaluation.missingCriteria > 0) incompleteMatches += 1;
    if (strictMode && evaluation.missingCriteria > 0) {
      excludedByMissingData += 1;
      return;
    }

    const coverage = evaluation.totalCriteria > 0 ? evaluation.matchedCriteria / evaluation.totalCriteria : 0;
    matches.push({
      confidence: coverage === 1 ? "high" : coverage >= 0.5 ? "medium" : "low",
      details: evaluation.details,
      genetic,
      matchedCriteria: evaluation.matchedCriteria,
      score: evaluation.score,
      totalCriteria: evaluation.totalCriteria
    });
  });

  matches.sort((first, second) => second.score - first.score || first.genetic.name.localeCompare(second.genetic.name, "es"));
  return { excludedByMissingData, incompleteMatches, matches };
}

function evaluateGenetic(genetic: GeneticReferenceEntry, finderState: FinderState, dictionary: Dictionary) {
  const copy = getFinderEnhancementCopy(dictionary);
  const searchableText = buildSearchableText(genetic);
  const details: MatchDetail[] = [];
  let compatible = true;
  let matchedCriteria = 0;
  let missingCriteria = 0;
  let totalCriteria = 0;

  function record(label: string, result: boolean | null, matchReason: string, missingReason: string) {
    totalCriteria += 1;
    if (result === true) {
      matchedCriteria += 1;
      details.push({ label, reason: matchReason, status: "match" });
    } else if (result === null) {
      missingCriteria += 1;
      details.push({ label, reason: missingReason, status: "missing" });
    } else {
      compatible = false;
    }
  }

  if (finderState.growPlace !== "any") {
    const label = dictionary.seeds.finder.placeOptions.find((option) => option.id === finderState.growPlace)?.label ?? copy.environment;
    record(copy.environment, matchesGrowPlace(searchableText, finderState.growPlace), label, copy.environmentMissing);
  }

  if (finderState.seedType !== "any") {
    record(copy.type, geneticMatchesType(genetic.type, finderState.seedType), formatGeneticType(genetic.type, dictionary), "");
  }

  if (finderState.potency !== "any") {
    record(copy.potency, geneticMatchesPotency(genetic, finderState.potency), formatThcRange(genetic.thc_percent_range, dictionary), copy.thcMissing);
  }

  if (finderState.flavors.length > 0) {
    const hasFlavorData = hasPublishedFlavorData(genetic);
    const selectedLabels = finderState.flavors.map((flavor) =>
      dictionary.seeds.finder.flavorOptions.find((option) => option.id === flavor)?.label ?? flavor
    );
    const matchingLabels = finderState.flavors.filter((flavor) =>
      getFlavorKeywords(flavor).some((keyword) => searchableText.includes(keyword))
    ).map((flavor) => dictionary.seeds.finder.flavorOptions.find((option) => option.id === flavor)?.label ?? flavor);
    record(copy.flavor, !hasFlavorData ? null : matchingLabels.length > 0, matchingLabels.join(", ") || selectedLabels.join(", "), copy.flavorMissing);
  }

  if (totalCriteria === 0) details.push({ label: copy.noFilters, reason: copy.noFiltersHint, status: "missing" });

  return {
    compatible,
    details,
    matchedCriteria,
    missingCriteria,
    score: matchedCriteria * 10 - missingCriteria,
    totalCriteria
  };
}

function formatMatchSummary(match: GeneticMatch, dictionary: Dictionary) {
  if (match.totalCriteria === 0) return dictionary.seeds.finder.matchSummaryNoFilters;
  return formatDictionaryString(dictionary.seeds.finder.matchSummaryTemplate, {
    matching: String(match.matchedCriteria),
    total: String(match.totalCriteria)
  });
}

function geneticMatchesType(geneticType: GeneticType, selectedType: FinderSeedType) {
  if (selectedType === "any") return true;
  if (selectedType === "feminized") return geneticType === "feminized" || geneticType === "faster_flowering";
  return geneticType === selectedType;
}

function matchesGrowPlace(searchableText: string, growPlace: FinderGrowPlace): boolean | null {
  if (growPlace === "any") return true;
  const declaresIndoor = /\b(indoor|interior|inside)\b/.test(searchableText);
  const declaresOutdoor = /\b(outdoor|exterior|terraza|balcon|jardin|invernaculo)\b/.test(searchableText);

  if (!declaresIndoor && !declaresOutdoor) return null;
  return growPlace === "indoor" ? declaresIndoor : declaresOutdoor;
}

function geneticMatchesPotency(genetic: GeneticReferenceEntry, potency: FinderPotency) {
  if (potency === "any") return true;
  const [publishedMinimum, publishedMaximum] = genetic.thc_percent_range;
  if (publishedMaximum <= 0) return null;
  if (potency === "low") return publishedMinimum < 10;
  if (potency === "medium") return publishedMaximum >= 10 && publishedMinimum <= 20;
  return publishedMaximum > 20;
}

function hasPublishedFlavorData(genetic: GeneticReferenceEntry) {
  return Boolean(genetic.flavor_notes && !/no informado|no declarado|sin notas/i.test(genetic.flavor_notes));
}

function getFlavorKeywords(flavor: FinderFlavor) {
  const keywords: Record<FinderFlavor, string[]> = {
    acid: ["acid", "sour", "punz"],
    citrus: ["citr", "limon", "lima", "orange", "naranja", "pomelo", "mandarina", "lemon"],
    creamy: ["cream", "crema", "vainilla", "suave"],
    earthy: ["earth", "tierra", "terroso", "mineral"],
    fuel: ["gas", "diesel", "petroleo", "fuel", "combustible"],
    fruity: ["frut", "berry", "berries", "banana", "mango", "tropical", "pineapple", "pina"],
    skunk: ["skunk", "queso", "cheese"],
    spicy: ["spic", "pimienta", "pepper", "picante", "especia", "cinnamon"],
    sweet: ["dulce", "sweet", "caramelo", "cookie", "galleta", "cola"],
    wood: ["wood", "madera", "pino", "pine", "cedro", "herbal"]
  };

  return keywords[flavor];
}

function buildSearchableText(genetic: GeneticReferenceEntry) {
  const rawText = genetic.raw_fields ? Object.values(genetic.raw_fields).map(formatRawValue).join(" ") : "";

  return normalizeText([
    genetic.name,
    genetic.cross,
    genetic.type,
    genetic.source,
    genetic.effect_notes,
    genetic.flavor_notes,
    rawText
  ].join(" "));
}

function formatRawValue(value: GeneticRawFieldValue) {
  if (value === null) return "";
  return String(value);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatGeneticType(type: GeneticReferenceEntry["type"], dictionary: Dictionary) {
  if (type === "autoflowering") return dictionary.seeds.geneticTypeAutoflowering;
  if (type === "faster_flowering") return dictionary.seeds.geneticTypeFasterFlowering;
  if (type === "regular") return dictionary.seeds.geneticTypeRegular;
  return dictionary.seeds.geneticTypeFeminized;
}

function getGeneticTypeClass(type: GeneticReferenceEntry["type"]) {
  if (type === "autoflowering") return "autoflowering";
  if (type === "regular") return "regular";
  if (type === "faster_flowering") return "fast";
  return "feminized";
}

function formatRange([min, max]: [number, number], unit: string) {
  return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;
}

function formatThcRange([min, max]: [number, number], dictionary: Dictionary) {
  if (min === 0 && max === 0) return dictionary.seeds.finder.thcNotDeclared;
  return min === max ? `${min}% THC` : `${min}-${max}% THC`;
}

function compactText(value: string, dictionary: Dictionary) {
  if (!value || value === "No declarado en Excel") return dictionary.seeds.finder.noNotesMessage;
  return value.length > 118 ? `${value.slice(0, 115)}...` : value;
}

const favoriteStorageKey = "cultipilot-genetic-favorites";
const favoriteChangeEvent = "cultipilot-genetic-favorites-change";

function useStoredGeneticIds() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      window.addEventListener("storage", listener);
      window.addEventListener(favoriteChangeEvent, listener);
      return () => {
        window.removeEventListener("storage", listener);
        window.removeEventListener(favoriteChangeEvent, listener);
      };
    },
    () => window.localStorage.getItem(favoriteStorageKey) ?? "[]",
    () => "[]"
  );

  try {
    const values = JSON.parse(snapshot) as unknown;
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function toggleStoredGeneticId(id: string, currentIds: string[]) {
  const nextIds = currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [...currentIds, id];
  window.localStorage.setItem(favoriteStorageKey, JSON.stringify(nextIds));
  window.dispatchEvent(new Event(favoriteChangeEvent));
}

function getFinderEnhancementCopy(dictionary: Dictionary) {
  const isSpanish = dictionary.seeds.finder.backButton === "Atras";
  return isSpanish ? {
    addFavorite: "Guardar favorita",
    applyPreferences: "Aplicar preferencias guardadas",
    calculationSummary: "Resumen del calculo",
    compare: "Comparar",
    comparison: "Comparacion",
    comparisonHint: "Hasta tres fichas, con los mismos campos lado a lado.",
    confidence: "Confianza",
    duration: "Duracion",
    environment: "Ambiente",
    environmentMissing: "La fuente no declara interior ni exterior; no se asumio compatibilidad.",
    evaluated: "evaluadas",
    favorites: "Favoritas guardadas",
    flavor: "Aroma",
    flavorMissing: "La fuente no publica aromas comparables.",
    high: "alta",
    incompleteData: "compatibles con datos faltantes",
    low: "baja",
    matches: "coincidencias",
    medium: "media",
    missingData: "excluidas por datos faltantes",
    noFilters: "Sin filtros",
    noFiltersHint: "Orden alfabetico del catalogo completo.",
    potency: "Potencia",
    remove: "Quitar",
    removeComparison: "Quitar comparacion",
    removeFavorite: "Quitar favorita",
    savePreferences: "Guardar estas preferencias",
    strictMode: "Coincidencia estricta",
    strictModeHint: "Oculta fichas si falta algun dato elegido.",
    thcMissing: "La fuente no publica un rango de THC.",
    type: "Tipo"
  } : {
    addFavorite: "Save favorite",
    applyPreferences: "Apply saved preferences",
    calculationSummary: "Calculation summary",
    compare: "Compare",
    comparison: "Comparison",
    comparisonHint: "Up to three sheets with the same fields side by side.",
    confidence: "Confidence",
    duration: "Duration",
    environment: "Environment",
    environmentMissing: "The source does not declare indoor or outdoor; compatibility was not assumed.",
    evaluated: "evaluated",
    favorites: "Saved favorites",
    flavor: "Flavor",
    flavorMissing: "The source has no comparable flavor notes.",
    high: "high",
    incompleteData: "compatible with missing data",
    low: "low",
    matches: "matches",
    medium: "medium",
    missingData: "excluded for missing data",
    noFilters: "No filters",
    noFiltersHint: "Full catalog in alphabetical order.",
    potency: "Potency",
    remove: "Remove",
    removeComparison: "Remove comparison",
    removeFavorite: "Remove favorite",
    savePreferences: "Save these preferences",
    strictMode: "Strict match",
    strictModeHint: "Hide sheets missing any selected data.",
    thcMissing: "The source does not publish a THC range.",
    type: "Type"
  };
}
