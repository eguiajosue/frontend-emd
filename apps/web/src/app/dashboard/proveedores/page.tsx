"use client";

import { z } from "zod";
import { Truck } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import { CrudPage, type CrudFilterConfig } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { Supplier } from "@/types";
import { getSupplierColumns } from "./components/supplierColumns";

const SUPPLIER_LOCATION_OPTIONS = [
  { value: "nacional", label: "Nacional" },
  { value: "local", label: "Local" },
  { value: "internacional", label: "Internacional" },
];

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  location: z.enum(["nacional", "local", "internacional"], {
    errorMap: () => ({ message: "Elige un alcance para el proveedor" }),
  }),
});

const supplierFilters: CrudFilterConfig<Supplier>[] = [
  {
    key: "location",
    label: "Ubicación",
    allLabel: "Todas las ubicaciones",
    options: SUPPLIER_LOCATION_OPTIONS,
    matches: (item, value) => item.location === value,
  },
];

const supplierFields: FieldConfig[] = [
  { name: "name", label: "Nombre" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Teléfono" },
  { name: "website", label: "Web" },
  {
    name: "location",
    label: "Ubicación",
    type: "select",
    valueType: "string",
    options: SUPPLIER_LOCATION_OPTIONS,
  },
];

/**
 * Catálogo de Proveedores, en su propia sección (antes era una pestaña
 * dentro de Materiales). Se eligen como proveedor preferido de un material
 * y en cada línea de la hoja de materiales de un pedido.
 */
export default function ProveedoresPage() {
  const { canManageOperations } = usePermissions();

  return (
    <PageContainer className="space-y-4">
      <PageHeader title="Proveedores" icon={Truck} description="Quién te surte cada material, con su contacto y alcance." />
      <CrudPage<Supplier>
        entity="suppliers"
        title="Proveedores"
        createLabel="Nuevo Proveedor"
        canEdit={canManageOperations}
        fields={supplierFields}
        schema={supplierSchema}
        columns={getSupplierColumns}
        search={{ placeholder: "Buscar proveedor..." }}
        filters={supplierFilters}
        emptyMessage="Ningún proveedor registrado por ahora"
        emptyDescription="Los proveedores se eligen al dar de alta un material y al armar la hoja de materiales de un pedido."
        emptyIcon={Truck}
        deleteDescription="Esta acción eliminará al proveedor de forma permanente."
        dialogTitle={(editing) => (editing ? "Editar Proveedor" : "Nuevo Proveedor")}
        hideTitle
        initialValues={(editing) =>
          editing
            ? {
                name: editing.name,
                email: editing.email ?? "",
                phone: editing.phone ?? "",
                website: editing.website ?? "",
                location: editing.location,
              }
            : {}
        }
      />
    </PageContainer>
  );
}
