"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OrderHistoryFilters } from "@/hooks/useOrders";
import { AREA_OPTIONS } from "@/lib/areas";
import { getClientName } from "@/lib/format";
import type { Client, Status } from "@/types";

/** Radix Select no admite `""`: centinela para "sin filtro". */
const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

const toIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIsoDay = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined);

export function hasHistoryFilters(f: OrderHistoryFilters): boolean {
  return Boolean(
    f.q?.trim() ||
      f.statusId !== undefined ||
      f.clientId !== undefined ||
      f.area ||
      f.dateFrom ||
      f.dateTo ||
      f.deliveryFrom ||
      f.deliveryTo
  );
}

const PILL = "h-10 rounded-full border-border/60 shadow-soft";

/** Píldora con un rango de días (`YYYY-MM-DD`); el título se reemplaza por las fechas elegidas. */
function DateRangePill({
  title,
  from,
  to,
  onChange,
}: {
  title: string;
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
}) {
  const isMobile = useIsMobile();
  const fmt = (s: string) => fromIsoDay(s)!.toLocaleDateString("es-MX");
  const label = !from ? title : !to || to === from ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
  const range: DateRange | undefined = from ? { from: fromIsoDay(from), to: fromIsoDay(to) } : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={from ? `${title}: ${label}` : title}
          className={`${PILL} gap-2 px-4 font-normal`}
        >
          <CalendarIcon className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) => onChange(r?.from ? toIsoDay(r.from) : undefined, r?.to ? toIsoDay(r.to) : undefined)}
          numberOfMonths={isMobile ? 1 : 2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Combobox de cliente con búsqueda (la lista puede ser larga). */
function ClientFilter({ value, onChange }: { value?: number; onChange: (id?: number) => void }) {
  const { data: clients } = useEntityList<Client>("clients");
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);
  const sorted = useMemo(
    () => [...clients].sort((a, b) => getClientName(a).localeCompare(getClientName(b), "es")),
    [clients]
  );
  const pick = (id?: number) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filtrar por cliente"
          className={`${PILL} w-auto min-w-[11rem] max-w-[16rem] justify-between gap-2 px-4 font-normal`}
        >
          <span className="truncate">{selected ? getClientName(selected) : "Todos los clientes"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente…" />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandItem value="Todos los clientes" onSelect={() => pick(undefined)}>
              Todos los clientes
            </CommandItem>
            {sorted.map((client) => (
              <CommandItem
                key={client.id}
                value={`${getClientName(client)} ${client.id}`}
                onSelect={() => pick(client.id)}
              >
                {getClientName(client)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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

      <ClientFilter value={filters.clientId} onChange={(clientId) => onChange({ ...filters, clientId })} />

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

      <DateRangePill
        title="Fecha de creación"
        from={filters.dateFrom}
        to={filters.dateTo}
        onChange={(dateFrom, dateTo) => onChange({ ...filters, dateFrom, dateTo })}
      />
      <DateRangePill
        title="Fecha de entrega"
        from={filters.deliveryFrom}
        to={filters.deliveryTo}
        onChange={(deliveryFrom, deliveryTo) => onChange({ ...filters, deliveryFrom, deliveryTo })}
      />

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
