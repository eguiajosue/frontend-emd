"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Loader2 } from "lucide-react";
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
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATALOG_STALE_TIME, useEntityList } from "@/hooks/useEntity";
import { useInventoryMutations } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/api";
import { inventoryAreaLabel } from "@/lib/inventory";
import type { InventoryArea, InventoryItem, Material, Supplier } from "@/types";

/** Unidades frecuentes en el taller; se puede escribir cualquier otra. */
const COMMON_UNITS = [
  "pieza",
  "cono",
  "rollo",
  "litro",
  "mililitro",
  "cartucho",
  "metro",
  "hoja",
  "caja",
  "paquete",
  "kilogramo",
];

/** Categorías sugeridas para arrancar; las que se usen después se suman solas. */
const COMMON_CATEGORIES = [
  "Hilos",
  "Tintas",
  "Estabilizador / entretela",
  "Agujas y refacciones",
  "Film y polvo DTF",
  "Papelería",
  "Empaques",
  "Herramientas",
];

const NONE = "__none";

interface FormState {
  area: InventoryArea | "";
  materialId?: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  color: string;
  brand: string;
  location: string;
  initialQuantity: string;
  minStock: string;
  unitCost: string;
  supplierId?: number;
  notes: string;
}

const toText = (n?: number | null) => (n == null ? "" : String(n));

function initialState(item: InventoryItem | null | undefined, defaultArea: InventoryArea | ""): FormState {
  return {
    area: item?.area ?? defaultArea,
    materialId: item?.materialId ?? undefined,
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    category: item?.category ?? "",
    unit: item?.unit ?? "",
    color: item?.color ?? "",
    brand: item?.brand ?? "",
    location: item?.location ?? "",
    initialQuantity: "",
    minStock: toText(item?.minStock),
    unitCost: toText(item?.unitCost),
    supplierId: item?.supplierId ?? undefined,
    notes: item?.notes ?? "",
  };
}

/** "" = sin valor (null); texto no numérico o negativo = inválido (undefined). */
function parseOptionalNumber(raw: string): number | null | undefined {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

interface InventoryItemDialogProps {
  open: boolean;
  onClose: () => void;
  /** Presente = edición. */
  item?: InventoryItem | null;
  /** Departamentos en los que el usuario puede cargar artículos. */
  areas: InventoryArea[];
  /** Departamento preseleccionado en el alta (la pestaña activa). */
  defaultArea?: InventoryArea;
  /** Categorías ya usadas en el inventario, para sugerirlas. */
  knownCategories: string[];
  knownUnits: string[];
}

/**
 * Alta/edición de un artículo del inventario de un departamento.
 *
 * El vínculo con el catálogo de Materiales es OPCIONAL: sirve cuando la
 * existencia es de algo que también se usa en hojas de materiales (y al
 * elegirlo autocompleta los datos), pero un consumible propio del área —un
 * cono de hilo, una tinta— se carga sin vínculo.
 *
 * El stock no se edita aquí: en el alta se informa el stock inicial (queda en
 * el kardex como primera entrada) y después cambia sólo con movimientos.
 */
export function InventoryItemDialog({
  open,
  onClose,
  item,
  areas,
  defaultArea,
  knownCategories,
  knownUnits,
}: InventoryItemDialogProps) {
  const isEditing = Boolean(item);
  const { create, update } = useInventoryMutations();
  const { data: materials } = useEntityList<Material>("materials", { enabled: open });
  const { data: suppliers } = useEntityList<Supplier>("suppliers", {
    enabled: open,
    staleTime: CATALOG_STALE_TIME,
  });

  const [form, setForm] = useState<FormState>(() => initialState(item, defaultArea ?? areas[0] ?? ""));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialState(item, defaultArea ?? areas[0] ?? ""));
    setErrors({});
    // Sólo al abrir: un refetch de fondo no debe pisar lo que se está cargando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const categoryOptions = useMemo(
    () =>
      [...new Set([...knownCategories, ...COMMON_CATEGORIES])]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((c) => ({ id: c, label: c })),
    [knownCategories]
  );
  const unitOptions = useMemo(
    () => [...new Set([...knownUnits, ...COMMON_UNITS])].map((u) => ({ id: u, label: u })),
    [knownUnits]
  );

  /** Al vincular un material, completa lo que todavía esté vacío. */
  const handleMaterialChange = (raw: string) => {
    if (raw === NONE) {
      set("materialId", undefined);
      return;
    }
    const material = materials.find((m) => m.id === Number(raw));
    if (!material) return;
    setForm((prev) => ({
      ...prev,
      materialId: material.id,
      name: prev.name || [material.name, material.measure].filter(Boolean).join(" "),
      unit: prev.unit || material.unit?.name || "",
      category: prev.category || material.category?.name || "",
      color: prev.color || material.color || "",
      brand: prev.brand || material.brand || "",
      supplierId: prev.supplierId ?? material.supplierId ?? undefined,
      unitCost: prev.unitCost || toText(material.suggestedPrice),
    }));
  };

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!form.area) next.area = "Elige el departamento";
    if (!form.name.trim()) next.name = "El nombre es requerido";
    if (!form.unit.trim()) next.unit = "La unidad es requerida";
    const minStock = parseOptionalNumber(form.minStock);
    const unitCost = parseOptionalNumber(form.unitCost);
    const initialQuantity = parseOptionalNumber(form.initialQuantity);
    if (minStock === undefined) next.minStock = "Debe ser un número mayor o igual a 0";
    if (unitCost === undefined) next.unitCost = "Debe ser un número mayor o igual a 0";
    if (!isEditing && initialQuantity === undefined) {
      next.initialQuantity = "Debe ser un número mayor o igual a 0";
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const payload = {
      area: form.area as InventoryArea,
      name: form.name.trim(),
      unit: form.unit.trim(),
      sku: form.sku.trim(),
      category: form.category.trim(),
      color: form.color.trim(),
      brand: form.brand.trim(),
      location: form.location.trim(),
      notes: form.notes.trim(),
      minStock,
      unitCost,
      materialId: form.materialId ?? null,
      supplierId: form.supplierId ?? null,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await update.mutateAsync({ id: item!.id, payload });
        toast.success("Artículo actualizado");
      } else {
        await create.mutateAsync({ ...payload, initialQuantity: initialQuantity ?? 0 });
        toast.success("Artículo agregado al inventario");
      }
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el artículo."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="sm:max-h-[90vh] sm:max-w-2xl sm:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar artículo" : "Nuevo artículo de inventario"}</DialogTitle>
          <DialogDescription>
            Existencias físicas del departamento. Vincularlo al catálogo de Materiales es opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 pt-1 sm:grid-cols-2">
          <FormField label="Departamento" htmlFor="inv-area" required error={errors.area}>
            <Select value={form.area} onValueChange={(v) => set("area", v as InventoryArea)}>
              <SelectTrigger id="inv-area" aria-invalid={Boolean(errors.area)}>
                <SelectValue placeholder="Elige el departamento..." />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area} value={area}>
                    {inventoryAreaLabel(area)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Material del catálogo"
            htmlFor="inv-material"
            icon={Boxes}
            hint="Opcional. Déjalo vacío para consumibles propios del área (hilos, tintas...)."
          >
            <Select value={form.materialId ? String(form.materialId) : NONE} onValueChange={handleMaterialChange}>
              <SelectTrigger id="inv-material">
                <SelectValue placeholder="No está en el catálogo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-muted-foreground">
                  No está en el catálogo
                </SelectItem>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={String(material.id)}>
                    {material.name}
                    {material.measure ? ` · ${material.measure}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Artículo" htmlFor="inv-name" required error={errors.name} className="sm:col-span-2">
            <Input
              id="inv-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder='Ej. "Hilo poliéster 40 rojo 1147"'
              aria-invalid={Boolean(errors.name)}
            />
          </FormField>

          <FormField label="Categoría" htmlFor="inv-category">
            <CreatableCombobox
              id="inv-category"
              items={categoryOptions}
              customValue={form.category}
              placeholder="Buscar o escribir categoría..."
              onSelectItem={(opt) => set("category", opt.label)}
              onUseCustom={(text) => set("category", text)}
            />
          </FormField>

          <FormField label="Unidad" htmlFor="inv-unit" required error={errors.unit}>
            <CreatableCombobox
              id="inv-unit"
              items={unitOptions}
              customValue={form.unit}
              placeholder="cono, rollo, litro..."
              onSelectItem={(opt) => set("unit", opt.label)}
              onUseCustom={(text) => set("unit", text)}
              invalid={Boolean(errors.unit)}
            />
          </FormField>

          <FormField label="Código / SKU" htmlFor="inv-sku" hint="Único dentro del departamento.">
            <Input id="inv-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </FormField>

          <FormField label="Ubicación" htmlFor="inv-location">
            <Input
              id="inv-location"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder='Ej. "Estante A-3"'
            />
          </FormField>

          <FormField label="Color" htmlFor="inv-color">
            <Input id="inv-color" value={form.color} onChange={(e) => set("color", e.target.value)} />
          </FormField>

          <FormField label="Marca" htmlFor="inv-brand">
            <Input id="inv-brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </FormField>

          {!isEditing && (
            <FormField
              label="Stock inicial"
              htmlFor="inv-initial"
              error={errors.initialQuantity}
              hint="Queda registrado como primera entrada."
            >
              <Input
                id="inv-initial"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={form.initialQuantity}
                onChange={(e) => set("initialQuantity", e.target.value)}
                placeholder="0"
              />
            </FormField>
          )}

          <FormField
            label="Stock mínimo"
            htmlFor="inv-min"
            error={errors.minStock}
            hint="Al llegar a este nivel se avisa para reponer."
          >
            <Input
              id="inv-min"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={form.minStock}
              onChange={(e) => set("minStock", e.target.value)}
            />
          </FormField>

          <FormField label="Costo unitario (MXN)" htmlFor="inv-cost" error={errors.unitCost}>
            <Input
              id="inv-cost"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.unitCost}
              onChange={(e) => set("unitCost", e.target.value)}
            />
          </FormField>

          <FormField label="Proveedor habitual" htmlFor="inv-supplier">
            <Select
              value={form.supplierId ? String(form.supplierId) : NONE}
              onValueChange={(v) => set("supplierId", v === NONE ? undefined : Number(v))}
            >
              <SelectTrigger id="inv-supplier">
                <SelectValue placeholder="Sin proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-muted-foreground">
                  Sin proveedor
                </SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Notas" htmlFor="inv-notes" className="sm:col-span-2">
            <Textarea
              id="inv-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar artículo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
