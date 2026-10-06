"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Boxes } from "lucide-react";
import Title from "@/components/Title";
import { CrudPage, type CrudFilterConfig } from "@/components/crud/CrudPage";
import type { FieldConfig } from "@/components/crud/EntityFormDialog";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { AREA_OPTIONS } from "@/lib/areas";
import type { Material, MaterialCategory, MaterialUnit, Supplier } from "@/types";
import { getMaterialColumns } from "./components/materialColumns";

const materialSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  category: z.string().optional().or(z.literal("")),
  unit: z.string().optional().or(z.literal("")),
  measure: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  brand: z.string().optional().or(z.literal("")),
  supplierId: z.number().optional(),
  areas: z.array(z.string()).optional(),
  suggestedPrice: z.number().min(0, "El precio no puede ser negativo").optional(),
});

/**
 * Catálogo de Materiales/insumos: lo que después se usa para armar la hoja
 * de materiales de un pedido (ver /dashboard/hoja-materiales). Los
 * proveedores tienen su propia sección (/dashboard/proveedores).
 */
export default function MaterialesPage() {
  const { canManageOperations } = usePermissions();
  const router = useRouter();
  // Links viejos a la pestaña de proveedores (?tab=proveedores): ahora es
  // su propia sección.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "proveedores") {
      router.replace("/dashboard/proveedores");
    }
  }, [router]);

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
      {
        name: "suggestedPrice",
        label: "Precio sugerido (MXN)",
        type: "number",
        helpText: "Se copia a cada línea de la hoja de materiales al agregarla.",
      },
    ],
    [categories, units, suppliers]
  );

  const materialFilters: CrudFilterConfig<Material>[] = useMemo(
    () => [
      {
        key: "category",
        label: "Categoría",
        allLabel: "Todas las categorías",
        options: categories.map((c) => ({ value: c.name, label: c.name })),
        matches: (item, value) => item.category?.name === value,
      },
      {
        key: "area",
        label: "Área",
        allLabel: "Todas las áreas",
        options: AREA_OPTIONS.map((a) => ({ value: a.value, label: a.label })),
        matches: (item, value) => item.areas.includes(value),
      },
    ],
    [categories]
  );

  return (
    <div className="space-y-4">
      <Title title="Materiales" />
      <CrudPage<Material>
        entity="materials"
        title="Materiales"
        createLabel="Nuevo Material"
        canEdit={canManageOperations}
        fields={materialFields}
        schema={materialSchema}
        columns={getMaterialColumns}
        search={{ placeholder: "Buscar material..." }}
        filters={materialFilters}
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
                suggestedPrice: editing.suggestedPrice ?? undefined,
              }
            : {}
        }
      />
    </div>
  );
}
