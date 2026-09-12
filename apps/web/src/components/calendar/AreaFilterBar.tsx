"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  /** Compacta a un dropdown en vez de tabs — mobile, donde 7 tabs no entran sin scroll horizontal. */
  compact?: boolean;
}

/**
 * Filtro "Todas" + una tab por área de producción (Taller/DTF/Bordado/
 * Diseño/Láser/Impresiones), independiente del filtro por categoría del
 * evento. Mismo patrón visual que `CategoryFilterBar`, con íconos de área
 * en vez de puntos de color (reusa los mismos de las tarjetas de pedido).
 */
export function AreaFilterBar({ value, onChange, compact }: AreaFilterBarProps) {
  if (compact) {
    return (
      <Select value={value} onValueChange={(v) => onChange(v as AreaFilter)}>
        <SelectTrigger className="w-full" aria-label="Filtrar por área">
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

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as AreaFilter)}>
      <TabsList>
        <TabsTrigger value="todas">Todas</TabsTrigger>
        {AREA_OPTIONS.map((option) => {
          const Icon = AREA_ICONS[option.value];
          return (
            <TabsTrigger key={option.value} value={option.value} className="gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {option.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
