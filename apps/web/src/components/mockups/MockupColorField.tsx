"use client";

import { useEffect, useId, useState } from "react";
import { Check, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MyColorEntry } from "@/lib/mockups/myColors";
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

/** Acciones de "Mis colores" (vienen de `useMockupColors`). */
export interface MyColorsControls {
  entries: MyColorEntry[];
  onAdd: (hex: string) => Promise<boolean> | boolean;
  onToggleFavorite: (hex: string) => void;
  onRemove: (hex: string) => void;
}

/** Campo hex que acepta "fff", "#FFF", "ffffff"… y se confirma al salir o con Enter. */
function HexInput({
  value,
  onCommit,
  label,
  className,
}: {
  value: string;
  onCommit: (hex: string) => void;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = normalizeHexColor(draft);
    if (next) {
      setDraft(next);
      if (next !== value) onCommit(next);
    } else {
      setDraft(value);
    }
  };
  return (
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
      aria-label={label}
      spellCheck={false}
      maxLength={7}
      className={cn("h-10 w-28 rounded-full px-4 font-mono text-sm tabular-nums", className)}
    />
  );
}

/** Swatch redondo con el selector nativo del sistema encima (invisible). */
function NativeColorSwatch({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative h-10 w-10 shrink-0 cursor-pointer rounded-full border border-border shadow-inner ring-offset-background transition-shadow focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2",
        className
      )}
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
      />
    </label>
  );
}

function ColorDot({
  value,
  active,
  favorite,
  label,
  onClick,
}: {
  value: string;
  active: boolean;
  favorite?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={value.toUpperCase()}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/80 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
        active && "ring-2 ring-ink/80 ring-offset-1 ring-offset-background"
      )}
      style={{ backgroundColor: value }}
    >
      {active && (
        <Check aria-hidden className={cn("h-3.5 w-3.5", isLight(value) ? "text-black" : "text-white")} />
      )}
      {favorite && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border"
        >
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />
        </span>
      )}
    </button>
  );
}

/**
 * Panel de "Mis colores": agregar un color propio (selector nativo + hex) y
 * administrar los guardados (aplicar, marcar favorito, quitar).
 */
function MyColorsPanel({
  label,
  value,
  onApply,
  controls,
}: {
  label: string;
  value: string;
  onApply: (hex: string) => void;
  controls: MyColorsControls;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const exists = controls.entries.some((e) => e.value === draft);

  const add = async () => {
    setSaving(true);
    try {
      const ok = await controls.onAdd(draft);
      if (ok) onApply(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Agregar color</p>
        <div className="flex items-center gap-2">
          <NativeColorSwatch value={draft} onChange={setDraft} label="Color nuevo: elegir color" />
          <HexInput value={draft} onCommit={setDraft} label="Color nuevo (código hex)" className="w-[6.5rem] px-3" />
          <Button type="button" size="sm" className="h-10 flex-1" onClick={add} disabled={saving || exists}>
            <Plus /> {exists ? "Ya está" : "Agregar"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Tus colores</p>
        {controls.entries.length === 0 ? (
          <p className="text-meta">Todavía no guardas colores. Los que agregues sólo los ves tú.</p>
        ) : (
          <ul aria-label="Tus colores" className="-mx-1 max-h-60 space-y-0.5 overflow-y-auto px-1">
            {controls.entries.map((entry) => {
              const hex = entry.value.toUpperCase();
              return (
                <li key={entry.value} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/60">
                  <button
                    type="button"
                    onClick={() => onApply(entry.value)}
                    aria-label={`${label}: usar ${hex}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <span
                      className="h-6 w-6 shrink-0 rounded-full border border-border/80"
                      style={{ backgroundColor: entry.value }}
                      aria-hidden
                    />
                    <span className="font-mono text-sm tabular-nums">{hex}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-pressed={entry.favorite}
                    aria-label={entry.favorite ? `Quitar ${hex} de favoritos` : `Marcar ${hex} como favorito`}
                    onClick={() => controls.onToggleFavorite(entry.value)}
                  >
                    <Star className={cn(entry.favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar ${hex} de mis colores`}
                    onClick={() => controls.onRemove(entry.value)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Color libre de una parte de la prenda: el selector nativo del sistema
 * (envuelto como swatch redondo), el valor hex editable a mano, una fila de
 * colores rápidos (blanco, negro, marino, gris jaspe, rojo) y, si se pasan
 * `myColors`, la fila "Mis colores" del usuario (favoritos primero).
 */
export function MockupColorField({
  label,
  value,
  onChange,
  myColors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  myColors?: MyColorsControls;
}) {
  const id = useId();
  const [panelOpen, setPanelOpen] = useState(false);
  const current = value.toLowerCase();

  return (
    <div className="space-y-2" role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-label">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <NativeColorSwatch value={value} onChange={onChange} label={`${label}: elegir color`} />
        <HexInput value={value} onCommit={onChange} label={`${label} (código hex)`} />
        <div className="ml-auto flex items-center gap-1.5">
          {QUICK_SWATCHES.map((swatch) => (
            <ColorDot
              key={swatch.value}
              value={swatch.value}
              active={swatch.value === current}
              label={`${label}: ${swatch.label}`}
              onClick={() => onChange(swatch.value)}
            />
          ))}
        </div>
      </div>

      {myColors && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/40 py-1.5 pl-3 pr-1.5">
          <span className="shrink-0 text-meta">Mis colores</span>
          <div
            role="group"
            aria-label={`${label}: mis colores`}
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {myColors.entries.map((entry) => (
              <ColorDot
                key={entry.value}
                value={entry.value}
                active={entry.value === current}
                favorite={entry.favorite}
                label={`${label}: ${entry.value.toUpperCase()}${entry.favorite ? " (favorito)" : ""}`}
                onClick={() => onChange(entry.value)}
              />
            ))}
            {myColors.entries.length === 0 && (
              <span className="truncate text-meta text-muted-foreground/80">Guarda aquí los colores de tus clientes</span>
            )}
          </div>
          <Popover open={panelOpen} onOpenChange={setPanelOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 bg-card px-2.5"
                aria-label={`${label}: agregar color`}
              >
                <Plus /> Agregar color
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              {panelOpen && (
                <MyColorsPanel
                  label={label}
                  value={current}
                  controls={myColors}
                  onApply={(hex) => {
                    onChange(hex);
                  }}
                />
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
