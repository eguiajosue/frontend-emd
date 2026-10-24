"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuggestionInput } from "@/components/areas/AreaPickers";
import {
  CONFIG_NAME_MAX,
  FIELD_TYPE_LABELS,
  MAX_CAPACITY,
  MAX_FIELDS,
  MAX_MACHINES,
  MAX_TURNAROUND_HOURS,
  newField,
  validateFields,
  validateMachines,
  validateWhole,
  type FieldDraft,
  type MachineDraft,
} from "@/lib/areaForm";
import type { AreaFieldType } from "@emd/types";

/** Mueve el elemento `index` una posición en una lista (la misma lista si no se puede). */
function move<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function RowButtons({
  label,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ml-auto flex items-center">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Subir ${label} ${index + 1}`} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Bajar ${label} ${index + 1}`} disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Quitar ${label} ${index + 1}`} disabled={disabled} onClick={onRemove}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

function ErrorLine({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

/** Capacidad (tareas abiertas a la vez) y horas típicas por tarea. */
export function CapacityFields({
  capacity,
  turnaroundHours,
  onCapacity,
  onTurnaroundHours,
  showErrors = false,
  disabled,
}: {
  capacity: string;
  turnaroundHours: string;
  onCapacity: (value: string) => void;
  onTurnaroundHours: (value: string) => void;
  showErrors?: boolean;
  disabled?: boolean;
}) {
  const capacityError = showErrors ? validateWhole(capacity, MAX_CAPACITY, "La capacidad") : undefined;
  const hoursError = showErrors ? validateWhole(turnaroundHours, MAX_TURNAROUND_HOURS, "Las horas") : undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="area-capacity">Capacidad (tareas abiertas a la vez)</Label>
        <Input
          id="area-capacity"
          inputMode="numeric"
          value={capacity}
          disabled={disabled}
          placeholder="Sin tope"
          aria-invalid={Boolean(capacityError)}
          onChange={(event) => onCapacity(event.target.value)}
        />
        <ErrorLine message={capacityError} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="area-turnaround">Horas típicas por tarea</Label>
        <Input
          id="area-turnaround"
          inputMode="numeric"
          value={turnaroundHours}
          disabled={disabled}
          placeholder="Sin dato"
          aria-invalid={Boolean(hoursError)}
          onChange={(event) => onTurnaroundHours(event.target.value)}
        />
        <ErrorLine message={hoursError} />
      </div>
    </div>
  );
}

/** Máquinas o equipos del área, en orden. */
export function MachineEditor({
  value,
  onChange,
  disabled,
  showErrors = false,
}: {
  value: MachineDraft[];
  onChange: (next: MachineDraft[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
}) {
  const error = showErrors ? validateMachines(value) : undefined;
  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3.5 py-4 text-center text-sm text-muted-foreground">
          Sin máquinas: las tareas no se asignan a un equipo.
        </p>
      ) : (
        <ol aria-label="Máquinas del área" className="space-y-2">
          {value.map((machine, index) => (
            <li key={machine.id ?? `new-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
              <Input
                value={machine.name}
                maxLength={CONFIG_NAME_MAX}
                disabled={disabled}
                placeholder="Nombre de la máquina"
                aria-label={`Nombre de la máquina ${index + 1}`}
                className="h-9 min-w-[10rem] flex-1"
                onChange={(event) => onChange(value.map((m, i) => (i === index ? { ...m, name: event.target.value } : m)))}
              />
              <RowButtons
                label="la máquina"
                index={index}
                count={value.length}
                disabled={disabled}
                onMove={(delta) => onChange(move(value, index, delta))}
                onRemove={() => onChange(value.filter((_, i) => i !== index))}
              />
            </li>
          ))}
        </ol>
      )}
      <ErrorLine message={error} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={disabled || value.length >= MAX_MACHINES} onClick={() => onChange([...value, { name: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Agregar máquina
        </Button>
        <span className="text-xs text-muted-foreground">
          {value.length} de {MAX_MACHINES}
        </span>
      </div>
    </div>
  );
}

/** Datos propios que se capturan en cada tarea del área. */
export function FieldEditor({
  value,
  onChange,
  disabled,
  showErrors = false,
}: {
  value: FieldDraft[];
  onChange: (next: FieldDraft[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
}) {
  const error = showErrors ? validateFields(value) : undefined;
  const update = (index: number, patch: Partial<FieldDraft>) =>
    onChange(value.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3.5 py-4 text-center text-sm text-muted-foreground">
          Sin datos propios: la tarea sólo lleva lo de siempre.
        </p>
      ) : (
        <ol aria-label="Datos propios del área" className="space-y-2">
          {value.map((field, index) => {
            // El tipo de un dato que ya existe no cambia (los valores capturados dependen de él).
            const typeLocked = field.id !== undefined;
            return (
              <li key={field.id ?? `new-${index}`} className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={field.label}
                    maxLength={CONFIG_NAME_MAX}
                    disabled={disabled}
                    placeholder="Nombre del dato (ej. Material)"
                    aria-label={`Nombre del dato ${index + 1}`}
                    className="h-9 min-w-[10rem] flex-1"
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                  <Select
                    value={field.type}
                    disabled={disabled || typeLocked}
                    onValueChange={(type) => update(index, { type: type as AreaFieldType, options: [], unit: "", required: false })}
                  >
                    <SelectTrigger className="w-44" aria-label={`Tipo del dato ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIELD_TYPE_LABELS) as AreaFieldType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {FIELD_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <RowButtons
                    label="el dato"
                    index={index}
                    count={value.length}
                    disabled={disabled}
                    onMove={(delta) => onChange(move(value, index, delta))}
                    onRemove={() => onChange(value.filter((_, i) => i !== index))}
                  />
                </div>
                {field.type === "select" && (
                  <SuggestionInput
                    label={`Opciones del dato ${index + 1}`}
                    placeholder="Opciones: PLA, ABS… (Enter agrega cada una)"
                    value={field.options}
                    onChange={(options) => update(index, { options })}
                  />
                )}
                {field.type === "number" && (
                  <Input
                    value={field.unit}
                    maxLength={10}
                    disabled={disabled}
                    placeholder="Unidad (ej. cm, g)"
                    aria-label={`Unidad del dato ${index + 1}`}
                    className="h-9 w-44"
                    onChange={(event) => update(index, { unit: event.target.value })}
                  />
                )}
                {field.type !== "boolean" && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`field-required-${index}`}
                      checked={field.required}
                      disabled={disabled}
                      onCheckedChange={(required) => update(index, { required })}
                    />
                    <Label htmlFor={`field-required-${index}`} className="text-sm">
                      Obligatorio para empezar la producción
                    </Label>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <ErrorLine message={error} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={disabled || value.length >= MAX_FIELDS} onClick={() => onChange([...value, newField()])}>
          <Plus className="h-4 w-4" aria-hidden />
          Agregar dato
        </Button>
        <span className="text-xs text-muted-foreground">
          {value.length} de {MAX_FIELDS}
        </span>
      </div>
    </div>
  );
}
