"use client";

import { useEffect, useState } from "react";
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Search, SearchX, UserRound, X } from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/feedback/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { BranchBadge } from "@/components/orders/BranchBadge";
import { useBranchOrderHistory } from "@/hooks/useBranchOrderHistory";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { formatDate, getOrderClientName } from "@/lib/format";
import {
  BRANCH_HISTORY_PAGE_SIZE,
  EMPTY_BRANCH_HISTORY_FILTERS,
  hasBranchHistoryFilters,
  type BranchHistoryFilters,
} from "@/lib/branchOrderHistory";
import { cn } from "@/lib/utils";
import type { Order, Status } from "@/types";

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

/** Misma rejilla en el encabezado y en cada fila (escritorio). */
const DESKTOP_GRID =
  "lg:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_9.5rem_6.5rem]";

/**
 * Una fila del historial: # · cliente · descripción · empleado · estado ·
 * fecha. En móvil se apila en una tarjeta; toda la fila abre el detalle.
 */
function BranchHistoryRow({ order, onOpen }: { order: Order; onOpen: (id: number) => void }) {
  const client = getOrderClientName(order);
  const employee = order.branchEmployee?.name;

  return (
    <li>
      <Button
        type="button"
        variant="bare"
        size="bare"
        onClick={() => onOpen(order.id)}
        aria-label={`Ver pedido #${order.id} de ${client}`}
        className={cn(
          "grid w-full grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 rounded-none px-5 py-4 text-left transition-colors hover:bg-muted/50 sm:grid-cols-[3rem_minmax(0,1fr)_auto]",
          DESKTOP_GRID
        )}
      >
        <span className="font-heading text-sm font-semibold tabular-nums">#{order.id}</span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{client}</span>
          <BranchBadge order={order} size="sm" />
        </span>
        <span className="col-start-2 min-w-0 truncate text-sm text-muted-foreground sm:col-span-2 lg:col-span-1 lg:col-start-auto">
          {order.description || "—"}
        </span>
        <span
          className="col-start-2 inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-1 lg:col-start-auto"
          title={employee ? `Lo levantó ${employee}` : undefined}
        >
          <UserRound className="h-3 w-3 shrink-0 lg:hidden" aria-hidden />
          <span className="truncate">{employee ?? "—"}</span>
        </span>
        <span className="col-start-2 flex sm:col-span-2 lg:col-span-1 lg:col-start-auto">
          <StatusBadge statusId={order.statusId} statusName={order.status?.name} />
        </span>
        <span className="col-start-2 inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground sm:col-span-2 lg:col-span-1 lg:col-start-auto">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 lg:hidden" aria-hidden />
          {formatDate(order.creationDate)}
        </span>
      </Button>
    </li>
  );
}

/**
 * Historial de la sucursal: TODOS sus pedidos (activos y terminados), del más
 * nuevo al más viejo, con búsqueda, estado y rango de fechas de creación. El
 * clic abre el detalle en modo lectura (`OrderDetailDialog`).
 */
const BranchHistoryPage = () => {
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [filters, setFilters] = useState<BranchHistoryFilters>(EMPTY_BRANCH_HISTORY_FILTERS);
  // Lo que se escribe en el buscador; a `filters.q` pasa con un respiro para no pedir en cada tecla.
  const [searchText, setSearchText] = useState("");
  const { data: statuses } = useEntityList<Status>("statuses", { staleTime: CATALOG_STALE_TIME });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.q === searchText ? prev : { ...prev, q: searchText }));
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { orders, total, totalPages, isPending, isError, isFetching, refetch } = useBranchOrderHistory(
    filters,
    page
  );
  const hasFilters = hasBranchHistoryFilters(filters) || searchText.trim() !== "";

  const updateFilters = (patch: Partial<BranchHistoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const clearFilters = () => {
    setSearchText("");
    setFilters(EMPTY_BRANCH_HISTORY_FILTERS);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Title title="Historial de pedidos" />

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros del historial">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            placeholder="Buscar cliente, descripción o #…"
            aria-label="Buscar en el historial"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Select
          value={filters.statusId ? String(filters.statusId) : ALL}
          onValueChange={(v) => updateFilters({ statusId: v === ALL ? undefined : Number(v) })}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground sm:flex-none">
          Creado desde
          <Input
            type="date"
            className="sm:w-40"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => updateFilters({ from: e.target.value })}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground sm:flex-none">
          Creado hasta
          <Input
            type="date"
            className="sm:w-40"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => updateFilters({ to: e.target.value })}
          />
        </label>
        {hasFilters && (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden />
            Limpiar filtros
          </Button>
        )}
      </div>

      {isPending ? (
        <Card className="divide-y divide-border/60" aria-busy="true" aria-label="Cargando historial">
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
          description="Prueba con otra búsqueda, estado o rango de fechas."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Todavía no hay pedidos"
          description="Aquí van a aparecer todos los pedidos que levante tu sucursal, activos y terminados."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div
              className={cn("hidden gap-x-4 border-b border-border/60 px-5 py-3 text-label lg:grid", DESKTOP_GRID)}
              aria-hidden
            >
              <span>#</span>
              <span>Cliente</span>
              <span>Descripción</span>
              <span>Levantó</span>
              <span>Estado</span>
              <span>Fecha</span>
            </div>
            <ul className={cn("divide-y divide-border/60", isFetching && "opacity-60")}>
              {orders.map((order) => (
                <BranchHistoryRow key={order.id} order={order} onOpen={setOpenOrderId} />
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-meta tabular-nums" data-testid="branch-history-summary">
              Página {Math.min(page, totalPages)} de {totalPages} · {total} {total === 1 ? "pedido" : "pedidos"}
              {total > BRANCH_HISTORY_PAGE_SIZE ? ` (${BRANCH_HISTORY_PAGE_SIZE} por página)` : ""}
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

export default BranchHistoryPage;
