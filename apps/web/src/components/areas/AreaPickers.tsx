"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AREA_ICON_REGISTRY, areaTones } from "@/lib/areas";
import {
  AREA_COLOR_PRESETS,
  HEX_COLOR,
  MAX_SUGGESTIONS,
  MAX_SUGGESTION_LENGTH,
  addSuggestion,
  removeSuggestion,
} from "@/lib/areaForm";

/** Elige el ícono del área entre los que conoce la app. */
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Ícono del área" className="grid grid-cols-8 gap-1.5">
      {Object.entries(AREA_ICON_REGISTRY).map(([name, Icon]) => {
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            onClick={() => onChange(name)}
            className={cn(
              "flex h-10 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "border-foreground/60 bg-muted text-foreground"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Color del área: sugeridos, o cualquiera en #rrggbb. */
export function ColorPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (color: string) => void;
  error?: string;
}) {
  const normalized = value.trim().toLowerCase();
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Color del área" className="flex flex-wrap items-center gap-2">
        {AREA_COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={normalized === color}
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              normalized === color && "ring-2 ring-foreground"
            )}
          />
        ))}
        <input
          type="color"
          aria-label="Elegir otro color"
          value={HEX_COLOR.test(normalized) ? normalized : "#7c3aed"}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          aria-label="Color en hexadecimal"
          aria-invalid={Boolean(error)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={7}
          className="h-8 w-28 font-mono text-sm"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Cómo se verá el área en tarjetas y filtros, con su color y su ícono. */
export function AreaPreview({ name, icon, color }: { name: string; icon: string; color: string }) {
  const { resolvedTheme } = useTheme();
  const tones = areaTones(color);
  const Icon = AREA_ICON_REGISTRY[icon];
  const tone = tones ? (resolvedTheme === "dark" ? tones.dark : tones.light) : null;
  return (
    <div
      className="area-stripe flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
      style={
        tone
          ? ({ "--tone": tone.tone, "--tone-ink": tone.ink } as React.CSSProperties)
          : ({ "--tone": "240 6% 60%", "--tone-ink": "240 10% 30%" } as React.CSSProperties)
      }
      aria-label="Vista previa del área"
    >
      <span className="area-chip">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {name.trim() || "Nombre del área"}
      </span>
      <span className="text-xs text-muted-foreground">Así se verá en pedidos y tareas</span>
    </div>
  );
}

/** Lista de sugerencias (categorías, unidades): Enter o coma agregan, la × quita. */
export function SuggestionInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState("");
  const commit = () => {
    if (text.trim()) onChange(addSuggestion(value, text));
    setText("");
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && text === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="space-y-2">
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={text}
        maxLength={MAX_SUGGESTION_LENGTH}
        disabled={value.length >= MAX_SUGGESTIONS}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label} agregadas`}>
          {value.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
            >
              {item}
              <button
                type="button"
                aria-label={`Quitar ${item}`}
                onClick={() => onChange(removeSuggestion(value, item))}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
