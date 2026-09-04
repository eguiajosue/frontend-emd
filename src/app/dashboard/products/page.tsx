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
import { getColumns, Product } from "./components/columns";
import { NamedEntity } from "@/components/crud/SimpleNamedEntityPage";

const schema = z.object({
  productTypeId: z.number({ required_error: "El tipo es requerido" }),
  colorId: z.number().optional(),
  sizeId: z.number().optional(),
  code: z.string().optional().or(z.literal("")),
  quantity: z.number({ required_error: "La cantidad es requerida" }),
});

const ProductsPage = () => {
  const { data: session } = useSession();
  const { data, loading, create, update, remove } = useCrud<Product>("products");
  const { data: productTypes } = useCrud<NamedEntity>("product-types");
  const { data: colors } = useCrud<NamedEntity>("colors");
  const { data: sizes } = useCrud<NamedEntity>("sizes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const role = session?.user?.role;
  const canEdit = role === "admin" || role === "taller";

  const fields: FieldConfig[] = useMemo(
    () => [
      {
        name: "productTypeId",
        label: "Tipo de Producto",
        type: "select",
        options: productTypes.map((p) => ({ value: p.id, label: p.name })),
      },
      {
        name: "colorId",
        label: "Color",
        type: "select",
        options: colors.map((c) => ({ value: c.id, label: c.name })),
      },
      {
        name: "sizeId",
        label: "Tamaño",
        type: "select",
        options: sizes.map((s) => ({ value: s.id, label: s.name })),
      },
      { name: "code", label: "Código" },
      { name: "quantity", label: "Cantidad", type: "number" },
    ],
    [productTypes, colors, sizes]
  );

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    try {
      await remove(id);
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  };

  const columns = getColumns({ onEdit: handleEdit, onDelete: handleDelete, canEdit });

  return (
    <div className="p-0 w-full">
      <div className="flex items-center justify-between">
        <Title title="Lista de Productos" />
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
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
          title={editing ? "Editar Producto" : "Nuevo Producto"}
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

export default ProductsPage;
