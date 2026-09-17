"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Boxes, Hash, AlignLeft, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrderMaterials } from "@/hooks/useOrderMaterials";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { getErrorMessage } from "@/lib/api";
import { LOCATION_LABELS } from "@/lib/suppliers";
import { AVAILABILITY_OPTIONS } from "@/lib/materialAvailability";
import type { Material, MaterialAvailability, OrderMaterialItem, Supplier } from "@/types";

interface OrderMaterialDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: number;
  /** Presente en modo edición; ausente = alta. */
  item?: OrderMaterialItem | null;
}

/** "PVC 6mm blanco" a partir del material elegido: punto de partida editable. */
function describeMaterial(material: Material): string {
  return [material.name, material.measure, material.color].filter(Boolean).join(" ");
}

/**
 * Alta/edición de UNA línea de la hoja de materiales de un pedido. La
 * Descripción se autocompleta al elegir el Material pero queda libre para
 * editar; el Proveedor arranca en el preferido del material (si tiene) y
 * siempre muestra su ubicación actual, leída en vivo de `Supplier.location`
 * (nunca una copia guardada).
 */
export function OrderMaterialDialog({ open, onClose, orderId, item }: OrderMaterialDialogProps) {
  const { create, update } = useOrderMaterials(orderId);
  const { data: materials } = useEntityList<Material>("materials", { enabled: open });
  const { data: suppliers } = useEntityList<Supplier>("suppliers", {
    enabled: open,
    staleTime: CATALOG_STALE_TIME,
  });
  const isEditing = Boolean(item);

  const [materialId, setMaterialId] = useState<number | undefined>(undefined);
  const [quantity, setQuantity] = useState<string>("1");
  const [description, setDescription] = useState("");
  const [supplierId, setSupplierId] = useState<number | undefined>(undefined);
  const [availability, setAvailability] = useState<MaterialAvailability>("disponible");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [materialError, setMaterialError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMaterialId(item?.materialId ?? undefined);
    setQuantity(item ? String(item.quantity) : "1");
    setDescription(item?.description ?? "");
    setSupplierId(item?.supplierId ?? undefined);
    setAvailability(item?.availability ?? "disponible");
    setDescriptionTouched(Boolean(item));
    setMaterialError(undefined);
  }, [open, item]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId]
  );

  const handleMaterialChange = (id: number) => {
    setMaterialId(id);
    if (materialError) setMaterialError(undefined);
    const material = materials.find((m) => m.id === id);
    if (!material) return;
    if (!descriptionTouched) setDescription(describeMaterial(material));
    if (material.supplierId) setSupplierId(material.supplierId);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!materialId) {
      setMaterialError("Elegí un material");
      return;
    }
    const qty = Number(quantity);
    const resolvedQuantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const resolvedDescription =
      description.trim() || describeMaterial(materials.find((m) => m.id === materialId)!);

    setSubmitting(true);
    try {
      if (isEditing) {
        // El material de una línea no se reasigna: sólo se puede dar de baja
        // y agregar una nueva. `UpdateOrderMaterialItemDto` no acepta
        // `materialId`, así que no se manda en la edición.
        await update.mutateAsync({
          itemId: item!.id,
          payload: {
            quantity: resolvedQuantity,
            description: resolvedDescription,
            supplierId,
            availability,
          },
        });
        toast.success("Línea actualizada");
      } else {
        await create.mutateAsync({
          materialId,
          quantity: resolvedQuantity,
          description: resolvedDescription,
          supplierId,
          availability,
        });
        toast.success("Material agregado a la hoja");
      }
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el material."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar material" : "Agregar material"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <FormField
            label="Material"
            htmlFor="om-material"
            icon={Boxes}
            required
            error={materialError}
            hint={isEditing ? "El material de una línea ya cargada no se puede cambiar." : undefined}
          >
            <Select
              value={materialId ? String(materialId) : ""}
              onValueChange={(v) => handleMaterialChange(Number(v))}
              disabled={isEditing}
            >
              <SelectTrigger id="om-material" className="h-11 sm:h-9" aria-invalid={Boolean(materialError)}>
                <SelectValue placeholder="Elegí un material..." />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={String(material.id)}>
                    {material.name}
                    {material.measure ? ` · ${material.measure}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Cantidad" htmlFor="om-quantity" icon={Hash}>
            <Input
              id="om-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>

          <FormField label="Descripción" htmlFor="om-description" icon={AlignLeft}>
            <Textarea
              id="om-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescriptionTouched(true);
              }}
              placeholder='Ej. "Hoja de PVC de 6mm"'
              rows={2}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>

          <FormField label="Proveedor" htmlFor="om-supplier" icon={Truck}>
            <Select
              value={supplierId ? String(supplierId) : "ninguno"}
              onValueChange={(v) => setSupplierId(v === "ninguno" ? undefined : Number(v))}
            >
              <SelectTrigger id="om-supplier" className="h-11 sm:h-9">
                <SelectValue placeholder="Sin proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin proveedor</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSupplier && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Ubicación: <span className="font-medium">{LOCATION_LABELS[selectedSupplier.location]}</span>
              </p>
            )}
          </FormField>

          <FormField label="Disponibilidad" htmlFor="om-availability" icon={Boxes}>
            <Select
              value={availability}
              onValueChange={(v) => setAvailability(v as MaterialAvailability)}
            >
              <SelectTrigger id="om-availability" className="h-11 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
