"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { Boxes, Truck } from "lucide-react";
import Title from "@/components/Title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudPage } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { AREA_OPTIONS } from "@/lib/areas";
import type { Material, MaterialCategory, MaterialUnit, Supplier } from "@/types";
import { getMaterialColumns } from "./components/materialColumns";
import { getSupplierColumns } from "./components/supplierColumns";

const SUPPLIER_LOCATION_OPTIONS = [
  { value: "nacional", label: "Nacional" },
  { value: "local", label: "Local" },
  { value: "internacional", label: "Internacional" },
];

const materialSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  category: z.string().optional().or(z.literal("")),
  unit: z.string().optional().or(z.literal("")),
  measure: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  brand: z.string().optional().or(z.literal("")),
  supplierId: z.number().optional(),
  areas: z.array(z.string()).optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  location: z.enum(["nacional", "local", "internacional"], {
    errorMap: () => ({ message: "Elegí un alcance para el proveedor" }),
  }),
});

/**
 * Catálogo de Materiales/insumos + Proveedores (pestañas, mismo patrón que
 * "Clientes"/"Empresas"): da de alta lo que después se usa para armar la
 * hoja de materiales de un pedido (ver OrderMaterialsSection).
 */
function initialTabFromUrl(): "materiales" | "proveedores" {
  if (typeof window === "undefined") return "materiales";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "proveedores" ? "proveedores" : "materiales";
}

export default function MaterialesPage() {
  const { canManageOperations } = usePermissions();
  const [tab, setTab] = useState<"materiales" | "proveedores">(initialTabFromUrl);

  const { data: categories } = useEntityList<MaterialCategory>("materialCategories", {
    staleTime: CATALOG_STALE_TIME,
  });
  const { data: units } = useEntityList<MaterialUnit>("materialUnits", {
    staleTime: CATALOG_STALE_TIME,
  });
  const { data: suppliers } = useEntityList<Supplier>("suppliers", {
    staleTime: CATALOG_STALE_TIME,
  });

  const materialFields: FieldConfig[] = useMemo(
    () => [
      { name: "name", label: "Material" },
      {
        name: "category",
        label: "Categoría",
        type: "combobox",
        placeholder: "Buscar o escribir categoría...",
        options: categories.map((c) => ({ value: c.name, label: c.name })),
      },
      {
        name: "unit",
        label: "Unidad de medida",
        type: "combobox",
        placeholder: "Buscar o escribir unidad...",
        options: units.map((u) => ({ value: u.name, label: u.name })),
      },
      { name: "measure", label: "Medida", helpText: 'Ej. "6mm", "3/16 x 1 1/4"' },
      { name: "color", label: "Color" },
      { name: "brand", label: "Marca" },
      {
        name: "supplierId",
        label: "Proveedor preferido",
        type: "select",
        options: suppliers.map((s) => ({ value: s.id, label: s.name })),
      },
      {
        name: "areas",
        label: "Áreas donde se usa",
        type: "multiselect",
        options: AREA_OPTIONS.map((a) => ({ value: a.value, label: a.label })),
      },
    ],
    [categories, units, suppliers]
  );

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

  const handleTabChange = (value: string) => {
    const next = value === "proveedores" ? "proveedores" : "materiales";
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-4">
      <Title title="Materiales" />
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="materiales">Materiales</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="materiales">
          <CrudPage<Material>
            entity="materials"
            title="Materiales"
            createLabel="Nuevo Material"
            canEdit={canManageOperations}
            fields={materialFields}
            schema={materialSchema}
            columns={getMaterialColumns}
            emptyMessage="Todavía no cargaste ningún material"
            emptyDescription="El catálogo de materiales se usa para armar la hoja de materiales de un pedido."
            emptyIcon={Boxes}
            deleteDescription="Esta acción eliminará el material de forma permanente."
            dialogTitle={(editing) => (editing ? "Editar Material" : "Nuevo Material")}
            hideTitle
            initialValues={(editing) =>
              editing
                ? {
                    name: editing.name,
                    category: editing.category?.name ?? "",
                    unit: editing.unit?.name ?? "",
                    measure: editing.measure ?? "",
                    color: editing.color ?? "",
                    brand: editing.brand ?? "",
                    supplierId: editing.supplierId ?? undefined,
                    areas: editing.areas ?? [],
                  }
                : {}
            }
          />
        </TabsContent>

        <TabsContent value="proveedores">
          <CrudPage<Supplier>
            entity="suppliers"
            title="Proveedores"
            createLabel="Nuevo Proveedor"
            canEdit={canManageOperations}
            fields={supplierFields}
            schema={supplierSchema}
            columns={getSupplierColumns}
            emptyMessage="Ningún proveedor registrado por ahora"
            emptyDescription="Los proveedores se eligen al armar la hoja de materiales de un pedido."
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
