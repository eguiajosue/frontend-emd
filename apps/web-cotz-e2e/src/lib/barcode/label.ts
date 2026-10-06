/**
 * Etiqueta de inventario para impresora térmica de rollo: 80 × 35 mm,
 * apaisada, una por página.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ PROPIEDAD DE: EMD HUB                        │  empresa
 *   │ Hilo poliéster 40 rojo 1147         BORDADO  │  artículo · departamento
 *   │ ║│║║│║│││║║│║│║║│║│││║║│║│║║│║│││║║│║│║║│  │
 *   │ ║│║║│║│││║║│║│║║│║│││║║│║│║║│║│││║║│║│║║│  │  Code 128
 *   │                 EMD-000123                   │  código legible
 *   └──────────────────────────────────────────────┘
 *
 * Todo se calcula en milímetros (el CSS de impresión los entiende tal cual)
 * y aquí sólo hay matemática pura: el ancho de cada barra se redondea a
 * puntos enteros de la impresora para que las barras salgan nítidas.
 */

export const LABEL_WIDTH_MM = 80;
export const LABEL_HEIGHT_MM = 35;

/** Resolución típica de las térmicas de etiquetas (8 puntos/mm). */
export const THERMAL_DPI = 203;
export const MM_PER_INCH = 25.4;
/** Pixeles CSS por pulgada. */
export const CSS_DPI = 96;

/** Nombre que encabeza la etiqueta ("Propiedad de: …"). Mismo que la barra superior. */
export const LABEL_COMPANY_NAME = "EMD HUB";

/** Code 128 pide 10 módulos de margen blanco a cada lado para leerse bien. */
export const QUIET_ZONE_MODULES = 10;

/** Debajo de esto (≈ 1.5 puntos a 203 dpi) muchos lectores ya no leen. */
export const MIN_READABLE_MODULE_MM = 0.19;

export function mmToPx(mm: number, dpi = CSS_DPI): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function pxToMm(px: number, dpi = CSS_DPI): number {
  return (px / dpi) * MM_PER_INCH;
}

/** Tamaño de un punto de la impresora en mm (0.125 mm a 203 dpi). */
export function dotMm(dpi = THERMAL_DPI): number {
  return MM_PER_INCH / dpi;
}

/** Puntos (pt tipográficos) a mm: para fijar el tamaño de letra. */
export function ptToMm(pt: number): number {
  return (pt / 72) * MM_PER_INCH;
}

export interface ModuleFit {
  /** Ancho de una barra mínima (módulo), múltiplo exacto de un punto. */
  moduleMm: number;
  /** Ancho de las barras sin márgenes blancos. */
  barsWidthMm: number;
  /** Puntos de impresora por módulo. */
  dotsPerModule: number;
  /** `false` = el código es demasiado largo para leerse bien en esta etiqueta. */
  readable: boolean;
}

/**
 * Elige el ancho del módulo para que las barras + sus márgenes blancos
 * quepan en `availableMm`, redondeando hacia abajo a puntos enteros de la
 * impresora (barras de ancho desparejo = lecturas fallidas). Nunca baja de
 * un punto: un código larguísimo se imprime igual, pero `readable` avisa.
 */
export function fitBarcodeModules(
  modules: number,
  availableMm: number,
  { dpi = THERMAL_DPI, maxModuleMm = 0.5 }: { dpi?: number; maxModuleMm?: number } = {}
): ModuleFit {
  const dot = dotMm(dpi);
  const total = Math.max(1, modules) + QUIET_ZONE_MODULES * 2;
  const ideal = Math.min(availableMm / total, maxModuleMm);
  const dotsPerModule = Math.max(1, Math.floor(ideal / dot + 1e-9));
  let moduleMm = dotsPerModule * dot;
  // Con un solo punto tampoco cabe: se ajusta al ancho disponible.
  if (moduleMm * total > availableMm) moduleMm = availableMm / total;
  return {
    moduleMm,
    barsWidthMm: moduleMm * Math.max(1, modules),
    dotsPerModule,
    readable: moduleMm >= MIN_READABLE_MODULE_MM,
  };
}

/**
 * Cuántos caracteres caben en `widthMm` con letra de `fontMm` de alto. Usa
 * el ancho promedio de una sans-serif (≈ 0.55 em; 0.6 em en monoespaciada):
 * conservador, para que lo que se calcula como "cabe" no se corte al imprimir.
 */
export function maxCharsForWidth(widthMm: number, fontMm: number, avgCharEm = 0.55): number {
  if (widthMm <= 0 || fontMm <= 0) return 0;
  return Math.max(1, Math.floor(widthMm / (fontMm * avgCharEm)));
}

/** Recorta con "…" al final si no cabe. Respeta los pares sustitutos (emoji). */
export function truncateText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  if (chars.length <= maxChars) return clean;
  if (maxChars <= 0) return "";
  if (maxChars === 1) return "…";
  return chars.slice(0, maxChars - 1).join("").trimEnd() + "…";
}

export interface FittedText {
  text: string;
  fontMm: number;
  truncated: boolean;
}

/**
 * Letra lo más grande posible (entre `maxFontMm` y `minFontMm`) para que
 * `text` quepa en un renglón de `widthMm`; si ni con la mínima cabe, se
 * recorta con "…". Así un nombre corto se lee de lejos y uno largo no se
 * pierde entero.
 */
export function fitText(
  text: string,
  widthMm: number,
  { maxFontMm, minFontMm, avgCharEm = 0.55 }: { maxFontMm: number; minFontMm: number; avgCharEm?: number }
): FittedText {
  const clean = text.replace(/\s+/g, " ").trim();
  const length = Array.from(clean).length;
  const fontForAll = widthMm / (Math.max(1, length) * avgCharEm);
  if (fontForAll >= maxFontMm) return { text: clean, fontMm: maxFontMm, truncated: false };
  if (fontForAll >= minFontMm) {
    // Redondeo hacia abajo a 0.05 mm: margen para la métrica real de la letra.
    return { text: clean, fontMm: Math.floor(fontForAll * 20) / 20, truncated: false };
  }
  const maxChars = maxCharsForWidth(widthMm, minFontMm, avgCharEm);
  return { text: truncateText(clean, maxChars), fontMm: minFontMm, truncated: true };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelLayout {
  widthMm: number;
  heightMm: number;
  /** "Propiedad de: EMD HUB", a la izquierda del primer renglón. */
  company: Box & { fontMm: number };
  /** Departamento, a la derecha del mismo renglón. */
  area: Box & { fontMm: number };
  /** Nombre del artículo: todo el ancho, letra entre `maxFontMm` y `minFontMm`. */
  title: Box & { maxFontMm: number; minFontMm: number };
  barcode: Box;
  code: Box & { fontMm: number };
}

export interface LabelLayoutOptions {
  widthMm?: number;
  heightMm?: number;
  /** Margen blanco del borde de la etiqueta (la térmica no imprime pegado al corte). */
  paddingMm?: number;
}

/**
 * Distribución de la etiqueta en mm. Los renglones de texto tienen tamaño
 * fijo y las barras se quedan con todo el alto que sobra: cuanto más altas,
 * más fácil leerlas con un lector de mano.
 */
export function computeLabelLayout({
  widthMm = LABEL_WIDTH_MM,
  heightMm = LABEL_HEIGHT_MM,
  paddingMm = 2.5,
}: LabelLayoutOptions = {}): LabelLayout {
  const inner = widthMm - paddingMm * 2;
  const smallFont = ptToMm(7); // ≈ 2.5 mm
  const titleMax = ptToMm(11); // ≈ 3.9 mm
  const titleMin = ptToMm(7.5); // ≈ 2.6 mm
  const codeFont = ptToMm(9); // ≈ 3.2 mm

  let y = paddingMm;
  const rowHeight = smallFont * 1.2;
  const areaWidth = inner * 0.38;
  const company = { x: paddingMm, y, width: inner - areaWidth - 1, height: rowHeight, fontMm: smallFont };
  const area = { x: widthMm - paddingMm - areaWidth, y, width: areaWidth, height: rowHeight, fontMm: smallFont };
  y += rowHeight + 0.5;

  const title = { x: paddingMm, y, width: inner, height: titleMax * 1.2, maxFontMm: titleMax, minFontMm: titleMin };
  y += title.height + 0.8;

  const codeHeight = codeFont * 1.2;
  const codeY = heightMm - paddingMm - codeHeight + 0.6;
  const barcode = { x: 1, y, width: widthMm - 2, height: Math.max(6, codeY - 0.4 - y) };
  const code = { x: paddingMm, y: codeY, width: inner, height: codeHeight, fontMm: codeFont };

  return { widthMm, heightMm, company, area, title, barcode, code };
}
