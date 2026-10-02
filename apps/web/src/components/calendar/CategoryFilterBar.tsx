"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_OPTIONS } from "./eventCategories";
import type { CategoryFilter } from "@/hooks/useCalendarPrefs";

interface CategoryFilterBarProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
  /** Ocupa todo el ancho disponible (mobile, en grilla de dos columnas). */
  compact?: boolean;
}

/**
 * Filtro por categoría del evento. Un Select (con el punto de color de cada
 * categoría) en vez de una fila de tabs: junto al de área eran 13 pestañas
 * compitiendo con el selector Día/Semana/Mes.
 */
export function CategoryFilterBar({ value, onChange, compact }: CategoryFilterBarProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CategoryFilter)}>
      <SelectTrigger className={cn("w-full", !compact && "sm:w-48")} aria-label="Filtrar por categoría">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todas las categorías</SelectItem>
        {CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${option.swatchClass}`} />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
