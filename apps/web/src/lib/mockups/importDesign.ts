import { MAX_DESIGN_PX } from "@/lib/mockups/types";

/**
 * Importa el diseño de un cliente (logo/arte) para el creador de mockups.
 *
 * Decisión R1 (docs/plans/mockups-3d.md): todo diseño se rasteriza y se reduce
 * aquí, al entrar, a un PNG de ≤ MAX_DESIGN_PX por su lado mayor. Así un mockup
 * guardado (que conserva sus diseños para poder re-editarse) nunca pasa del
 * tope del backend aunque el cliente mande un PNG de 5 MB. El PNG conserva la
 * transparencia, que es lo normal en un logo.
 *
 * Los SVG también se rasterizan (a MAX_DESIGN_PX por su lado mayor, que es
 * vectorial y escala sin perder nitidez): el lienzo 3D sólo trabaja con
 * texturas de píxeles.
 */

export interface ImportedDesign {
  /** Nombre del archivo sin extensión (se muestra en la lista de diseños). */
  name: string;
  /** `data:image/png;base64,...` ya reducido. */
  dataUrl: string;
  /** Ancho / alto. */
  aspect: number;
}

export const DESIGN_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;

/** Valor para `<input type="file" accept>`. */
export const DESIGN_ACCEPT = [...DESIGN_MIME_TYPES, ".svg"].join(",");

export class DesignImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignImportError";
  }
}

const EXTENSION_TYPES: Record<string, (typeof DESIGN_MIME_TYPES)[number]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Tipo efectivo: algunos sistemas mandan los SVG sin `type`; se usa la extensión. */
export function resolveDesignType(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if ((DESIGN_MIME_TYPES as readonly string[]).includes(type)) return type;
  if (!type) return EXTENSION_TYPES[extensionOf(file.name)] ?? null;
  return null;
}

export function isDesignFile(file: File): boolean {
  return resolveDesignType(file) !== null;
}

function displayName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, "").trim();
  return base || "Diseño";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

/** Tamaño de un SVG sin `width`/`height` intrínsecos, sacado de su `viewBox`. */
async function svgViewBoxSize(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const text = await file.text();
    const match = text.match(/viewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)\s*["']/i);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

/**
 * Lee, rasteriza y reduce un diseño. Rechaza con `DesignImportError` (mensaje
 * en español listo para un toast) si el tipo no es PNG/JPG/SVG/WEBP o si el
 * navegador no lo puede leer.
 */
export async function importDesignFile(file: File): Promise<ImportedDesign> {
  const type = resolveDesignType(file);
  if (!type) {
    throw new DesignImportError(`«${file.name}» no es un diseño compatible. Usa PNG, JPG, SVG o WEBP.`);
  }
  const unreadable = () =>
    new DesignImportError(`No se pudo leer «${file.name}». Revisa que la imagen no esté dañada.`);

  const isSvg = type === "image/svg+xml";
  // Un SVG sin `type` no se decodifica como imagen: se le pone el correcto.
  const blob = file.type === type ? file : new Blob([file], { type });
  const url = URL.createObjectURL(blob);
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      throw unreadable();
    }

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if ((!width || !height) && isSvg) {
      const size = await svgViewBoxSize(blob);
      if (size) ({ width, height } = size);
    }
    if (!width || !height) throw unreadable();

    const longest = Math.max(width, height);
    // Las imágenes de píxeles sólo se reducen; el SVG se lleva al máximo.
    const scale = isSvg ? MAX_DESIGN_PX / longest : Math.min(1, MAX_DESIGN_PX / longest);
    const outWidth = Math.max(1, Math.round(width * scale));
    const outHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw unreadable();
    ctx.clearRect(0, 0, outWidth, outHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outWidth, outHeight);

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch {
      throw unreadable();
    }
    if (!dataUrl.startsWith("data:image/png")) throw unreadable();

    return { name: displayName(file.name), dataUrl, aspect: outWidth / outHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
