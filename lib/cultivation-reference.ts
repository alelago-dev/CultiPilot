export type SeedType = "feminized" | "regular" | "autoflowering";

export type CultivationReferenceRow = {
  type: SeedType;
  label_es: string;
  label_en: string;
  days_to_flower_range: string;
  flowering_weeks_range: string;
  pot_liters_range: string;
  light_notes_es: string;
  light_notes_en: string;
  watering_notes_es: string;
  watering_notes_en: string;
};

// Static reference data. It can be shown as catalog-origin information, but it must not
// silently overwrite user-entered values; any calculation has to label its data source.
export const CULTIVATION_REFERENCE: CultivationReferenceRow[] = [
  {
    type: "feminized",
    label_es: "Feminizada fotoperiodica",
    label_en: "Photoperiod feminized",
    days_to_flower_range: "21-45 dias",
    flowering_weeks_range: "8-10 semanas",
    pot_liters_range: "7-20 L",
    light_notes_es: "Referencia visual: suele registrarse con luz interior o exterior declarada por el usuario.",
    light_notes_en: "Visual reference: often logged with indoor or outdoor light declared by the user.",
    watering_notes_es: "Referencia visual: revisar humedad real antes de cargar un riego manual.",
    watering_notes_en: "Visual reference: check real moisture before logging a manual watering."
  },
  {
    type: "regular",
    label_es: "Regular fotoperiodica",
    label_en: "Photoperiod regular",
    days_to_flower_range: "21-45 dias",
    flowering_weeks_range: "8-12 semanas",
    pot_liters_range: "7-25 L",
    light_notes_es: "Referencia visual: el usuario define manualmente luz, espacio y cambios de etapa.",
    light_notes_en: "Visual reference: the user manually defines light, space, and stage changes.",
    watering_notes_es: "Referencia visual: registrar riegos solo cuando el usuario lo decida.",
    watering_notes_en: "Visual reference: log watering only when the user decides it."
  },
  {
    type: "autoflowering",
    label_es: "Automatica",
    label_en: "Autoflowering",
    days_to_flower_range: "15-30 dias",
    flowering_weeks_range: "5-8 semanas",
    pot_liters_range: "5-15 L",
    light_notes_es: "Referencia visual: no se calcula pase a flora; el usuario lo declara si corresponde.",
    light_notes_en: "Visual reference: flowering transition is not calculated; the user declares it if needed.",
    watering_notes_es: "Referencia visual: usar solo como ayuda de lectura, sin sugerir cantidad de agua.",
    watering_notes_en: "Visual reference: use only as reading aid, without suggesting water amount."
  }
];

export function getReferenceRow(type: SeedType) {
  return CULTIVATION_REFERENCE.find((row) => row.type === type);
}
