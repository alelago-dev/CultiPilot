import type { DataOrigin } from "@/lib/types";

export type SeedClimate = "Templado" | "Calido" | "Fresco" | "Seco" | "Interior controlado";

export type SeedProfile = {
  id: string;
  name: string;
  crop: string;
  category: "cannabis" | "horticultural" | "regulated";
  regulated: boolean;
  seedType: string;
  climates: SeedClimate[];
  daysToHarvest: string;
  sowingWindow: string;
  careNote: string;
  recommendationEnabled: boolean;
};

export type HorticulturePlanInput = {
  indoorSize?: "small" | "medium" | "large";
  lightType?: "led" | "sun" | "mixed";
  potLiters?: number;
  seedId?: string;
  userHarvestWindow?: string;
  userSeedType?: string;
};

export type HorticulturePlanDataPoint = {
  label: string;
  source: DataOrigin;
  value: string;
};

export type HorticulturePlan = {
  automaticEnabled: boolean;
  dataPoints: HorticulturePlanDataPoint[];
  missingInputs: string[];
  seedLabel: string;
  substrateLiters: string;
  waterCheck: string;
  waterAmount: string;
  lightFit: string;
  spaceFit: string;
  harvestWindow: string;
  note: string;
};

export const seedClimateOptions: SeedClimate[] = ["Templado", "Calido", "Fresco", "Seco", "Interior controlado"];

// Business rule: "regulated" is legal metadata only. It does not disable calculations by itself.
// Calculation availability depends on the available user, catalog, measurement, or estimated data.
export const seedCatalog: SeedProfile[] = [
  {
    id: "cannabis-photoperiod-regular",
    name: "Fotoperiodica regular",
    crop: "Cannabis legal",
    category: "cannabis",
    regulated: true,
    seedType: "Regulada",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Disponible para seguimiento donde el cultivo sea legal. Los calculos requieren datos suficientes cargados por el usuario.",
    recommendationEnabled: true
  },
  {
    id: "cannabis-photoperiod-feminized",
    name: "Fotoperiodica feminizada",
    crop: "Cannabis legal",
    category: "cannabis",
    regulated: true,
    seedType: "Regulada",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Disponible para seguimiento donde el cultivo sea legal. Los calculos requieren datos suficientes cargados por el usuario.",
    recommendationEnabled: true
  },
  {
    id: "cannabis-autoflowering",
    name: "Autofloreciente",
    crop: "Cannabis legal",
    category: "cannabis",
    regulated: true,
    seedType: "Regulada",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Disponible para seguimiento donde el cultivo sea legal. Los calculos requieren datos suficientes cargados por el usuario.",
    recommendationEnabled: true
  },
  {
    id: "cannabis-cbd",
    name: "CBD / medicinal",
    crop: "Cannabis legal",
    category: "cannabis",
    regulated: true,
    seedType: "Regulada",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Disponible para seguimiento donde el cultivo sea legal. Los calculos requieren datos suficientes cargados por el usuario.",
    recommendationEnabled: true
  },
  {
    id: "cannabis-hemp",
    name: "Canamo industrial",
    crop: "Cannabis legal",
    category: "cannabis",
    regulated: true,
    seedType: "Regulada",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Disponible para seguimiento donde el cultivo sea legal. Los calculos requieren datos suficientes cargados por el usuario.",
    recommendationEnabled: true
  },
  {
    id: "cannabis-custom",
    name: "Otra genetica / banco propio",
    crop: "Cannabis legal",
    category: "cannabis",
    regulated: true,
    seedType: "Regulada - carga libre",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Usa esta opcion para registrar una variedad legal que no figure en el listado. Los calculos dependen de los datos tecnicos que cargue el usuario.",
    recommendationEnabled: true
  },
  {
    id: "tomato-roma",
    name: "Roma",
    crop: "Tomate",
    category: "horticultural",
    regulated: false,
    seedType: "Hortaliza de fruto",
    climates: ["Templado", "Calido"],
    daysToHarvest: "70-85 dias",
    sowingWindow: "Primavera y verano",
    careNote: "Buena opcion para exterior con sol directo y riego controlado.",
    recommendationEnabled: true
  },
  {
    id: "basil-genovese",
    name: "Genovesa",
    crop: "Albahaca",
    category: "horticultural",
    regulated: false,
    seedType: "Aromatica",
    climates: ["Templado", "Calido", "Interior controlado"],
    daysToHarvest: "45-60 dias",
    sowingWindow: "Primavera a inicio de otono",
    careNote: "Funciona bien en maceta y espacios luminosos.",
    recommendationEnabled: true
  },
  {
    id: "lettuce-butterhead",
    name: "Mantecosa",
    crop: "Lechuga",
    category: "horticultural",
    regulated: false,
    seedType: "Hoja",
    climates: ["Fresco", "Templado"],
    daysToHarvest: "50-65 dias",
    sowingWindow: "Otono, invierno suave y primavera",
    careNote: "Preferible para temperaturas suaves y media sombra.",
    recommendationEnabled: true
  },
  {
    id: "pepper-california",
    name: "California Wonder",
    crop: "Pimiento",
    category: "horticultural",
    regulated: false,
    seedType: "Hortaliza de fruto",
    climates: ["Calido", "Templado"],
    daysToHarvest: "75-95 dias",
    sowingWindow: "Primavera",
    careNote: "Apto para espacios calidos con buena luz.",
    recommendationEnabled: true
  },
  {
    id: "lavender-dentata",
    name: "Dentata",
    crop: "Lavanda",
    category: "horticultural",
    regulated: false,
    seedType: "Aromatica perenne",
    climates: ["Seco", "Templado"],
    daysToHarvest: "90-120 dias",
    sowingWindow: "Primavera",
    careNote: "Prefiere sustratos drenantes y riegos espaciados.",
    recommendationEnabled: true
  },
  {
    id: "cilantro-santo",
    name: "Santo",
    crop: "Cilantro",
    category: "horticultural",
    regulated: false,
    seedType: "Aromatica",
    climates: ["Fresco", "Templado"],
    daysToHarvest: "35-55 dias",
    sowingWindow: "Otono y primavera",
    careNote: "Conveniente para ciclos cortos y climas no extremos.",
    recommendationEnabled: true
  },
  {
    id: "spinach-bloomsdale",
    name: "Bloomsdale",
    crop: "Espinaca",
    category: "horticultural",
    regulated: false,
    seedType: "Hoja",
    climates: ["Fresco"],
    daysToHarvest: "40-55 dias",
    sowingWindow: "Otono e invierno suave",
    careNote: "Mejor en clima fresco, con humedad estable.",
    recommendationEnabled: true
  },
  {
    id: "regulated-manual",
    name: "Variedad regulada",
    crop: "Carga manual legal",
    category: "regulated",
    regulated: true,
    seedType: "Regulada - carga libre",
    climates: [],
    daysToHarvest: "Definido por el usuario",
    sowingWindow: "Segun normativa local",
    careNote:
      "Permite seguimiento y calculos genericos basados en los datos aportados por el usuario, si el cultivo es legal.",
    recommendationEnabled: true
  }
];

export function getRecommendedSeeds(climate: SeedClimate) {
  return seedCatalog.filter((seed) => seed.recommendationEnabled && seed.climates.includes(climate));
}

export function getHorticultureSeeds() {
  return seedCatalog.filter((seed) => seed.recommendationEnabled);
}

export function calculateHorticulturePlan(input: HorticulturePlanInput): HorticulturePlan {
  const fallbackSeed = getHorticultureSeeds().find((item) => !item.regulated) ?? getHorticultureSeeds()[0];
  const seed = seedCatalog.find((item) => item.id === input.seedId) ?? fallbackSeed;
  const missingInputs: string[] = [];
  const seedType = input.userSeedType || seed?.seedType;

  if (!seed) missingInputs.push("semilla o variedad");
  if (!seedType) missingInputs.push("tipo de semilla/cultivo");
  if (!input.indoorSize) missingInputs.push("tamano de indoor o espacio");
  if (!input.lightType) missingInputs.push("tipo de luz");
  if (!Number.isFinite(input.potLiters) || Number(input.potLiters) <= 0) missingInputs.push("litros de maceta");

  const catalogHarvestWindow = seed?.daysToHarvest ?? "";
  const harvestWindow = input.userHarvestWindow?.trim() || (/\d/.test(catalogHarvestWindow) ? catalogHarvestWindow : "");

  if (!harvestWindow) missingInputs.push("ventana de cosecha/ciclo declarada por usuario o catalogo");

  const potLiters = Math.max(1, Math.min(Number(input.potLiters) || 1, 80));
  const lightType = input.lightType ?? "mixed";
  const indoorSize = input.indoorSize ?? "medium";
  const waterBase = getWaterBaseBySeed(seedType || "");
  const lightMultiplier = lightType === "led" ? 1.05 : lightType === "sun" ? 1.15 : 1;
  const spaceMultiplier = indoorSize === "small" ? 0.88 : indoorSize === "large" ? 1.08 : 1;
  const waterMin = Math.round(potLiters * waterBase * lightMultiplier * spaceMultiplier);
  const waterMax = Math.round(waterMin * 1.35);
  const substrateLiters = `${Math.ceil(potLiters * 1.05)} a ${Math.ceil(potLiters * 1.2)} L de mezcla total`;
  const waterCheck = getWaterCheckBySeed(seedType || "", lightType);
  const waterAmount = `${waterMin}-${waterMax} ml por registro, ajustando segun humedad real`;
  const lightFit = getLightFit(seedType || "", lightType);
  const spaceFit = getSpaceFit(seedType || "", indoorSize);
  const seedLabel = seed ? `${seed.crop} ${seed.name}` : "Semilla no declarada";
  const automaticEnabled = missingInputs.length === 0;
  const harvestSource: DataOrigin = input.userHarvestWindow?.trim() ? "user" : /\d/.test(catalogHarvestWindow) ? "catalog" : "missing";

  return {
    automaticEnabled,
    dataPoints: [
      { label: "Semilla", source: seed ? "catalog" : "missing", value: seedLabel },
      { label: "Maceta", source: input.potLiters ? "user" : "missing", value: `${potLiters} L` },
      { label: "Luz", source: input.lightType ? "user" : "missing", value: lightType },
      { label: "Espacio", source: input.indoorSize ? "user" : "missing", value: indoorSize },
      { label: "Sustrato", source: "calculated", value: substrateLiters },
      { label: "Riego", source: "calculated", value: waterAmount },
      { label: "Ventana", source: harvestSource, value: harvestWindow || "Dato faltante" }
    ],
    missingInputs,
    seedLabel,
    substrateLiters: missingInputs.includes("litros de maceta") ? "Falta declarar litros de maceta" : substrateLiters,
    waterCheck: missingInputs.includes("tipo de luz") ? "Falta declarar tipo de luz" : waterCheck,
    waterAmount: missingInputs.includes("litros de maceta") ? "Falta declarar litros de maceta" : waterAmount,
    lightFit: missingInputs.includes("tipo de luz") ? "Falta declarar tipo de luz" : lightFit,
    spaceFit: missingInputs.includes("tamano de indoor o espacio") ? "Falta declarar tamano de indoor o espacio" : spaceFit,
    harvestWindow: harvestWindow || "Falta declarar ventana de cosecha/ciclo",
    note: automaticEnabled
      ? "Estimacion basada en datos disponibles. Confirmar con mediciones reales antes de actuar."
      : `No hay datos suficientes para activar todas las estimaciones. Faltan: ${missingInputs.join(", ")}.`
  };
}

function getWaterBaseBySeed(seedType: string) {
  if (seedType.includes("Hoja")) return 55;
  if (seedType.includes("Aromatica perenne")) return 35;
  if (seedType.includes("Aromatica")) return 42;
  return 60;
}

function getWaterCheckBySeed(seedType: string, lightType: HorticulturePlanInput["lightType"]) {
  const extraLight = lightType === "sun" ? " y despues de dias de mucho sol" : "";
  if (seedType.includes("Hoja")) return `Revisar humedad cada 1-2 dias${extraLight}`;
  if (seedType.includes("Aromatica perenne")) return `Revisar humedad cada 3-5 dias${extraLight}`;
  return `Revisar humedad periodicamente${extraLight}`;
}

function getLightFit(seedType: string, lightType: HorticulturePlanInput["lightType"]) {
  if (seedType.includes("Hoja")) {
    return lightType === "sun" ? "Luz moderada o media sombra" : "LED suave a medio";
  }

  if (seedType.includes("Aromatica")) {
    return lightType === "mixed" ? "Luz mixta estable" : "Luz alta sin exceso de calor";
  }

  return "Usar los parametros de iluminacion registrados por el usuario";
}

function getSpaceFit(seedType: string, indoorSize: HorticulturePlanInput["indoorSize"]) {
  if (seedType.includes("Hortaliza de fruto")) {
    return indoorSize === "small" ? "Usar variedades compactas o tutorado" : "Espacio apto para plantas de fruto";
  }

  if (seedType.includes("Aromatica perenne")) return "Espacio compacto, priorizar buen drenaje";
  return "Evaluar segun dimensiones y mediciones registradas";
}
