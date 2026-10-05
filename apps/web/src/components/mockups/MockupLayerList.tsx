"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewImage } from "@/components/ui/preview-image";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DesignLayer } from "@/lib/mockups/types";

/** Cuadriculado de fondo para que se note la transparencia del logo. */
export const CHECKERBOARD_CLASS =
  "bg-[conic-gradient(hsl(var(--muted))_25%,transparent_0_50%,hsl(var(--muted))_0_75%,transparent_0)] bg-[length:12px_12px]";

/**
 * Diseños del mockup: subir (botón, arrastrar o pegar), elegir cuál se
 * ajusta y quitar. Sin diseños, la sección es una zona grande que invita a
 * soltar el primero.
 */
export function MockupLayerList({
  layers,
  selectedId,
  importing,
  onSelect,
  onRemove,
  onUpload,
}: {
  layers: DesignLayer[];
  selectedId: string | null;
  importing: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpload: () => void;
}) {
  if (layers.length === 0) {
    return (
      <button
        type="button"
        onClick={onUpload}
        disabled={importing}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-4 py-7 text-center transition-colors hover:border-ink/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft" aria-hidden>
          <ImagePlus className="h-5 w-5 text-foreground/70" />
        </span>
        <span className="text-sm font-semibold">{importing ? "Preparando diseño…" : "Sube el diseño del cliente"}</span>
        <span className="max-w-[16rem] text-meta">
          Arrastra un PNG, JPG, SVG o WEBP aquí, pégalo con Ctrl+V o elige un archivo.
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5" aria-label="Diseños del mockup">
        {layers.map((layer, index) => {
          const selected = layer.id === selectedId;
          return (
            <li
              key={layer.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-1.5 pr-1 transition-colors",
                selected ? "border-ink/70 bg-muted/60" : "border-transparent bg-muted/30 hover:bg-muted/50"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(layer.id)}
                aria-pressed={selected}
                aria-label={`Seleccionar ${layer.name}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-card",
                    CHECKERBOARD_CLASS
                  )}
                >
                  <PreviewImage src={layer.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{layer.name}</span>
                  <span className="block text-meta">
                    {selected ? "Seleccionado" : `Diseño ${index + 1}`}
                  </span>
                </span>
              </button>
              <SimpleTooltip label="Quitar diseño">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(layer.id)}
                  aria-label={`Quitar ${layer.name}`}
                >
                  <Trash2 />
                </Button>
              </SimpleTooltip>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        onClick={onUpload}
        disabled={importing}
      >
        <Upload /> {importing ? "Preparando diseño…" : "Agregar otro diseño"}
      </Button>
    </div>
  );
}
