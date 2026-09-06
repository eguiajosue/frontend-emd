"use client";

import React, { useState } from "react";
import { z } from "zod";
import { UserCog } from "lucide-react";
import Title from "@/components/Title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudPage } from "@/components/crud/CrudPage";
import { SimpleNamedEntityPage } from "@/components/crud/SimpleNamedEntityPage";
import type { FieldConfig, EntityValues } from "@/components/crud/EntityFormDialog";
import { useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import type { Role, User } from "@/types";
import { getUserColumns } from "@/app/dashboard/users/components/columns";
import { ADMIN_ROLES as ADMIN_ROLE_NAMES } from "@/lib/roleTaskMapping";

// Debe coincidir exactamente con la política de contraseñas del backend
// (POST/PATCH /users): mínimo 8 caracteres, al menos una mayúscula y un número.
const PASSWORD_HELP_TEXT = "Mínimo 8 caracteres, con al menos una mayúscula y un número.";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[0-9]/, "Debe incluir un número");

// El nombre de usuario ya no se pide para cuentas de persona: el backend lo
// genera automáticamente (primera letra del nombre + apellido, con
// resolución de colisiones) e ignora cualquier valor de `username` que se le
// mande. Para cuentas de área (`isSharedAccount: true`) el backend SÍ espera
// un `username` explícito, ya que no hay nombre+apellido de una sola persona
// del cual derivarlo.
const baseUserFields = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().or(z.literal("")),
  isSharedAccount: z.boolean().optional(),
  username: z.string().optional().or(z.literal("")),
  roleIds: z.array(z.number()).min(1, "Selecciona al menos un rol"),
});

function requireUsernameWhenShared(
  values: z.infer<typeof baseUserFields>,
  ctx: z.RefinementCtx
) {
  if (values.isSharedAccount && !values.username?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El nombre de usuario es requerido para cuentas de área",
      path: ["username"],
    });
  }
}

const createSchema = baseUserFields
  .extend({ password: passwordSchema })
  .superRefine(requireUsernameWhenShared);

// Al editar, la contraseña es opcional (solo se envía si se quiere cambiar),
// pero si se ingresa algo debe cumplir la misma política que el backend.
const editSchema = baseUserFields
  .extend({
    password: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || passwordSchema.safeParse(v).success, {
        message: "Mínimo 8 caracteres, con una mayúscula y un número",
      }),
  })
  .superRefine(requireUsernameWhenShared);

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
  const { canManageUsers, isAdmin } = usePermissions();
  const { data: roles } = useEntityList<Role>("roles");
  const [tab, setTab] = useState<"usuarios" | "roles">(initialTabFromUrl);

  // Quien crea/edita usuarios sin ser admin/superuser no debe poder siquiera
  // ver las opciones de rol "admin"/"superuser" en la lista de checkboxes
  // (defensa en profundidad: el backend igual sólo permite esta pantalla a
  // admin/superuser, pero si en el futuro se abre a otro rol esto ya evita
  // que asignen esos roles desde acá).
  const selectableRoles = isAdmin
    ? roles
    : roles.filter((r) => !ADMIN_ROLE_NAMES.includes(r.name));

  const userFields = (editing: User | null): FieldConfig[] => [
    {
      name: "isSharedAccount",
      label: "Cuenta de área (compartida)",
      type: "switch",
      helpText: "Úsala para cuentas de todo un equipo (ej. taller, dtf, diseño), no de una persona.",
    },
    {
      name: "firstName",
      label: "Nombre para mostrar",
      showIf: (values: EntityValues) => Boolean(values.isSharedAccount),
      helpText: "Ej. Taller, DTF, Diseño — como se verá en pedidos y listados.",
    },
    {
      name: "username",
      label: "Nombre de usuario",
      showIf: (values: EntityValues) => Boolean(values.isSharedAccount),
      helpText: "ej. taller, dtf, diseno — usada por todo el equipo del área para iniciar sesión.",
    },
    {
      name: "firstName",
      label: "Nombre",
      showIf: (values: EntityValues) => !values.isSharedAccount,
    },
    {
      name: "lastName",
      label: "Apellido",
      showIf: (values: EntityValues) => !values.isSharedAccount,
    },
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
      options: selectableRoles.map((r) => ({ value: r.id, label: r.name })),
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
            emptyMessage="Sólo estás vos por acá"
            emptyDescription="Invitá al resto del equipo creando sus cuentas de usuario."
            emptyIcon={UserCog}
            deleteDescription="Esta acción eliminará al usuario de forma permanente."
            dialogTitle={(editing) => (editing ? "Editar Usuario" : "Nuevo Usuario")}
            hideTitle
            initialValues={(editing) =>
              editing
                ? {
                    firstName: editing.firstName,
                    lastName: editing.lastName ?? "",
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
