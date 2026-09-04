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

  const canEdit = session?.user?.role === "admin" || session?.user?.role === "recepcion";

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

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este cliente?")) return;
    try {
      await remove(id);
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
    }
  };

  const columns = getColumns({ onEdit: handleEdit, onDelete: handleDelete, canEdit });

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
