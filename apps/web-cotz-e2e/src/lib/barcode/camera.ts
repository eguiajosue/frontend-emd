/**
 * Lectura de códigos con la cámara (celular o webcam).
 *
 * Primero la API nativa `BarcodeDetector` (Chrome en Android, Edge, Safari
 * reciente): rápida y sin descargar nada. Si el navegador no la tiene, se
 * carga `@zxing/browser` (diferido: pesa, y casi nadie lo necesita).
 *
 * La cámara exige HTTPS (o localhost) y permiso del usuario; cada falla se
 * traduce a un mensaje que diga qué hacer.
 */

/** Simbologías que se buscan: las de nuestras etiquetas y las de los fabricantes. */
export const CAMERA_FORMATS = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"] as const;

/** Cada cuánto se analiza un cuadro con el detector nativo. */
const NATIVE_INTERVAL_MS = 120;

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface NativeBarcodeDetectorCtor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

function nativeDetectorCtor(): NativeBarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector ?? null;
}

/**
 * Por qué no se puede usar la cámara en este navegador, antes de pedir
 * permiso. `null` = se puede intentar.
 */
export function cameraUnavailableReason(): string | null {
  if (typeof window === "undefined") return "La cámara sólo funciona en el navegador.";
  if (!window.isSecureContext) {
    return "La cámara sólo funciona con conexión segura (https). Abre el sistema desde su dirección https.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Este navegador no permite usar la cámara. Usa un lector USB o escribe el código.";
  }
  return null;
}

/** Mensaje para el usuario a partir del error de `getUserMedia` o del lector. */
export function describeCameraError(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "No diste permiso para usar la cámara. Actívalo en la configuración del sitio del navegador y vuelve a intentar.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "No se encontró una cámara en este equipo.";
    case "NotReadableError":
    case "TrackStartError":
      return "La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentar.";
    case "SecurityError":
      return "El navegador bloqueó la cámara: hace falta conexión segura (https).";
    case "AbortError":
      return "Se interrumpió el acceso a la cámara. Vuelve a intentar.";
    default:
      return "No se pudo abrir la cámara. Usa un lector USB o escribe el código.";
  }
}

export type CameraEngine = "native" | "zxing";

export interface CameraSession {
  engine: CameraEngine;
  stop: () => void;
}

async function nativeDetector(): Promise<NativeBarcodeDetector | null> {
  const Ctor = nativeDetectorCtor();
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? [...CAMERA_FORMATS];
    const formats = CAMERA_FORMATS.filter((f) => supported.includes(f));
    if (!formats.includes("code_128")) return null;
    return new Ctor({ formats });
  } catch {
    return null;
  }
}

/**
 * Abre la cámara trasera en `video` y llama `onCode` con cada código que
 * vea (repetido mientras siga en cuadro: el filtro de duplicados es de quien
 * llama). Lanza si no hay permiso o cámara; ver `describeCameraError`.
 */
export async function startCameraScanner(
  video: HTMLVideoElement,
  onCode: (code: string) => void
): Promise<CameraSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const stopStream = () => stream.getTracks().forEach((t) => t.stop());

  try {
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play();

    const detector = await nativeDetector();
    if (detector) {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tick = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const found = await detector.detect(video);
            for (const b of found) if (b.rawValue) onCode(b.rawValue);
          }
        } catch {
          // Un cuadro que no se pudo analizar no corta la sesión.
        }
        if (!stopped) timer = setTimeout(tick, NATIVE_INTERVAL_MS);
      };
      tick();
      return {
        engine: "native",
        stop: () => {
          stopped = true;
          clearTimeout(timer);
          stopStream();
          video.srcObject = null;
        },
      };
    }

    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result) onCode(result.getText());
    });
    return {
      engine: "zxing",
      stop: () => {
        controls.stop();
        stopStream();
        video.srcObject = null;
      },
    };
  } catch (error) {
    stopStream();
    throw error;
  }
}
