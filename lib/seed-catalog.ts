export type SeedClimate =
  | "Templado"
  | "Calido"
  | "Fresco"
  | "Seco"
  | "Interior controlado";

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
  indoorSize: "small" | "medium" | "large";
  lightType: "led" | "sun" | "mixed";
  potLiters: number;
  seedId: string;
};

export type HorticulturePlan = {
  automaticEnabled: boolean;
  seedLabel: string;
  substrateLiters: string;
  waterCheck: string;
  waterAmount: string;
  lightFit: string;
  spaceFit: string;
  harvestWindow: string;
  note: string;
};

export const seedClimateOptions: SeedClimate[] = [
  "Templado",
  "Calido",
  "Fresco",
  "Seco",
  "Interior controlado"
];

// "regulated" is legal/metadata classification only.
// It must not disable the generic calculation engine by itself.
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
      "Disponible para seguimiento cuando el cultivo sea legal en la jurisdiccion del usuario.",
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
      "Disponible para seguimiento cuando el cultivo sea legal en la jurisdiccion del usuario.",
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
      "Disponible para seguimiento cuando el cultivo sea legal en la jurisdiccion del usuario.",
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
      "Disponible para seguimiento cuando el cultivo sea legal en la jurisdiccion del usuario.",
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
      "Disponible para seguimiento cuando el cultivo sea legal en la jurisdiccion del usuario.",
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
      "Usa esta opcion para registrar una variedad legal que no figure en el listado.",
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
    careNote:
      "Buena opcion para exterior con sol directo y riego controlado.",
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
      "Permite seguimiento y calculos genericos basados en los datos aportados por el usuario.",
    recommendationEnabled: true
  }
];

export function getRecommendedSeeds(climate: SeedClimate) {
  return seedCatalog.filter(
    (seed) =>
      seed.recommendationEnabled &&
      (seed.climates.length === 0 || seed.climates.includes(climate))
  );
}

export function getHorticultureSeeds() {
  return seedCatalog.filter(
    (seed) =>
      seed.category === "horticultural" &&
      seed.recommendationEnabled
  );
}

export function calculateHorticulturePlan(
  input: HorticulturePlanInput
): HorticulturePlan {
  const seed =
    seedCatalog.find((item) => item.id === input.seedId) ??
    getHorticultureSeeds()[0];

  if (!seed) {
    return {
      automaticEnabled: false,
      seedLabel: "Sin variedad seleccionada",
      substrateLiters: "Datos insuficientes",
      waterCheck: "Datos insuficientes",
      waterAmount: "Datos insuficientes",
      lightFit: "Datos insuficientes",
      spaceFit: "Datos insuficientes",
      harvestWindow: "Datos insuficientes",
      note: "Selecciona una variedad para generar una estimacion."
    };
  }

  const potLiters = Math.max(1, Math.min(input.potLiters, 80));

  const waterBase = getWaterBaseBySeed(seed.seedType);

  const lightMultiplier =
    input.lightType === "led"
      ? 1.05
      : input.lightType === "sun"
        ? 1.15
        : 1;

  const spaceMultiplier =
    input.indoorSize === "small"
      ? 0.88
      : input.indoorSize === "large"
        ? 1.08
        : 1;

  const waterMin = Math.round(
    potLiters * waterBase * lightMultiplier * spaceMultiplier
  );

  const waterMax = Math.round(waterMin * 1.35);

  return {
    automaticEnabled: true,
    seedLabel: `${seed.crop} ${seed.name}`,
    substrateLiters: `${Math.ceil(potLiters * 1.05)} a ${Math.ceil(
      potLiters * 1.2
    )} L de mezcla total`,
    waterCheck: getWaterCheckBySeed(seed.seedType, input.lightType),
    waterAmount: `${waterMin}-${waterMax} ml por registro, ajustando segun humedad real`,
    lightFit: getLightFit(seed.seedType, input.lightType),
    spaceFit: getSpaceFit(seed.seedType, input.indoorSize),
    harvestWindow: seed.daysToHarvest,
    note: seed.regulated
      ? "Estimacion generica basada en los datos ingresados. Cultivo sujeto a la normativa aplicable."
      : "Calculo horticola orientativo. Confirmar las condiciones reales antes de aplicar una sugerencia."
  };
}

function getWaterBaseBySeed(seedType: string) {
  if (seedType.includes("Hoja")) return 55;
  if (seedType.includes("Aromatica perenne")) return 35;
  if (seedType.includes("Aromatica")) return 42;

  // Generic fallback.
  // Regulated status does not define cultivation parameters.
  return 60;
}

function getWaterCheckBySeed(
  seedType: string,
  lightType: HorticulturePlanInput["lightType"]
) {
  const extraLight =
    lightType === "sun" ? " y despues de dias de mucho sol" : "";

  if (seedType.includes("Hoja")) {
    return `Revisar humedad cada 1-2 dias${extraLight}`;
  }

  if (seedType.includes("Aromatica perenne")) {
    return `Revisar humedad cada 3-5 dias${extraLight}`;
  }

  return `Revisar humedad periodicamente${extraLight}`;
}

function getLightFit(
  seedType: string,
  lightType: HorticulturePlanInput["lightType"]
) {
  if (seedType.includes("Hoja")) {
    return lightType === "sun"
      ? "Luz moderada o media sombra"
      : "LED suave a medio";
  }

  if (seedType.includes("Aromatica")) {
    return lightType === "mixed"
      ? "Luz mixta estable"
      : "Luz alta sin exceso de calor";
  }

  return "Usar los parametros de iluminacion registrados por el usuario";
}

function getSpaceFit(
  seedType: string,
  indoorSize: HorticulturePlanInput["indoorSize"]
) {
  if (seedType.includes("Hortaliza de fruto")) {
    return indoorSize === "small"
      ? "Usar variedades compactas o tutorado"
      : "Espacio apto para plantas de fruto";
  }

  if (seedType.includes("Aromatica perenne")) {
    return "Espacio compacto, priorizar buen drenaje";
  }

  return "Evaluar segun dimensiones y mediciones registradas";
}
