"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  History,
  Loader2,
  Package,
  PackageX,
  Plus,
  Search,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { InventoryItemDialog } from "@/components/inventory/InventoryItemDialog";
import { InventoryMovementDialog } from "@/components/inventory/InventoryMovementDialog";
import { InventoryHistorySheet } from "@/components/inventory/InventoryHistorySheet";
import { InventoryMovementsList } from "@/components/inventory/InventoryMovementsList";
import { useAuthToken } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import {
  downloadInventoryExport,
  useInventoryAreas,
  useInventoryItems,
  useInventoryMovements,
  useInventoryMutations,
} from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/api";
import { formatCurrencyMXN } from "@/lib/format";
import {
  INVENTORY_AREA_OPTIONS,
  STOCK_STATUS_META,
  inventoryAreaLabel,
  sortByUrgency,
  summarizeInventory,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type {
  InventoryArea,
  InventoryItem,
  InventoryMovementType,
  InventoryStockStatus,
} from "@/types";
import { getInventoryColumns } from "./components/inventoryColumns";

const ALL = "__all__";

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "warn" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left shadow-soft transition-colors",
        onClick && "hover:bg-muted/40",
        active && "ring-2 ring-ink/80"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70",
          tone === "warn" && "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
          tone === "danger" && "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300"
        )}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-label">{label}</span>
        <span className="block font-heading text-xl font-semibold leading-tight">{value}</span>
        {hint && <span className="block truncate text-meta">{hint}</span>}
      </span>
    </Comp>
  );
}

/**
 * Inventario por departamento: existencias físicas de cada área (hilos,
 * tintas, consumibles, materiales en estante) con su kardex de entradas,
 * salidas y ajustes.
 *
 * No es el catálogo de Materiales (/dashboard/materiales): ese es la lista con
 * la que se arma la hoja de materiales de un pedido. Un artículo puede estar
 * vinculado a un material del catálogo, pero muchos consumibles sólo existen
 * aquí.
 *
 * Admin/superuser/recepción ven todos los departamentos y son los únicos que
 * crean, editan, borran y mueven stock; cada área sólo consulta el suyo (el
 * backend recorta, ver `GET /inventory/areas`).
 */
export default function InventarioPage() {
  const token = useAuthToken();
  // El inventario es sólo de Recepción y administración (el backend lo hace
  // cumplir igual); las áreas de producción y Diseño no entran.
  const { canManageOperations: canManage, isSessionLoading, roles } = usePermissions();
  const noAccess = !isSessionLoading && roles.length > 0 && !canManage;

  const { data: areas = [], isPending: areasPending } = useInventoryAreas();
  const [area, setArea] = useState<InventoryArea | typeof ALL>(ALL);
  // Con un solo departamento no hay "Todos": se usa directamente el suyo.
  const effectiveArea: InventoryArea | undefined =
    area !== ALL ? area : areas.length === 1 ? areas[0] : undefined;

  const { data: items, isPending, isError, refetch } = useInventoryItems(effectiveArea);
  const movements = useInventoryMovements({ area: effectiveArea, limit: 100 });
  const { remove } = useInventoryMutations();

  const [view, setView] = useState<"stock" | "movements">("stock");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InventoryStockStatus | typeof ALL>(ALL);
  const [category, setCategory] = useState<string>(ALL);

  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [moving, setMoving] = useState<{ item: InventoryItem; type: InventoryMovementType } | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const summary = useMemo(() => summarizeInventory(items), [items]);
  const categories = useMemo(
    () =>
      [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [items]
  );
  const units = useMemo(() => [...new Set(items.map((i) => i.unit))], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortByUrgency(
      items.filter((item) => {
        if (status !== ALL && item.stockStatus !== status) return false;
        if (category !== ALL && item.category !== category) return false;
        if (!q) return true;
        return [item.name, item.sku, item.category, item.color, item.brand, item.location, item.material?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
    );
  }, [items, search, status, category]);

  const activeFilters = (search.trim() ? 1 : 0) + (status !== ALL ? 1 : 0) + (category !== ALL ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setStatus(ALL);
    setCategory(ALL);
  };

  // Al cambiar de departamento, la categoría elegida puede no existir en el nuevo.
  const changeArea = (next: string) => {
    setArea(next as InventoryArea | typeof ALL);
    setCategory(ALL);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const columns = getInventoryColumns({
    showArea: !effectiveArea,
    canManage,
    onMove: (item, type) => setMoving({ item, type }),
    onHistory: setHistoryItem,
    onEdit: (item) => {
      setEditing(item);
      setFormOpen(true);
    },
    onDelete: setDeleting,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadInventoryExport(token, effectiveArea);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo exportar el inventario."));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    await remove.mutateAsync(id).then(
      () => toast.success("Artículo eliminado"),
      () => undefined
    );
  };

  const toggleStatus = (next: InventoryStockStatus) => setStatus((prev) => (prev === next ? ALL : next));

  const scopeLabel = effectiveArea ? inventoryAreaLabel(effectiveArea) : "todos los departamentos";

  if (!areasPending && areas.length === 0) {
    return (
      <div className="space-y-4">
        <Title title="Inventario" />
        <EmptyState
          icon={Warehouse}
          title="No tienes un departamento con inventario"
          description="El inventario se lleva por área. Pide a administración que te asigne a un departamento."
        />
      </div>
    );
  }

  if (noAccess) {
    return (
      <EmptyState
        title="Sin acceso al inventario"
        description="El inventario lo manejan Recepción y administración."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Title title="Inventario" />

      {/* Departamentos */}
      {areas.length > 1 && (
        <Tabs value={area} onValueChange={changeArea}>
          <TabsList className="h-auto max-w-full justify-start rounded-full p-1 sm:h-auto">
            <TabsTrigger value={ALL} className="rounded-full px-4">
              Todos
            </TabsTrigger>
            {INVENTORY_AREA_OPTIONS.filter((opt) => areas.includes(opt.value)).map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="rounded-full px-4">
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Package} label="Artículos" value={String(summary.items)} hint={scopeLabel} />
        <StatTile
          icon={AlertTriangle}
          label="Bajo stock"
          value={String(summary.low)}
          hint="En o bajo el mínimo"
          tone={summary.low > 0 ? "warn" : undefined}
          active={status === "low"}
          onClick={() => {
            setView("stock");
            toggleStatus("low");
          }}
        />
        <StatTile
          icon={PackageX}
          label="Agotados"
          value={String(summary.out)}
          hint="Sin existencia"
          tone={summary.out > 0 ? "danger" : undefined}
          active={status === "out"}
          onClick={() => {
            setView("stock");
            toggleStatus("out");
          }}
        />
        <StatTile
          icon={Wallet}
          label="Valor del inventario"
          value={formatCurrencyMXN(summary.value)}
          hint={summary.withoutCost > 0 ? `${summary.withoutCost} sin costo cargado` : "Existencia × costo"}
        />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList className="rounded-full">
            <TabsTrigger value="stock" className="rounded-full px-4">
              Existencias
            </TabsTrigger>
            <TabsTrigger value="movements" className="rounded-full px-4">
              Movimientos
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              variant="secondary"
              className="h-10 rounded-full px-4"
              onClick={handleExport}
              disabled={exporting || items.length === 0}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar CSV
            </Button>
            {canManage && (
              <Button className="h-10 px-5" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nuevo artículo
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="stock" className="mt-4 space-y-4">
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar artículo, código, color..."
                  aria-label="Buscar en el inventario"
                  className="h-10 rounded-full border-border/60 pl-10 text-sm shadow-soft"
                />
              </div>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger
                  className="h-10 w-auto min-w-[9rem] gap-2 rounded-full border-border/60 px-4 text-sm shadow-soft"
                  aria-label="Estado"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los estados</SelectItem>
                  {(Object.keys(STOCK_STATUS_META) as InventoryStockStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {STOCK_STATUS_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length > 0 && (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger
                    className="h-10 w-auto min-w-[9rem] gap-2 rounded-full border-border/60 px-4 text-sm shadow-soft"
                    aria-label="Categoría"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas las categorías</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="h-10 rounded-full px-4" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}

          {isPending || areasPending ? (
            <TableSkeleton rows={5} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={`Todavía no hay inventario en ${scopeLabel}`}
              description={
                canManage
                  ? "Carga lo que el departamento tiene en estante: conos de hilo, tintas, estabilizador, refacciones o materiales del catálogo."
                  : "Administración o Recepción cargan el inventario del departamento."
              }
              action={canManage ? { label: "Nuevo artículo", icon: Plus, onClick: openCreate } : undefined}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Nada coincide con la búsqueda o los filtros elegidos."
              secondaryAction={{ label: "Limpiar filtros", onClick: clearFilters }}
            />
          ) : (
            <DataTable columns={columns} data={filtered} className="shadow-soft" />
          )}
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          {movements.isPending ? (
            <TableSkeleton rows={5} />
          ) : movements.isError ? (
            <ErrorState onRetry={() => movements.refetch()} />
          ) : (movements.data ?? []).length === 0 ? (
            <EmptyState
              icon={History}
              title="Sin movimientos todavía"
              description="Cada entrada, salida o ajuste queda registrado aquí con quién lo hizo y cuándo."
            />
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card px-4 shadow-soft sm:px-5">
              <InventoryMovementsList movements={movements.data ?? []} showItem />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {formOpen && (
        <InventoryItemDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          item={editing}
          areas={areas}
          defaultArea={effectiveArea}
          knownCategories={categories}
          knownUnits={units}
        />
      )}

      <InventoryMovementDialog
        item={moving?.item ?? null}
        initialType={moving?.type}
        onClose={() => setMoving(null)}
      />

      <InventoryHistorySheet item={historyItem} onClose={() => setHistoryItem(null)} />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={handleDelete}
        title="¿Eliminar artículo?"
        description={
          deleting
            ? `Se borra "${deleting.name}" del inventario de ${inventoryAreaLabel(deleting.area)} junto con todo su historial de movimientos.`
            : undefined
        }
      />
    </div>
  );
}
