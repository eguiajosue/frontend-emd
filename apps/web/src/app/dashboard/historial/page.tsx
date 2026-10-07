"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { BranchBadge } from "@/components/orders/BranchBadge";
import { OriginFilter } from "@/components/orders/OriginFilter";
import { matchesOrigin, ORIGIN_URL_PARAM, originParams, parseOrigin, type OrderOrigin } from "@/lib/orderOrigin";
import { useOrderHistoryList, downloadOrdersExport, type OrderHistoryFilters } from "@/hooks/useOrders";
import { useAuthToken, useEntityList } from "@/hooks/useEntity";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { formatDeliveryDate, getAssignedUserName, getClientName, getOrderClientName } from "@/lib/format";
import { AREA_OPTIONS, getAreaIcon, getAreaLabel } from "@/lib/areas";
import { orderAreaTags } from "@/lib/orderAreas";
import { useDeliveryProgress } from "@/lib/deliveryProgress";
import { isDeliveredStatus } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  FileDown,
  Archive,
  ListChecks,
  Paperclip,
  SearchX,
  UserRound,
  X,
} from "lucide-react";
import type { Client, Order } from "@/types";
import { EmptyState } from "@/components/ui/empty-state";

const PAGE_SIZE = 20;
const ALL = "all";

/** Filtros tal como los edita la pantalla (fechas "yyyy-MM-dd" del input). */
interface HistoryFilterState {
  /** Origen (sólo matriz): Matriz / sucursales / una sucursal. En la URL: `?origen=`. */
  origin?: OrderOrigin;
  clientId?: number;
  area?: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: HistoryFilterState = { origin: undefined, clientId: undefined, area: undefined, from: "", to: "" };

/** Pasa las fechas del input a instantes: desde el inicio del día hasta su final, en hora local. */
function toHistoryQuery(f: HistoryFilterState): OrderHistoryFilters {
  return {
    ...originParams(f.origin),
    clientId: f.clientId,
    area: f.area,
    deliveryFrom: f.from ? new Date(`${f.from}T00:00:00`).toISOString() : undefined,
    deliveryTo: f.to ? new Date(`${f.to}T23:59:59.999`).toISOString() : undefined,
  };
}

function ClientFilter({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value?: number;
  onChange: (id?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);
  const sorted = useMemo(
    () => [...clients].sort((a, b) => getClientName(a).localeCompare(getClientName(b), "es")),
    [clients]
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filtrar por cliente"
          className="w-full justify-between font-normal sm:w-56"
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
            <CommandItem
              value="Todos los clientes"
              onSelect={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Todos los clientes
            </CommandItem>
            {sorted.map((client) => (
              <CommandItem
                key={client.id}
                value={`${getClientName(client)} ${client.id}`}
                onSelect={() => {
                  onChange(client.id);
                  setOpen(false);
                }}
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
 * Una fila del historial: número, cliente y descripción, áreas, entrega
 * (píldora gris; roja si está por vencer o vencida y no se entregó) y
 * estado. Toda la fila es un botón que abre el detalle del pedido.
 */
function HistoryRow({ order, onOpen }: { order: Order; onOpen: (id: number) => void }) {
  const { timeFormat } = useTimeFormat();
  const delivered = isDeliveredStatus(order.statusId);
  const progress = useDeliveryProgress(order.creationDate, order.deliveryDate);
  const isCritical = !delivered && progress !== null && progress >= 95;
  const assignedName = getAssignedUserName(order.assignedUser);
  const client = getOrderClientName(order);
  const pendingTasks = order.areaTasks?.filter((t) => t.status !== "terminado").length ?? 0;

  return (
    <li>
      <Button
        type="button"
        variant="bare"
        size="bare"
        onClick={() => onOpen(order.id)}
        aria-label={`Ver pedido #${order.id} de ${client}`}
        className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)] items-center sm:grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-4 gap-y-2 rounded-none px-5 py-4 transition-colors hover:bg-muted/50 lg:grid-cols-[3.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_9.5rem]"
      >
        <span className="font-heading text-sm font-semibold tabular-nums">#{order.id}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium">{client}</span>
            <BranchBadge order={order} size="sm" />
          </span>
          <span className="block truncate text-xs text-muted-foreground">{order.description}</span>
        </span>
        <span className="col-start-2 flex sm:col-start-auto sm:justify-end lg:order-last">
          <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
        </span>
        <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:col-span-2 lg:col-span-1 lg:col-start-auto">
          {orderAreaTags(order).map((area) => {
            const AreaIcon = getAreaIcon(area);
            return (
              <span
                key={area}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80"
              >
                {AreaIcon && <AreaIcon className="h-3 w-3" aria-hidden />}
                {getAreaLabel(area)}
              </span>
            );
          })}
          {order.hasClientResourceFile && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Tiene archivos del cliente adjuntos">
              <Paperclip className="h-3 w-3" aria-hidden />
              Adjunto
            </span>
          )}
          {pendingTasks > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
              title={`${pendingTasks} tarea${pendingTasks === 1 ? "" : "s"} de área pendiente${pendingTasks === 1 ? "" : "s"}`}
            >
              <ListChecks className="h-3 w-3" aria-hidden />
              {pendingTasks}
            </span>
          )}
          {assignedName && (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={`Asignado a ${assignedName}`}>
              <UserRound className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{assignedName}</span>
            </span>
          )}
        </span>
        <span className="col-start-2 sm:col-span-2 lg:col-span-1 lg:col-start-auto">
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
              isCritical
                ? "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate tabular-nums">{formatDeliveryDate(order.deliveryDate, timeFormat)}</span>
          </span>
        </span>
      </Button>
    </li>
  );
}

/**
 * Historial completo de pedidos: TODOS los pedidos de la empresa, sin la
 * ventana de retención que oculta los entregados viejos del tablero en vivo
 * (`/dashboard/orders`). Es un registro para consultar, así que se lee como
 * lista sobre una tarjeta blanca; el detalle abre el mismo `OrderDetailDialog`.
 */
const HistorialPage = () => {
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [filters, setFilters] = useState<HistoryFilterState>(EMPTY_FILTERS);
  const query = useMemo(() => toHistoryQuery(filters), [filters]);
  const { orders: fetched, meta, isPending, isError, refetch, isFetching } = useOrderHistoryList(
    page,
    PAGE_SIZE,
    query
  );
  // El backend filtra por origen; esto sólo cubre una respuesta sin filtrar.
  const orders = useMemo(() => fetched.filter((o) => matchesOrigin(o, filters.origin)), [fetched, filters.origin]);
  const { data: clients } = useEntityList<Client>("clients");
  const hasFilters = Boolean(filters.clientId || filters.area || filters.from || filters.to || filters.origin);

  // El origen se recuerda en la URL (`?origen=`), como los filtros de Pedidos.
  useEffect(() => {
    const origin = parseOrigin(new URLSearchParams(window.location.search).get(ORIGIN_URL_PARAM));
    if (origin) setFilters((prev) => ({ ...prev, origin }));
  }, []);
  const updateFilters = (patch: Partial<HistoryFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    if ("origin" in patch) {
      try {
        const url = new URL(window.location.href);
        if (patch.origin) url.searchParams.set(ORIGIN_URL_PARAM, patch.origin);
        else url.searchParams.delete(ORIGIN_URL_PARAM);
        window.history.replaceState(null, "", url.toString());
      } catch {
        // Sin acceso a la URL el filtro sigue funcionando en memoria.
      }
    }
  };
  const { canManageOperations } = usePermissions();
  const token = useAuthToken();

  const totalPages = meta?.totalPages ?? 1;

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      await downloadOrdersExport(token, {});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo exportar el CSV."
      );
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Title title="Historial de pedidos" />
        {canManageOperations && (
          <Button variant="outline" onClick={handleExportCsv} disabled={isExportingCsv}>
            <FileDown className="h-4 w-4" />
            {isExportingCsv ? "Exportando…" : "Exportar CSV"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros del historial">
        <ClientFilter clients={clients} value={filters.clientId} onChange={(clientId) => updateFilters({ clientId })} />
        <OriginFilter value={filters.origin} onChange={(origin) => updateFilters({ origin })} />
        <Select
          value={filters.area ?? ALL}
          onValueChange={(v) => updateFilters({ area: v === ALL ? undefined : v })}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por área">
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
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Entrega desde
          <Input
            type="date"
            className="w-40"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => updateFilters({ from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Entrega hasta
          <Input
            type="date"
            className="w-40"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => updateFilters({ to: e.target.value })}
          />
        </label>
        {hasFilters && (
          <Button type="button" variant="ghost" onClick={() => updateFilters(EMPTY_FILTERS)}>
            <X className="h-4 w-4" aria-hidden />
            Limpiar filtros
          </Button>
        )}
      </div>

      {isPending ? (
        <Card className="divide-y divide-border/60">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : orders.length === 0 && hasFilters ? (
        <EmptyState
          icon={SearchX}
          title="Sin pedidos con estos filtros"
          description="Prueba con otro cliente, área o rango de fechas."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="El historial todavía está en blanco"
          description="En cuanto se entregue el primer pedido, va a quedar registrado aquí para siempre."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div
              className="hidden grid-cols-[3.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_9.5rem] gap-x-4 border-b border-border/60 px-5 py-3 text-label lg:grid"
              aria-hidden
            >
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Áreas</span>
              <span>Entrega</span>
              <span className="text-right">Estado</span>
            </div>
            <ul className={cn("divide-y divide-border/60", isFetching && "opacity-60")}>
              {orders.map((order) => (
                <HistoryRow key={order.id} order={order} onOpen={setOpenOrderId} />
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-meta tabular-nums">
              {meta ? `Página ${meta.page} de ${meta.totalPages} · ${meta.total} pedidos` : null}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
};

export default HistorialPage;
