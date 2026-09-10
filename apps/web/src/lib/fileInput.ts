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
