"use client";

import { useEffect, useId, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { QUICK_SWATCHES, normalizeHexColor } from "@/lib/mockups/studio";
import { cn } from "@/lib/utils";

/** Tono claro: la palomita del swatch elegido va en negro para que se vea. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/**
 * Color libre de una parte de la prenda: el selector nativo del sistema
 * (envuelto como swatch redondo), el valor hex editable a mano y una fila de
 * colores rápidos (blanco, negro, marino, gris jaspe, rojo).
 */
export function MockupColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const next = normalizeHexColor(draft);
    if (next) {
      setDraft(next);
      if (next !== value) onChange(next);
    } else {
      setDraft(value);
    }
  };

  return (
    <div className="space-y-2" role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-label">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className="relative h-10 w-10 shrink-0 cursor-pointer rounded-full border border-border shadow-inner ring-offset-background transition-shadow focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            aria-label={`${label}: elegir color`}
            className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
          />
        </label>
        <Input
          value={draft.toUpperCase()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          aria-label={`${label} (código hex)`}
          spellCheck={false}
          maxLength={7}
          className="h-10 w-28 rounded-full px-4 font-mono text-sm tabular-nums"
        />
        <div className="ml-auto flex items-center gap-1.5">
          {QUICK_SWATCHES.map((swatch) => {
            const active = swatch.value === value.toLowerCase();
            return (
              <button
                key={swatch.value}
                type="button"
                title={swatch.label}
                aria-label={`${label}: ${swatch.label}`}
                aria-pressed={active}
                onClick={() => onChange(swatch.value)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border border-border/80 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
                  active && "ring-2 ring-ink/80 ring-offset-1 ring-offset-background"
                )}
                style={{ backgroundColor: swatch.value }}
              >
                {active && (
                  <Check
                    aria-hidden
                    className={cn("h-3.5 w-3.5", isLight(swatch.value) ? "text-black" : "text-white")}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
