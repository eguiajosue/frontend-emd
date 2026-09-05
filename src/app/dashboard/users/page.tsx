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
import { getColumns, Users, RoleRef } from "./components/columns";
import { isAdminRole } from "@/lib/roleTaskMapping";

const createSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().or(z.literal("")),
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  roleIds: z.array(z.number()).min(1, "Selecciona al menos un rol"),
});

// Al editar, la contraseña es opcional (solo se envía si se quiere cambiar).
const editSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().or(z.literal("")),
  username: z.string().min(1, "El usuario es requerido"),
  password: z
    .string()
    .refine((v) => v === "" || v.length >= 6, {
      message: "La contraseña debe tener al menos 6 caracteres",
    })
    .optional()
    .or(z.literal("")),
  roleIds: z.array(z.number()).min(1, "Selecciona al menos un rol"),
});

const UsersPage = () => {
  const { data: session } = useSession();
  const { data, loading, create, update, remove } = useCrud<Users>("users");
  const { data: roles } = useCrud<RoleRef>("roles");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Users | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const userRoles = session?.user?.roles || [];
  const canEdit = isAdminRole(userRoles);

  const fields: FieldConfig[] = useMemo(
    () => [
      { name: "firstName", label: "Nombre" },
      { name: "lastName", label: "Apellido" },
      { name: "username", label: "Usuario" },
      {
        name: "password",
        label: editing ? "Nueva Contraseña (opcional)" : "Contraseña",
        type: "text",
      },
      {
        name: "roleIds",
        label: "Roles",
        type: "multiselect",
        options: roles.map((r) => ({ value: r.id, label: r.name })),
      },
    ],
    [roles, editing]
  );

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: Users) => {
    setEditing(user);
    setDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteId === null) return;
    try {
      await remove(deleteId);
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
    } finally {
      setDeleteId(null);
    }
  };

  const columns = getColumns({ onEdit: handleEdit, onDelete: setDeleteId, canEdit });

  return (
    <div className="p-0 w-full">
      <div className="flex items-center justify-between">
        <Title title={"Lista de Usuarios"} />
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
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
        description="Esta acción eliminará al usuario de forma permanente."
      />

      {dialogOpen && (
        <EntityFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={editing ? "Editar Usuario" : "Nuevo Usuario"}
          fields={fields}
          schema={editing ? editSchema : createSchema}
          initialValues={
            editing
              ? {
                  firstName: editing.firstName,
                  lastName: editing.lastName,
                  username: editing.username,
                  password: "",
                  roleIds: editing.roles?.map((r) => r.id) || [],
                }
              : { roleIds: [] }
          }
          onSubmit={async (values) => {
            // No enviar password vacío al editar (el backend lo trata como PartialType).
            const payload = { ...values };
            if (editing && !payload.password) {
              delete payload.password;
            }
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
};

export default UsersPage;
