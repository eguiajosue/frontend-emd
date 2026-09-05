"use client";

import React, { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import { EntityFormDialog, FieldConfig } from "@/components/crud/EntityFormDialog";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { getColumns, Client } from "./components/columns";
import { Company } from "../companies/components/columns";

const schema = z.object({
  first_name: z.string().min(1, "El nombre es requerido"),
  last_name: z.string().min(1, "El apellido es requerido"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  companyId: z.number().optional(),
});

const ClientsPage = () => {
  const { data: session } = useSession();
  const { data, loading, create, update, remove } = useCrud<Client>("clients");
  const { data: companies } = useCrud<Company>("companies");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const roles = session?.user?.roles || [];
  const canEdit = roles.includes("admin") || roles.includes("recepcion");

  const fields: FieldConfig[] = useMemo(
    () => [
      { name: "first_name", label: "Nombre" },
      { name: "last_name", label: "Apellido" },
      { name: "phone", label: "Teléfono" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Dirección" },
      {
        name: "companyId",
        label: "Empresa",
        type: "select",
        options: companies.map((c) => ({ value: c.id, label: c.name })),
      },
    ],
    [companies]
  );

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditing(client);
    setDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteId === null) return;
    try {
      await remove(deleteId);
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
    } finally {
      setDeleteId(null);
    }
  };

  const columns = getColumns({ onEdit: handleEdit, onDelete: setDeleteId, canEdit });

  return (
    <div className="p-0 w-full">
      <div className="flex items-center justify-between">
        <Title title="Lista de Clientes" />
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay clientes aún.
        </div>
      ) : (
        <div className="w-full overflow-auto mt-4">
          <DataTable columns={columns} data={data} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
        description="Esta acción eliminará al cliente de forma permanente."
      />

      {dialogOpen && (
        <EntityFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={editing ? "Editar Cliente" : "Nuevo Cliente"}
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
};

export default ClientsPage;
