"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRestockMutations } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/api";
import { MAX_QUANTITY, RESTOCK_URGENCY_LABEL, inventoryAreaLabel } from "@/lib/inventory";
import type { InventoryArea, InventoryItem, RestockRequestUrgency } from "@/types";

interface RestockRequestDialogProps {
  open: boolean;
  /** Artículo del que se avisa; sin él es texto libre. */
  item: InventoryItem | null;
  /** Áreas del usuario (texto libre con varias pide elegir una). */
  areas: InventoryArea[];
  onClose: () => void;
}

/**
 * "Avisar que se acabó / requiere reabasto": con un artículo del inventario o
 * un insumo en texto libre, cantidad y comentario opcionales y urgencia.
 * Recepción recibe la notificación y lo atiende en "Solicitudes de reabasto".
 */
export function RestockRequestDialog({ open, item, areas, onClose }: RestockRequestDialogProps) {
  const { create } = useRestockMutations();
  const [itemName, setItemName] = useState("");
  const [area, setArea] = useState<InventoryArea | "">("");
  const [quantity, setQuantity] = useState("");
  const [comment, setComment] = useState("");
  const [urgency, setUrgency] = useState<RestockRequestUrgency>("NORMAL");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setItemName("");
    setArea(areas.length === 1 ? areas[0] : "");
    setQuantity("");
    setComment("");
    setUrgency(item && item.quantity <= 0 ? "URGENTE" : "NORMAL");
    setError(undefined);
  }, [open, item, areas]);

  if (!open) return null;

  const submitting = create.isPending;

  const handleSubmit = async () => {
    if (!item && !itemName.trim()) {
      setError("Escribe qué insumo hace falta");
      return;
    }
    if (!item && !area) {
      setError("Elige el departamento");
      return;
    }
    const qty = quantity.trim() === "" ? undefined : Number(quantity);
    if (qty !== undefined && (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QUANTITY)) {
      setError(qty !== undefined && qty > MAX_QUANTITY ? `La cantidad máxima es ${MAX_QUANTITY.toLocaleString("es-MX")}` : "La cantidad no es válida");
      return;
    }
    try {
      await create.mutateAsync({
        itemId: item?.id,
        itemName: item ? undefined : itemName.trim(),
        area: item ? undefined : area || undefined,
        quantity: qty,
        comment: comment.trim() || undefined,
        urgency,
      });
      toast.success("Aviso enviado a Recepción");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo enviar el aviso."));
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avisar reabasto</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.name} · hay ${item.quantity} ${item.unit}`
              : "Avisa a Recepción qué insumo se acabó o hace falta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {!item && (
            <FormField label="Insumo" htmlFor="rs-name" required error={error}>
              <Input
                id="rs-name"
                autoFocus
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setError(undefined);
                }}
                placeholder="Ej. Hilo negro 40"
              />
            </FormField>
          )}
          {!item && areas.length > 1 && (
            <FormField label="Departamento" htmlFor="rs-area" required>
              <select
                id="rs-area"
                value={area}
                onChange={(e) => setArea(e.target.value as InventoryArea)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Elige…</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {inventoryAreaLabel(a)}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Urgencia" htmlFor="rs-urgency">
            <ToggleGroup
              type="single"
              value={urgency}
              onValueChange={(v) => v && setUrgency(v as RestockRequestUrgency)}
              className="grid grid-cols-2 rounded-full bg-muted p-1"
              aria-label="Urgencia"
            >
              {(Object.keys(RESTOCK_URGENCY_LABEL) as RestockRequestUrgency[]).map((u) => (
                <ToggleGroupItem
                  key={u}
                  value={u}
                  className="rounded-full text-sm data-[state=on]:bg-card data-[state=on]:shadow-soft"
                >
                  {RESTOCK_URGENCY_LABEL[u]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormField>

          <FormField label="Cantidad sugerida" htmlFor="rs-qty" hint="Opcional.">
            <Input
              id="rs-qty"
              type="number"
              min={0}
              max={MAX_QUANTITY}
              step="any"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </FormField>

          <FormField label="Comentario" htmlFor="rs-comment">
            <Textarea
              id="rs-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej. ya no queda en el estante"
            />
          </FormField>
          {item && error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Enviando..." : "Enviar aviso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
