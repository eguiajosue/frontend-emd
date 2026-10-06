import { barsToPath } from "./code128";
import {
  LABEL_COMPANY_NAME,
  computeLabelLayout,
  fitBarcodeModules,
  fitText,
  truncateText,
  maxCharsForWidth,
  type LabelLayout,
} from "./label";

/**
 * HTML de una etiqueta (y del documento de impresión) como texto: la misma
 * función alimenta la vista previa del diálogo y el iframe que se manda a la
 * impresora, así que lo que se ve es lo que sale. Todo en mm, negro sobre
 * blanco, sin depender del CSS de la app.
 */

export interface LabelData {
  /** Nombre del artículo. */
  name: string;
  /** Departamento ya traducido ("Bordado"). */
  areaLabel: string;
  /** Código que se imprime y se escanea. */
  code: string;
  /** Módulos del Code 128 ("1" barra, "0" espacio): ver `encodeCode128`. */
  bits: string;
  /** Encabezado; por omisión el nombre de la empresa. */
  company?: string;
}

const FONT_SANS = "Arial, 'Helvetica Neue', Helvetica, 'Liberation Sans', sans-serif";
const FONT_MONO = "'DejaVu Sans Mono', Menlo, Consolas, 'Liberation Mono', monospace";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const mm = (n: number) => `${Math.round(n * 1000) / 1000}mm`;

function box(b: { x: number; y: number; width: number; height: number }): string {
  return `position:absolute;left:${mm(b.x)};top:${mm(b.y)};width:${mm(b.width)};height:${mm(b.height)};`;
}

const TEXT = "margin:0;white-space:nowrap;overflow:hidden;color:#000;";

/** Una etiqueta: `<div class="emd-label">` de `layout.widthMm × layout.heightMm`. */
export function renderLabelHtml(data: LabelData, layout: LabelLayout = computeLabelLayout()): string {
  const company = `Propiedad de: ${data.company ?? LABEL_COMPANY_NAME}`;
  const title = fitText(data.name, layout.title.width, {
    maxFontMm: layout.title.maxFontMm,
    minFontMm: layout.title.minFontMm,
    avgCharEm: 0.58,
  });
  const area = truncateText(
    data.areaLabel.toUpperCase(),
    maxCharsForWidth(layout.area.width, layout.area.fontMm, 0.65)
  );

  const modules = data.bits.length;
  const fit = fitBarcodeModules(modules, layout.barcode.width);
  const barsLeft = layout.barcode.x + (layout.barcode.width - fit.barsWidthMm) / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} 100" preserveAspectRatio="none" ` +
    `shape-rendering="crispEdges" role="img" aria-label="Código de barras ${escapeHtml(data.code)}" ` +
    `style="position:absolute;left:${mm(barsLeft)};top:${mm(layout.barcode.y)};width:${mm(fit.barsWidthMm)};height:${mm(layout.barcode.height)};display:block">` +
    `<path fill="#000" d="${barsToPath(data.bits)}"/></svg>`;

  // El código legible: letra fija y algo espaciada, como en las etiquetas de almacén.
  const codeChars = maxCharsForWidth(layout.code.width, layout.code.fontMm, 0.68);

  return (
    `<div class="emd-label" data-code="${escapeHtml(data.code)}" style="position:relative;overflow:hidden;` +
    `width:${mm(layout.widthMm)};height:${mm(layout.heightMm)};background:#fff;color:#000;font-family:${FONT_SANS};">` +
    `<p style="${box(layout.company)}${TEXT}font-size:${mm(layout.company.fontMm)};line-height:1.2;font-weight:600;letter-spacing:0.02em;text-overflow:ellipsis">${escapeHtml(company)}</p>` +
    `<p style="${box(layout.area)}${TEXT}font-size:${mm(layout.area.fontMm)};line-height:1.2;font-weight:700;text-align:right;letter-spacing:0.04em">${escapeHtml(area)}</p>` +
    `<p class="emd-label-title" style="${box(layout.title)}${TEXT}font-size:${mm(title.fontMm)};line-height:${mm(layout.title.height)};font-weight:700">${escapeHtml(title.text)}</p>` +
    svg +
    `<p class="emd-label-code" style="${box(layout.code)}${TEXT}font-family:${FONT_MONO};font-size:${mm(layout.code.fontMm)};line-height:1.2;text-align:center;letter-spacing:0.08em">${escapeHtml(truncateText(data.code, codeChars))}</p>` +
    `</div>`
  );
}

export interface PrintDocumentOptions {
  /** Copias de cada etiqueta (1–99). */
  copies?: number;
  widthMm?: number;
  heightMm?: number;
  title?: string;
}

export const MAX_COPIES = 99;

export function clampCopies(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_COPIES, Math.max(1, Math.floor(n)));
}

/**
 * Documento completo para el iframe de impresión: `@page` del tamaño exacto
 * de la etiqueta y sin márgenes, una etiqueta por página, `copies` veces
 * cada una (seguidas: 3 de A, 3 de B…).
 */
export function buildLabelPrintDocument(labelsHtml: string[], options: PrintDocumentOptions = {}): string {
  const { widthMm = 80, heightMm = 35, title = "Etiquetas" } = options;
  const copies = clampCopies(options.copies ?? 1);
  const pages = labelsHtml.flatMap((html) => Array.from({ length: copies }, () => `<div class="page">${html}</div>`));
  return (
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<style>` +
    `@page{size:${widthMm}mm ${heightMm}mm;margin:0}` +
    `*{box-sizing:border-box}` +
    `html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `.page{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;break-after:page;page-break-after:always}` +
    `.page:last-child{break-after:auto;page-break-after:auto}` +
    `</style></head><body>${pages.join("")}</body></html>`
  );
}
