import type { CalendarEvent, CalendarEventKind, CalendarEventOccurrence } from "@/lib/types";

const eventKindLabels: Record<CalendarEventKind, string> = {
  watering: "Riego",
  photo: "Foto",
  cleaning: "Limpieza",
  review: "Revision"
};

export function getEventKindLabel(kind: CalendarEventKind) {
  return eventKindLabels[kind];
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);

  return toIsoDate(date);
}

export function addMonths(isoDate: string, months: number) {
  const date = parseIsoDate(isoDate);
  const currentDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(currentDay, lastDayOfTargetMonth));

  return toIsoDate(date);
}

export function addYears(isoDate: string, years: number) {
  return addMonths(isoDate, years * 12);
}

export function getTodayIso() {
  return toIsoDate(new Date());
}

export function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function getMonthStartIso(isoDate: string) {
  const date = parseIsoDate(isoDate);

  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getYearMonthValue(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function fromYearMonthValue(yearMonth: string) {
  return `${yearMonth}-01`;
}

export function buildMonthGrid(anchorIsoDate: string) {
  const anchor = parseIsoDate(anchorIsoDate);
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset);
  const todayIso = getTodayIso();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      isoDate: toIsoDate(date),
      label: String(date.getDate()),
      isCurrentMonth: date.getMonth() === anchor.getMonth(),
      isToday: toIsoDate(date) === todayIso
    };
  });
}

export function buildWeekGrid(anchorIsoDate: string) {
  const anchor = parseIsoDate(anchorIsoDate);
  const mondayOffset = (anchor.getDay() + 6) % 7;
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - mondayOffset);
  const todayIso = getTodayIso();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    return {
      isoDate: toIsoDate(date),
      label: String(date.getDate()),
      isCurrentMonth: true,
      isToday: toIsoDate(date) === todayIso
    };
  });
}

export function expandEventOccurrences(events: CalendarEvent[], startDate: string, endDate: string) {
  const occurrences: CalendarEventOccurrence[] = [];

  events.forEach((event) => {
    const eventEndDate = event.recurrence?.endDate && event.recurrence.endDate < endDate ? event.recurrence.endDate : endDate;
    let occurrenceDate = event.startDate;

    while (occurrenceDate <= eventEndDate) {
      if (occurrenceDate >= startDate) {
        occurrences.push({
          completed: event.completedDates.includes(occurrenceDate),
          date: occurrenceDate,
          description: event.description,
          eventId: event.id,
          kind: event.kind,
          occurrenceId: `${event.id}:${occurrenceDate}`,
          plantId: event.plantId,
          source: event.source,
          title: event.title
        });
      }

      if (!event.recurrence?.active) {
        break;
      }

      occurrenceDate = addDays(occurrenceDate, event.recurrence.everyDays);
    }
  });

  return occurrences.sort((first, second) => first.date.localeCompare(second.date));
}

export function createEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
