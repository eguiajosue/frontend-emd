"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AreaOverview, UpdateAreaPayload } from "@emd/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AreaPreview, ColorPicker, IconPicker, SuggestionInput } from "@/components/areas/AreaPickers";
import { StageEditor } from "@/components/areas/StageEditor";
import { CapacityFields, FieldEditor, MachineEditor } from "@/components/areas/AreaConfigEditors";
import { useAreaCatalog } from "@/hooks/useAreas";
import { useAreaAdminMutations } from "@/hooks/useAreaAdmin";
import {
  fieldDraftsOf,
  fieldsChanged,
  fieldsPayload,
  machineDraftsOf,
  machinesChanged,
  machinesPayload,
  stageDraftsOf,
  stagesChanged,
  stagesPayload,
  validateColor,
  validateFields,
  validateMachines,
  validateName,
  validateStages,
  validateWhole,
  wholeOrNull,
  MAX_CAPACITY,
  MAX_TURNAROUND_HOURS,
  type FieldDraft,
  type MachineDraft,
  type StageDraft,
} from "@/lib/areaForm";

interface EditDraft {
  name: string;
  icon: string;
  color: string;
  isProductionDestination: boolean;
  hasInventory: boolean;
  generalViewEnabled: boolean;
  inventoryCategories: string[];
  inventoryUnits: string[];
  /** Como se teclean ("" = sin dato). */
  capacity: string;
  turnaroundHours: string;
}

const draftOf = (area: AreaOverview): EditDraft => ({
  name: area.name,
  icon: area.icon,
  color: area.color,
  isProductionDestination: area.isProductionDestination,
  hasInventory: area.hasInventory,
  generalViewEnabled: area.generalViewEnabled,
  inventoryCategories: area.inventoryCategories,
  inventoryUnits: area.inventoryUnits,
  capacity: area.capacity === null ? "" : String(area.capacity),
  turnaroundHours: area.turnaroundHours === null ? "" : String(area.turnaroundHours),
});

/** Sólo lo que cambió: el backend rechaza (409) tocar lo que tiene trabajo abierto, aunque no cambie. */
export function changesOf(area: AreaOverview, draft: EditDraft): UpdateAreaPayload {
  const before = draftOf(area);
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(before) as (keyof EditDraft)[]) {
    const next = key === "name" ? draft.name.trim() : key === "color" ? draft.color.trim().toLowerCase() : draft[key];
    if (JSON.stringify(next) !== JSON.stringify(before[key])) {
      changes[key] = key === "capacity" || key === "turnaroundHours" ? wholeOrNull(next as string) : next;
    }
  }
  return changes as UpdateAreaPayload;
}

function SwitchRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium leading-none">
          {title}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/** Edición de un área existente: nombre, ícono, color, comportamiento y sugerencias. El slug no cambia. */
export function AreaEditDialog({ area, onClose }: { area: AreaOverview | null; onClose: () => void }) {
  const catalog = useAreaCatalog();
  const { update, setStages, setMachines, setFields, isUpdating } = useAreaAdminMutations();
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [stages, setStagesDraft] = useState<StageDraft[]>([]);
  const [machines, setMachinesDraft] = useState<MachineDraft[]>([]);
  const [fields, setFieldsDraft] = useState<FieldDraft[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setDraft(area ? draftOf(area) : null);
    setStagesDraft(area ? stageDraftsOf(area.stages) : []);
    setMachinesDraft(area ? machineDraftsOf(area.machines) : []);
    setFieldsDraft(area ? fieldDraftsOf(area.fields) : []);
    setTouched(false);
  }, [area]);

  if (!area || !draft) return null;

  const set = <K extends keyof EditDraft>(key: K, value: EditDraft[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  const nameError = validateName(draft.name, catalog, area.id);
  const colorError = validateColor(draft.color);
  const changes = changesOf(area, draft);
  const stagesError = draft.isProductionDestination ? validateStages(stages) : undefined;
  const stagesDirty = !area.isDesign && stagesChanged(area.stages, stages);
  const production = !area.isDesign && draft.isProductionDestination;
  const capacityError = validateWhole(draft.capacity, MAX_CAPACITY, "La capacidad");
  const hoursError = validateWhole(draft.turnaroundHours, MAX_TURNAROUND_HOURS, "Las horas");
  const configError = production
    ? (validateMachines(machines) ?? validateFields(fields) ?? capacityError ?? hoursError)
    : undefined;
  const machinesDirty = production && machinesChanged(area.machines, machines);
  const fieldsDirty = production && fieldsChanged(area.fields, fields);
  const hasChanges = Object.keys(changes).length > 0 || stagesDirty || machinesDirty || fieldsDirty;
  const hasOpenWork = area.openOrders > 0 || area.openTasks > 0;

  const handleSave = async () => {
    setTouched(true);
    if (nameError || colorError || stagesError || configError || !hasChanges) return;
    try {
      if (Object.keys(changes).length > 0) await update(area.id, changes);
      if (stagesDirty) await setStages(area.id, { stages: stagesPayload(stages) });
      if (machinesDirty) await setMachines(area.id, { machines: machinesPayload(machines) });
      if (fieldsDirty) await setFields(area.id, { fields: fieldsPayload(fields) });
      toast.success("Área actualizada");
      onClose();
    } catch {
      // El error del backend ya se avisa con un toast global.
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !isUpdating && onClose()}>
      <DialogContent className="sm:max-h-[90vh] sm:max-w-xl sm:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {area.name}</DialogTitle>
          <DialogDescription>
            Identificador interno: <span className="font-mono">{area.slug}</span> (no cambia).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <FormField label="Nombre del área" htmlFor="edit-area-name" required error={touched ? nameError : undefined}>
            <Input
              id="edit-area-name"
              value={draft.name}
              maxLength={40}
              aria-invalid={touched && Boolean(nameError)}
              onChange={(event) => set("name", event.target.value)}
            />
          </FormField>
          <FormField label="Ícono">
            <IconPicker value={draft.icon} onChange={(icon) => set("icon", icon)} />
          </FormField>
          <FormField label="Color">
            <ColorPicker value={draft.color} onChange={(color) => set("color", color)} error={touched ? colorError : undefined} />
          </FormField>
          <AreaPreview name={draft.name} icon={draft.icon} color={draft.color} />

          <SwitchRow
            id="edit-area-production"
            title="Destino de producción"
            description={
              area.isDesign
                ? "Diseño es la fase previa de los pedidos: no es destino de producción."
                : hasOpenWork && draft.isProductionDestination
                  ? "No se puede quitar mientras tenga pedidos o tareas abiertos."
                  : "Los pedidos pueden producirse aquí."
            }
            checked={draft.isProductionDestination}
            disabled={area.isDesign || (hasOpenWork && area.isProductionDestination)}
            onChange={(checked) => set("isProductionDestination", checked)}
          />
          <SwitchRow
            id="edit-area-inventory"
            title="Inventario propio"
            description="Si lo apagas, el área deja de verse en Inventario (sus artículos se conservan)."
            checked={draft.hasInventory}
            onChange={(checked) => set("hasInventory", checked)}
          />
          <SwitchRow
            id="edit-area-general-view"
            title="Todo el equipo ve todo el trabajo del área"
            description="Si lo apagas, cada persona sólo ve lo que se le asignó y lo que está libre."
            checked={draft.generalViewEnabled}
            onChange={(checked) => set("generalViewEnabled", checked)}
          />
          {!area.isDesign && draft.isProductionDestination && (
            <FormField label="Etapas previas a producción">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Cada tarea nueva pasa por estas etapas antes de producir. Las tareas que ya están en curso conservan
                  su etapa; no se puede quitar una etapa (ni cambiarle el tipo) mientras tenga tareas abiertas.
                </p>
                <StageEditor value={stages} onChange={setStagesDraft} showErrors={touched} disabled={isUpdating} />
              </div>
            </FormField>
          )}
          {production && (
            <>
              <FormField label="Capacidad y tiempos">
                <CapacityFields
                  capacity={draft.capacity}
                  turnaroundHours={draft.turnaroundHours}
                  onCapacity={(value) => set("capacity", value)}
                  onTurnaroundHours={(value) => set("turnaroundHours", value)}
                  showErrors={touched}
                  disabled={isUpdating}
                />
              </FormField>
              <FormField label="Máquinas o equipos">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No se puede quitar una máquina mientras tenga tareas abiertas asignadas.
                  </p>
                  <MachineEditor value={machines} onChange={setMachinesDraft} showErrors={touched} disabled={isUpdating} />
                </div>
              </FormField>
              <FormField label="Datos del pedido">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Se capturan en cada tarea del área. Quitar un dato lo oculta; lo ya capturado se conserva. El tipo de un
                    dato existente no cambia.
                  </p>
                  <FieldEditor value={fields} onChange={setFieldsDraft} showErrors={touched} disabled={isUpdating} />
                </div>
              </FormField>
            </>
          )}
          {draft.hasInventory && (
            <>
              <FormField label="Categorías sugeridas en inventario">
                <SuggestionInput
                  label="Categorías"
                  placeholder="Ej. Filamento, Resina"
                  value={draft.inventoryCategories}
                  onChange={(next) => set("inventoryCategories", next)}
                />
              </FormField>
              <FormField label="Unidades sugeridas en inventario">
                <SuggestionInput
                  label="Unidades"
                  placeholder="Ej. kg, rollo, litro"
                  value={draft.inventoryUnits}
                  onChange={(next) => set("inventoryUnits", next)}
                />
              </FormField>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isUpdating}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isUpdating || !hasChanges}>
            {isUpdating ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
