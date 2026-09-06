"use client";

import React, { useMemo } from "react";
import { z } from "zod";
import { CrudPage } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import type { Client, Company } from "@/types";
import { getClientColumns } from "./components/columns";

const schema = z.object({
  first_name: z.string().min(1, "El nombre es requerido"),
  last_name: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  companyId: z.number().optional(),
});

const ClientsPage = () => {
  const { canManageOperations } = usePermissions();
  // La lista de empresas viene de la misma cache que /dashboard/companies:
  // si ya se visitó esa pantalla, no se dispara una request nueva.
  const { data: companies } = useEntityList<Company>("companies");

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

  return (
    <CrudPage<Client>
      entity="clients"
      title="Lista de Clientes"
      createLabel="Nuevo Cliente"
      canEdit={canManageOperations}
      fields={fields}
      schema={schema}
      columns={getClientColumns}
      emptyMessage="No hay clientes aún."
      deleteDescription="Esta acción eliminará al cliente de forma permanente."
      dialogTitle={(editing) => (editing ? "Editar Cliente" : "Nuevo Cliente")}
      initialValues={(editing) =>
        editing
          ? {
              first_name: editing.first_name,
              last_name: editing.last_name,
              phone: editing.phone ?? "",
              email: editing.email ?? "",
              address: editing.address ?? "",
              companyId: editing.companyId ?? undefined,
            }
          : {}
      }
    />
  );
};

export default ClientsPage;
