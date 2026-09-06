"use client";

import React, { useState } from "react";
import { z } from "zod";
import Title from "@/components/Title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudPage } from "@/components/crud/CrudPage";
import { SimpleNamedEntityPage } from "@/components/crud/SimpleNamedEntityPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import type { Role, User } from "@/types";
import { getUserColumns } from "@/app/dashboard/users/components/columns";

// Debe coincidir exactamente con la política de contraseñas del backend
// (POST/PATCH /users): mínimo 8 caracteres, al menos una mayúscula y un número.
const PASSWORD_HELP_TEXT = "Mínimo 8 caracteres, con al menos una mayúscula y un número.";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[0-9]/, "Debe incluir un número");

const createSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().or(z.literal("")),
  username: z.string().min(1, "El usuario es requerido"),
  password: passwordSchema,
  roleIds: z.array(z.number()).min(1, "Selecciona al menos un rol"),
});

// Al editar, la contraseña es opcional (solo se envía si se quiere cambiar),
// pero si se ingresa algo debe cumplir la misma política que el backend.
const editSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().or(z.literal("")),
  username: z.string().min(1, "El usuario es requerido"),
  password: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || passwordSchema.safeParse(v).success, {
      message: "Mínimo 8 caracteres, con una mayúscula y un número",
    }),
  roleIds: z.array(z.number()).min(1, "Selecciona al menos un rol"),
});

function initialTabFromUrl(): "usuarios" | "roles" {
  if (typeof window === "undefined") return "usuarios";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "roles" ? "roles" : "usuarios";
}

/**
 * Pantalla unificada de "Usuarios": pestañas Usuarios / Roles (antes dos
 * pantallas separadas en /dashboard/users y /dashboard/roles).
 */
const UsuariosPage = () => {
  const { canManageUsers } = usePermissions();
  const { data: roles } = useEntityList<Role>("roles");
  const [tab, setTab] = useState<"usuarios" | "roles">(initialTabFromUrl);

  const userFields = (editing: User | null): FieldConfig[] => [
    { name: "firstName", label: "Nombre" },
    { name: "lastName", label: "Apellido" },
    { name: "username", label: "Usuario" },
    {
      name: "password",
      label: editing ? "Nueva Contraseña (opcional)" : "Contraseña",
      type: "text",
      helpText: PASSWORD_HELP_TEXT,
    },
    {
      name: "roleIds",
      label: "Roles",
      type: "multiselect",
      options: roles.map((r) => ({ value: r.id, label: r.name })),
    },
  ];

  const handleTabChange = (value: string) => {
    const next = value === "roles" ? "roles" : "usuarios";
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-4">
      <Title title="Usuarios" />
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <CrudPage<User>
            entity="users"
            title="Usuarios"
            createLabel="Nuevo Usuario"
            canEdit={canManageUsers}
            fields={userFields}
            schema={(editing) => (editing ? editSchema : createSchema)}
            columns={getUserColumns}
            emptyMessage="No hay usuarios aún."
            deleteDescription="Esta acción eliminará al usuario de forma permanente."
            dialogTitle={(editing) => (editing ? "Editar Usuario" : "Nuevo Usuario")}
            hideTitle
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
        </TabsContent>

        <TabsContent value="roles">
          <SimpleNamedEntityPage
            entity="roles"
            title="Roles"
            createLabel="Nuevo Rol"
            allowedRoles={["admin"]}
            hideTitle
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsuariosPage;
