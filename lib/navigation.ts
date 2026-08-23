import type { Locale } from "@/lib/types";

export type AppSection = "today" | "seeds" | "spaces" | "calendar" | "journal" | "privacy";

export type NavigationItem = {
  icon: string;
  key: AppSection;
  label: string;
  short: string;
  slug: string;
};

export const navigationByLocale: Record<Locale, NavigationItem[]> = {
  es: [
    { icon: "H", key: "today", label: "Hoy", short: "Hoy", slug: "hoy" },
    { icon: "S", key: "seeds", label: "Semillas", short: "Semillas", slug: "semillas" },
    { icon: "E", key: "spaces", label: "Espacios", short: "Espacios", slug: "espacios" },
    { icon: "C", key: "calendar", label: "Calendario", short: "Calendario", slug: "calendario" },
    { icon: "D", key: "journal", label: "Diario", short: "Diario", slug: "diario" },
    { icon: "L", key: "privacy", label: "Privacidad", short: "Privacidad", slug: "privacidad" }
  ],
  en: [
    { icon: "T", key: "today", label: "Today", short: "Today", slug: "today" },
    { icon: "S", key: "seeds", label: "Seeds", short: "Seeds", slug: "seeds" },
    { icon: "G", key: "spaces", label: "Spaces", short: "Spaces", slug: "spaces" },
    { icon: "C", key: "calendar", label: "Calendar", short: "Calendar", slug: "calendar" },
    { icon: "J", key: "journal", label: "Journal", short: "Journal", slug: "journal" },
    { icon: "L", key: "privacy", label: "Privacy", short: "Privacy", slug: "privacy" }
  ]
};

export const allSectionStaticParams = Object.entries(navigationByLocale).flatMap(([locale, items]) =>
  items.map((item) => ({ locale, section: item.slug }))
);

export function getSectionFromSlug(locale: Locale, slug: string): AppSection | null {
  return navigationByLocale[locale].find((item) => item.slug === slug)?.key ?? null;
}

/**
 * Ruta interna de la app, SIN el prefijo del repositorio.
 *
 * Es la que va en los `href` de `next/link` y en `redirect()`: Next ya le
 * agrega el `basePath` por su cuenta, asi que agregarselo aca lo duplicaria
 * (`/CultiPilot/CultiPilot/es/hoy/`).
 */
export function getInternalSectionHref(locale: Locale, section: AppSection) {
  const item = navigationByLocale[locale].find((navItem) => navItem.key === section);

  return `/${locale}/${item?.slug ?? navigationByLocale[locale][0].slug}/`;
}

/**
 * Ruta completa, CON el prefijo del repositorio.
 *
 * Es la que va donde Next no interviene y hace falta la URL tal cual la
 * entiende el navegador: `window.location`, las notificaciones push y los
 * `<a href>` sueltos. Para `next/link` usar `getInternalSectionHref`.
 */
export function getSectionHref(locale: Locale, section: AppSection) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return `${basePath}${getInternalSectionHref(locale, section)}`;
}
