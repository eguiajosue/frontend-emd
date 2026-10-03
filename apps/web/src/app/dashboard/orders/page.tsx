"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import {
  CardsSkeleton,
  ErrorState,
} from "@/components/feedback/states";
import {
  useOrders,
  downloadOrdersExport,
  useBulkChangeOrderStatus,
  useMoveOrderStatus,
} from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import { CATALOG_STALE_TIME, useEntityList, useAuthToken } from "@/hooks/useEntity";
import { useAppSettings } from "@/hooks/useSettings";
import {
  statusMap,
  statusOptions,
  isDeliveredStatus,
  isFinishedStatus,
} from "@/lib/orderStatus";
import {
  buildDesignColumns,
  buildProductionColumns,
  effectiveProductionStatusId,
  splitDesignAndProduction,
} from "@/lib/kanbanColumns";
import { formatDate, formatDeliveryDate, getAssignedUserName, getOrderClientName } from "@/lib/format";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { isOverdue } from "@/lib/deliveryProgress";
import { KanbanBoard } from "@/components/orders/KanbanBoard";
import { OrdersJobWall } from "@/components/orders/OrdersJobWall";
import { motion } from "framer-motion";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { CreateOrderDialog } from "@/components/orders/CreateOrderDialog";
import {
  OrdersFilterBar,
  EMPTY_ORDERS_FILTERS,
  type OrdersFilters,
} from "@/components/orders/OrdersFilterBar";
import type { Client, Order, OrderProductPreset, Status, User } from "@/types";
import {
  ChevronDown,
  FileDown,
  FilterX,
  LayoutGrid,
  List,
  PackageSearch,
  PartyPopper,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ordersScreenCopy } from "@/lib/orderScreen";
import { TASKS_URL } from "@/lib/navMenu";
import { ORDER_TONE_PARAM, parseToneParam } from "@/lib/orderViews";
import type { DeadlineTone } from "@/lib/orderDeadline";

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
  const createdByMe = params.get("createdByMe");
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
    createdByMe: createdByMe === "1",
  };
}

function filtersToUrlParams(filters: OrdersFilters, tone: DeadlineTone | null = null): URLSearchParams {
  const params = new URLSearchParams();
  if (tone) params.set(ORDER_TONE_PARAM, tone);
  if (filters.clientId !== undefined) params.set("clientId", String(filters.clientId));
  if (filters.statusIds.length > 0) params.set("statusIds", filters.statusIds.join(","));
  if (filters.dateRange?.from) params.set("deliveryFrom", filters.dateRange.from.toISOString().slice(0, 10));
  if (filters.dateRange?.to) params.set("deliveryTo", filters.dateRange.to.toISOString().slice(0, 10));
  if (filters.onlyOverdue) params.set("onlyOverdue", "1");
  if (filters.area) params.set("area", filters.area);
  if (filters.assignedUserId !== undefined) {
    params.set("assignedUserId", filters.assignedUserId === null ? "unassigned" : String(filters.assignedUserId));
  }
  if (filters.createdByMe) params.set("createdByMe", "1");
  return params;
}

/**
 * Escucha la query de Pedidos. Va aparte y dentro de `<Suspense>` porque
 * `useSearchParams` lo exige, y porque la paleta ⌘K y los accesos del menú
 * navegan a `/dashboard/orders?…` estando ya en Pedidos: la página no se
 * vuelve a montar, así que sin escuchar no se enteraba del deep-link.
 */
function OrdersUrlWatcher({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const query = useSearchParams().toString();
  useEffect(() => onChange(new URLSearchParams(query)), [query, onChange]);
  return null;
}

/** Roles que corresponden a un área de producción (Diseño no es un destino). */
const PRODUCTION_ROLES: string[] = PRODUCTION_AREA_OPTIONS.map((a) => a.value);

const VIEW_MODE_KEY = "orders-view-mode";
const CIRCUIT_KEY = "orders-circuit";
type ViewMode = "list" | "grid";

/**
 * Cuál de los dos circuitos del taller se está mirando en cuadrícula. Se ve uno
 * a la vez: apilar los dos tableros dejaba la pantalla como dos dashboards
 * pegados, con el de abajo siempre fuera de vista.
 */
type Circuit = "diseno" | "produccion";

const CIRCUITS: { value: Circuit; label: string }[] = [
  { value: "diseno", label: "Diseño" },
  { value: "produccion", label: "Producción" },
];

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
 * cambio de estado, archivos del cliente) es la misma pantalla para todos.
 */
const WORK_AREA_ROLE_SET = new Set(["diseno", "taller", "dtf", "bordado", "laser", "impresiones"]);

const OrdersPage = () => {
  const { roles, canManageOperations, isSessionLoading, session } = usePermissions();
  // Diseño y Producción no gestionan pedidos: su pantalla es "Tareas
  // asignadas". Un link viejo (notificación, marcador) los lleva ahí.
  const ordersRouter = useRouter();
  const redirectToTasks =
    !isSessionLoading && !canManageOperations && roles.some((r) => WORK_AREA_ROLE_SET.has(r));
  useEffect(() => {
    if (redirectToTasks) ordersRouter.replace(TASKS_URL);
  }, [redirectToTasks, ordersRouter]);
  const currentUserId = session?.user?.id ? Number(session.user.id) : undefined;
  const { timeFormat } = useTimeFormat();
  const { data: orders, isPending, isError, refetch } = useOrders();
  const { data: clients } = useEntityList<Client>("clients");
  const { data: users } = useEntityList<User>("users");
  // Precargado acá (igual que clients/users) para que los chips "Frecuentes"
  // del paso Productos del wizard no arranquen fríos la primera vez que se
  // abre en la sesión.
  useEntityList<OrderProductPreset>("orderProductPresets", { staleTime: CATALOG_STALE_TIME });
  // Catálogo de estados: el tablero de Diseño resuelve sus columnas por nombre
  // contra esto, porque sus ids los siembra el backend y cambian por entorno.
  const { data: statuses } = useEntityList<Status>("statuses", { staleTime: CATALOG_STALE_TIME });
  const { deliveredRetentionHours } = useAppSettings();
  const token = useAuthToken();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Precarga del cliente al reabrir el wizard desde "Crear otro pedido para
  // {cliente}" en el toast de éxito (ver CreateOrderDialog).
  const [createPrefillClient, setCreatePrefillClient] = useState<{
    id?: number;
    label: string;
  } | null>(null);
  const [filters, setFilters] = useState<OrdersFilters>(EMPTY_ORDERS_FILTERS);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>("");
  const [isBulkChanging, setIsBulkChanging] = useState(false);
  const [circuit, setCircuit] = useState<Circuit>("produccion");
  const [tone, setTone] = useState<DeadlineTone | null>(null);
  const [tvOpen, setTvOpen] = useState(false);
  // Lo leen los escritores de URL: filtros y plazo comparten la misma query.
  const filtersRef = useRef(filters);
  const toneRef = useRef(tone);
  filtersRef.current = filters;
  toneRef.current = tone;
  const { bulkChangeStatus } = useBulkChangeOrderStatus();


  useEffect(() => {
    setFilters(filtersFromUrl());
  }, []);

  // Atajo "N": abre "+ Nueva Orden" (sólo si nadie tiene foco en un input/textarea
  // y el usuario puede crear pedidos).
  useEffect(() => {
    if (!canManageOperations) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      setCreateOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canManageOperations]);

  const writeUrl = useCallback((nextFilters: OrdersFilters, nextTone: DeadlineTone | null) => {
    try {
      const query = filtersToUrlParams(nextFilters, nextTone).toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState(null, "", url);
    } catch {
      // Si no se puede tocar la URL (SSR, etc.), el filtro sigue funcionando en memoria.
    }
  }, []);

  const updateFilters = useCallback(
    (next: OrdersFilters) => {
      setFilters(next);
      writeUrl(next, toneRef.current);
    },
    [writeUrl]
  );

  const updateTone = useCallback(
    (next: DeadlineTone | null) => {
      setTone(next);
      writeUrl(filtersRef.current, next);
    },
    [writeUrl]
  );

  // Deep-links (paleta ⌘K, atajo "N", accesos del menú, links compartidos):
  //  - ?plazo=<tono> filtra el muro; sólo existe en Lista, así que se cambia
  //    a ella sin pisar la preferencia guardada.
  //  - ?tv=1 abre el modo TV; ?new=1 abre "+ Nueva Orden";
  //    ?openOrderId=<id> abre ese detalle. Quedan en la URL mientras eso siga
  //    abierto y se limpian al cerrarlo: la transición de ruta puede montar la
  //    página dos veces, y si se limpiaban al leerlos el segundo montaje ya no
  //    los veía (el modo TV o el detalle se abrían y se cerraban solos).
  //  - ?clientId=<id> fija el filtro de cliente ("Ver sus pedidos").
  const forcedListRef = useRef(false);
  const handleUrlParams = useCallback((params: URLSearchParams) => {
    const nextTone = parseToneParam(params.get(ORDER_TONE_PARAM));
    setTone(nextTone);
    const tv = params.get("tv") === "1";
    if (nextTone || tv) {
      forcedListRef.current = true;
      setViewMode("list");
    }
    if (tv) setTvOpen(true);
    if (params.get("new") === "1") setCreateOpen(true);
    const openId = Number(params.get("openOrderId"));
    if (openId) setOpenOrderId(openId);
    const clientId = Number(params.get("clientId"));
    if (clientId && clientId !== filtersRef.current.clientId) {
      setFilters({ ...filtersRef.current, clientId });
    }
  }, []);

  const clearUrlParam = useCallback((key: string) => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(key)) return;
      url.searchParams.delete(key);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Sin acceso a la URL: no afecta a la pantalla.
    }
  }, []);

  const handleTvOpenChange = useCallback(
    (open: boolean) => {
      setTvOpen(open);
      if (!open) clearUrlParam("tv");
    },
    [clearUrlParam]
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      // El watcher de URL corre antes (es hijo): si ya forzó "Lista" por un
      // `?plazo=`/`?tv=1`, la preferencia guardada no lo pisa.
      if (forcedListRef.current) return;
      if (stored === "list" || stored === "grid") setViewMode(stored);
    } catch {
      // Sin acceso a localStorage (modo privado, etc.): se queda en "list".
    }
  }, []);

  // El circuito elegido se recuerda igual que el modo de vista: quien trabaja
  // sobre todo en un área no quiere volver a elegirlo en cada visita.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CIRCUIT_KEY);
      if (stored === "diseno" || stored === "produccion") setCircuit(stored);
    } catch {
      // Sin acceso a localStorage: se queda en "produccion".
    }
  }, []);

  const updateCircuit = useCallback((next: Circuit) => {
    setCircuit(next);
    try {
      localStorage.setItem(CIRCUIT_KEY, next);
    } catch {
      // No pasa nada si no se puede persistir.
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
  const closeDetail = useCallback(() => {
    setOpenOrderId(null);
    clearUrlParam("openOrderId");
  }, [clearUrlParam]);

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
      if (filters.createdByMe && order.userId !== currentUserId) {
        return false;
      }
      return true;
    });
  }, [orders, filters, retentionMs, currentUserId]);

  const handleExport = async () => {
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
      "Fecha de Entrega": formatDeliveryDate(order.deliveryDate, timeFormat),
    }));

    try {
      // `xlsx` se carga de forma dinámica (solo al exportar) para no meter
      // esta librería pesada en el bundle inicial de la pantalla de pedidos.
      const XLSX = await import("xlsx");

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `pedidos-${today}.xlsx`);
    } catch {
      // Import dinámico: puede fallar por red (chunk viejo tras un deploy,
      // conexión inestable). Antes era un import estático, siempre disponible.
      toast.error("No se pudo generar el Excel. Probá de nuevo.");
    }
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

  // La selección de bulk actions se limpia cuando cambian los filtros o la
  // vista: evita aplicar un cambio de estado a pedidos que ya no están a la
  // vista.
  useEffect(() => {
    setSelectedIds([]);
  }, [filters, viewMode]);

  const toggleSelected = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((existingId) => existingId !== id)
    );
  }, []);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? visibleOrders.map((o) => o.id) : []);
    },
    [visibleOrders]
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleBulkStatusChange = async () => {
    if (!bulkTargetStatus || selectedIds.length === 0) return;
    const newStatusId = Number(bulkTargetStatus);
    const targetOrders = visibleOrders.filter(
      (o) => selectedIds.includes(o.id) && o.statusId !== newStatusId
    );
    if (targetOrders.length === 0) {
      toast.info("Los pedidos seleccionados ya están en ese estado.");
      return;
    }
    setIsBulkChanging(true);
    // Selección y filtro de estado se limpian de una: la UI ya se actualiza
    // en forma optimista (ver useBulkChangeOrderStatus), no hace falta
    // esperar a que las requests resuelvan para que la barra desaparezca.
    clearSelection();
    setBulkTargetStatus("");
    try {
      const { succeeded: ok, failed } = await bulkChangeStatus(targetOrders, newStatusId);
      if (ok > 0) {
        toast.success(
          `${ok} pedido${ok === 1 ? "" : "s"} actualizado${ok === 1 ? "" : "s"} a "${statusMap[newStatusId] ?? newStatusId}".`
        );
      }
      if (failed > 0) {
        toast.error(`No se pudo actualizar ${failed} pedido${failed === 1 ? "" : "s"}.`);
      }
    } finally {
      setIsBulkChanging(false);
    }
  };

  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    visibleOrders.length > 0 && selectedIds.length === visibleOrders.length;

  // Áreas de producción del usuario: definen cuál tarea de área manda al
  // ubicar un pedido en el tablero de producción (ver
  // `effectiveProductionStatusId`).
  const viewerAreas = useMemo(
    () => roles.filter((role) => PRODUCTION_ROLES.includes(role)),
    [roles]
  );

  // Mover un pedido escribe donde el tablero lee: las tareas de área cuando
  // las hay, el estado del pedido cuando no.
  const moveActor = useMemo(
    () => ({ areas: viewerAreas, isManager: canManageOperations }),
    [viewerAreas, canManageOperations]
  );
  const { move: moveOrderStatus, canMove: canApplyMove } =
    useMoveOrderStatus(moveActor);

  // Tableros de la vista cuadrícula. Diseño y producción son DOS circuitos con
  // etapas distintas, así que son dos tableros con sus propias columnas fijas.
  // Un pedido "autorizado" queda archivado para Diseño (sale de su tablero) y
  // arranca el trabajo del área que lo produce. Archivar es sólo eso: el pedido
  // se sigue viendo en esta misma pantalla en vista Lista y en la búsqueda.
  const { designBoard, productionBoard } = useMemo(() => {
    const { design, production } = splitDesignAndProduction(visibleOrders);
    return {
      designBoard: { orders: design, columns: buildDesignColumns(design, statuses) },
      productionBoard: {
        orders: production,
        columns: buildProductionColumns(production, viewerAreas),
      },
    };
  }, [visibleOrders, statuses, viewerAreas]);

  // Drag & drop: soltar una tarjeta en otra columna cambia el estado del
  // pedido. Se permite sólo hacia estados que ese rol puede fijar (mismo
  // criterio que los botones de estado del detalle) y sólo en producción: el
  // circuito de Diseño se avanza con sus propias acciones de autorización.
  const myStageIds = useMemo(() => statusIdsForRoles(roles), [roles]);
  const canMoveOrder = useCallback(
    (order: Order, statusId: number) => {
      if (effectiveProductionStatusId(order, viewerAreas) === statusId) return false;
      if (!canManageOperations && !myStageIds.includes(statusId)) return false;
      // El destino tiene que ser aplicable de verdad: si el pedido se ubica
      // por su tarea de área, hace falta una tarea inequívoca que mover.
      return canApplyMove(order, statusId);
    },
    [canApplyMove, canManageOperations, myStageIds, viewerAreas]
  );
  const handleMoveOrder = useCallback(
    (order: Order, statusId: number) => {
      void moveOrderStatus(order, statusId);
    },
    [moveOrderStatus]
  );

  // Qué tableros ve este usuario. Un diseñador que además trabaja otra área ve
  // los dos; quien tiene una sola área ve sólo el suyo. Recepción/admin ven
  // ambos porque siguen todo el circuito.
  const worksInDesign = canManageOperations || roles.includes("diseno");
  const worksInProduction =
    canManageOperations ||
    roles.some((r) => PRODUCTION_ROLES.includes(r));
  // Si un pedido en diseño llegó igual (ej. rol mixto mal configurado), el
  // tablero se muestra antes que esconder trabajo. El de producción, en cambio,
  // se muestra sólo a quien produce: desde que un pedido queda "autorizado"
  // pasa a producción, y a un diseñador puro eso le agregaría un tablero entero
  // que no es suyo.
  const showDesignBoard = worksInDesign || designBoard.orders.length > 0;
  const showProductionBoard = worksInProduction;
  const showBothBoards = showDesignBoard && showProductionBoard;
  // Con un solo circuito visible no hay selector: manda el que corresponda.
  const activeCircuit: Circuit = showBothBoards
    ? circuit
    : showDesignBoard
      ? "diseno"
      : "produccion";

  // Pendientes propios: todo lo que este usuario ve y todavía no está
  // terminado ni entregado. Es la cuenta que traía "Mi trabajo".
  const pendingCount = useMemo(
    () =>
      visibleOrders.filter(
        (order) => !isFinishedStatus(effectiveProductionStatusId(order, viewerAreas))
      ).length,
    [visibleOrders, viewerAreas]
  );

  const screenCopy = useMemo(
    () =>
      ordersScreenCopy(roles, {
        canManageOperations,
        pendingCount: canManageOperations ? undefined : pendingCount,
      }),
    [roles, canManageOperations, pendingCount]
  );

  const loading = isPending || isSessionLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Una sola pantalla, dos lecturas: quien administra ve "Pedidos",
              quien ejecuta ve "Tareas asignadas" con su cuenta de pendientes.
              Antes eran dos pantallas distintas para el mismo trabajo. */}
          <Title title={screenCopy.title} description={screenCopy.description} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageOperations && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileDown className="h-4 w-4" />
                  Exportar
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              {/* Dos exportaciones que se usan de vez en cuando no merecen dos
                  botones permanentes al lado del de crear un pedido. */}
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem
                  disabled={loading || visibleOrders.length === 0}
                  onSelect={() => void handleExport()}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-medium">Excel</span>
                  <span className="text-meta">Lo que está a la vista, en tu equipo.</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isExportingCsv}
                  onSelect={() => void handleExportCsv()}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-medium">
                    {isExportingCsv ? "Generando CSV…" : "CSV del servidor"}
                  </span>
                  <span className="text-meta">Mismos filtros, generado por el backend.</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canManageOperations && (
            <Button data-tour="new-order-button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Una sola banda de controles entre el encabezado y el trabajo: modo de
          vista, circuito y filtros. Antes eran tres bloques apilados y el
          tablero empezaba muy abajo. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={viewMode}
          onValueChange={(v) => v && updateViewMode(v as ViewMode)}
          aria-label="Vista"
          className="shrink-0 rounded-full border bg-card p-1"
        >
          <ToggleGroupItem value="list" className="gap-1.5">
            <List aria-hidden /> Lista
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" className="gap-1.5">
            <LayoutGrid aria-hidden /> Cuadrícula
          </ToggleGroupItem>
        </ToggleGroup>

        {viewMode === "grid" && showBothBoards && (
          // `basis-full` en móvil: el grupo del circuito no entra en la misma
          // línea que el de vista y, sin un contenedor propio, se salía del
          // ancho en vez de bajar entero.
          <div className="basis-full sm:basis-auto">
            {/* Un circuito a la vez. Los dos tableros apilados obligaban a
                bajar toda la pantalla para llegar al segundo, y el corte entre
                uno y otro se leía como dos aplicaciones una encima de la otra. */}
            <ToggleGroup
              type="single"
              variant="segmented"
              size="sm"
              value={circuit}
              onValueChange={(v) => v && updateCircuit(v as Circuit)}
              aria-label="Circuito"
              className="inline-flex rounded-full border bg-card p-1"
            >
              {CIRCUITS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="group gap-1.5">
                  {option.label}
                  <span className="text-xs tabular-nums opacity-70">
                    {option.value === "diseno"
                      ? designBoard.orders.length
                      : productionBoard.orders.length}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />

        <OrdersFilterBar
          clients={clients}
          users={users}
          filters={filters}
          onChange={updateFilters}
        />
      </div>

      {loading ? (
        <CardsSkeleton count={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : visibleOrders.length === 0 ? (
        orders.length > 0 ? (
          <EmptyState
            icon={FilterX}
            title="Ningún pedido coincide con estos filtros"
            description="Ajustar o limpiar los filtros para ver el resto de los pedidos."
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
            description="No hay pedidos asignados en este momento. Cuando entre uno nuevo, va a aparecer acá."
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
        <div className="w-full">
          {canManageOperations && selectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border bg-background/95 p-3 shadow-soft-md backdrop-blur"
            >
              <span className="text-sm font-medium">
                {selectedCount} pedido{selectedCount === 1 ? "" : "s"} seleccionado
                {selectedCount === 1 ? "" : "s"}
              </span>
              <Select value={bulkTargetStatus} onValueChange={setBulkTargetStatus}>
                <SelectTrigger className="h-8 w-48 text-sm">
                  <SelectValue placeholder="Cambiar estado a..." />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!bulkTargetStatus || isBulkChanging}
                onClick={handleBulkStatusChange}
              >
                {isBulkChanging ? "Aplicando..." : "Aplicar"}
              </Button>
              {!allVisibleSelected && (
                <Button size="sm" variant="ghost" onClick={() => toggleSelectAll(true)}>
                  Seleccionar los {visibleOrders.length}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Cancelar
              </Button>
            </motion.div>
          )}
          <OrdersJobWall
            orders={visibleOrders}
            timeFormat={timeFormat}
            onOpenOrder={openDetail}
            selectable={canManageOperations}
            selectedIds={selectedIds}
            onSelectedChange={toggleSelected}
            onRefresh={refetch}
            tone={tone}
            onToneChange={updateTone}
            tvOpen={tvOpen}
            onTvOpenChange={handleTvOpenChange}
          />
        </div>
      ) : activeCircuit === "diseno" ? (
        <KanbanBoard columns={designBoard.columns} onOpenOrder={openDetail} />
      ) : (
        <KanbanBoard
          columns={productionBoard.columns}
          onOpenOrder={openDetail}
          onMoveOrder={handleMoveOrder}
          canMoveOrder={canMoveOrder}
        />
      )}

      <Suspense fallback={null}>
        <OrdersUrlWatcher onChange={handleUrlParams} />
      </Suspense>
      <OrderDetailDialog orderId={openOrderId} onClose={closeDetail} />
      <CreateOrderDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          clearUrlParam("new");
          setCreatePrefillClient(null);
        }}
        onCreated={(order) => openDetail(order.id)}
        initialClientId={createPrefillClient?.id}
        initialClientNameOverride={createPrefillClient?.id ? undefined : createPrefillClient?.label}
        onCreateAnother={(clientId, clientNameOverride) => {
          setCreatePrefillClient({ id: clientId, label: clientNameOverride });
          setCreateOpen(true);
        }}
      />
    </div>
  );
};

export default OrdersPage;
