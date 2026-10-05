import type { DesignLayer, MockupExport, MockupView } from "@/lib/mockups/types";

/**
 * Lámina de exportación: 3 vistas (Frente / Espalda / Lado) lado a lado sobre
 * fondo claro, ≈ 1600 × 800 (decisión R1: imagen acotada para guardar en el
 * pedido). La composición es 2D pura; el lienzo 3D sólo aporta cada vista.
 */

export const SHEET_WIDTH = 1600;
export const SHEET_HEIGHT = 800;
export const SHEET_BACKGROUND = "#f4f4f5";
export const SHEET_LABEL_COLOR = "#71717a";

/** Azimut de la cámara por vista. "left" = lado izquierdo de quien viste la prenda (+X). */
export const VIEW_AZIMUTH: Record<MockupView, number> = {
  front: 0,
  left: Math.PI / 2,
  back: Math.PI,
  right: -Math.PI / 2,
};

export interface SheetLayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
  gap?: number;
  labelHeight?: number;
}

export interface SheetPanel {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Centro horizontal y línea base de la etiqueta bajo el panel. */
  labelX: number;
  labelY: number;
}

/** Reparte `count` paneles iguales en una fila, con su etiqueta debajo. */
export function computeSheetLayout(count: number, opts: SheetLayoutOptions = {}): SheetPanel[] {
  const width = opts.width ?? SHEET_WIDTH;
  const height = opts.height ?? SHEET_HEIGHT;
  const padding = opts.padding ?? 32;
  const gap = opts.gap ?? 16;
  const labelHeight = opts.labelHeight ?? 40;
  if (count <= 0) return [];
  const panelWidth = Math.floor((width - padding * 2 - gap * (count - 1)) / count);
  const panelHeight = Math.max(0, height - padding * 2 - labelHeight);
  return Array.from({ length: count }, (_, i) => {
    const x = padding + i * (panelWidth + gap);
    return {
      x,
      y: padding,
      width: panelWidth,
      height: panelHeight,
      labelX: x + panelWidth / 2,
      labelY: padding + panelHeight + labelHeight * 0.62,
    };
  });
}

/**
 * Lado que conviene mostrar: el que tenga diseños (manga o lateral); si no hay
 * ninguno o empatan, el izquierdo.
 */
export function pickSideView(layers: Pick<DesignLayer, "placement">[]): "left" | "right" {
  let left = 0;
  let right = 0;
  for (const l of layers) {
    const nx = l.placement.normal[0];
    if (nx > 0.5) left++;
    else if (nx < -0.5) right++;
  }
  return right > left ? "right" : "left";
}

export interface SheetView {
  view: MockupView;
  label: string;
}

export function sheetViewsFor(layers: Pick<DesignLayer, "placement">[]): SheetView[] {
  return [
    { view: "front", label: "Frente" },
    { view: "back", label: "Espalda" },
    { view: pickSideView(layers), label: "Lado" },
  ];
}

/** Dibuja una vista de `width × height` px y devuelve algo que `drawImage` acepte. */
export type RenderPanel = (view: MockupView, width: number, height: number) => CanvasImageSource;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Caja de los píxeles visibles (alfa > `threshold`) de una imagen RGBA, o
 * null si está vacía. Incluye la sombra de contacto (alfa bajo pero visible).
 */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number, threshold = 6): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Caja que contiene a todas (las null se ignoran). */
export function unionBounds(list: (Bounds | null)[]): Bounds | null {
  const valid = list.filter((b): b is Bounds => b !== null);
  if (!valid.length) return null;
  const x0 = Math.min(...valid.map((b) => b.x));
  const y0 = Math.min(...valid.map((b) => b.y));
  const x1 = Math.max(...valid.map((b) => b.x + b.width));
  const y1 = Math.max(...valid.map((b) => b.y + b.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Escala para meter `content` en `box` sin deformar y sin pasar de `maxScale`
 * (no agrandar más allá de la resolución renderizada).
 */
export function fitScale(content: { width: number; height: number }, box: { width: number; height: number }, maxScale = 1) {
  if (content.width <= 0 || content.height <= 0) return maxScale;
  return Math.min(box.width / content.width, box.height / content.height, maxScale);
}

/**
 * Compone la lámina. Es síncrona a propósito: el lienzo WebGL se copia justo
 * después de cada render, en la misma tarea, sin parpadeos en pantalla.
 *
 * Las 3 vistas salen con la misma cámara (misma escala), así que se recortan
 * todas con la MISMA caja (la unión de lo visible) para aprovechar el espacio
 * sin que una prenda se vea más grande que otra.
 */
export function composeSheet(
  views: SheetView[],
  renderPanel: RenderPanel,
  { supersample = 2, ...layoutOpts }: SheetLayoutOptions & { supersample?: number } = {},
): MockupExport {
  const width = layoutOpts.width ?? SHEET_WIDTH;
  const height = layoutOpts.height ?? SHEET_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la imagen del mockup");

  const panels = computeSheetLayout(views.length, { ...layoutOpts, width, height });
  const rw = Math.round((panels[0]?.width ?? 0) * supersample);
  const rh = Math.round((panels[0]?.height ?? 0) * supersample);

  // 1) Render de cada vista a un canvas 2D propio (copia inmediata).
  const shots = views.map((v) => {
    const shot = document.createElement("canvas");
    shot.width = rw;
    shot.height = rh;
    const sctx = shot.getContext("2d");
    if (!sctx) throw new Error("No se pudo crear la imagen del mockup");
    sctx.drawImage(renderPanel(v.view, rw, rh), 0, 0, rw, rh);
    return { shot, bounds: alphaBounds(sctx.getImageData(0, 0, rw, rh).data, rw, rh) };
  });

  // 2) Recorte común con un pequeño margen.
  const union = unionBounds(shots.map((s) => s.bounds)) ?? { x: 0, y: 0, width: rw, height: rh };
  const pad = Math.round(Math.max(union.width, union.height) * 0.04);
  const crop: Bounds = {
    x: Math.max(0, union.x - pad),
    y: Math.max(0, union.y - pad),
    width: Math.min(rw, union.x + union.width + pad) - Math.max(0, union.x - pad),
    height: Math.min(rh, union.y + union.height + pad) - Math.max(0, union.y - pad),
  };

  // 3) Fondo, vistas centradas y etiquetas justo debajo del contenido.
  ctx.fillStyle = SHEET_BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = fitScale(crop, panels[0] ?? { width: 0, height: 0 });
  const drawW = crop.width * scale;
  const drawH = crop.height * scale;
  const labelGap = 40;
  const blockH = drawH + labelGap;
  const top = Math.max((height - blockH) / 2, 0);

  ctx.fillStyle = SHEET_LABEL_COLOR;
  ctx.font = '500 22px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  views.forEach((v, i) => {
    const p = panels[i];
    const x = p.x + (p.width - drawW) / 2;
    ctx.drawImage(shots[i].shot, crop.x, crop.y, crop.width, crop.height, x, top, drawW, drawH);
    ctx.fillText(v.label, p.labelX, top + drawH + labelGap - 8);
  });

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}
