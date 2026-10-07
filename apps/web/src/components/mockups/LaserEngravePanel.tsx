"use client";

import { useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_LASER_SETTINGS,
  laserMask,
  laserSettings,
  maskToRgba,
  type LaserEngraveSettings,
} from "@/lib/mockups/laserEngrave";
import { RAW_STEEL_HEX, isRawSteel, type DesignLayer } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";

/**
 * Controles del grabado láser del termo (umbral, invertir, difuminado) con
 * una vista previa de la máscara en blanco y negro. El diseño original no se
 * modifica: los ajustes viven en `layer.engrave` y "Restablecer" vuelve a los
 * valores por defecto.
 */

/** Vista previa B/N de lo que quemará el láser (negro = grabado). */
function MaskPreview({ dataUrl, settings }: { dataUrl: string; settings: LaserEngraveSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const { threshold, invert, dither } = settings;

  useEffect(() => {
    let cancelled = false;
    const draw = (img: HTMLImageElement) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx || !img.naturalWidth) return;
      // Vista chica: se procesa a ≤ 240 px para que el slider responda al instante.
      const k = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = laserMask(px, { threshold, invert, dither });
      maskToRgba(mask, px.data);
      // Negro donde se graba (en la vista previa se lee mejor que blanco).
      for (let i = 0; i < px.data.length; i += 4) {
        px.data[i] = px.data[i + 1] = px.data[i + 2] = 17;
      }
      ctx.putImageData(px, 0, 0);
    };
    const cached = imageRef.current;
    if (cached && cached.src === dataUrl && cached.complete) {
      draw(cached);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      draw(img);
    };
    img.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl, threshold, invert, dither]);

  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-border/70 bg-white p-2">
      <canvas
        ref={canvasRef}
        data-testid="laser-preview"
        aria-label="Vista previa del grabado en blanco y negro"
        role="img"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function LaserEngravePanel({
  layer,
  onChange,
}: {
  layer: DesignLayer;
  onChange: (settings: LaserEngraveSettings) => void;
}) {
  const settings = laserSettings(layer.engrave);
  const set = (patch: Partial<LaserEngraveSettings>) => onChange({ ...settings, ...patch });
  const isDefault =
    settings.threshold === DEFAULT_LASER_SETTINGS.threshold &&
    settings.invert === DEFAULT_LASER_SETTINGS.invert &&
    settings.dither === DEFAULT_LASER_SETTINGS.dither;

  return (
    <div className="space-y-3" data-testid="laser-engrave-panel">
      <MaskPreview dataUrl={layer.dataUrl} settings={settings} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={`laser-threshold-${layer.id}`} className="text-label">
            Umbral
          </label>
          <span className="text-meta tabular-nums">{settings.threshold}</span>
        </div>
        <input
          id={`laser-threshold-${layer.id}`}
          type="range"
          min={1}
          max={254}
          step={1}
          value={settings.threshold}
          onChange={(e) => set({ threshold: Number(e.target.value) })}
          className="w-full accent-ink"
        />
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">Invertir (grabar lo claro)</span>
        <Switch checked={settings.invert} onCheckedChange={(invert) => set({ invert })} aria-label="Invertir grabado" />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">Difuminado (fotos y degradados)</span>
        <Switch checked={settings.dither} onCheckedChange={(dither) => set({ dither })} aria-label="Difuminado Floyd–Steinberg" />
      </label>
      <div className="flex items-center justify-between gap-2">
        <p className="text-meta">El láser sólo graba o no graba: el diseño se ve en blanco y negro.</p>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => onChange({ ...DEFAULT_LASER_SETTINGS })}
          className="shrink-0 text-[0.8125rem] font-medium underline-offset-2 hover:underline disabled:opacity-40"
        >
          Restablecer
        </button>
      </div>
    </div>
  );
}

/** Acabado del cuerpo del termo: pintura (color libre) o acero natural. */
export function TermoFinishPicker({
  body,
  onChange,
  paintColor,
}: {
  body: string;
  onChange: (hex: string) => void;
  /** Color al que vuelve "Pintura" desde acero natural. */
  paintColor: string;
}) {
  const steel = isRawSteel(body);
  const option = (active: boolean) =>
    cn(
      "h-8 flex-1 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
      active ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card hover:bg-muted",
    );
  return (
    <div className="flex gap-1.5" role="group" aria-label="Acabado del termo">
      <button type="button" aria-pressed={!steel} className={option(!steel)} onClick={() => steel && onChange(paintColor)}>
        Pintura electrostática
      </button>
      <button type="button" aria-pressed={steel} className={option(steel)} onClick={() => onChange(RAW_STEEL_HEX)}>
        Acero natural
      </button>
    </div>
  );
}
