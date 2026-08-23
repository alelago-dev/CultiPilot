/**
 * plant-photo-timeline.tsx
 *
 * Linea de tiempo fotografica unificada por maceta: junta las fotos de
 * mediciones, bitacora e inspecciones (las tres fuentes que ya permiten
 * adjuntar una foto) en una sola tira cronologica, para ver la evolucion
 * visual completa sin tener que abrir el historial de mediciones, la
 * bitacora y las inspecciones por separado.
 *
 * Distinta de MeasurementPhotoGallery (comparador de 2 fotos, solo de
 * mediciones, dentro del historial de mediciones) y de PlantTimeline
 * (registro mixto de texto con fotos incidentales, tope de 8 items). Esta
 * es solo fotos, de las tres fuentes, sin tope visible salvo scroll.
 */

"use client";

import { useState } from "react";

import type { CareEntry, Plant, PlantInspection, PlantMeasurement } from "@/lib/types";

type PhotoTimelineItem = {
  date: string;
  id: string;
  note?: string;
  photoDataUrl: string;
  source: string;
};

export function PlantPhotoTimeline({
  entries,
  inspections,
  measurements,
  plant
}: {
  entries: CareEntry[];
  inspections: PlantInspection[];
  measurements: PlantMeasurement[];
  plant: Plant;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items: PhotoTimelineItem[] = [
    ...measurements
      .filter((measurement) => measurement.photoDataUrl)
      .map((measurement) => ({ date: measurement.measuredAt, id: `measurement-${measurement.id}`, note: measurement.observations, photoDataUrl: measurement.photoDataUrl!, source: "Medición" })),
    ...entries
      .filter((entry) => entry.plantId === plant.id && entry.photoDataUrl)
      .map((entry) => ({ date: entry.createdAt, id: `entry-${entry.id}`, note: entry.note, photoDataUrl: entry.photoDataUrl!, source: entry.title || "Bitácora" })),
    ...inspections
      .filter((inspection) => inspection.photoDataUrl)
      .map((inspection) => ({ date: inspection.inspectedAt, id: `inspection-${inspection.id}`, note: inspection.observation, photoDataUrl: inspection.photoDataUrl!, source: "Inspección" }))
  ].sort((first, second) => second.date.localeCompare(first.date));

  if (items.length === 0) return null;

  const openItem = openIndex !== null ? items[openIndex] : null;

  return (
    <section aria-labelledby={`${plant.id}-photo-timeline-title`} className="plant-photo-timeline">
      <header>
        <div>
          <p className="plant-calculation-eyebrow">Registro fotográfico</p>
          <h4 id={`${plant.id}-photo-timeline-title`}>Línea de tiempo de fotos</h4>
        </div>
        <span className="pill pill-blue">{items.length} foto{items.length === 1 ? "" : "s"}</span>
      </header>
      <p>Fotos de mediciones, bitácora e inspecciones de esta maceta, juntas y ordenadas por fecha. Comparación visual; CultiPilot no infiere diagnósticos a partir de las fotos.</p>
      <div className="plant-photo-timeline-strip">
        {items.map((item, index) => (
          <button className="plant-photo-timeline-thumb" key={item.id} onClick={() => setOpenIndex(index)} type="button">
            {/* Data URL local elegido por el usuario; next/image no la optimiza. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${item.source} de ${plant.name} del ${formatShortDate(item.date)}`} src={item.photoDataUrl} />
            <span>{formatShortDate(item.date)}</span>
          </button>
        ))}
      </div>

      {openItem ? (
        <div aria-labelledby="plant-photo-timeline-viewer-title" aria-modal="true" className="plant-photo-timeline-backdrop" role="dialog">
          <section className="plant-photo-timeline-viewer">
            <header>
              <div>
                <p className="plant-calculation-eyebrow">{openItem.source}</p>
                <h4 id="plant-photo-timeline-viewer-title">{formatLongDate(openItem.date)}</h4>
              </div>
              <button className="secondary-button" onClick={() => setOpenIndex(null)} type="button">
                Cerrar
              </button>
            </header>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${openItem.source} de ${plant.name} del ${formatLongDate(openItem.date)}`} src={openItem.photoDataUrl} />
            {openItem.note ? <p>{openItem.note}</p> : null}
            <div className="plant-photo-timeline-nav">
              <button
                className="secondary-button"
                disabled={openIndex === 0}
                onClick={() => setOpenIndex((current) => (current !== null && current > 0 ? current - 1 : current))}
                type="button"
              >
                ← Más reciente
              </button>
              <button
                className="secondary-button"
                disabled={openIndex === items.length - 1}
                onClick={() => setOpenIndex((current) => (current !== null && current < items.length - 1 ? current + 1 : current))}
                type="button"
              >
                Más antigua →
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`));
}

function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`));
}
