"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/card";
import {
  calculateHorticulturePlan,
  getHorticultureSeeds,
  type HorticulturePlanInput
} from "@/lib/seed-catalog";

const horticultureSeeds = getHorticultureSeeds();

export function HorticultureCalculator() {
  const [seedId, setSeedId] = useState(horticultureSeeds[0]?.id ?? "tomato-roma");
  const [potLiters, setPotLiters] = useState(12);
  const [lightType, setLightType] = useState<HorticulturePlanInput["lightType"]>("led");
  const [indoorSize, setIndoorSize] = useState<HorticulturePlanInput["indoorSize"]>("medium");

  const plan = useMemo(
    () =>
      calculateHorticulturePlan({
        indoorSize,
        lightType,
        potLiters,
        seedId
      }),
    [indoorSize, lightType, potLiters, seedId]
  );

  if (!plan.automaticEnabled) {
    return (
      <Card as="section" aria-labelledby="calculator-title" className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader eyebrow="Calculadora" title="Cultivo horticola" />
          <span className="mode-badge manual">Manual</span>
        </div>
        <div className="seed-result mt-5 border-amber-700/20 bg-amber-50/72">
          <p className="text-sm font-black text-moss-950">{plan.seedLabel}</p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{plan.note}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="calculator-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="Calculadora" title="Cultivo horticola" />
        <span className="mode-badge automatic">Automatico</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-black text-moss-950">
          Semilla
          <select className="form-control" value={seedId} onChange={(event) => setSeedId(event.target.value)}>
            {horticultureSeeds.map((seed) => (
              <option key={seed.id} value={seed.id}>
                {seed.crop} - {seed.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-black text-moss-950">
          Maceta
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
          Luz
          <select
            className="form-control"
            value={lightType}
            onChange={(event) => setLightType(event.target.value as HorticulturePlanInput["lightType"])}
          >
            <option value="led">LED</option>
            <option value="sun">Sol directo</option>
            <option value="mixed">Mixta</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-black text-moss-950">
          Indoor / espacio
          <select
            className="form-control"
            value={indoorSize}
            onChange={(event) => setIndoorSize(event.target.value as HorticulturePlanInput["indoorSize"])}
          >
            <option value="small">Chico</option>
            <option value="medium">Medio</option>
            <option value="large">Grande</option>
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PlanTile label="Semilla elegida" value={plan.seedLabel} />
        <PlanTile label="Sustrato" value={plan.substrateLiters} />
        <PlanTile label="Riego" value={plan.waterCheck} />
        <PlanTile label="Agua" value={plan.waterAmount} />
        <PlanTile label="Luz sugerida" value={plan.lightFit} />
        <PlanTile label="Espacio" value={plan.spaceFit} />
      </div>

      <div className="seed-result mt-4">
        <p className="text-sm font-black text-moss-950">Ventana estimada</p>
        <p className="mt-1 text-sm leading-6 text-stone-700">{plan.harvestWindow}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-stone-600">{plan.note}</p>
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
