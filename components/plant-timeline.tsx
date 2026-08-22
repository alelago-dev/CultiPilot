"use client";

import { useMemo, useState } from "react";

import {
  buildPlantTimeline,
  plantTimelineFilters,
  type PlantTimelineItem,
  type PlantTimelineType
} from "@/lib/timeline";
import type { CalendarEvent, CareEntry, Plant, PlantEnvironmentalAlertSettings, PlantMeasurement, PlantStageTransition, Task } from "@/lib/types";

type PlantTimelineProps = {
  calendarEvents: CalendarEvent[];
  entries: CareEntry[];
  environmentalAlertSettings?: PlantEnvironmentalAlertSettings;
  measurements: PlantMeasurement[];
  plant: Plant;
  stageTransitions: PlantStageTransition[];
  tasks: Task[];
};

export function PlantTimeline({ calendarEvents, entries, environmentalAlertSettings, measurements, plant, stageTransitions, tasks }: PlantTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<PlantTimelineType | "all">("all");
  const timelineItems = useMemo(
    () => buildPlantTimeline({ calendarEvents, entries, environmentalAlertSettings, measurements, plant, stageTransitions, tasks }),
    [calendarEvents, entries, environmentalAlertSettings, measurements, plant, stageTransitions, tasks]
  );
  const visibleItems =
    activeFilter === "all" ? timelineItems : timelineItems.filter((item) => item.type === activeFilter);

  return (
    <section className="plant-timeline-card" aria-labelledby={`${plant.id}-timeline-title`}>
      <div className="plant-timeline-header">
        <div>
          <p className="eyebrow">Historial local</p>
          <h4 id={`${plant.id}-timeline-title`}>Linea de tiempo</h4>
        </div>
        <span className="timeline-count">{timelineItems.length} registros</span>
      </div>

      <div className="timeline-filter-row" aria-label="Filtrar historial de planta">
        {plantTimelineFilters.map((filter) => (
          <button
            aria-pressed={activeFilter === filter.value}
            className={activeFilter === filter.value ? "timeline-filter active" : "timeline-filter"}
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="plant-timeline-list">
        {visibleItems.length > 0 ? (
          visibleItems.slice(0, 8).map((item) => <TimelineRow item={item} key={item.id} />)
        ) : (
          <div className="timeline-empty">
            <strong>No hay registros para este filtro.</strong>
            <span>Cuando agregues notas, mediciones, tareas, fotos o eventos, van a aparecer acá ordenados por fecha.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineRow({ item }: { item: PlantTimelineItem }) {
  return (
    <article className={`timeline-row timeline-${item.type}`}>
      <span className="timeline-dot" aria-hidden="true" />
      <div className="timeline-row-body">
        <div className="timeline-row-top">
          <span className="timeline-date">{formatTimelineDate(item.date)}</span>
          <span className={item.status === "completed" ? "timeline-badge done" : "timeline-badge"}>{item.badge}</span>
        </div>
        <h5>{item.title}</h5>
        <p>{item.body}</p>
        {item.photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="timeline-photo" src={item.photoDataUrl} alt={`Foto de ${item.title}`} />
        ) : null}
      </div>
    </article>
  );
}

function formatTimelineDate(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short"
  }).format(new Date(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`));
}
