import { isLocale } from "@/lib/i18n";
import { allSectionStaticParams, getSectionFromSlug, getSectionHref } from "@/lib/navigation";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return allSectionStaticParams;
}

export default async function DuplicateBasePathRedirectPage({
  params
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const currentSection = getSectionFromSlug(locale, section);

  if (!currentSection) {
    notFound();
  }

  const targetHref = getSectionHref(locale, currentSection);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <meta httpEquiv="refresh" content={`0;url=${targetHref}`} />
      <h1 className="text-2xl font-black">Redirigiendo...</h1>
      <p className="text-sm text-muted-foreground">Esta ruta anterior tenia el prefijo duplicado.</p>
      <a className="primary-button" href={targetHref}>
        Abrir CultiPilot
      </a>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(targetHref)});`
        }}
      />
    </main>
  );
}
