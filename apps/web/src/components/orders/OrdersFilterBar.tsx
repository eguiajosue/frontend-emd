"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { statusOptions, statusLabel } from "@/lib/orderStatus";
import { AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { ownProductionAreas } from "@/lib/orderScreen";
import { getAssignedUserName } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { CalendarIcon, SlidersHorizontal, X } from "lucide-react";
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
 * Filtros (cliente, estatus, rango de fecha de entrega, área, persona
 * asignada y "sólo caducados") para la pantalla unificada de Pedidos. Filtra
 * en el cliente sobre el array ya devuelto por GET /orders.
 *
 * Los controles viven dentro de un popover, no en un panel siempre abierto:
 * como panel ocupaban una banda permanente entre el encabezado y el tablero,
 * sumando un tercer bloque de chrome antes de llegar al trabajo. Lo que sí
 * queda a la vista es lo que está filtrado ahora mismo, en chips que se
 * quitan de a uno — que es la información que hace falta leer de un vistazo,
 * y que el panel abierto no daba.
 */
/** Label uniforme para cada campo del popover. */
const FIELD_LABEL_CLASS = "text-xs font-medium text-muted-foreground";

export function OrdersFilterBar({ clients, users, filters, onChange }: OrdersFilterBarProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isAdmin, roles } = usePermissions();
  const isManager = isAdmin || roles.includes("recepcion");
  // Quien trabaja más de un área necesita poder mirar una sola: es lo que daba
  // el modo "Por área" de la pantalla "Mi trabajo", que se fusionó con esta.
  // Sólo ofrece SUS áreas — filtrar por una ajena no mostraría nada, porque el
  // backend ya no se las manda.
  const ownAreas = ownProductionAreas(roles);
  const areaChoices = isManager
    ? AREA_OPTIONS
    : AREA_OPTIONS.filter((a) => ownAreas.includes(a.value));
  const canFilterByArea = isManager || ownAreas.length > 1;

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

  // El Select sólo maneja strings: "all" = sin filtro, "unassigned" = filtro
  // explícito "Sin asignar" (assignedUserId === null), y cualquier otro valor
  // es el id numérico del usuario. Radix Select no admite value="", de ahí el
  // sentinel "all" en vez de cadena vacía.
  const assignedUserSelectValue =
    filters.assignedUserId === undefined
      ? "all"
      : filters.assignedUserId === null
        ? "unassigned"
        : String(filters.assignedUserId);

  /** Chips de lo que está filtrado ahora, cada uno con su forma de quitarse. */
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.clientId !== undefined) {
    const client = clients.find((c) => c.id === filters.clientId);
    activeChips.push({
      key: "client",
      label: client ? clientLabel(client) : `Cliente #${filters.clientId}`,
      clear: () => onChange({ ...filters, clientId: undefined }),
    });
  }
  filters.statusIds.forEach((id) => {
    activeChips.push({
      key: `status-${id}`,
      label: statusLabel(id),
      clear: () => toggleStatus(id),
    });
  });
  if (filters.area) {
    activeChips.push({
      key: "area",
      label: getAreaLabel(filters.area),
      clear: () => onChange({ ...filters, area: undefined }),
    });
  }
  if (filters.assignedUserId !== undefined) {
    const user =
      filters.assignedUserId === null
        ? null
        : users.find((u) => u.id === filters.assignedUserId);
    activeChips.push({
      key: "assigned",
      label:
        filters.assignedUserId === null
          ? "Sin asignar"
          : user
            ? userLabel(user)
            : `Usuario #${filters.assignedUserId}`,
      clear: () => onChange({ ...filters, assignedUserId: undefined }),
    });
  }
  if (filters.dateRange?.from) {
    activeChips.push({
      key: "range",
      label: formatRange(filters.dateRange),
      clear: () => onChange({ ...filters, dateRange: undefined }),
    });
  }
  if (filters.onlyOverdue) {
    activeChips.push({
      key: "overdue",
      label: "Sólo caducados",
      clear: () => onChange({ ...filters, onlyOverdue: false }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "gap-2 rounded-full",
              hasActiveFilters && "border-primary/50 text-primary"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeChips.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                {activeChips.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[22rem] space-y-4 p-4">
          {/* Cliente, Área y Asignado a son los tres selectores de "quién" del
              pedido: van agrupados y más apretados entre sí que respecto al
              resto de los filtros. */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLASS}>Cliente</Label>
              <Select
                value={filters.clientId === undefined ? "all" : String(filters.clientId)}
                onValueChange={(value) =>
                  onChange({
                    ...filters,
                    clientId: value === "all" ? undefined : Number(value),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sortedClients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {clientLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={cn("grid gap-2", canFilterByArea ? "grid-cols-2" : "grid-cols-1")}>
              {canFilterByArea && (
                <div className="space-y-1.5">
                  <Label className={FIELD_LABEL_CLASS}>Área</Label>
                  <Select
                    value={filters.area ?? "all"}
                    onValueChange={(value) =>
                      onChange({ ...filters, area: value === "all" ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {areaChoices.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className={FIELD_LABEL_CLASS}>Asignado a</Label>
                <Select
                  value={assignedUserSelectValue}
                  onValueChange={(value) =>
                    onChange({
                      ...filters,
                      assignedUserId:
                        value === "all" ? undefined : value === "unassigned" ? null : Number(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {sortedUsers.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {userLabel(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={FIELD_LABEL_CLASS}>Estatus</Label>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={filters.statusIds.includes(opt.value)}
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

          <div className="space-y-1.5">
            <Label className={FIELD_LABEL_CLASS}>Fecha de entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-start gap-2 font-normal"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  {formatRange(filters.dateRange)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={filters.dateRange}
                  onSelect={(range) => onChange({ ...filters, dateRange: range })}
                  numberOfMonths={isMobile ? 1 : 2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <Label htmlFor="only-overdue" className="text-sm font-normal">
              Ver sólo caducados
            </Label>
            <Switch
              id="only-overdue"
              checked={filters.onlyOverdue}
              onCheckedChange={(checked) =>
                onChange({ ...filters, onlyOverdue: checked })
              }
            />
          </div>
        </PopoverContent>
      </Popover>

      {activeChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          title={`Quitar el filtro "${chip.label}"`}
          className="group inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium capitalize text-primary transition-colors hover:bg-primary/15"
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange(EMPTY_ORDERS_FILTERS)}
        >
          Limpiar
        </Button>
      )}
    </div>
  );
}
