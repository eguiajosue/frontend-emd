"use client";

import { useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { statusOptions } from "@/lib/orderStatus";
import { AREA_OPTIONS } from "@/lib/areas";
import { getAssignedUserName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarIcon, X } from "lucide-react";
import type { Client, User } from "@/types";

export interface OrdersFilters {
  clientId?: number;
  statusIds: number[];
  dateRange?: DateRange;
  onlyOverdue: boolean;
  area?: string;
  /** `null` = filtro explícito "Sin asignar"; `undefined` = sin filtro. */
  assignedUserId?: number | null;
}

export const EMPTY_ORDERS_FILTERS: OrdersFilters = {
  clientId: undefined,
  statusIds: [],
  dateRange: undefined,
  onlyOverdue: false,
  area: undefined,
  assignedUserId: undefined,
};

function clientLabel(c: Client): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function userLabel(u: User): string {
  return getAssignedUserName(u) ?? u.username;
}

function formatRange(range?: DateRange): string {
  if (!range?.from) return "Rango de entrega";
  const fmt = (d: Date) => d.toLocaleDateString("es-MX");
  if (!range.to || range.to.getTime() === range.from.getTime()) return fmt(range.from);
  return `${fmt(range.from)} - ${fmt(range.to)}`;
}

interface OrdersFilterBarProps {
  clients: Client[];
  users: User[];
  filters: OrdersFilters;
  onChange: (filters: OrdersFilters) => void;
}

/**
 * Barra de filtros (cliente, estatus, rango de fecha de entrega, área,
 * persona asignada y "sólo caducados") para la pantalla unificada de
 * Pedidos. Filtra en el cliente sobre el array ya devuelto por GET /orders.
 */
export function OrdersFilterBar({ clients, users, filters, onChange }: OrdersFilterBarProps) {
  const hasActiveFilters =
    filters.clientId !== undefined ||
    filters.statusIds.length > 0 ||
    !!filters.dateRange?.from ||
    filters.onlyOverdue ||
    !!filters.area ||
    filters.assignedUserId !== undefined;

  const toggleStatus = (id: number) => {
    const next = filters.statusIds.includes(id)
      ? filters.statusIds.filter((s) => s !== id)
      : [...filters.statusIds, id];
    onChange({ ...filters, statusIds: next });
  };

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => clientLabel(a).localeCompare(clientLabel(b))),
    [clients]
  );

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => userLabel(a).localeCompare(userLabel(b))),
    [users]
  );

  // El <select> nativo sólo maneja strings: "" = sin filtro, "unassigned" =
  // filtro explícito "Sin asignar" (assignedUserId === null), y cualquier
  // otro valor es el id numérico del usuario.
  const assignedUserSelectValue =
    filters.assignedUserId === undefined ? "" : filters.assignedUserId === null ? "unassigned" : String(filters.assignedUserId);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Cliente</Label>
        <select
          className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={filters.clientId ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              clientId: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Todos</option>
          {sortedClients.map((c) => (
            <option key={c.id} value={c.id}>
              {clientLabel(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Estatus</Label>
        <div className="flex flex-wrap gap-1">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                filters.statusIds.includes(opt.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-transparent hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Área</Label>
        <select
          className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={filters.area ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              area: e.target.value || undefined,
            })
          }
        >
          <option value="">Todas</option>
          {AREA_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Asignado a</Label>
        <select
          className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={assignedUserSelectValue}
          onChange={(e) => {
            const value = e.target.value;
            onChange({
              ...filters,
              assignedUserId: value === "" ? undefined : value === "unassigned" ? null : Number(value),
            });
          }}
        >
          <option value="">Todos</option>
          <option value="unassigned">Sin asignar</option>
          {sortedUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {userLabel(u)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Fecha de entrega</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 justify-start gap-2 font-normal">
              <CalendarIcon className="h-4 w-4" />
              {formatRange(filters.dateRange)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={filters.dateRange}
              onSelect={(range) => onChange({ ...filters, dateRange: range })}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Switch
          id="only-overdue"
          checked={filters.onlyOverdue}
          onCheckedChange={(checked) => onChange({ ...filters, onlyOverdue: checked })}
        />
        <Label htmlFor="only-overdue" className="text-xs">
          Ver sólo caducados
        </Label>
      </div>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
          onClick={() => onChange(EMPTY_ORDERS_FILTERS)}
        >
          <X className="h-3.5 w-3.5" /> Limpiar filtros
        </Button>
      )}
    </div>
  );
}
