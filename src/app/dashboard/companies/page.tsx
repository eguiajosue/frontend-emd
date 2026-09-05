"use client";

import React from "react";
import { z } from "zod";
import { CrudPage } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { Company } from "@/types";
import { getCompanyColumns } from "./components/columns";

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
  const { canManageOperations } = usePermissions();

  return (
    <CrudPage<Company>
      entity="companies"
      title="Lista de Empresas"
      createLabel="Nueva Empresa"
      canEdit={canManageOperations}
      fields={fields}
      schema={schema}
      columns={getCompanyColumns}
      emptyMessage="No hay empresas aún."
      deleteDescription="Esta acción eliminará la empresa de forma permanente."
      dialogTitle={(editing) => (editing ? "Editar Empresa" : "Nueva Empresa")}
      initialValues={(editing) =>
        editing
          ? {
              name: editing.name,
              phone: editing.phone ?? "",
              email: editing.email ?? "",
              address: editing.address ?? "",
              location: editing.location ?? "",
            }
          : {}
      }
    />
  );
};

export default CompaniesPage;
