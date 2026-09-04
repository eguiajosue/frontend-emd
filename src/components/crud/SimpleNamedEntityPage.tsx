"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useCrud } from "@/hooks/useCrud";
import { EntityFormDialog, FieldConfig } from "@/components/crud/EntityFormDialog";
import { RowActions } from "@/components/crud/RowActions";

export type NamedEntity = {
  id: number;
  name: string;
};

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
});

const fields: FieldConfig[] = [{ name: "name", label: "Nombre" }];

interface SimpleNamedEntityPageProps {
  endpoint: string;
  title: string;
  createLabel: string;
  allowedRoles: string[];
}

export function SimpleNamedEntityPage({
  endpoint,
  title,
  createLabel,
  allowedRoles,
}: SimpleNamedEntityPageProps) {
  const { data: session } = useSession();
  const { data, loading, create, update, remove } = useCrud<NamedEntity>(endpoint);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NamedEntity | null>(null);

  const role = session?.user?.role;
  const canEdit = !!role && (role === "admin" || allowedRoles.includes(role));

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (entity: NamedEntity) => {
    setEditing(entity);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este registro?")) return;
    try {
      await remove(id);
    } catch (error) {
      console.error(`Error al eliminar ${endpoint}:`, error);
    }
  };

  const columns: ColumnDef<NamedEntity>[] = [
    { accessorKey: "name", header: "Nombre" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <RowActions
          canEdit={canEdit}
          onEdit={() => handleEdit(row.original)}
          onDelete={() => handleDelete(row.original.id)}
        />
      ),
    },
  ];

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

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
        </div>
      ) : (
        <div className="w-full overflow-auto">
          <DataTable columns={columns} data={data} />
        </div>
      )}

      {dialogOpen && (
        <EntityFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={editing ? "Editar" : "Nuevo"}
          fields={fields}
          schema={schema}
          initialValues={editing ?? {}}
          onSubmit={async (values) => {
            if (editing) {
              await update(editing.id, values);
            } else {
              await create(values);
            }
          }}
        />
      )}
    </div>
  );
}
