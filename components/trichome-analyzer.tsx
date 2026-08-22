/**
 * trichome-analyzer.tsx
 *
 * Guia de tricomas por maceta: ayuda a decidir la ventana de cosecha sin
 * depender de un servicio de IA en la nube (pago, requeriria que el usuario
 * cree una cuenta externa -- algo que no podemos hacer por el, y ademas la
 * foto tendria que salir del dispositivo). En cambio, la foto se analiza
 * ENTERAMENTE en el navegador: nunca se sube a ningun lado.
 *
 * Importante sobre que hace y que NO hace: esta herramienta no "encuentra"
 * tricomas en la foto por si sola (eso si requeriria vision por computadora
 * entrenada, fuera de alcance). Lo que hace es clasificar por color el punto
 * exacto donde el usuario toca -- el usuario es quien mira la foto (idealmente
 * tomada con macro o una lupa sobre la camara del celular) y decide donde hay
 * un tricoma. La app suma un conteo consistente de claro/lechoso/ambar a
 * partir de esos puntos, para no depender de la percepcion de color a ojo
 * bajo distinta luz cada vez. Se dice esto explicitamente en la UI.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import type { CareEntry, Plant } from "@/lib/types";

type TrichomeClass = "amber" | "clear" | "milky" | "unclear";

type TrichomePoint = {
  x: number;
  y: number;
  classification: TrichomeClass;
};

const classLabel: Record<TrichomeClass, string> = {
  amber: "Ámbar",
  clear: "Claro",
  milky: "Lechoso",
  unclear: "Sin clasificar"
};

const classSwatch: Record<TrichomeClass, string> = {
  amber: "#b9772e",
  clear: "#7fb8a8",
  milky: "#e7e2d3",
  unclear: "#9a9188"
};

const CANVAS_MAX_WIDTH = 460;
const SAMPLE_RADIUS = 3;

export function TrichomeAnalyzer({ onAddJournalEntry, plant }: { onAddJournalEntry: (entry: CareEntry) => void; plant: Plant }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [points, setPoints] = useState<TrichomePoint[]>([]);
  const [status, setStatus] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // El <canvas> solo existe en el DOM cuando photoDataUrl no esta vacio (ver
  // el render mas abajo), asi que dibujar la foto tiene que esperar a que
  // React monte ese elemento. Hacerlo en el mismo handler del <input>, antes
  // de que termine el re-render, deja canvasRef.current en null la primera
  // vez. Este efecto corre despues del commit, cuando el canvas ya existe.
  useEffect(() => {
    if (!photoDataUrl) return;
    let cancelled = false;

    drawPhotoOnCanvas(photoDataUrl, canvasRef.current).catch(() => {
      if (!cancelled) setStatus("No se pudo mostrar esa foto. Probá con otro archivo.");
    });

    return () => {
      cancelled = true;
    };
  }, [photoDataUrl]);

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setPoints([]);
      setStatus("");
    } catch {
      setStatus("No se pudo leer esa foto. Probá con otro archivo.");
    }
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

    const sampleSize = SAMPLE_RADIUS * 2 + 1;
    const startX = Math.max(0, x - SAMPLE_RADIUS);
    const startY = Math.max(0, y - SAMPLE_RADIUS);
    const { data } = ctx.getImageData(startX, startY, Math.min(sampleSize, canvas.width - startX), Math.min(sampleSize, canvas.height - startY));

    let r = 0;
    let g = 0;
    let b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r /= pixelCount;
    g /= pixelCount;
    b /= pixelCount;

    const classification = classifyTrichomeColor(r, g, b);
    setPoints((current) => [...current, { classification, x, y }]);

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = classSwatch[classification];
    ctx.strokeStyle = "rgba(20, 24, 20, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  }

  function undoLastPoint() {
    if (points.length === 0 || !photoDataUrl) return;
    const next = points.slice(0, -1);
    setPoints(next);
    redrawPoints(next);
  }

  function resetCount() {
    setPoints([]);
    redrawPoints([]);
  }

  function redrawPoints(nextPoints: TrichomePoint[]) {
    const canvas = canvasRef.current;
    if (!canvas || !photoDataUrl) return;

    drawPhotoOnCanvas(photoDataUrl, canvas).then(() => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      for (const point of nextPoints) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = classSwatch[point.classification];
        ctx.strokeStyle = "rgba(20, 24, 20, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  function saveAsObservation() {
    if (points.length === 0) {
      setStatus("Marcá al menos un tricoma antes de guardar.");
      return;
    }

    const summary = summarizeCounts(points);
    const note = [
      `Lectura de tricomas sobre ${points.length} punto${points.length === 1 ? "" : "s"} marcado${points.length === 1 ? "" : "s"} por el usuario: ${summary.text}.`,
      "Clasificación por color del punto exacto tocado en la foto, hecha en el navegador; no detecta tricomas por sí sola ni reemplaza mirarlos con lupa."
    ].join(" ");

    onAddJournalEntry({
      createdAt: new Date().toISOString(),
      id: `trichome-${plant.id}-${Date.now()}`,
      note,
      photoDataUrl: photoDataUrl || undefined,
      plantId: plant.id,
      tags: ["tricomas"],
      title: "Lectura de tricomas"
    });

    setStatus("Guardado en la bitácora de esta maceta.");
  }

  const summary = summarizeCounts(points);

  return (
    <section aria-labelledby={`trichome-title-${plant.id}`} className="trichome-analyzer">
      <header>
        <div>
          <p className="plant-calculation-eyebrow">Ventana de cosecha</p>
          <h4 id={`trichome-title-${plant.id}`}>Guía de tricomas</h4>
        </div>
        <button className="secondary-button" onClick={() => setIsOpen((current) => !current)} type="button">
          {isOpen ? "Cerrar" : "Abrir"}
        </button>
      </header>

      {isOpen ? (
        <div className="trichome-analyzer-body">
          <p>
            Subí una foto de cerca de los tricomas (con macro o una lupa sobre la cámara del celular) y tocá cada
            tricoma que veas en la imagen. La app no encuentra tricomas por sí sola: clasifica el color exacto del
            punto donde tocaste, para llevar un conteo consistente sin depender de cómo se ve el color bajo la luz de
            ese día.
          </p>

          <label className="trichome-analyzer-upload">
            Foto de tricomas
            <input accept="image/*" className="form-control" onChange={handlePhotoChange} type="file" />
          </label>

          {photoDataUrl ? (
            <>
              <canvas className="trichome-analyzer-canvas" onClick={handleCanvasClick} ref={canvasRef} />
              <div className="trichome-analyzer-actions">
                <button className="secondary-button" disabled={points.length === 0} onClick={undoLastPoint} type="button">
                  Deshacer último punto
                </button>
                <button className="secondary-button" disabled={points.length === 0} onClick={resetCount} type="button">
                  Reiniciar conteo
                </button>
              </div>
            </>
          ) : null}

          {points.length > 0 ? (
            <div className="trichome-analyzer-tally">
              {(["clear", "milky", "amber", "unclear"] as TrichomeClass[])
                .filter((item) => summary.counts[item] > 0)
                .map((item) => (
                  <span className="trichome-analyzer-chip" key={item}>
                    <span aria-hidden="true" className="trichome-analyzer-dot" style={{ background: classSwatch[item] }} />
                    {classLabel[item]}: {summary.counts[item]} ({summary.percentages[item]}%)
                  </span>
                ))}
            </div>
          ) : null}

          <p className="trichome-analyzer-guide">
            Como referencia general y no como regla fija: muchos cultivadores esperan a que la mayoría de los
            tricomas pasen de transparentes a lechosos antes de cosechar, y usan la proporción de ámbar (tricomas ya
            oxidados) como una señal de que la ventana está más avanzada. La proporción exacta que conviene depende
            de la genética y de la preferencia de cada quien — esto no es una recomendación de PlantCare, es lo que
            reportan cultivadores en general.
          </p>

          <button className="primary-button" disabled={points.length === 0} onClick={saveAsObservation} type="button">
            Guardar como observación de esta maceta
          </button>
          {status ? <p className="trichome-analyzer-status" role="status">{status}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function summarizeCounts(points: TrichomePoint[]) {
  const counts: Record<TrichomeClass, number> = { amber: 0, clear: 0, milky: 0, unclear: 0 };
  for (const point of points) counts[point.classification] += 1;

  const total = points.length || 1;
  const percentages: Record<TrichomeClass, number> = {
    amber: Math.round((counts.amber / total) * 100),
    clear: Math.round((counts.clear / total) * 100),
    milky: Math.round((counts.milky / total) * 100),
    unclear: Math.round((counts.unclear / total) * 100)
  };

  const text = (["clear", "milky", "amber"] as TrichomeClass[])
    .filter((item) => counts[item] > 0)
    .map((item) => `${percentages[item]}% ${classLabel[item].toLowerCase()}`)
    .join(", ");

  return { counts, percentages, text: text || "sin puntos clasificados" };
}

/**
 * Clasificacion heuristica por HSL. Los tricomas ambar tienen matiz propio
 * (naranja/marron) y son los mas faciles de distinguir por color. Claro y
 * lechoso son ambos de saturacion baja y luminosidad alta -- la diferencia
 * real entre "transparente" y "opaco blanco" depende de si la luz atraviesa
 * el tricoma o rebota en el, algo que una sola muestra de color de pixel no
 * puede determinar con certeza. Se separan por luminosidad (lechoso, mas
 * opaco/brillante, tiende a leer mas claro/blanco que un tricoma transparente
 * que deja ver algo del fondo detras) a sabiendas de que es una aproximacion,
 * no una medicion optica real -- de ahi el aviso explicito en la UI.
 */
function classifyTrichomeColor(r: number, g: number, b: number): TrichomeClass {
  const { h, l, s } = rgbToHsl(r, g, b);

  if (l < 0.18) return "unclear";

  const isAmberHue = h >= 15 && h <= 50;
  if (isAmberHue && s >= 0.22 && l >= 0.2 && l <= 0.72) return "amber";

  if (s <= 0.35) {
    if (l >= 0.78) return "milky";
    if (l >= 0.4) return "clear";
  }

  return "unclear";
}

function rgbToHsl(r: number, g: number, b: number) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, l, s: 0 };

  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let h = 0;
  if (max === rNorm) h = ((gNorm - bNorm) / delta) % 6;
  else if (max === gNorm) h = (bNorm - rNorm) / delta + 2;
  else h = (rNorm - gNorm) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;

  return { h, l, s };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer el archivo."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("No se pudo leer el archivo.")));
    reader.readAsDataURL(file);
  });
}

function drawPhotoOnCanvas(dataUrl: string, canvas: HTMLCanvasElement | null) {
  return new Promise<void>((resolve, reject) => {
    if (!canvas) {
      reject(new Error("No hay canvas disponible."));
      return;
    }

    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, CANVAS_MAX_WIDTH / image.width);
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      // willReadFrequently: true aca (no solo en el click handler) porque el
      // primer getContext("2d") de un canvas fija esa opcion para todos los
      // llamados siguientes -- si este quedara sin marcar, el getImageData
      // del click de clasificacion se quedaria sin el modo optimizado.
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("No se pudo dibujar la foto."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    image.onerror = () => reject(new Error("No se pudo cargar la foto."));
    image.src = dataUrl;
  });
}
