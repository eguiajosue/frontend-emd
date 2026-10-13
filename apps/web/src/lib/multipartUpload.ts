/**
 * Subida por partes (multipart) de archivos de varios GB directo al bucket.
 *
 * El archivo se corta con `Blob.slice` (nunca se carga entero en memoria ni se
 * pasa a base64) y cada parte se sube con un PUT a su URL firmada, con pocas
 * partes en paralelo, reintentos con espera creciente y progreso total.
 *
 * Es agnóstico del backend: recibe un `MultipartApi` con las 3 llamadas
 * (iniciar, re-firmar, completar) y un `putPart` inyectable (XHR por defecto)
 * para poder probarlo sin red.
 */

export interface PartUrl {
  partNumber: number;
  url: string;
}

export interface InitResult {
  fileId: number;
  partSize: number;
  partCount: number;
  parts: PartUrl[];
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export interface MultipartApi {
  init(file: { fileName: string; mimeType: string; sizeBytes: number; notes?: string }): Promise<InitResult>;
  signParts(fileId: number, partNumbers: number[]): Promise<PartUrl[]>;
  complete(fileId: number, parts: CompletedPart[]): Promise<unknown>;
  abort(fileId: number): Promise<unknown>;
}

export type PutPart = (
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal
) => Promise<string>;

export interface UploadOptions {
  notes?: string;
  concurrency?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { loaded: number; total: number }) => void;
  putPart?: PutPart;
  /** Espera entre reintentos (ms); inyectable para los tests. */
  backoffMs?: (attempt: number) => number;
}

export class UploadCancelledError extends Error {
  constructor() {
    super("Subida cancelada");
    this.name = "UploadCancelledError";
  }
}

/** PUT de una parte con XHR (fetch no expone el progreso de subida). Devuelve el ETag. */
export const xhrPutPart: PutPart = (url, body, onProgress, signal) =>
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const done = () => signal.removeEventListener("abort", onAbort);
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (etag) resolve(etag);
        else reject(new Error("El bucket no expuso el ETag (revisa el CORS: ExposeHeaders: ETag)."));
      } else {
        reject(new PartHttpError(xhr.status));
      }
    };
    xhr.onerror = () => {
      done();
      reject(new Error("Fallo de red al subir una parte."));
    };
    xhr.onabort = () => {
      done();
      reject(new UploadCancelledError());
    };
    xhr.send(body);
  });

export class PartHttpError extends Error {
  constructor(readonly status: number) {
    super(`El bucket rechazó la parte (HTTP ${status}).`);
    this.name = "PartHttpError";
  }
}

const defaultBackoff = (attempt: number) => Math.min(1000 * 2 ** (attempt - 1), 8000);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new UploadCancelledError());
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new UploadCancelledError());
      },
      { once: true }
    );
  });
}

/**
 * Sube `file` completo. Si algo falla de forma definitiva (o se cancela) aborta
 * la subida en el servidor para no dejar partes huérfanas en el bucket.
 */
export async function uploadFileMultipart(file: File, api: MultipartApi, options: UploadOptions = {}) {
  const {
    concurrency = 3,
    maxAttempts = 4,
    putPart = xhrPutPart,
    backoffMs = defaultBackoff,
    onProgress,
  } = options;

  const controller = new AbortController();
  const { signal } = controller;
  if (options.signal) {
    if (options.signal.aborted) throw new UploadCancelledError();
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const init = await api.init({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    notes: options.notes,
  });

  const urls = new Map(init.parts.map((p) => [p.partNumber, p.url]));
  const completed = new Map<number, string>();
  const inFlight = new Map<number, number>();
  const finishedBytes = { value: 0 };
  const report = () => {
    let loaded = finishedBytes.value;
    for (const bytes of inFlight.values()) loaded += bytes;
    onProgress?.({ loaded: Math.min(loaded, file.size), total: file.size });
  };

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * init.partSize;
    const blob = file.slice(start, Math.min(start + init.partSize, file.size));
    for (let attempt = 1; ; attempt++) {
      if (signal.aborted) throw new UploadCancelledError();
      try {
        let url = urls.get(partNumber);
        if (!url) {
          [{ url }] = await api.signParts(init.fileId, [partNumber]);
          urls.set(partNumber, url);
        }
        inFlight.set(partNumber, 0);
        const etag = await putPart(
          url,
          blob,
          (loaded) => {
            inFlight.set(partNumber, loaded);
            report();
          },
          signal
        );
        inFlight.delete(partNumber);
        finishedBytes.value += blob.size;
        completed.set(partNumber, etag);
        report();
        return;
      } catch (error) {
        inFlight.delete(partNumber);
        if (error instanceof UploadCancelledError || signal.aborted) throw new UploadCancelledError();
        // 403 = URL vencida: se pide una nueva en el siguiente intento.
        if (error instanceof PartHttpError && error.status === 403) urls.delete(partNumber);
        if (attempt >= maxAttempts) throw error;
        await sleep(backoffMs(attempt), signal);
      }
    }
  };

  const queue = Array.from({ length: init.partCount }, (_, i) => i + 1);
  try {
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        await uploadPart(next);
      }
    });
    // Si un worker falla, se frena a los demás antes de abortar.
    await Promise.all(
      workers.map((w) =>
        w.catch((error) => {
          controller.abort();
          throw error;
        })
      )
    );
    const parts = [...completed.entries()]
      .sort(([a], [b]) => a - b)
      .map(([partNumber, etag]) => ({ partNumber, etag }));
    return await api.complete(init.fileId, parts);
  } catch (error) {
    await api.abort(init.fileId).catch(() => undefined);
    throw error;
  }
}
