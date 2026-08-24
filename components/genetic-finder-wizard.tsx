"use client";

import { useMemo, useState } from "react";

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
  const [finderState, setFinderState] = useState<FinderState>(initialFinderState);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];
  const matches = useMemo(() => filterGenetics(finderState), [finderState]);
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
        dictionary={dictionary}
        finderState={finderState}
        key={JSON.stringify(finderState)}
        matches={matches}
        onSelectGenetic={onSelectGenetic}
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
              setStepIndex(0);
            }}
            type="button"
          >
            {finder.startOverButton}
          </button>
        )}
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
  dictionary,
  finderState,
  matches,
  onSelectGenetic
}: {
  dictionary: Dictionary;
  finderState: FinderState;
  matches: Array<{ genetic: GeneticReferenceEntry; score: number }>;
  onSelectGenetic?: (genetic: GeneticReferenceEntry) => void;
}) {
  const finder = dictionary.seeds.finder;
  const [visibleCount, setVisibleCount] = useState(initialVisibleResultCount);
  const visibleMatches = matches.slice(0, visibleCount);
  const remainingCount = matches.length - visibleMatches.length;

  return (
    <div className="finder-results">
      <div>
        <h4>{finder.resultsTitle}</h4>
        <p>{finder.resultsHint}</p>
      </div>

      {matches.length > 0 ? (
        <div className="finder-result-grid">
          {visibleMatches.map(({ genetic }) => (
            <article className="finder-result-card" key={genetic.id}>
              <div className="finder-result-main">
                <div>
                  <h5>{genetic.name}</h5>
                  <p className="finder-source">
                    <span>{finder.sourceLabel}</span>
                    {genetic.source}
                  </p>
                </div>
              </div>
              <p className="finder-match-summary">{formatMatchSummary(genetic, finderState, dictionary)}</p>
              <div className="finder-chip-row">
                <span className={`finder-type-badge ${getGeneticTypeClass(genetic.type)}`}>
                  {formatGeneticType(genetic.type, dictionary)}
                </span>
                <span className="finder-data-badge">{formatRange(genetic.flowering_weeks_range, dictionary.seeds.weeksUnit)}</span>
                <span className="finder-data-badge">{formatThcRange(genetic.thc_percent_range, dictionary)}</span>
              </div>
              <p className="finder-notes">{compactText(genetic.flavor_notes || genetic.effect_notes, dictionary)}</p>
              {onSelectGenetic ? (
                <button className="finder-use-button" onClick={() => onSelectGenetic(genetic)} type="button">
                  {finder.addSeedButton}
                </button>
              ) : null}
            </article>
          ))}
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

function filterGenetics(finderState: FinderState) {
  return geneticsCatalog
    .map((genetic) => ({ genetic, score: scoreGenetic(genetic, finderState) }))
    .filter(({ genetic }) => matchesRequiredFilters(genetic, finderState))
    .sort((first, second) => second.score - first.score || first.genetic.name.localeCompare(second.genetic.name, "es"));
}

function scoreGenetic(genetic: GeneticReferenceEntry, finderState: FinderState) {
  let score = 0;
  const searchableText = buildSearchableText(genetic);

  if (finderState.seedType !== "any") {
    score += 7;
  }

  if (matchesGrowPlace(searchableText, finderState.growPlace) === true) {
    score += 3;
  }

  if (finderState.potency !== "any") {
    score += 4;
  }

  finderState.flavors.forEach((flavor) => {
    if (getFlavorKeywords(flavor).some((keyword) => searchableText.includes(keyword))) {
      score += 3;
    }
  });

  return score;
}

function formatMatchSummary(genetic: GeneticReferenceEntry, finderState: FinderState, dictionary: Dictionary) {
  const searchableText = buildSearchableText(genetic);
  const criteria: boolean[] = [];

  if (finderState.growPlace !== "any") {
    criteria.push(matchesGrowPlace(searchableText, finderState.growPlace) === true);
  }

  if (finderState.seedType !== "any") {
    criteria.push(geneticMatchesType(genetic.type, finderState.seedType));
  }

  if (finderState.potency !== "any") {
    criteria.push(geneticMatchesPotency(genetic, finderState.potency));
  }

  if (finderState.flavors.length > 0) {
    criteria.push(
      finderState.flavors.some((flavor) =>
        getFlavorKeywords(flavor).some((keyword) => searchableText.includes(keyword))
      )
    );
  }

  if (criteria.length === 0) {
    return dictionary.seeds.finder.matchSummaryNoFilters;
  }

  const matchingCriteria = criteria.filter(Boolean).length;
  return formatDictionaryString(dictionary.seeds.finder.matchSummaryTemplate, {
    matching: String(matchingCriteria),
    total: String(criteria.length)
  });
}

function geneticMatchesType(geneticType: GeneticType, selectedType: FinderSeedType) {
  if (selectedType === "any") return true;
  if (selectedType === "feminized") return geneticType === "feminized" || geneticType === "faster_flowering";
  return geneticType === selectedType;
}

function matchesRequiredFilters(genetic: GeneticReferenceEntry, finderState: FinderState) {
  const growPlaceMatch = matchesGrowPlace(buildSearchableText(genetic), finderState.growPlace);
  if (growPlaceMatch === false) return false;
  if (finderState.seedType !== "any" && !geneticMatchesType(genetic.type, finderState.seedType)) return false;
  if (finderState.potency !== "any" && !geneticMatchesPotency(genetic, finderState.potency)) return false;

  if (finderState.flavors.length > 0) {
    const searchableText = buildSearchableText(genetic);
    const matchesFlavor = finderState.flavors.some((flavor) =>
      getFlavorKeywords(flavor).some((keyword) => searchableText.includes(keyword))
    );
    if (!matchesFlavor) return false;
  }

  return true;
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
  const [, publishedMaximum] = genetic.thc_percent_range;
  if (publishedMaximum <= 0) return false;
  if (potency === "low") return publishedMaximum < 10;
  if (potency === "medium") return publishedMaximum >= 10 && publishedMaximum <= 20;
  return publishedMaximum > 20;
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
