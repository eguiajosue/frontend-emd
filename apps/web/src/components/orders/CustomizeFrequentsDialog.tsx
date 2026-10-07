"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Loader2, Plus, X } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api";
import { normalizeProductKey } from "@/lib/createOrderForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderProductPreset } from "@/types";

/** Largo permitido del nombre de un producto nuevo. */
export const PRESET_NAME_MIN = 1;
export const PRESET_NAME_MAX = 80;

/** Nombre limpio para guardar: sin espacios de más. */
export function cleanPresetName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Error de validación del nombre de un producto nuevo, o `null` si es válido. */
export function validatePresetName(raw: string): string | null {
  const name = cleanPresetName(raw);
  if (name.length < PRESET_NAME_MIN) return "Escribe el nombre del producto.";
  if (name.length > PRESET_NAME_MAX) return `Máximo ${PRESET_NAME_MAX} caracteres.`;
  return null;
}

/** Cuántos frecuentes se muestran cuando el usuario no eligió los suyos. */
export const DEFAULT_FREQUENTS_LIMIT = 10;

/**
 * Frecuentes que ve este usuario: los que eligió, en su orden (ignorando los
 * que ya no existen en el catálogo), o los primeros del catálogo si nunca los
 * personalizó.
 */
export function resolveFrequents(
  presets: OrderProductPreset[],
  customIds: number[] | null | undefined
): OrderProductPreset[] {
  if (!customIds) return presets.slice(0, DEFAULT_FREQUENTS_LIMIT);
  const byId = new Map(presets.map((p) => [p.id, p]));
  return customIds.map((id) => byId.get(id)).filter((p): p is OrderProductPreset => !!p);
}

interface CustomizeFrequentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: OrderProductPreset[];
  /** Frecuentes que el usuario ve hoy (ya resueltos). */
  current: OrderProductPreset[];
  /** `null` vuelve al orden por defecto. */
  onSave: (ids: number[] | null) => Promise<unknown>;
  /**
   * Crea un producto nuevo en el catálogo (`POST /order-product-presets`,
   * idempotente) y devuelve el preset. Sin esto no se ofrece "Producto nuevo".
   */
  onCreatePreset?: (name: string) => Promise<OrderProductPreset>;
}

/**
 * Cada usuario arma y ordena sus propios frecuentes del alta de pedido; lo que
 * cambia uno no afecta a los demás (se guarda en sus preferencias).
 */
export function CustomizeFrequentsDialog({
  open,
  onOpenChange,
  presets,
  current,
  onSave,
  onCreatePreset,
}: CustomizeFrequentsDialogProps) {
  const [ids, setIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Productos creados desde este diálogo: el catálogo (`presets`) tarda un
  // refetch en traerlos y no deben desaparecer de la lista mientras tanto.
  const [created, setCreated] = useState<OrderProductPreset[]>([]);

  useEffect(() => {
    if (!open) return;
    setIds(current.map((p) => p.id));
    setSaving(false);
    setNewName("");
    setNewError(null);
    setCreated([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const catalog = useMemo(() => {
    const known = new Set(presets.map((p) => p.id));
    return [...presets, ...created.filter((p) => !known.has(p.id))];
  }, [presets, created]);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const chosen = ids.map((id) => byId.get(id)).filter((p): p is OrderProductPreset => !!p);
  const available = catalog.filter((p) => !ids.includes(p.id));

  const addNew = async () => {
    if (!onCreatePreset || creating) return;
    const invalid = validatePresetName(newName);
    if (invalid) {
      setNewError(invalid);
      return;
    }
    const name = cleanPresetName(newName);
    // Sin duplicados: ignora mayúsculas, acentos y espacios de más. Si ya está
    // en el catálogo sólo se agrega a MIS frecuentes.
    const existing = catalog.find((p) => normalizeProductKey(p.name) === normalizeProductKey(name));
    if (existing) {
      if (ids.includes(existing.id)) {
        setNewError(`«${existing.name}» ya está en tus frecuentes.`);
        return;
      }
      setIds((prev) => [...prev, existing.id]);
      setNewName("");
      setNewError(null);
      return;
    }
    setCreating(true);
    setNewError(null);
    try {
      const preset = await onCreatePreset(name);
      setCreated((prev) => [...prev, preset]);
      setIds((prev) => (prev.includes(preset.id) ? prev : [...prev, preset.id]));
      setNewName("");
    } catch (error) {
      setNewError(getErrorMessage(error, "No se pudo crear el producto."));
    } finally {
      setCreating(false);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setIds((prev) => arrayMove(prev, prev.indexOf(Number(active.id)), prev.indexOf(Number(over.id))));
  };

  const save = async (value: number[] | null) => {
    setSaving(true);
    try {
      await onSave(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mis frecuentes</DialogTitle>
          <DialogDescription>Arrastra para ordenarlos. Solo cambian para ti.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          {chosen.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes frecuentes. Agrega algunos abajo.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5" aria-label="Frecuentes elegidos">
                  {chosen.map((preset) => (
                    <SortableFrequent
                      key={preset.id}
                      preset={preset}
                      onRemove={() => setIds((prev) => prev.filter((id) => id !== preset.id))}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {onCreatePreset && (
            <div className="space-y-1.5">
              <label htmlFor="frequent-new-product" className="text-label">
                Producto nuevo
              </label>
              <div className="flex gap-2">
                <Input
                  id="frequent-new-product"
                  value={newName}
                  placeholder="Ej. Playera polo"
                  autoComplete="off"
                  aria-invalid={newError ? true : undefined}
                  aria-describedby={newError ? "frequent-new-product-error" : undefined}
                  disabled={creating}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    // Sin esto el Enter burbujea (por el portal) al formulario del pedido.
                    e.preventDefault();
                    e.stopPropagation();
                    void addNew();
                  }}
                />
                <Button type="button" variant="outline" disabled={creating} onClick={() => void addNew()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                  Agregar
                </Button>
              </div>
              {newError && (
                <p id="frequent-new-product-error" role="alert" className="text-sm text-destructive">
                  {newError}
                </p>
              )}
            </div>
          )}

          {available.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-label">Agregar del catálogo</p>
              <div className="flex flex-wrap gap-2">
                {available.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    aria-label={`Agregar ${preset.name} a frecuentes`}
                    onClick={() => setIds((prev) => [...prev, preset.id])}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => save(null)}>
            Restablecer
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => save(ids)}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableFrequent({ preset, onRemove }: { preset: OrderProductPreset; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preset.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 ${isDragging ? "z-10 shadow-md" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={`Mover ${preset.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">{preset.name}</span>
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Quitar ${preset.name}`} onClick={onRemove}>
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}
