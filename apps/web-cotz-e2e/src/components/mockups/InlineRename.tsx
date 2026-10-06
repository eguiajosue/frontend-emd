"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Campo para renombrar en su lugar (plantillas, logos). Enter guarda, Esc
 * cancela. Un nombre vacío o igual al de antes sólo cierra.
 */
export function InlineRename({
  initial,
  label,
  maxLength = 80,
  onSave,
  onCancel,
}: {
  initial: string;
  /** "Nuevo nombre de la plantilla", etc. */
  label: string;
  maxLength?: number;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    const name = value.replace(/\s+/g, " ").trim();
    if (!name || name === initial) onCancel();
    else onSave(name);
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={value}
        maxLength={maxLength}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        aria-label={label}
        className="h-8 min-w-0 flex-1 rounded-lg px-2 text-sm"
      />
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Guardar nombre" onClick={save}>
        <Check />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Cancelar" onClick={onCancel}>
        <X />
      </Button>
    </div>
  );
}
