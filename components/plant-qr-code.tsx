/**
 * plant-qr-code.tsx
 *
 * Codigo QR por maceta, para imprimir/pegar en el tiesto o en un cartel al
 * lado de la planta. Codifica un enlace directo a la fila de esa maceta en
 * Espacios (misma URL con ancla #plantId que ya usan los links internos de
 * "Ver maceta" en Hoy/alertas -- .plant-row-details:target ya la resalta y
 * el navegador abre el <details> solo). No agrega logica de scroll nueva:
 * reutiliza el anclado que ya existe.
 */

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { getSectionHref } from "@/lib/navigation";
import type { Locale, Plant } from "@/lib/types";

export function PlantQrPanel({ locale, plant }: { locale: Locale; plant: Plant }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    const link = `${window.location.origin}${getSectionHref(locale, "spaces")}#${plant.id}`;

    QRCode.toDataURL(link, { margin: 1, width: 320 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setStatus("No se pudo generar el código QR en este navegador.");
      });

    return () => {
      cancelled = true;
    };
  }, [locale, plant.id]);

  function downloadQr() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `plantcare-qr-${sanitizeFilename(plant.name)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section aria-label={`Código QR de ${plant.name}`} className="plant-qr-panel">
      <header>
        <div>
          <p className="plant-calculation-eyebrow">Etiqueta para la maceta</p>
          <h4>Código QR</h4>
        </div>
      </header>
      <div className="plant-qr-panel-body">
        {dataUrl ? (
          <img alt={`Código QR que enlaza a ${plant.name} en PlantCare`} className="plant-qr-image" height={160} src={dataUrl} width={160} />
        ) : (
          <div aria-hidden="true" className="plant-qr-placeholder" />
        )}
        <div className="plant-qr-panel-copy">
          <p>
            Escaneado con la cámara del celular, este código abre esta maceta directamente en PlantCare. Se puede
            imprimir y pegar en el tiesto o en un cartel junto a la planta.
          </p>
          <button className="secondary-button" disabled={!dataUrl} onClick={downloadQr} type="button">
            Descargar QR
          </button>
        </div>
      </div>
      {status ? <p className="plant-qr-status" role="status">{status}</p> : null}
    </section>
  );
}

function sanitizeFilename(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "maceta"
  );
}
