/**
 * Validación en el cliente del logo de una sucursal ANTES de subirlo. Son las
 * mismas reglas que aplica el backend (`PUT /branches/:id/logo/:variant`), para
 * avisar al instante y sin gastar una subida: sólo PNG / JPEG / WebP (nada de
 * SVG: puede traer scripts), hasta 400 KB y 2000×2000 px.
 */

export const LOGO_MAX_BYTES = 400 * 1024;
export const LOGO_MAX_DIMENSION = 2000;
export const LOGO_ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_ACCEPT_ATTR = LOGO_ACCEPTED_MIME.join(",");

export type LogoVariantKey = "onLight" | "onDark";

export type LogoCheck =
  | { ok: true; dataUrl: string; width: number; height: number; warning: string | null }
  | { ok: false; error: string };

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

/**
 * Avisos (NO errores) sobre el contraste: un logo casi transparente, o de un
 * color que se pierde sobre el fondo para el que se sube. Mira una versión
 * reducida de la imagen; si el navegador no puede (sin canvas), no avisa.
 */
export function contrastWarning(
  pixels: Uint8ClampedArray,
  variant: LogoVariantKey
): string | null {
  let visible = 0;
  let lum = 0;
  const total = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 25) continue;
    visible += 1;
    lum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
  }
  if (total === 0 || visible / total < 0.01) {
    return "La imagen es casi toda transparente: revisa que sea el logo correcto.";
  }
  const mean = lum / visible;
  if (variant === "onLight" && mean > 215) {
    return "Este logo se ve muy claro: sobre fondos claros (papel, tema claro) casi no se verá. ¿Es la versión negra?";
  }
  if (variant === "onDark" && mean < 40) {
    return "Este logo se ve muy oscuro: sobre fondos oscuros (Modo TV, tema oscuro) casi no se verá. ¿Es la versión blanca?";
  }
  return null;
}

function sampleWarning(img: HTMLImageElement, variant: LogoVariantKey): string | null {
  try {
    const scale = Math.min(1, 64 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return contrastWarning(ctx.getImageData(0, 0, w, h).data, variant);
  } catch {
    return null;
  }
}

/** Valida el archivo y lo devuelve como data URL listo para subir. */
export async function checkLogoFile(file: File, variant: LogoVariantKey): Promise<LogoCheck> {
  if (!(LOGO_ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: file.type === "image/svg+xml"
        ? "El SVG no está permitido: usa un PNG, JPEG o WebP."
        : "El logo debe ser PNG, JPEG o WebP.",
    };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return {
      ok: false,
      error: `El logo pesa ${Math.ceil(file.size / 1024)} KB: el máximo es ${LOGO_MAX_BYTES / 1024} KB.`,
    };
  }
  let dataUrl: string;
  let img: HTMLImageElement;
  try {
    dataUrl = await readAsDataUrl(file);
    img = await loadImage(dataUrl);
  } catch {
    return { ok: false, error: "No se pudo leer la imagen: el archivo está dañado o no es una imagen." };
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width > LOGO_MAX_DIMENSION || height > LOGO_MAX_DIMENSION) {
    return {
      ok: false,
      error: `El logo mide ${width}×${height} px: el máximo es ${LOGO_MAX_DIMENSION}×${LOGO_MAX_DIMENSION} px.`,
    };
  }
  return { ok: true, dataUrl, width, height, warning: sampleWarning(img, variant) };
}
