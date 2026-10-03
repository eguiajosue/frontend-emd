"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OrderHistoryFilters } from "@/hooks/useOrders";
import { AREA_OPTIONS } from "@/lib/areas";
import type { Status } from "@/types";

/** Radix Select no admite `""`: centinela para "sin filtro". */
const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

const toIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIsoDay = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined);

function rangeLabel(filters: OrderHistoryFilters): string {
  const fmt = (s: string) => fromIsoDay(s)!.toLocaleDateString("es-MX");
  if (!filters.dateFrom) return "Fecha de creación";
  if (!filters.dateTo || filters.dateTo === filters.dateFrom) return fmt(filters.dateFrom);
  return `${fmt(filters.dateFrom)} – ${fmt(filters.dateTo)}`;
}

export function hasHistoryFilters(f: OrderHistoryFilters): boolean {
  return Boolean(f.q?.trim() || f.statusId !== undefined || f.area || f.dateFrom || f.dateTo);
}

/**
 * Búsqueda + filtros del Historial, en una sola fila de píldoras. El texto
 * busca por código ("EMD-P0042" o sólo "42"), cliente, empresa o descripción
 * y se manda al backend con un pequeño debounce: el historial es paginado en
 * el servidor, así que filtrar en el navegador sólo vería la página actual.
 */
export function HistoryFilters({
  filters,
  onChange,
}: {
  filters: OrderHistoryFilters;
  onChange: (next: OrderHistoryFilters) => void;
}) {
  const isMobile = useIsMobile();
  const { data: statuses } = useEntityList<Status>("statuses", { staleTime: CATALOG_STALE_TIME });
  const [text, setText] = useState(filters.q ?? "");

  // El campo es local y se publica con debounce; si afuera se limpian los
  // filtros, el campo se vacía también.
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (text === (filters.q ?? "")) return;
    const id = window.setTimeout(() => onChange({ ...filters, q: text }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text, filters, onChange]);

  const range: DateRange | undefined = filters.dateFrom
    ? { from: fromIsoDay(filters.dateFrom), to: fromIsoDay(filters.dateTo) }
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Buscar en el historial">
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar EMD-P0042, cliente o descripción…"
          aria-label="Buscar por código, cliente o descripción"
          className="h-10 rounded-full border-border/60 pl-10 shadow-soft"
        />
      </div>

      <Select
        value={filters.statusId !== undefined ? String(filters.statusId) : ALL}
        onValueChange={(v) => onChange({ ...filters, statusId: v === ALL ? undefined : Number(v) })}
      >
        <SelectTrigger aria-label="Filtrar por estado" className="h-10 w-auto min-w-[10rem] rounded-full border-border/60 shadow-soft [&>span]:first-letter:uppercase">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={String(s.id)} className="capitalize">
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.area ?? ALL}
        onValueChange={(v) => onChange({ ...filters, area: v === ALL ? undefined : v })}
      >
        <SelectTrigger aria-label="Filtrar por área" className="h-10 w-auto min-w-[9rem] rounded-full border-border/60 shadow-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las áreas</SelectItem>
          {AREA_OPTIONS.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 gap-2 border-border/60 font-normal shadow-soft">
            <CalendarIcon className="h-4 w-4" aria-hidden />
            {rangeLabel(filters)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) =>
              onChange({
                ...filters,
                dateFrom: r?.from ? toIsoDay(r.from) : undefined,
                dateTo: r?.to ? toIsoDay(r.to) : undefined,
              })
            }
            numberOfMonths={isMobile ? 1 : 2}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {hasHistoryFilters(filters) && (
        <Button
          variant="ghost"
          className="h-10 gap-1.5 text-muted-foreground"
          onClick={() => {
            setText("");
            onChange({});
          }}
        >
          <X className="h-4 w-4" aria-hidden />
          Limpiar
        </Button>
      )}
    </div>
  );
}
