"use client";

import React, { useMemo, useState } from "react";
import { z } from "zod";
import { Plus } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/feedback/states";
import {
  EntityFormDialog,
  type EntityValues,
  type FieldConfig,
} from "@/components/crud/EntityFormDialog";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import type { EntityKey } from "@/lib/queryKeys";
import type { BaseEntity } from "@/types";

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
  deleteDescription?: string;
  /** Valores iniciales del formulario al editar (default: la entidad completa). */
  initialValues?: (editing: T | null) => EntityValues;
  /** Transformación del payload antes de enviarlo al backend. */
  toPayload?: (values: EntityValues, editing: T | null) => EntityValues;
  dialogTitle?: (editing: T | null) => string;
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
  deleteDescription,
  initialValues,
  toPayload,
  dialogTitle,
}: CrudPageProps<T>) {
  const { data, isPending, isError, refetch } = useEntityList<T>(entity);
  const { create, update, remove } = useEntityMutations<T, EntityValues>(entity);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
      <div className="flex items-center justify-between">
        <Title title={title} />
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> {createLabel}
          </Button>
        )}
      </div>

      {isPending ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="w-full overflow-auto mt-4">
          <DataTable columns={tableColumns} data={data} />
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
