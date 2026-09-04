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
import { getColumns, InventoryTransaction } from "./components/columns";
import { Product } from "../products/components/columns";

const schema = z.object({
  productId: z.number({ required_error: "El producto es requerido" }),
  quantityChange: z.number({ required_error: "La cantidad es requerida" }),
  transactionDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const InventoryTransactionsPage = () => {
  const { data: session } = useSession();
  const { data, loading, create, update, remove } = useCrud<InventoryTransaction>(
    "inventory-transactions"
  );
  const { data: products } = useCrud<Product>("products");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryTransaction | null>(null);

  const role = session?.user?.role;
  const canEdit = role === "admin" || role === "taller";

  const fields: FieldConfig[] = useMemo(
    () => [
      {
        name: "productId",
        label: "Producto",
        type: "select",
        options: products.map((p) => ({
          value: p.id,
          label: p.code || `Producto #${p.id}`,
        })),
      },
      { name: "quantityChange", label: "Cambio de Cantidad (+ entrada / - salida)", type: "number" },
      { name: "transactionDate", label: "Fecha", type: "date" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
    [products]
  );

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (transaction: InventoryTransaction) => {
    setEditing(transaction);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este movimiento?")) return;
    try {
      await remove(id);
    } catch (error) {
      console.error("Error al eliminar movimiento de inventario:", error);
    }
  };

  const columns = getColumns({ onEdit: handleEdit, onDelete: handleDelete, canEdit });

  return (
    <div className="p-0 w-full">
      <div className="flex items-center justify-between">
        <Title title="Movimientos de Inventario" />
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Movimiento
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
          title={editing ? "Editar Movimiento" : "Nuevo Movimiento"}
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

export default InventoryTransactionsPage;
