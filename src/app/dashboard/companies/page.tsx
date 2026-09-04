"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import { EntityFormDialog, FieldConfig } from "@/components/crud/EntityFormDialog";
import { getColumns, Company } from "./components/columns";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
});

const fields: FieldConfig[] = [
  { name: "name", label: "Nombre" },
  { name: "phone", label: "Teléfono" },
  { name: "email", label: "Email", type: "email" },
  { name: "address", label: "Dirección" },
  { name: "location", label: "Ubicación" },
];

const CompaniesPage = () => {
  const { data: session } = useSession();
  const { data, loading, create, update, remove } = useCrud<Company>("companies");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const canEdit = session?.user?.role === "admin" || session?.user?.role === "recepcion";

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditing(company);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar esta empresa?")) return;
    try {
      await remove(id);
    } catch (error) {
      console.error("Error al eliminar empresa:", error);
    }
  };

  const columns = getColumns({ onEdit: handleEdit, onDelete: handleDelete, canEdit });

  return (
    <div className="p-0 w-full">
      <div className="flex items-center justify-between">
        <Title title="Lista de Empresas" />
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Empresa
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
          title={editing ? "Editar Empresa" : "Nueva Empresa"}
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

export default CompaniesPage;
