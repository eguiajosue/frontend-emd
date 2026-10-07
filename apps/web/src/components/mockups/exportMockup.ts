import type { DesignLayer, DownloadViewKey, Garment, MockupExport, MockupView, VehiclePart } from "@/lib/mockups/types";
import { isVehicle } from "@/lib/mockups/vehicles";
import { parseSizeBreakdown, piecesLabel, sizeTableRows, type SizeBreakdown } from "@/lib/garmentSizes";

/**
 * Lámina de exportación: 3 vistas (Frente / Espalda / Lado) lado a lado sobre
 * fondo claro, ≈ 1600 × 800 (decisión R1: imagen acotada para guardar en el
 * pedido). La composición es 2D pura; el lienzo 3D sólo aporta cada vista.
 *
 * Vehículos (Rotulaciones): Frente y Atrás arriba, los dos lados abajo (más
 * anchos) y "Arriba" sólo si algún diseño va en techo, cofre o cajuela. Cada
 * vista se recorta y se escala por separado, porque un frente y un costado
 * no tienen las mismas proporciones.
 */


export const SHEET_WIDTH = 1600;
export const SHEET_HEIGHT = 800;
export const SHEET_BACKGROUND = "#f4f4f5";
export const SHEET_LABEL_COLOR = "#71717a";

/**
 * Lo que puede dibujar la cámara: las vistas fijas más "angle" (tres cuartos
 * frente-izquierda), que sólo usan las miniaturas de plantillas de vehículos.
 */
export type RenderView = MockupView | "angle";

/**
 * Azimut de la cámara por vista. "left" = lado izquierdo de quien viste la
 * prenda / del vehículo (+X). "top" mira desde arriba con el frente hacia
 * arriba de la imagen (el azimut sólo decide hacia dónde queda el "arriba").
 */
export const VIEW_AZIMUTH: Record<RenderView, number> = {
  front: 0,
  left: Math.PI / 2,
  back: Math.PI,
  right: -Math.PI / 2,
  top: Math.PI,
  angle: 0.62,
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

export interface RowsLayoutOptions extends SheetLayoutOptions {
  /** Paneles por fila. */
  rows: number[];
  /** Peso del alto de cada fila (por defecto, iguales). */
  rowWeights?: number[];
}

/**
 * Reparte los paneles en filas (cada fila con sus paneles iguales y su
 * etiqueta debajo). Los paneles salen en orden de lectura.
 */
export function computeRowsLayout(opts: RowsLayoutOptions): SheetPanel[] {
  const width = opts.width ?? SHEET_WIDTH;
  const height = opts.height ?? SHEET_HEIGHT;
  const padding = opts.padding ?? 32;
  const gap = opts.gap ?? 16;
  const labelHeight = opts.labelHeight ?? 40;
  const rows = opts.rows.filter((n) => n > 0);
  if (!rows.length) return [];
  const weights = rows.map((_, i) => opts.rowWeights?.[i] ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const free = height - padding * 2 - gap * (rows.length - 1);
  const panels: SheetPanel[] = [];
  let y = padding;
  rows.forEach((count, r) => {
    const rowHeight = Math.floor((free * weights[r]) / totalWeight);
    const panelHeight = Math.max(0, rowHeight - labelHeight);
    const panelWidth = Math.floor((width - padding * 2 - gap * (count - 1)) / count);
    // Una fila con menos paneles que la más ancha se centra, no se estira.
    for (let i = 0; i < count; i++) {
      const x = padding + i * (panelWidth + gap);
      panels.push({
        x,
        y,
        width: panelWidth,
        height: panelHeight,
        labelX: x + panelWidth / 2,
        labelY: y + panelHeight + labelHeight * 0.62,
      });
    }
    y += rowHeight + gap;
  });
  return panels;
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
  view: RenderView;
  label: string;
}

/** Nombre de cada vista de vehículo en la lámina y en los botones. */
export const VEHICLE_VIEW_LABELS: Record<MockupView, string> = {
  front: "Frente",
  back: "Atrás",
  left: "Lado izquierdo",
  right: "Lado derecho",
  top: "Arriba",
};

/** ¿Algún diseño mira hacia arriba (techo, cofre, cajuela)? Entonces la lámina incluye "Arriba". */
export function hasTopDesign(layers: Pick<DesignLayer, "placement">[]): boolean {
  return layers.some((l) => l.placement.normal[1] > 0.5);
}

export function sheetViewsFor(layers: Pick<DesignLayer, "placement">[], garment?: Garment): SheetView[] {
  if (garment && isVehicle(garment)) {
    const views: MockupView[] = ["front", "back", "left", "right"];
    if (hasTopDesign(layers)) views.push("top");
    return views.map((view) => ({ view, label: VEHICLE_VIEW_LABELS[view] }));
  }
  return [
    { view: "front", label: "Frente" },
    { view: "back", label: "Espalda" },
    { view: pickSideView(layers), label: "Lado" },
  ];
}

/** Qué descargar: la lámina con las tres vistas o una sola. */
export const DOWNLOAD_VIEW_OPTIONS: { key: DownloadViewKey; label: string; description: string }[] = [
  { key: "all", label: "Todas las vistas", description: "Lámina con Frente, Espalda y Lado" },
  { key: "front", label: "Solo Frente", description: "Una imagen de la vista frontal" },
  { key: "back", label: "Solo Espalda", description: "Una imagen de la vista trasera" },
  { key: "side", label: "Solo Lado", description: "Una imagen de la vista lateral" },
];

/** Opciones del menú de descarga de los vehículos. */
export const VEHICLE_DOWNLOAD_VIEW_OPTIONS: { key: DownloadViewKey; label: string; description: string }[] = [
  { key: "all", label: "Todas las vistas", description: "Lámina con Frente, Atrás y los dos lados (y Arriba si hay diseños en techo o cofre)" },
  { key: "front", label: "Solo Frente", description: "Una imagen de la vista frontal" },
  { key: "back", label: "Solo Atrás", description: "Una imagen de la vista trasera" },
  { key: "left", label: "Solo Lado izquierdo", description: "Una imagen del costado izquierdo" },
  { key: "right", label: "Solo Lado derecho", description: "Una imagen del costado derecho" },
  { key: "top", label: "Solo Arriba", description: "Una imagen desde arriba (techo, cofre y cajuela)" },
];

/** Opciones del menú de descarga según el producto. */
export function downloadViewOptions(garment?: Garment) {
  return garment && isVehicle(garment) ? VEHICLE_DOWNLOAD_VIEW_OPTIONS : DOWNLOAD_VIEW_OPTIONS;
}

/** Vistas a incluir según lo elegido (la lámina completa o una sola). */
export function selectSheetViews(
  layers: Pick<DesignLayer, "placement">[],
  only: DownloadViewKey = "all",
  garment?: Garment,
): SheetView[] {
  const all = sheetViewsFor(layers, garment);
  if (only === "all") return all;
  if (garment && isVehicle(garment)) {
    const view: MockupView = only === "side" ? pickSideView(layers) : (only as MockupView);
    return [{ view, label: VEHICLE_VIEW_LABELS[view] }];
  }
  const wanted = only === "side" ? all[2] : all.find((v) => v.view === only);
  return wanted ? [wanted] : all;
}

/** Medidas de una lámina con una sola vista: cuadrada, para que la prenda no quede diminuta. */
export const SINGLE_VIEW_SIZE = 900;

/** Dibuja una vista de `width × height` px y devuelve algo que `drawImage` acepte. */
export type RenderPanel = (view: RenderView, width: number, height: number) => CanvasImageSource;

/** Distribución de la lámina de un vehículo. */
export interface VehicleSheetPlan {
  width: number;
  height: number;
  rows: number[];
  rowWeights: number[];
}

/**
 * Lámina de vehículo con todas las vistas. El tráiler completo es muy largo:
 * cada costado ocupa su propia fila de ancho completo. Los demás ponen
 * Frente / Atrás (y Arriba) en una fila y los costados, más anchos, abajo.
 */
export function vehicleSheetPlan(garment: Garment, part: VehiclePart | undefined, views: SheetView[]): VehicleSheetPlan {
  const hasTop = views.some((v) => v.view === "top");
  if (garment === "trailer" && (part ?? "full") === "full") {
    return hasTop
      ? { width: 1600, height: 1480, rows: [2, 1, 1, 1], rowWeights: [0.34, 0.24, 0.24, 0.18] }
      : { width: 1600, height: 1240, rows: [2, 1, 1], rowWeights: [0.38, 0.31, 0.31] };
  }
  return hasTop
    ? { width: 1600, height: 960, rows: [3, 2], rowWeights: [0.55, 0.45] }
    : { width: 1600, height: 900, rows: [2, 2], rowWeights: [0.56, 0.44] };
}

/** Medidas de la imagen de una sola vista de vehículo. */
export function vehicleSingleViewSize(garment: Garment, part: VehiclePart | undefined, view: MockupView): { width: number; height: number } {
  const long = garment === "trailer" && (part ?? "full") === "full";
  if (view === "left" || view === "right") return long ? { width: 1600, height: 560 } : { width: 1400, height: 760 };
  if (view === "top") return long ? { width: 1600, height: 520 } : { width: 900, height: 1000 };
  return { width: 1000, height: 900 };
}

/**
 * Opciones de composición de una exportación: lámina de prendas (tres
 * vistas en fila), vista suelta cuadrada o lámina de vehículo en filas.
 */
export function sheetPlanFor(
  garment: Garment,
  views: SheetView[],
  only: DownloadViewKey,
  part: VehiclePart | undefined,
  sizes?: SizeBreakdown | null,
): ComposeOptions {
  if (isVehicle(garment)) {
    if (views.length === 1) return { ...vehicleSingleViewSize(garment, part, views[0].view as MockupView) };
    const plan = vehicleSheetPlan(garment, part, views);
    return { width: plan.width, height: plan.height, rows: plan.rows, rowWeights: plan.rowWeights };
  }
  return only !== "all" ? { sizes, width: SINGLE_VIEW_SIZE, height: SINGLE_VIEW_SIZE } : { sizes };
}

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
export interface ComposeOptions extends SheetLayoutOptions {
  supersample?: number;
  /** false = sin etiquetas bajo cada vista (miniaturas). */
  labels?: boolean;
  /** Formato de salida (PNG por defecto; JPEG para miniaturas livianas). */
  mimeType?: "image/png" | "image/jpeg";
  /** Calidad del JPEG (0-1). */
  quality?: number;
  /** Desglose de tallas: si tiene piezas se imprime como tabla al pie de la lámina. */
  sizes?: SizeBreakdown | null;
  /** Paneles por fila (vehículos). Con esto cada vista se recorta por separado. */
  rows?: number[];
  rowWeights?: number[];
}

/** Medidas de la tabla de tallas al pie de la lámina. */
export const SIZE_TABLE_ROW_HEIGHT = 44;
export const SIZE_TABLE_PADDING = 32;

export interface SizeTableLayout {
  /** Alto extra que se suma a la lámina (0 = sin tabla). */
  height: number;
  /** Encabezados: "Corte", tallas usadas, "Total". */
  header: string[];
  /** Filas de texto (corte + piezas por talla + total) y la fila final de total. */
  rows: string[][];
  colX: number[];
  colWidth: number;
  tableX: number;
}

/**
 * Tabla de tallas de la lámina, en puro (testeable sin canvas): sólo cortes
 * y tallas con piezas, más una fila de "Total". Sin tallas → alto 0.
 */
export function sizeTableLayout(sizes: SizeBreakdown | null | undefined, width: number): SizeTableLayout {
  const t = sizeTableRows(parseSizeBreakdown(sizes));
  if (!t.total) return { height: 0, header: [], rows: [], colX: [], colWidth: 0, tableX: 0 };
  const header = ["Corte", ...t.sizes, "Total"];
  const rows = [
    ...t.rows.map((r) => [r.label, ...r.cells.map((c) => (c ? String(c) : "–")), String(r.total)]),
    ["Total", ...t.sizes.map(() => ""), piecesLabel(t.total)],
  ];
  const colWidth = Math.min(160, Math.floor((width - SIZE_TABLE_PADDING * 2) / header.length));
  const tableX = Math.round((width - colWidth * header.length) / 2);
  const colX = header.map((_, i) => tableX + i * colWidth);
  const height = SIZE_TABLE_PADDING * 2 + SIZE_TABLE_ROW_HEIGHT * (rows.length + 1) + 28;
  return { height, header, rows, colX, colWidth, tableX };
}

function drawSizeTable(ctx: CanvasRenderingContext2D, layout: SizeTableLayout, top: number) {
  const font = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const rowH = SIZE_TABLE_ROW_HEIGHT;
  let y = top + SIZE_TABLE_PADDING;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#18181b";
  ctx.font = `600 22px ${font}`;
  ctx.fillText("Tallas", layout.tableX, y + 10);
  y += 28;
  const tableW = layout.colWidth * layout.header.length;
  const all = [layout.header, ...layout.rows];
  all.forEach((row, r) => {
    const isHeader = r === 0;
    const isTotal = r === all.length - 1;
    ctx.fillStyle = isHeader ? "#e4e4e7" : isTotal ? "#f4f4f5" : "#ffffff";
    ctx.fillRect(layout.tableX, y, tableW, rowH);
    ctx.strokeStyle = "#d4d4d8";
    ctx.lineWidth = 1;
    ctx.strokeRect(layout.tableX + 0.5, y + 0.5, tableW - 1, rowH - 1);
    ctx.fillStyle = "#18181b";
    ctx.font = `${isHeader || isTotal ? 600 : 400} 20px ${font}`;
    row.forEach((cell, c) => {
      ctx.textAlign = c === 0 ? "left" : "center";
      const x = c === 0 ? layout.colX[c] + 12 : layout.colX[c] + layout.colWidth / 2;
      ctx.fillText(cell, x, y + rowH / 2);
    });
    y += rowH;
  });
}

/** Miniatura de plantilla: cuadrada, sólo el frente, JPEG. */
export const THUMBNAIL_SIZE = 400;

export function composeSheet(
  views: SheetView[],
  renderPanel: RenderPanel,
  { supersample = 2, labels = true, mimeType = "image/png", quality, sizes, ...layoutOpts }: ComposeOptions = {},
): MockupExport {
  const width = layoutOpts.width ?? SHEET_WIDTH;
  const height = layoutOpts.height ?? SHEET_HEIGHT;
  // La tabla de tallas va DEBAJO de las vistas: la lámina crece hacia abajo
  // y el área de las vistas queda igual que sin tallas.
  const sizeTable = sizeTableLayout(sizes, width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + sizeTable.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la imagen del mockup");

  const { rows, rowWeights } = layoutOpts;
  const byRows = Array.isArray(rows) && rows.reduce((a, b) => a + b, 0) === views.length;
  const panels = byRows
    ? computeRowsLayout({ ...layoutOpts, rows: rows!, rowWeights, width, height })
    : computeSheetLayout(views.length, {
        ...layoutOpts,
        ...(labels ? {} : { labelHeight: 0 }),
        width,
        height,
      });
  const sizeOf = (i: number) => ({
    w: Math.max(1, Math.round((panels[i]?.width ?? 0) * supersample)),
    h: Math.max(1, Math.round((panels[i]?.height ?? 0) * supersample)),
  });

  // 1) Render de cada vista a un canvas 2D propio (copia inmediata).
  const shots = views.map((v, i) => {
    const { w: rw, h: rh } = sizeOf(i);
    const shot = document.createElement("canvas");
    shot.width = rw;
    shot.height = rh;
    const sctx = shot.getContext("2d");
    if (!sctx) throw new Error("No se pudo crear la imagen del mockup");
    sctx.drawImage(renderPanel(v.view, rw, rh), 0, 0, rw, rh);
    return { shot, rw, rh, bounds: alphaBounds(sctx.getImageData(0, 0, rw, rh).data, rw, rh) };
  });

  // 2) Recorte con un pequeño margen: común a todas las vistas (prendas) o
  // propio de cada una (vehículos, cuyas vistas tienen otras proporciones).
  const cropFor = (bounds: Bounds | null, rw: number, rh: number): Bounds => {
    const b = bounds ?? { x: 0, y: 0, width: rw, height: rh };
    const pad = Math.round(Math.max(b.width, b.height) * 0.04);
    return {
      x: Math.max(0, b.x - pad),
      y: Math.max(0, b.y - pad),
      width: Math.min(rw, b.x + b.width + pad) - Math.max(0, b.x - pad),
      height: Math.min(rh, b.y + b.height + pad) - Math.max(0, b.y - pad),
    };
  };
  const common = byRows ? null : cropFor(unionBounds(shots.map((s) => s.bounds)), shots[0]?.rw ?? 1, shots[0]?.rh ?? 1);

  // 3) Fondo, vistas centradas y etiquetas justo debajo del contenido.
  ctx.fillStyle = SHEET_BACKGROUND;
  ctx.fillRect(0, 0, width, height + sizeTable.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = SHEET_LABEL_COLOR;
  ctx.font = '500 22px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const labelGap = labels ? 40 : 0;
  views.forEach((v, i) => {
    const p = panels[i];
    const s = shots[i];
    const crop = common ?? cropFor(s.bounds, s.rw, s.rh);
    const scale = fitScale(crop, p);
    const drawW = crop.width * scale;
    const drawH = crop.height * scale;
    if (byRows) {
      // Cada panel: contenido centrado en su zona y la etiqueta en su línea.
      const x = p.x + (p.width - drawW) / 2;
      const y = p.y + (p.height - drawH) / 2;
      ctx.drawImage(s.shot, crop.x, crop.y, crop.width, crop.height, x, y, drawW, drawH);
      if (labels) ctx.fillText(v.label, p.labelX, p.labelY);
    } else {
      const blockH = drawH + labelGap;
      const top = Math.max((height - blockH) / 2, 0);
      const x = p.x + (p.width - drawW) / 2;
      ctx.drawImage(s.shot, crop.x, crop.y, crop.width, crop.height, x, top, drawW, drawH);
      if (labels) ctx.fillText(v.label, p.labelX, top + drawH + labelGap - 8);
    }
  });

  if (sizeTable.height) drawSizeTable(ctx, sizeTable, height);

  return { dataUrl: canvas.toDataURL(mimeType, quality), width, height: height + sizeTable.height };
}
