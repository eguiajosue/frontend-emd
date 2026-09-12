"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  /** Compacta a un dropdown en vez de tabs — mobile, donde 6 tabs no entran sin scroll horizontal. */
  compact?: boolean;
}

/**
 * Filtro "Todos" + una tab por categoría existente del calendario. En
 * escritorio son tabs (igual patrón que el selector Día/Semana/Mes); en
 * mobile se compacta a un dropdown para no llenar la pantalla de controles
 * horizontales.
 */
export function CategoryFilterBar({ value, onChange, compact }: CategoryFilterBarProps) {
  if (compact) {
    return (
      <Select value={value} onValueChange={(v) => onChange(v as CategoryFilter)}>
        <SelectTrigger className="w-full" aria-label="Filtrar por categoría">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
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

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as CategoryFilter)}>
      <TabsList>
        <TabsTrigger value="todos">Todos</TabsTrigger>
        {CATEGORY_OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={option.value} className="gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${option.swatchClass}`} />
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
