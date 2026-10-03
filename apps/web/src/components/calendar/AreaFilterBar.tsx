"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AREA_OPTIONS, AREA_ICONS } from "@/lib/areas";
import type { AreaFilter } from "@/hooks/useCalendarPrefs";

interface AreaFilterBarProps {
  value: AreaFilter;
  onChange: (value: AreaFilter) => void;
  /** Ocupa todo el ancho disponible (mobile, en grilla de dos columnas). */
  compact?: boolean;
}

/**
 * Filtro por área de producción (Taller/DTF/Bordado/Diseño/Láser/
 * Impresiones), independiente del de categoría. Mismo patrón que
 * `CategoryFilterBar`, con los íconos de área de las tarjetas de pedido.
 */
export function AreaFilterBar({ value, onChange, compact }: AreaFilterBarProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AreaFilter)}>
      <SelectTrigger className={cn("w-full rounded-full", compact ? "px-3" : "px-4 sm:w-48")} aria-label="Filtrar por área">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todas las áreas</SelectItem>
        {AREA_OPTIONS.map((option) => {
          const Icon = AREA_ICONS[option.value];
          return (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
