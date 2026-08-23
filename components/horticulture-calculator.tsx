"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/card";
import {
  calculateHorticulturePlan,
  getHorticultureSeeds,
  type HorticulturePlanInput
} from "@/lib/seed-catalog";
import type { Dictionary } from "@/lib/types";

const horticultureSeeds = getHorticultureSeeds();
const defaultSeedId = horticultureSeeds.find((seed) => !seed.regulated)?.id ?? horticultureSeeds[0]?.id ?? "tomato-roma";

export function HorticultureCalculator({ dictionary }: { dictionary: Dictionary }) {
  const calculator = dictionary.seeds.horticultureCalculator;
  const [seedId, setSeedId] = useState(defaultSeedId);
  const [potLiters, setPotLiters] = useState(12);
  const [lightType, setLightType] = useState<HorticulturePlanInput["lightType"]>("led");
  const [indoorSize, setIndoorSize] = useState<HorticulturePlanInput["indoorSize"]>("medium");

  const plan = useMemo(
    () =>
      calculateHorticulturePlan(
        {
          indoorSize,
          lightType,
          potLiters,
          seedId
        },
        dictionary
      ),
    [dictionary, indoorSize, lightType, potLiters, seedId]
  );

  return (
    <Card as="section" aria-labelledby="calculator-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow={calculator.eyebrow} title={calculator.title} />
        <span className={plan.automaticEnabled ? "mode-badge automatic" : "mode-badge manual"}>
          {plan.automaticEnabled ? calculator.statusActive : calculator.statusMissing}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-black text-moss-950">
          {calculator.seedLabel}
          <select className="form-control" value={seedId} onChange={(event) => setSeedId(event.target.value)}>
            {horticultureSeeds.map((seed) => (
              <option key={seed.id} value={seed.id}>
                {seed.crop} - {seed.name}{seed.regulated ? " · legal/regulado" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-black text-moss-950">
          {calculator.potLabel}
          <input
            className="form-control"
            min={1}
            max={80}
            type="number"
            value={potLiters}
            onChange={(event) => setPotLiters(Number(event.target.value))}
          />
        </label>

        <label className="grid gap-1 text-sm font-black text-moss-950">
          {calculator.lightLabel}
          <select
            className="form-control"
            value={lightType}
            onChange={(event) => setLightType(event.target.value as HorticulturePlanInput["lightType"])}
          >
            {calculator.lightOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-black text-moss-950">
          {calculator.indoorLabel}
          <select
            className="form-control"
            value={indoorSize}
            onChange={(event) => setIndoorSize(event.target.value as HorticulturePlanInput["indoorSize"])}
          >
            {calculator.indoorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PlanTile label={calculator.resultSeedLabel} value={plan.seedLabel} />
        <PlanTile label={calculator.resultSubstrateLabel} value={plan.substrateLiters} />
        <PlanTile label={calculator.resultWaterCheckLabel} value={plan.waterCheck} />
        <PlanTile label={calculator.resultWaterAmountLabel} value={plan.waterAmount} />
        <PlanTile label={calculator.resultLightLabel} value={plan.lightFit} />
        <PlanTile label={calculator.resultSpaceLabel} value={plan.spaceFit} />
      </div>

      <div className="seed-result mt-4">
        <p className="text-sm font-black text-moss-950">{calculator.harvestWindowLabel}</p>
        <p className="mt-1 text-sm leading-6 text-stone-700">{plan.harvestWindow}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-stone-600">{plan.note}</p>
        {plan.missingInputs.length > 0 ? (
          <ul className="mt-3 grid gap-1 text-xs font-bold text-stone-600">
            {plan.missingInputs.map((inputName) => (
              <li key={inputName}>{calculator.missingPrefix} {inputName}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-moss-950/10 bg-paper/80 p-3">
        <p className="text-xs font-black uppercase text-stone-500">{calculator.dataOriginLabel}</p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {plan.dataPoints.map((point) => (
            <div className="rounded-md bg-white/70 px-2 py-1.5" key={point.label}>
              <dt className="text-[11px] font-black uppercase text-stone-500">{point.label}</dt>
              <dd className="text-xs font-bold text-moss-950">{point.value}</dd>
              <dd className="text-[11px] font-black uppercase text-emerald-800">
                {calculator.originLabel} {formatSource(point.source, calculator)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

function PlanTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile min-h-0">
      <p className="text-xs font-black uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-black leading-5 text-moss-950">{value}</p>
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

function formatSource(source: string, calculator: Dictionary["seeds"]["horticultureCalculator"]) {
  if (source === "catalog") return calculator.originCatalog;
  if (source === "calculated") return calculator.originCalculated;
  if (source === "measurement") return calculator.originMeasurement;
  if (source === "suggestion") return calculator.originSuggestion;
  if (source === "user") return calculator.originUser;
  return calculator.originMissing;
}
