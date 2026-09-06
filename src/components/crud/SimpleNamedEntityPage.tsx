"use client";

import React from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { CrudPage, type CrudColumnsArgs } from "@/components/crud/CrudPage";
import { RowActions } from "@/components/crud/RowActions";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntityKey } from "@/lib/queryKeys";
import type { NamedEntity } from "@/types";

/**
 * Pantalla CRUD para entidades que sólo tienen `id` + `name` (ej. roles).
 * Es un preset de `CrudPage`.
 */

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
});

const fields: FieldConfig[] = [{ name: "name", label: "Nombre" }];

const columns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<NamedEntity>): ColumnDef<NamedEntity>[] => [
  { accessorKey: "name", header: "Nombre" },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => (
      <RowActions
        canEdit={canEdit}
        onEdit={() => onEdit(row.original)}
        onDelete={() => onDelete(row.original.id)}
      />
    ),
  },
];

interface SimpleNamedEntityPageProps {
  entity: EntityKey;
  title: string;
  createLabel: string;
  allowedRoles: string[];
  hideTitle?: boolean;
}

export function SimpleNamedEntityPage({
  entity,
  title,
  createLabel,
  allowedRoles,
  hideTitle,
}: SimpleNamedEntityPageProps) {
  const { roles, isAdmin } = usePermissions();
  const canEdit = isAdmin || roles.some((r) => allowedRoles.includes(r));

  return (
    <CrudPage<NamedEntity>
      entity={entity}
      title={title}
      createLabel={createLabel}
      canEdit={canEdit}
      fields={fields}
      schema={schema}
      columns={columns}
      initialValues={(editing) => (editing ? { name: editing.name } : {})}
      hideTitle={hideTitle}
    />
  );
}
