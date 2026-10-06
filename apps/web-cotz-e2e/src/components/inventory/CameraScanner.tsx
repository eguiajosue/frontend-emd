"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cameraUnavailableReason,
  describeCameraError,
  startCameraScanner,
  type CameraSession,
} from "@/lib/barcode/camera";

interface CameraScannerProps {
  /** Cada código visto (puede repetirse mientras siga en cuadro). */
  onCode: (code: string) => void;
  onClose: () => void;
}

/**
 * Visor de cámara del modo Escanear. Pide permiso al montarse y suelta la
 * cámara al desmontarse (la luz de "cámara en uso" se apaga al cerrar).
 */
export function CameraScanner({ onCode, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [status, setStatus] = useState<"starting" | "running" | "error">("starting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unavailable = cameraUnavailableReason();
    if (unavailable) {
      setError(unavailable);
      setStatus("error");
      return;
    }
    let session: CameraSession | null = null;
    let cancelled = false;
    startCameraScanner(videoRef.current!, (code) => onCodeRef.current(code)).then(
      (s) => {
        if (cancelled) return s.stop();
        session = s;
        setStatus("running");
      },
      (err) => {
        if (cancelled) return;
        setError(describeCameraError(err));
        setStatus("error");
      }
    );
    return () => {
      cancelled = true;
      session?.stop();
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black" aria-label="Cámara para escanear" role="region">
      <video
        ref={videoRef}
        className="aspect-[4/3] w-full object-cover sm:aspect-video"
        muted
        playsInline
        aria-hidden
      />
      {status === "running" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="relative h-[38%] w-[78%] rounded-xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-rose-500/90" />
          </div>
        </div>
      )}
      {status === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
          <Loader2 className="h-4 w-4 animate-spin" /> Abriendo la cámara…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 px-6 text-center text-sm text-white/90">
          <CameraOff className="h-6 w-6 text-white/60" aria-hidden />
          <p role="alert" className="max-w-sm">
            {error}
          </p>
        </div>
      )}
      {status === "running" && (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/90 drop-shadow">
          Centra el código dentro del recuadro
        </p>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute right-3 top-3 h-9 w-9 bg-white/90 text-black hover:bg-white"
        onClick={onClose}
        aria-label="Cerrar cámara"
      >
        <X />
      </Button>
    </div>
  );
}
