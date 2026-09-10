/**
 * Lectura de un `File` del navegador a `{ data, filename, mimeType }` (base64
 * sin el prefijo `data:...;base64,`), con las mismas reglas (tipo/tamaño) que
 * usa la hoja de autorización (`CreateOrderDialog`) — reutilizado acá por el
 * flujo de diseño (montaje / adjunto de feedback), mismo límite del backend.
 */

export const UPLOAD_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export function isAllowedUploadMime(type: string): type is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(type);
}

export interface UploadFileInput {
  data: string;
  filename: string;
  mimeType: AllowedUploadMimeType;
}

export function readFileAsUploadInput(file: File): Promise<UploadFileInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      resolve({
        data: base64,
        filename: file.name,
        mimeType: file.type as AllowedUploadMimeType,
      });
    };
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_DIMENSION = 2000;
const IMAGE_JPEG_QUALITY = 0.8;

/**
 * Normaliza cualquier imagen (incluido HEIC de la cámara de iOS, que Safari
 * decodifica de forma nativa en <canvas>) a un JPEG liviano: redimensiona el
 * lado mayor a un máximo de 2000px y comprime a calidad 0.8. Los PDF y las
 * imágenes que ya cumplen el tipo y el límite de tamaño se devuelven sin
 * tocar. Si el navegador no puede decodificar el archivo (ej. HEIC en
 * Chrome, que no tiene soporte nativo), devuelve `null`.
 */
export async function normalizeImageFile(file: File): Promise<File | null> {
  if (file.type === "application/pdf") return file;
  if (isAllowedUploadMime(file.type) && file.size <= UPLOAD_FILE_MAX_BYTES) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY)
  );
  if (!blob) return null;

  const jpegName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], jpegName, { type: "image/jpeg" });
}
