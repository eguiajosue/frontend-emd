"use client";

import React from "react";
import { z } from "zod";
import { CrudPage } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import type { Role, User } from "@/types";
import { getUserColumns } from "./components/columns";

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
  const { canManageUsers } = usePermissions();
  const { data: roles } = useEntityList<Role>("roles");

  const fields = (editing: User | null): FieldConfig[] => [
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
  ];

  return (
    <CrudPage<User>
      entity="users"
      title="Lista de Usuarios"
      createLabel="Nuevo Usuario"
      canEdit={canManageUsers}
      fields={fields}
      schema={(editing) => (editing ? editSchema : createSchema)}
      columns={getUserColumns}
      emptyMessage="No hay usuarios aún."
      deleteDescription="Esta acción eliminará al usuario de forma permanente."
      dialogTitle={(editing) => (editing ? "Editar Usuario" : "Nuevo Usuario")}
      initialValues={(editing) =>
        editing
          ? {
              firstName: editing.firstName,
              lastName: editing.lastName ?? "",
              username: editing.username,
              password: "",
              roleIds: editing.roles?.map((r) => r.id) ?? [],
            }
          : { roleIds: [] }
      }
      toPayload={(values, editing) => {
        // No enviar password vacío al editar (el backend lo trata como PartialType).
        const payload = { ...values };
        if (editing && !payload.password) {
          delete payload.password;
        }
        return payload;
      }}
    />
  );
};

export default UsersPage;
