"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import {
  CardsSkeleton,
  ErrorState,
  TableSkeleton,
} from "@/components/feedback/states";
import { useOrders, downloadOrdersExport } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityList, useAuthToken } from "@/hooks/useEntity";
import { useAppSettings } from "@/hooks/useSettings";
import { statusMap, isDeliveredStatus } from "@/lib/orderStatus";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDeliveryDate, getAssignedUserName, getOrderClientName } from "@/lib/format";
import { isOverdue } from "@/lib/deliveryProgress";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderQuickStatusChip } from "@/components/orders/OrderQuickStatusChip";
import { motion } from "framer-motion";
import { staggerContainerVariants } from "@/lib/motion";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { CreateOrderDialog } from "@/components/orders/CreateOrderDialog";
import {
  OrdersFilterBar,
  EMPTY_ORDERS_FILTERS,
  type OrdersFilters,
} from "@/components/orders/OrdersFilterBar";
import type { Client, Order, User } from "@/types";
import { ExternalLink, FileDown, LayoutGrid, List, Plus, PackageSearch, FilterX, PartyPopper } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/** Deserializa filtros desde la URL (compartible/recargable), best-effort. */
function filtersFromUrl(): OrdersFilters {
  if (typeof window === "undefined") return EMPTY_ORDERS_FILTERS;
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("clientId");
  const statusIds = params.get("statusIds");
  const from = params.get("deliveryFrom");
  const to = params.get("deliveryTo");
  const onlyOverdue = params.get("onlyOverdue");
  const area = params.get("area");
  const assignedUserId = params.get("assignedUserId");
  return {
    clientId: clientId ? Number(clientId) : undefined,
    statusIds: statusIds ? statusIds.split(",").map(Number).filter((n) => !Number.isNaN(n)) : [],
    dateRange:
      from || to
        ? { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }
        : undefined,
    onlyOverdue: onlyOverdue === "1",
    area: area || undefined,
    assignedUserId:
      assignedUserId === null ? undefined : assignedUserId === "unassigned" ? null : Number(assignedUserId),
  };
}

function filtersToUrlParams(filters: OrdersFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.clientId !== undefined) params.set("clientId", String(filters.clientId));
  if (filters.statusIds.length > 0) params.set("statusIds", filters.statusIds.join(","));
  if (filters.dateRange?.from) params.set("deliveryFrom", filters.dateRange.from.toISOString().slice(0, 10));
  if (filters.dateRange?.to) params.set("deliveryTo", filters.dateRange.to.toISOString().slice(0, 10));
  if (filters.onlyOverdue) params.set("onlyOverdue", "1");
  if (filters.area) params.set("area", filters.area);
  if (filters.assignedUserId !== undefined) {
    params.set("assignedUserId", filters.assignedUserId === null ? "unassigned" : String(filters.assignedUserId));
  }
  return params;
}

const VIEW_MODE_KEY = "orders-view-mode";
type ViewMode = "list" | "grid";

/**
 * Pantalla única de "Pedidos" para toda la app (reemplaza a las antiguas
 * `/dashboard/orders` (tabla + export), `/dashboard/orders/new` (alta aparte)
 * y `/dashboard/estatus-pedidos` (kanban de roles operativos)).
 *
 * El comportamiento cambia sólo por rol vía filtrado de datos:
 *  - admin/superuser/recepcion ven TODOS los pedidos y pueden crear/editar.
 *  - roles operativos (dtf/bordado/diseno/laser/taller/impresiones) ven sólo
 *    los pedidos en su(s) etapa(s) (misma lógica que tenía "Estatus de Pedidos").
 * Todo lo demás (toggle lista/cuadrícula, detalle animado, export a Excel,
 * cambio de estado, hoja de autorización) es la misma pantalla para todos.
 */
const OrdersPage = () => {
  const { roles, canManageOperations, isSessionLoading } = usePermissions();
  const { data: orders, isPending, isError, refetch } = useOrders();
  const { data: clients } = useEntityList<Client>("clients");
  const { data: users } = useEntityList<User>("users");
  const { deliveredRetentionHours } = useAppSettings();
  const token = useAuthToken();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  useEffect(() => {
    setFilters(filtersFromUrl());
    // Deep-links usados por el command palette / atajo "N":
    //  - ?new=1 abre "+ Nueva Orden".
    //  - ?openOrderId=<id> abre el detalle de ese pedido directamente.
    // En ambos casos se limpia el query param usado.
    try {
      const params = new URLSearchParams(window.location.search);
      let changed = false;
      if (params.get("new") === "1") {
        setCreateOpen(true);
        params.delete("new");
        changed = true;
      }
      const openId = params.get("openOrderId");
      if (openId && !Number.isNaN(Number(openId))) {
        setOpenOrderId(Number(openId));
        params.delete("openOrderId");
        changed = true;
      }
      if (changed) {
        const query = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`
        );
      }
    } catch {
      // Sin acceso a la URL: no bloquea el resto de la pantalla.
    }
  }, []);

  // Atajo "N": abre "+ Nueva Orden" (sólo si nadie tiene foco en un input/textarea
  // y el usuario puede crear pedidos).
  useEffect(() => {
    if (!canManageOperations) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      setCreateOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canManageOperations]);

  const updateFilters = useCallback((next: OrdersFilters) => {
    setFilters(next);
    try {
      const params = filtersToUrlParams(next);
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState(null, "", url);
    } catch {
      // Si no se puede tocar la URL (SSR, etc.), el filtro sigue funcionando en memoria.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "list" || stored === "grid") setViewMode(stored);
    } catch {
      // Sin acceso a localStorage (modo privado, etc.): se queda en "list".
    }
  }, []);

  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  const openDetail = useCallback((id: number) => setOpenOrderId(id), []);
  const closeDetail = useCallback(() => setOpenOrderId(null), []);

  // El backend (GET /orders) ya devuelve, para roles operativos, sólo los pedidos
  // que ese usuario debe ver (según su rol, la config. de visibilidad por área y si
  // el pedido está asignado a él). El resto de los filtros (cliente, estatus, fecha
  // de entrega, caducados) se aplican acá encima, sobre ese mismo array.
  const isOperationalRole = !canManageOperations;

  // Pedidos entregados hace más de `deliveredRetentionHours`: se ocultan del
  // tablero en vivo (siguen existiendo en la DB y son visibles en Historial).
  const retentionMs = deliveredRetentionHours * 60 * 60 * 1000;

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (
        isDeliveredStatus(order.statusId) &&
        order.deliveredAt &&
        Date.now() - new Date(order.deliveredAt).getTime() > retentionMs
      ) {
        return false;
      }
      if (filters.clientId !== undefined && order.clientId !== filters.clientId) {
        return false;
      }
      if (filters.statusIds.length > 0 && !filters.statusIds.includes(order.statusId)) {
        return false;
      }
      if (filters.dateRange?.from) {
        if (!order.deliveryDate) return false;
        const delivery = new Date(order.deliveryDate).getTime();
        const from = filters.dateRange.from.getTime();
        const to = (filters.dateRange.to ?? filters.dateRange.from).getTime() + 86_400_000 - 1;
        if (delivery < from || delivery > to) return false;
      }
      if (filters.onlyOverdue) {
        const overdue = isOverdue(order.creationDate, order.deliveryDate);
        const delivered = isDeliveredStatus(order.statusId);
        if (!overdue || delivered) return false;
      }
      if (filters.area && order.area !== filters.area) {
        return false;
      }
      if (filters.assignedUserId !== undefined) {
        if (filters.assignedUserId === null) {
          if (order.assignedUserId != null) return false;
        } else if (order.assignedUserId !== filters.assignedUserId) {
          return false;
        }
      }
      return true;
    });
  }, [orders, filters, retentionMs]);

  const handleExport = () => {
    if (visibleOrders.length === 0) {
      toast.info("No hay pedidos para exportar");
      return;
    }

    const rows = visibleOrders.map((order) => ({
      ID: order.id,
      Cliente: getOrderClientName(order),
      Descripción: order.description,
      Estado: (statusMap[order.statusId] || "desconocido").toUpperCase(),
      "Asignado a": getAssignedUserName(order.assignedUser) ?? "Sin asignar",
      "Fecha de Creación": formatDate(order.creationDate),
      "Fecha de Entrega": formatDeliveryDate(order.deliveryDate),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `pedidos-${today}.xlsx`);
  };

  /**
   * Export server-side vía `GET /orders/export` (CSV), con los mismos filtros
   * activos de esta pantalla. Endpoint nuevo del backend: si todavía no está
   * desplegado (404), se avisa con un toast en vez de romper la pantalla.
   */
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      await downloadOrdersExport(token, {
        clientId: filters.clientId,
        statusIds: filters.statusIds,
        deliveryFrom: filters.dateRange?.from?.toISOString().slice(0, 10),
        deliveryTo: filters.dateRange?.to?.toISOString().slice(0, 10),
        area: filters.area,
        assignedUserId: filters.assignedUserId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo exportar el CSV."
      );
    } finally {
      setIsExportingCsv(false);
    }
  };

  const columns: ColumnDef<Order>[] = useMemo(
    () => [
      { id: "id", header: "Pedido", cell: ({ row }) => `#${row.original.id}` },
      {
        id: "client",
        header: "Cliente",
        cell: ({ row }) => getOrderClientName(row.original),
      },
      { accessorKey: "description", header: "Descripción" },
      {
        id: "status",
        header: "Estado actual",
        cell: ({ row }) => (
          <StatusBadge statusId={row.original.statusId} statusName={row.original.status?.name} />
        ),
      },
      {
        id: "assignedUser",
        header: "Asignado a",
        cell: ({ row }) => getAssignedUserName(row.original.assignedUser) ?? "-",
      },
      {
        id: "deliveryDate",
        header: "Fecha de Entrega",
        cell: ({ row }) => formatDeliveryDate(row.original.deliveryDate),
      },
      {
        id: "changeStatus",
        header: "Avanzar estado",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            <OrderQuickStatusChip order={row.original} />
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openDetail(row.original.id);
            }}
            title="Ver detalle completo"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [openDetail]
  );

  // Columnas de la vista cuadrícula: se agrupa visualmente por estado del pedido
  // usando los datos que ya llegaron filtrados desde el backend (para roles
  // operativos, GET /orders ya sólo trae lo que ese usuario debe ver).
  const gridColumns = useMemo(() => {
    const stageIds = Object.keys(statusMap).map(Number);
    return stageIds
      .slice()
      .sort((a, b) => a - b)
      .map((statusId) => ({
        statusId,
        label: statusMap[statusId] ?? `Estado ${statusId}`,
        orders: visibleOrders.filter((o) => o.statusId === statusId),
      }));
  }, [visibleOrders]);

  const loading = isPending || isSessionLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Title title="Pedidos" />
          <p className="text-muted-foreground">
            {isOperationalRole ? (
              <>
                Pedidos visibles para tu(s) rol(es):{" "}
                <span className="font-medium">
                  {roles.join(", ") || "sin rol asignado"}
                </span>
              </>
            ) : (
              "Todos los pedidos de la empresa."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="gap-1.5"
              onClick={() => updateViewMode("list")}
            >
              <List className="h-4 w-4" /> Lista
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="gap-1.5"
              onClick={() => updateViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" /> Cuadrícula
            </Button>
          </div>

          {canManageOperations && (
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || visibleOrders.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" /> Exportar a Excel
            </Button>
          )}

          {canManageOperations && (
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={isExportingCsv}
              title="Exporta un CSV desde el servidor con los filtros activos"
              className={cn(isExportingCsv && "animate-pulse")}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {isExportingCsv ? "Exportando..." : "Exportar CSV"}
            </Button>
          )}

          {canManageOperations && (
            <Button data-tour="new-order-button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
            </Button>
          )}
        </div>
      </div>

      <OrdersFilterBar clients={clients} users={users} filters={filters} onChange={updateFilters} />

      {loading ? (
        viewMode === "list" ? (
          <TableSkeleton rows={5} />
        ) : (
          <CardsSkeleton count={6} />
        )
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : visibleOrders.length === 0 ? (
        orders.length > 0 ? (
          <EmptyState
            icon={FilterX}
            title="Ningún pedido coincide con estos filtros"
            description="Probá ajustar o limpiar los filtros para ver el resto de los pedidos."
            action={{
              label: "Limpiar filtros",
              icon: FilterX,
              onClick: () => updateFilters(EMPTY_ORDERS_FILTERS),
            }}
          />
        ) : isOperationalRole ? (
          <EmptyState
            icon={PartyPopper}
            title="Sin pendientes por ahora — buen trabajo"
            description="No tenés pedidos asignados en este momento. Cuando entre uno nuevo, va a aparecer acá."
          />
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="Todavía no hay pedidos en el tablero"
            description="El primero está a un click de distancia."
            action={
              canManageOperations
                ? {
                    label: "Nuevo pedido",
                    icon: Plus,
                    onClick: () => setCreateOpen(true),
                  }
                : undefined
            }
          />
        )
      ) : viewMode === "list" ? (
        <div className="w-full overflow-auto">
          <DataTable columns={columns} data={visibleOrders} onRowClick={(o) => openDetail(o.id)} />
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            gridColumns.length <= 1 && "sm:grid-cols-1",
            gridColumns.length === 2 && "sm:grid-cols-2",
            gridColumns.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {gridColumns.map((col) => (
            <div key={col.statusId} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground">{col.orders.length}</span>
              </div>
              {col.orders.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nada por acá todavía
                </p>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={staggerContainerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {col.orders.map((order) => (
                    <OrderCard key={order.id} order={order} onOpen={openDetail} />
                  ))}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={closeDetail} />
      <CreateOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(order) => openDetail(order.id)}
      />
    </div>
  );
};

export default OrdersPage;
