"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/card";
import {
  calculateHorticulturePlan,
  getHorticultureSeeds,
  type HorticulturePlanInput
} from "@/lib/seed-catalog";

const horticultureSeeds = getHorticultureSeeds();
const defaultSeedId = horticultureSeeds.find((seed) => !seed.regulated)?.id ?? horticultureSeeds[0]?.id ?? "tomato-roma";

export function HorticultureCalculator() {
  const [seedId, setSeedId] = useState(defaultSeedId);
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

  return (
    <Card as="section" aria-labelledby="calculator-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="Calculadora" title="Motor de cultivo" />
        <span className={plan.automaticEnabled ? "mode-badge automatic" : "mode-badge manual"}>
          {plan.automaticEnabled ? "Estimacion activa" : "Faltan datos"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-black text-moss-950">
          Semilla
          <select className="form-control" value={seedId} onChange={(event) => setSeedId(event.target.value)}>
            {horticultureSeeds.map((seed) => (
              <option key={seed.id} value={seed.id}>
                {seed.crop} - {seed.name}{seed.regulated ? " · legal/regulado" : ""}
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
        {plan.missingInputs.length > 0 ? (
          <ul className="mt-3 grid gap-1 text-xs font-bold text-stone-600">
            {plan.missingInputs.map((inputName) => (
              <li key={inputName}>Falta: {inputName}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-moss-950/10 bg-paper/80 p-3">
        <p className="text-xs font-black uppercase text-stone-500">Procedencia de datos</p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {plan.dataPoints.map((point) => (
            <div className="rounded-md bg-white/70 px-2 py-1.5" key={point.label}>
              <dt className="text-[11px] font-black uppercase text-stone-500">{point.label}</dt>
              <dd className="text-xs font-bold text-moss-950">{point.value}</dd>
              <dd className="text-[11px] font-black uppercase text-emerald-800">Origen: {formatSource(point.source)}</dd>
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

function formatSource(source: string) {
  if (source === "catalog") return "catalogo";
  if (source === "calculated") return "calculado";
  if (source === "measurement") return "medicion";
  if (source === "suggestion") return "sugerencia";
  if (source === "user") return "usuario";
  return "faltante";
}
