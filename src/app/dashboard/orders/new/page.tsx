"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { z } from "zod";
import Title from "@/components/Title";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import { Client } from "../../clients/components/columns";
import { Product } from "../../products/components/columns";
import { authFetch, authHeaders, AuthFetchError } from "@/lib/authFetch";

const orderProductSchema = z.object({
  productId: z.number({ required_error: "Selecciona un producto" }),
  quantity: z.number().min(1, "La cantidad debe ser mayor a 0"),
});

const orderSchema = z.object({
  clientId: z.number({ required_error: "El cliente es requerido" }),
  description: z.string().min(1, "La descripción es requerida"),
  deliveryDate: z.string().optional().or(z.literal("")),
  orderProducts: z.array(orderProductSchema).optional(),
});

interface OrderProductRow {
  productId?: number;
  quantity?: number;
}

const NewOrder = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: clients } = useCrud<Client>("clients");
  const { data: products } = useCrud<Product>("products");

  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [rows, setRows] = useState<OrderProductRow[]>([{}]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => setRows((prev) => [...prev, {}]);
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));
  const updateRow = (index: number, field: keyof OrderProductRow, value: number) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmit = async () => {
    const orderProducts = rows.filter((r) => r.productId && r.quantity);

    const parsed = orderSchema.safeParse({
      clientId,
      description,
      deliveryDate,
      orderProducts,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/orders`, {
        method: "POST",
        headers: authHeaders(session?.user?.token),
        body: JSON.stringify({
          clientId: parsed.data.clientId,
          userId: Number(session?.user?.id),
          statusId: 1,
          description: parsed.data.description,
          deliveryDate: parsed.data.deliveryDate || undefined,
          orderProducts: parsed.data.orderProducts,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const order = await res.json();
      toast.success("Pedido creado correctamente");
      router.push(`/dashboard/orders/${order.id}`);
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error("Error al crear el pedido:", error);
      toast.error("Ocurrió un error al crear el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-0 w-full max-w-2xl">
      <Title title="Nuevo Pedido" />

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Cliente</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            value={clientId ?? ""}
            onChange={(e) =>
              setClientId(e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Selecciona un cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
          {errors.clientId && (
            <p className="text-sm text-destructive">{errors.clientId}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Descripción</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Fecha de Entrega</Label>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Productos</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Agregar producto
            </Button>
          </div>
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2 items-center">
              <select
                className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={row.productId ?? ""}
                onChange={(e) =>
                  updateRow(index, "productId", Number(e.target.value))
                }
              >
                <option value="">Selecciona un producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code || `Producto #${p.id}`}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                className="w-24"
                placeholder="Cant."
                value={row.quantity ?? ""}
                onChange={(e) =>
                  updateRow(index, "quantity", Number(e.target.value))
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Guardando..." : "Crear Pedido"}
        </Button>
      </div>
    </div>
  );
};

export default NewOrder;
