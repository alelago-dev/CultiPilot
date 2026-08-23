"use client";

import { useState } from "react";

import { Card } from "@/components/card";
import { createEventId } from "@/lib/calendar-events";
import { formatDictionaryString } from "@/lib/i18n";
import type { Dictionary } from "@/lib/types";

type NutrientRow = {
  id: string;
  name: string;
  doseValue: string;
  doseUnit: "ml" | "g";
};

function createRow(): NutrientRow {
  return { id: createEventId("nutrient-row"), name: "", doseValue: "", doseUnit: "ml" };
}

export function NutrientCalculator({ dictionary }: { dictionary: Dictionary }) {
  const calculator = dictionary.seeds.nutrientCalculator;
  const [reservoirLiters, setReservoirLiters] = useState("10");
  const [rows, setRows] = useState<NutrientRow[]>([createRow()]);

  const parsedReservoir = Number(reservoirLiters);
  const reservoirValid = Number.isFinite(parsedReservoir) && parsedReservoir > 0;

  function updateRow(id: string, updates: Partial<NutrientRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  const rowTotals = rows.map((row) => {
    const dose = Number(row.doseValue);
    const valid = reservoirValid && Number.isFinite(dose) && dose > 0;
    return { ...row, total: valid ? dose * parsedReservoir : undefined };
  });

  const totalsByUnit = rowTotals.reduce<Record<string, number>>((sums, row) => {
    if (row.total === undefined) return sums;
    sums[row.doseUnit] = (sums[row.doseUnit] ?? 0) + row.total;
    return sums;
  }, {});

  const summaryParts = Object.entries(totalsByUnit).map(([unit, amount]) => `${formatAmount(amount)} ${unit}`);

  return (
    <Card as="section" aria-labelledby="nutrient-calculator-title" className="nutrient-calculator mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-emerald-800">{calculator.eyebrow}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-moss-950 sm:text-2xl" id="nutrient-calculator-title">
            {calculator.title}
          </h2>
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-stone-600">{calculator.description}</p>

      <label className="mt-4 grid max-w-[12rem] gap-1 text-sm font-black text-moss-950">
        {calculator.reservoirLabel}
        <input
          className="form-control"
          inputMode="decimal"
          min={0}
          onChange={(event) => setReservoirLiters(event.target.value)}
          step="0.5"
          type="number"
          value={reservoirLiters}
        />
      </label>

      <div className="nutrient-calculator-rows mt-4 grid gap-3">
        {rowTotals.map((row) => (
          <div className="nutrient-calculator-row" key={row.id}>
            <label className="grid gap-1 text-sm font-black text-moss-950">
              {calculator.productLabel}
              <input
                className="form-control"
                onChange={(event) => updateRow(row.id, { name: event.target.value })}
                placeholder={calculator.productPlaceholder}
                value={row.name}
              />
            </label>
            <label className="grid gap-1 text-sm font-black text-moss-950">
              {calculator.doseLabel}
              <div className="nutrient-calculator-dose-input">
                <input
                  className="form-control"
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => updateRow(row.id, { doseValue: event.target.value })}
                  step="0.1"
                  type="number"
                  value={row.doseValue}
                />
                <select
                  aria-label={calculator.doseUnitAriaLabel}
                  className="form-control"
                  onChange={(event) => updateRow(row.id, { doseUnit: event.target.value as NutrientRow["doseUnit"] })}
                  value={row.doseUnit}
                >
                  <option value="ml">ml/L</option>
                  <option value="g">g/L</option>
                </select>
              </div>
            </label>
            <div className="nutrient-calculator-total">
              <span className="text-xs font-black uppercase text-stone-500">{calculator.totalForReservoirLabel}</span>
              <strong>{row.total === undefined ? calculator.noDataLabel : `${formatAmount(row.total)} ${row.doseUnit}`}</strong>
            </div>
            <button
              className="text-button danger"
              disabled={rows.length === 1}
              onClick={() => removeRow(row.id)}
              type="button"
            >
              {calculator.removeButton}
            </button>
          </div>
        ))}
      </div>

      <button className="secondary-button mt-3" onClick={() => setRows((current) => [...current, createRow()])} type="button">
        {calculator.addProductButton}
      </button>

      <div className="seed-result mt-4">
        <p className="text-sm font-black text-moss-950">{calculator.totalMixLabel}</p>
        <p className="mt-1 text-sm leading-6 text-stone-700">
          {!reservoirValid
            ? calculator.invalidReservoirMessage
            : summaryParts.length === 0
              ? calculator.noProductsMessage
              : formatDictionaryString(calculator.summaryTemplate, {
                  parts: summaryParts.join(" + "),
                  reservoir: formatAmount(parsedReservoir)
                })}
        </p>
      </div>
    </Card>
  );
}

function formatAmount(value: number) {
  return Number(value.toFixed(2)).toLocaleString("es-AR");
}
