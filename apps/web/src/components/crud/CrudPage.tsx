"use client";

import React, { useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Search, type LucideIcon } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EntityFormDialog,
  type EntityValues,
  type FieldConfig,
} from "@/components/crud/EntityFormDialog";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { CATALOG_STALE_TIME, useEntityList, useEntityMutations } from "@/hooks/useEntity";
import type { EntityKey } from "@/lib/queryKeys";
import type { BaseEntity } from "@/types";

/**
 * Matcher de búsqueda genérico por defecto: compara el texto tipeado contra
 * todos los valores string/number del objeto, recorriendo un nivel de
 * relaciones anidadas (ej. `material.category.name`, `client.company.name`)
 * y arrays de strings (ej. `material.areas`). Cubre las 4 pantallas que usan
 * `CrudPage` (Materiales/Proveedores/Clientes/Empresas) sin que cada una
 * tenga que declarar sus propios campos buscables.
 */
function defaultSearchMatch(item: unknown, query: string): boolean {
  const check = (value: unknown): boolean => {
    if (value == null) return false;
    if (typeof value === "string" || typeof value === "number") {
      return String(value).toLowerCase().includes(query);
    }
    if (Array.isArray(value)) return value.some(check);
    if (typeof value === "object") return Object.values(value).some(check);
    return false;
  };
  return check(item);
}

export interface CrudSearchConfig<T> {
  placeholder?: string;
  /** Override del matcher genérico, para casos donde conviene ser más específico. */
  predicate?: (item: T, query: string) => boolean;
}

export interface CrudFilterConfig<T> {
  key: string;
  label: string;
  /** Texto de la opción "sin filtrar", ej. "Todas las categorías". */
  allLabel: string;
  options: { value: string; label: string }[];
  matches: (item: T, value: string) => boolean;
}

/**
 * Entidades de bajo cambio que pasan por esta pantalla genérica (roles en
 * Usuarios, proveedores en Materiales): mismo criterio que `CATALOG_STALE_TIME`
 * (ver `hooks/useEntity`), pero aplicado acá porque `CrudPage` no expone hoy
 * un `staleTime` por prop y cada pantalla que la usa pasa sólo `entity`. Las
 * mutaciones ya invalidan la query key en `onSuccess`, así que un alta/edición
 * se sigue viendo al toque; esto sólo evita refetches de background en cada
 * mount de la pestaña. `clients`/`companies`/`users`/`materials` no entran acá:
 * cambian más seguido y deben seguir con el staleTime global de 30s.
 */
const CATALOG_ENTITIES = new Set<EntityKey>(["roles", "suppliers"]);

/**
 * Pantalla CRUD genérica: listado + alta + edición + baja.
 *
 * Consolida la lógica que antes estaba duplicada casi textualmente en
 * clients / companies / users / roles (estado de diálogos, borrado con
 * confirmación, skeletons, estado vacío y manejo de errores).
 * Cada pantalla sólo aporta sus columnas, campos de formulario y schema.
 */

export interface CrudColumnsArgs<T> {
  onEdit: (entity: T) => void;
  onDelete: (id: number) => void;
  canEdit: boolean;
}

export interface CrudPageProps<T extends BaseEntity> {
  entity: EntityKey;
  title: string;
  createLabel: string;
  canEdit: boolean;
  /** Campos del formulario; función para poder variar según si es alta o edición. */
  fields: FieldConfig[] | ((editing: T | null) => FieldConfig[]);
  /** Schema de validación; función para poder relajar reglas al editar. */
  schema: z.ZodTypeAny | ((editing: T | null) => z.ZodTypeAny);
  columns: (args: CrudColumnsArgs<T>) => ColumnDef<T>[];
  emptyMessage?: string;
  /** Descripción secundaria del estado vacío (segunda línea, más chica). */
  emptyDescription?: string;
  /** Ícono ilustrativo del estado vacío; default genérico si no se pasa. */
  emptyIcon?: LucideIcon;
  deleteDescription?: string;
  /** Valores iniciales del formulario al editar (default: la entidad completa). */
  initialValues?: (editing: T | null) => EntityValues;
  /** Transformación del payload antes de enviarlo al backend. */
  toPayload?: (values: EntityValues, editing: T | null) => EntityValues;
  dialogTitle?: (editing: T | null) => string;
  /** Oculta el `<h1>` de título (ej. cuando la pantalla ya lo muestra en una pestaña). */
  hideTitle?: boolean;
  /** `true` = búsqueda con el matcher genérico; un objeto permite personalizar placeholder/predicate. Sin esto, no se muestra el buscador. */
  search?: boolean | CrudSearchConfig<T>;
  /** Filtros adicionales (dropdowns), combinados en AND entre sí y con la búsqueda. */
  filters?: CrudFilterConfig<T>[];
}

export function CrudPage<T extends BaseEntity>({
  entity,
  title,
  createLabel,
  canEdit,
  fields,
  schema,
  columns,
  emptyMessage = "No hay registros aún.",
  emptyDescription,
  emptyIcon,
  deleteDescription,
  initialValues,
  toPayload,
  dialogTitle,
  hideTitle,
  search,
  filters,
}: CrudPageProps<T>) {
  const { data, isPending, isError, refetch } = useEntityList<T>(entity, {
    staleTime: CATALOG_ENTITIES.has(entity) ? CATALOG_STALE_TIME : undefined,
  });
  const { create, update, remove } = useEntityMutations<T, EntityValues>(entity);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const searchConfig = search === true ? {} : search || undefined;
  const hasSearch = Boolean(searchConfig);
  const hasFilters = Boolean(filters && filters.length > 0);

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) + Object.values(filterValues).filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery("");
    setFilterValues({});
  };

  const filteredData = useMemo(() => {
    let result = data;
    const query = searchQuery.trim().toLowerCase();
    if (hasSearch && query) {
      const matcher = searchConfig?.predicate ?? defaultSearchMatch;
      result = result.filter((item) => matcher(item, query));
    }
    if (filters) {
      for (const filter of filters) {
        const value = filterValues[filter.key];
        if (value) {
          result = result.filter((item) => filter.matches(item, value));
        }
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hasSearch, searchQuery, filters, filterValues]);

  // Se congela mientras el diálogo está abierto: si se recalculara en cada
  // render, un refetch en background reiniciaría el formulario a medio cargar.
  const formInitialValues = useMemo(
    () =>
      initialValues ? initialValues(editing) : ((editing as EntityValues) ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, dialogOpen]
  );

  const resolvedFields = typeof fields === "function" ? fields(editing) : fields;
  const resolvedSchema = typeof schema === "function" ? schema(editing) : schema;

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: T) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    // Los errores ya se notifican de forma uniforme desde el MutationCache global.
    await remove(id).catch(() => undefined);
  };

  const tableColumns = columns({
    onEdit: handleEdit,
    onDelete: setDeleteId,
    canEdit,
  });

  return (
    <div className="p-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideTitle && <Title title={title} />}
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> {createLabel}
          </Button>
        )}
      </div>

      {(hasSearch || hasFilters) && !isPending && !isError && data.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {hasSearch && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchConfig?.placeholder ?? "Buscar..."}
                aria-label={searchConfig?.placeholder ?? "Buscar"}
                className="h-9 rounded-full pl-8 text-sm"
              />
            </div>
          )}
          {filters?.map((filter) => (
            <Select
              key={filter.key}
              value={filterValues[filter.key] || "__all__"}
              onValueChange={(v) =>
                setFilterValues((prev) => ({ ...prev, [filter.key]: v === "__all__" ? "" : v }))
              }
            >
              <SelectTrigger className="h-9 w-auto min-w-[9rem] rounded-full text-sm" aria-label={filter.label}>
                <SelectValue placeholder={filter.allLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{filter.allLabel}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-9 rounded-full" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {isPending ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyMessage}
          description={emptyDescription}
          action={canEdit ? { label: createLabel, icon: Plus, onClick: handleCreate } : undefined}
        />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Nada coincide con la búsqueda o los filtros elegidos."
          secondaryAction={{ label: "Limpiar filtros", onClick: clearFilters }}
        />
      ) : (
        <div className="w-full overflow-auto mt-4">
          <DataTable columns={tableColumns} data={filteredData} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
        description={deleteDescription}
      />

      {dialogOpen && (
        <EntityFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={
            dialogTitle
              ? dialogTitle(editing)
              : editing
              ? "Editar"
              : "Nuevo"
          }
          fields={resolvedFields}
          schema={resolvedSchema}
          initialValues={formInitialValues}
          onSubmit={async (values) => {
            const payload = toPayload ? toPayload(values, editing) : values;
            if (editing) {
              await update(editing.id, payload);
            } else {
              await create(payload);
            }
          }}
        />
      )}
    </div>
  );
}
