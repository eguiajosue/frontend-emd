"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
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
import { useInventoryMutations } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/api";
import { MOVEMENT_TYPE_META, formatQuantity, projectedBalance } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { InventoryItem, InventoryMovementType } from "@/types";

const TYPES: InventoryMovementType[] = ["ENTRADA", "SALIDA", "AJUSTE"];

const QUANTITY_LABEL: Record<InventoryMovementType, string> = {
  ENTRADA: "Cantidad que entra",
  SALIDA: "Cantidad que sale",
  AJUSTE: "Cantidad contada",
};

const QUANTITY_HINT: Record<InventoryMovementType, string> = {
  ENTRADA: "Compra o reposición.",
  SALIDA: "Consumo, merma o uso en un pedido.",
  AJUSTE: "Lo que hay físicamente en el estante: el stock pasa a ese valor.",
};

interface InventoryMovementDialogProps {
  item: InventoryItem | null;
  /** Tipo con el que abre (el botón que se tocó). */
  initialType?: InventoryMovementType;
  onClose: () => void;
}

/**
 * Registra un movimiento del kardex: entrada, salida o ajuste por conteo
 * físico. Muestra el saldo resultante antes de guardar y no deja registrar
 * una salida mayor a lo que hay (el backend también lo valida).
 */
export function InventoryMovementDialog({ item, initialType = "SALIDA", onClose }: InventoryMovementDialogProps) {
  const { registerMovement } = useInventoryMutations();
  const [type, setType] = useState<InventoryMovementType>(initialType);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!item) return;
    setType(initialType);
    setQuantity("");
    setUnitCost("");
    setOrderId("");
    setNote("");
    setError(undefined);
  }, [item, initialType]);

  if (!item) return null;

  const qty = quantity.trim() === "" ? NaN : Number(quantity);
  const projected = projectedBalance(item.quantity, type, qty);
  const submitting = registerMovement.isPending;

  const handleSubmit = async () => {
    if (projected === null) {
      setError(
        type === "SALIDA" && qty > item.quantity
          ? `No alcanza: hay ${formatQuantity(item.quantity, item.unit)}`
          : "Ingresá una cantidad válida"
      );
      return;
    }
    const parsedOrder = orderId.trim() === "" ? undefined : Number(orderId.replace("#", ""));
    if (parsedOrder !== undefined && (!Number.isInteger(parsedOrder) || parsedOrder <= 0)) {
      setError("El número de pedido no es válido");
      return;
    }
    const parsedCost = unitCost.trim() === "" ? undefined : Number(unitCost);
    if (parsedCost !== undefined && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setError("El costo no es válido");
      return;
    }
    try {
      await registerMovement.mutateAsync({
        id: item.id,
        payload: {
          type,
          quantity: qty,
          note: note.trim() || undefined,
          orderId: type === "SALIDA" ? parsedOrder : undefined,
          unitCost: type === "ENTRADA" ? parsedCost : undefined,
        },
      });
      toast.success(`${MOVEMENT_TYPE_META[type].label} registrada`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo registrar el movimiento."));
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{MOVEMENT_TYPE_META[type].verb}</DialogTitle>
          <DialogDescription>
            {item.name} · hay {formatQuantity(item.quantity, item.unit)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => {
              if (!v) return;
              setType(v as InventoryMovementType);
              setError(undefined);
            }}
            className="grid grid-cols-3 rounded-full bg-muted p-1"
            aria-label="Tipo de movimiento"
          >
            {TYPES.map((t) => (
              <ToggleGroupItem
                key={t}
                value={t}
                className="rounded-full text-sm data-[state=on]:bg-card data-[state=on]:shadow-soft"
              >
                {MOVEMENT_TYPE_META[t].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <FormField label={QUANTITY_LABEL[type]} htmlFor="mov-qty" required error={error} hint={!error ? QUANTITY_HINT[type] : undefined}>
            <Input
              id="mov-qty"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              autoFocus
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError(undefined);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              aria-invalid={Boolean(error)}
            />
          </FormField>

          {type === "ENTRADA" && (
            <FormField
              label="Costo unitario (MXN)"
              htmlFor="mov-cost"
              hint="Opcional. Pasa a ser el costo de referencia del artículo."
            >
              <Input
                id="mov-cost"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder={item.unitCost != null ? String(item.unitCost) : undefined}
              />
            </FormField>
          )}

          {type === "SALIDA" && (
            <FormField label="Pedido" htmlFor="mov-order" hint="Opcional. Imputa el consumo a un pedido.">
              <Input
                id="mov-order"
                inputMode="numeric"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Ej. 1234"
              />
            </FormField>
          )}

          <FormField label="Nota" htmlFor="mov-note">
            <Textarea
              id="mov-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={type === "AJUSTE" ? "Ej. conteo mensual" : undefined}
            />
          </FormField>

          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Stock resultante</span>
            <span className="flex items-center gap-2 font-medium">
              <span className="text-muted-foreground">{formatQuantity(item.quantity)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span
                className={cn(
                  projected === null && "text-muted-foreground",
                  projected !== null &&
                    item.minStock != null &&
                    projected <= item.minStock &&
                    "text-amber-700 dark:text-amber-300",
                  projected === 0 && "text-rose-700 dark:text-rose-300"
                )}
              >
                {projected === null ? "—" : formatQuantity(projected, item.unit)}
              </span>
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
