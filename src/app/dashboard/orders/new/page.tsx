"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import Title from "@/components/Title";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import type {
  AuthorizationFileInput,
  Client,
  CreateOrderPayload,
  Order,
  Product,
} from "@/types";

const AUTHORIZATION_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5MB, igual que el límite del backend.
const ALLOWED_AUTHORIZATION_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;

/** Lee un File a `{ data, filename, mimeType }` (base64 sin el prefijo data:...;base64,). */
function readFileAsAuthorizationInput(file: File): Promise<AuthorizationFileInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      resolve({
        data: base64,
        filename: file.name,
        mimeType: file.type as AuthorizationFileInput["mimeType"],
      });
    };
    reader.readAsDataURL(file);
  });
}

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
  const { session } = usePermissions();
  const { data: clients } = useEntityList<Client>("clients");
  const { data: products } = useEntityList<Product>("products");
  const { create } = useEntityMutations<Order, CreateOrderPayload>("orders");

  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [rows, setRows] = useState<OrderProductRow[]>([{}]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [authorizationFile, setAuthorizationFile] = useState<AuthorizationFileInput | null>(null);
  const [authorizationFilePreview, setAuthorizationFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAuthorizationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !ALLOWED_AUTHORIZATION_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_AUTHORIZATION_MIME_TYPES)[number]
      )
    ) {
      toast.error("La hoja de autorización debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > AUTHORIZATION_FILE_MAX_BYTES) {
      toast.error("La hoja de autorización no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsedFile = await readFileAsAuthorizationInput(file);
      setAuthorizationFile(parsedFile);
      setAuthorizationFilePreview(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentá de nuevo.");
    } finally {
      e.target.value = "";
    }
  };

  const removeAuthorizationFile = () => {
    if (authorizationFilePreview) URL.revokeObjectURL(authorizationFilePreview);
    setAuthorizationFile(null);
    setAuthorizationFilePreview(null);
  };

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
      const order = await create({
        clientId: parsed.data.clientId,
        userId: Number(session?.user?.id),
        statusId: 1,
        description: parsed.data.description,
        deliveryDate: parsed.data.deliveryDate || undefined,
        orderProducts: parsed.data.orderProducts,
        authorizationFile: authorizationFile ?? undefined,
      });
      toast.success("Pedido creado correctamente");
      router.push(`/dashboard/orders/${order.id}`);
    } catch {
      // El feedback de error es global (ver src/app/providers.tsx).
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

        <div className="space-y-2">
          <Label>Hoja de Autorización (opcional)</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={handleAuthorizationFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPG o PDF. Máximo 5MB.
          </p>

          {authorizationFile && (
            <div className="flex items-center gap-3 rounded-md border p-2">
              {authorizationFilePreview ? (
                <img
                  src={authorizationFilePreview}
                  alt={authorizationFile.filename}
                  className="h-14 w-14 rounded object-cover"
                />
              ) : (
                <FileText className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{authorizationFile.filename}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" /> Listo para enviar
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeAuthorizationFile}
                aria-label="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Guardando..." : "Crear Pedido"}
        </Button>
      </div>
    </div>
  );
};

export default NewOrder;
