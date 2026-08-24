import type { GeneticReferenceEntry, GeneticType } from "@/lib/genetics-catalog";

type CatalogRow = [name: string, bank: string, type: string, duration: string, thc: string, cbd: string, flavor: string, reference: string];

const rows: CatalogRow[] = [
  ["Ice Cream Cake Auto","WeedSeedsExpress","Automática feminizada","60-70 días","Hasta 24%","Hasta 1%","Crema, tierra, dulce, vainilla","[6]"],
  ["ManBearAlienPig","Mephisto Genetics","F3 automática feminizada","75-85 días desde brote","No informado","No informado","Cremoso, limón, frutal, cítrico, terroso, gas, especias","[7]"],
  ["Banana OG","Humboldt Seed Company 2026","Feminizada; también versión auto","55-65 días","Promedio 25%","No informado","Banana, caramelo y combustible","[8]"],
  ["Grand Doggy Purps Auto","Pacific Seed Bank","Automática feminizada","55-65 días","18%","Casi 10%","Dulce, skunk y diésel; cariofileno, mirceno, pineno","[9]"],
  ["Future #1","Anesia Seeds","Feminizada fotoperiódica","9-10 sem.","37% declarado","No informado","Piña y mango","[10]"],
  ["Lime Glow","Phylos Bioscience","Automática feminizada","65-75 días siembra-cosecha","20% ± 2%","No informado","Tierra, lima, skunk","[11]"],
  ["Zamaldelica Auto","Master of Seeds","Feminizada automática","8-9 sem.","11-16%","<0,06%","Caramelo, mango, melocotón, licor, anís, almizcle, zanahoria dulce","[12]"],
  ["Skunk #1 Automatic","Sensi Seeds","Automática feminizada","45-55 días de floración","Rica en THC; porcentaje no publicado","No informado","Terroso, dulce, agudo, skunk","[13]"],
  ["Skunk #1 Feminized","Sensi Seeds","Feminizada fotoperiódica","Corta; cifra no publicada","No informado","No informado","Terroso, dulce, skunk","[14]"],
  ["Ambassador","Verve Seeds 2026 / Charlotte's Web","Híbrida automática, 99% feminizada","65 días / 9 sem.","Derivado de ratio 28:1; porcentaje no publicado","Hasta 9%","Dulce, terroso, pino","[15]"],
  ["CBF1","Verve Seeds 2026","Híbrida feminizada fotoperiódica","Temporada larga; inicia floración en septiembre","Derivado de ratio 30:1; porcentaje no publicado","Hasta 10%","Floral, frutal, con fondo terroso","[16]"],
  ["Umpqua","Verve Seeds 2026","Híbrida 99% feminizada","Media temporada; fin de septiembre","Derivado de ratio 30:1; porcentaje no publicado","Hasta 10%","Pimienta intensa y final de pino","[17]"],
  ["Chola","Verve Seeds 2026","F1 99% feminizada","Temprana; fin de septiembre","Derivado de ratio 35:1; porcentaje no publicado","10-12% biomasa; 17-19% flor","Herbal, dulce, pino, cítrico, floral","[18]"],
  ["TONIP","Canavasalus 2023","99% feminizada (cáñamo CBD)","65-75 días","<0,3%","14-17%","Frutal intenso","[19]"],
  ["ENECTALIA","Canavasalus 2023","99% feminizada (cáñamo CBD)","65-75 días","<0,3%","8-12%","Frutal y resinoso","[19]"],
  ["All Gas OG","Humboldt Seed Company 2026","Feminizada y automática","55 días; auto 100 días","Prom. 21%","No informado","Skunk, naranja, pino y gas","[20]"],
  ["Apple Blossom","Humboldt Seed Company 2026","Feminizada, regular y automática","45 días; auto 80 días","Prom. 26-30%","No informado","Floral delicado y manzana dulce","[20]"],
  ["Banana Melt","Humboldt Seed Company 2026","Feminizada","63 días","No informado","No informado","Banana madura, cítrico y piña","[20]"],
  ["Bigfoot Glue","Humboldt Seed Company 2026","Feminizada","60 días","Prom. 17-25%","No informado","Pino, floral, ácido y pungente","[20]"],
  ["Blueberry Cupcake","Humboldt Seed Company 2026","Feminizada","60 días","Prom. 28-34%","No informado","Masa de pastel, arándanos y combustible","[20]"],
  ["Blueberry Honey","Humboldt Seed Company 2026","Feminizada","50 días","No informado","No informado","Arándanos maduros y miel","[20]"],
  ["Blueberry Muffin","Humboldt Seed Company 2026","Feminizada","45 días","No informado","No informado","Muffin de arándanos y manzanilla","[20]"],
  ["Blueberry Pancakes","Humboldt Seed Company 2026","Feminizada","60 días","No informado","No informado","Arándanos, jarabe dulce y fruta","[20]"],
  ["California Haze","Humboldt Seed Company 2026","Feminizada","67 días","Prom. 25-27%","No informado","Cítrico, pino y dulce","[20]"],
  ["California Octane","Humboldt Seed Company 2026","Feminizada y triploide","60 días","Prom. 26%","No informado","Gas, guayaba y crema","[20]"],
  ["California Sour Diesel","Humboldt Seed Company 2026","Feminizada y automática","70 días; auto 70 días","No informado","No informado","Limón ácido, cítrico y combustible","[20]"],
  ["Caramel Cream","Humboldt Seed Company 2026","Feminizada y automática","60 días; auto 90 días","Prom. 25%","No informado","Caramelo salado, crema, nuez y combustible","[20]"],
  ["Caribbean Queen","Humboldt Seed Company 2026","Feminizada","60 días","No informado","No informado","Frutas tropicales y especias","[20]"],
  ["Chicken n' Wafflez","Humboldt Seed Company 2026","Feminizada","60 días","Prom. 30%","No informado","Mantequilla salada, jarabe, hierbas y especias","[20]"],
  ["Chunkadelic","Humboldt Seed Company 2026","Automática","75-85 días desde germinación","Prom. 18-22%","No informado","Combustible, skunk y mandarina","[20]"],
  ["Donutz","Humboldt Seed Company 2026","Feminizada","55 días","25-30%","No informado","Donas glaseadas, masa dulce y combustible","[20]"],
  ["Dream Queen","Humboldt Seed Company 2026","Feminizada y automática","45 días; auto 100 días","Prom. 23%","No informado","Naranja, pino y skunk dulce","[20]"],
  ["Durban Poison Auto","Humboldt Seed Company 2026","Automática","100 días brote-cosecha","Prom. 28-32%","No informado","Menta, combustible y dulzor","[20]"],
  ["Emerald Fire OG","Humboldt Seed Company 2026","Feminizada y automática","60 días; auto 85 días","Prom. 23-28%","No informado","Tierra, cítrico, limón y pino","[20]"],
  ["Farmer's Daughter","Humboldt Seed Company 2026","Feminizada","70 días","Prom. 26-30%","No informado","Cítrico, pomelo y kush","[20]"],
  ["Garlic Budder","Humboldt Seed Company 2026","Feminizada y automática","70 días","Prom. 28-32%","No informado","Ajo y especias","[20]"],
  ["Gazzurple","Humboldt Seed Company 2026","Feminizada","50 días","28-33%","No informado","Gas, bayas y crema","[20]"],
  ["Golden Sands","Humboldt Seed Company 2026","Feminizada","55-60 días","30-35%","No informado","Gas OG, funk y floral","[20]"],
  ["Granny Candy","Humboldt Seed Company 2026","Feminizada","50-55 días","Prom. 25-30%","No informado","Fresa ácida, piña, caramelo y combustible","[20]"],
  ["Guzzlerz","Humboldt Seed Company 2026","Feminizada","55-60 días","30-35%","No informado","Gas, amoníaco y funk","[20]"],
  ["Hella Jelly","Humboldt Seed Company 2026","Feminizada y automática","45 días; auto 80 días","Prom. 26-30%","No informado","Algodón de azúcar, fresa y uva","[20]"],
  ["Hi-Biscus","Humboldt Seed Company 2026","Feminizada","55 días","Prom. 20%","No informado","Ponche de frutas, hibisco, cereza y mango","[20]"],
  ["Honey Bear","Humboldt Seed Company 2026","Feminizada","45-50 días","Prom. 25%","No informado","Papaya, miel y toque de queso","[20]"],
  ["Humboldt Headband","Humboldt Seed Company 2026","Feminizada y automática","60 días; auto 90 días","Prom. 19-25%","No informado","Tierra, diésel, limón y pungente","[20]"],
  ["Jelly Donutz","Humboldt Seed Company 2026","Feminizada y automática","55 días","Prom. 30-35%","No informado","Algodón de azúcar y combustible","[20]"],
  ["Ghost of NYC","Humboldt Seed Organization 2025","Feminizada","63-65 días","24-26%","0,1%","Gas, cítrico, dulce y ácido","[21]"],
  ["Green Crack 2.0","Humboldt Seed Organization 2025","Feminizada","60-65 días","18%+","0,1%","Cítrico, mango, piña, cedro e incienso","[21]"],
  ["Lemon Citron","Humboldt Seed Organization 2025","Feminizada","65 días","24-26%+","0,1%","Gas, cítrico, fruta dulce, limón y acetona","[21]"],
  ["Mouth Wash","Humboldt Seed Organization 2025","Feminizada","55-60 días","18-22%","0,1%","Tierra, fruta dulce, pino, cítrico y madera","[21]"],
  ["Mango Sapphire","Humboldt Seed Organization 2025","Feminizada","50-55 días","21-23%","0,1%","Coco, mango, cítrico y fruta dulce","[21]"],
  ["Columbian Gold Auto","Kind Seed Co","Automática feminizada","56-70 días / 8-10 sem.","21-25%","0-0,5%","Cítrico, tierra, limón y notas ácidas","[22]"],
  ["Grandaddy Purple Auto","Kind Seed Co","Automática feminizada","8-10 sem.","19%","No informado","Tierra, bayas y uva","[22]"],
  ["Great White Shark Auto","Kind Seed Co","Automática feminizada","9-11 sem.; aprox. 10 sem. semilla-cosecha","No informado","No informado","No informado","[22]"],
  ["NY Diesel Auto","Kind Seed Co","Automática feminizada","8-9 sem.","14%","2%","Diésel pungente","[22]"],
  ["Chocolate Auto","Kind Seed Co","Automática feminizada","7-8 sem. (texto); 8-10 sem. (tabla)","23%","3%","Chocolate, café, cacao y tierra","[22]"],
  ["Papaya Breath Auto","Atlas Seed","Day neutral, 99,997% feminizada","56-70 días","19-25%","No informado","No informado","[23]"],
  ["Mendo Star Auto","Atlas Seed","Day neutral, 99,997% feminizada","56-70 días","19-25%","No informado","No informado","[23]"],
  ["Grand Daddy Purple Auto","Atlas Seed","Day neutral, 99,997% feminizada","56-70 días","19-25%","No informado","No informado","[23]"],
  ["Auto Bahn","DNA Genetics","Automática feminizada F1","75-90 días desde siembra","Ratio CBD:THC 24:1-32:1","Cannabinoides totales 12-15%; CBD dominante","Skunk, tierra, terpinoleno y bayas","[25]"],
  ["Chocolope","DNA Genetics","Feminizada","8-9 sem.","Alto; porcentaje no publicado","No informado","Chocolate y café","[25]"],
  ["Chocolope 256","DNA Genetics","Feminizada","9 sem.","19%; reportes hasta 23-26%","0,5-1%","Chocolate, café, vainilla, cítrico y frutos secos","[25]"],
  ["L.A. Chocolat","DNA Genetics","Feminizada","8-9 sem.","22-29%","No informado","Chocolate, café, cítrico, tierra y pino","[25]"],
  ["GG4","DNA Genetics","Feminizada","9-10 sem.","Hasta 27%","No informado","No informado","[25]"],
  ["Pineapple Pulse Auto","Original Sensible Seeds","Automática feminizada","55-65 días semilla-cosecha","26%","No informado","Piña tropical, cítrico dulce y crema","[26]"],
  ["Frozen Cheesecake Auto","Original Sensible Seeds","Automática feminizada","65 días","No informado","No informado","Cheesecake y helado","[26]"],
  ["Pink Rozay x Strawberry Banana Auto","Original Sensible Seeds","Automática feminizada","65-70 días","No informado","No informado","Frutal dulce, tierra y mentol","[26]"],
  ["NY Diesel","Original Sensible Seeds","Feminizada fotoperiódica","60-70 días / 9-10 sem.","No informado","No informado","Dulce, frutal, madera e incienso","[26]"],
  ["GG 4 Original Glue","Original Sensible Seeds","Feminizada fotoperiódica","56-63 días",">28%","No informado","Tierra y diésel","[26]"],
  ["Caramelo","EcoTrio Labs 2026","99,9% feminizada (CBD)","7-8 sem.","<1%","Hasta 16%","Dulce y frutal","[27]"],
];

export const PDF_CATALOG_2026_GENETICS: GeneticReferenceEntry[] = rows.map(([name, bank, publishedType, duration, thc, cbd, flavor, reference]) => ({
  id: `pdf-2026-${slugify(name)}`,
  name,
  cross: "No informado",
  type: parseType(publishedType),
  flowering_weeks_range: parseWeeks(duration),
  thc_percent_range: parsePercentRange(thc),
  effect_notes: "No informado",
  flavor_notes: flavor,
  raw_fields: { "Catálogo / banco": bank, "Tipo publicado": publishedType, "Duración publicada": duration, "THC publicado": thc, "CBD publicado": cbd, "Sabor y aroma": flavor, "Referencia del informe": reference },
  source: `${bank} - Catálogos de semillas de cannabis, edición ampliada 2026 ${reference}`,
}));

function parseType(value: string): GeneticType {
  const normalized = value.toLowerCase();
  if (normalized.includes("automática") || normalized.includes("neutral")) return "autoflowering";
  if (normalized.includes("regular")) return "regular";
  return "feminized";
}

function parseWeeks(value: string): [number, number] {
  const weeks = value.match(/(\d+)(?:\s*-\s*(\d+))?\s*sem/i);
  if (weeks) return [Number(weeks[1]), Number(weeks[2] ?? weeks[1])];
  const days = value.match(/(\d+)(?:\s*-\s*(\d+))?\s*d[ií]as/i);
  if (days) return [Math.round(Number(days[1]) / 7), Math.round(Number(days[2] ?? days[1]) / 7)];
  return [0, 0];
}

function parsePercentRange(value: string): [number, number] {
  if (/no informado|no publicado|ratio/i.test(value)) return [0, 0];
  const tolerance = value.match(/(\d+(?:[.,]\d+)?)\s*%?\s*[±]\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (tolerance) {
    const center = Number(tolerance[1].replace(",", "."));
    const margin = Number(tolerance[2].replace(",", "."));
    return [Math.max(0, center - margin), center + margin];
  }
  const values = [...value.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(",", ".")));
  return values.length ? [values[0], values[1] ?? values[0]] : [0, 0];
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
