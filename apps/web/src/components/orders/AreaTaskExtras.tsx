"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAreaCatalog } from "@/hooks/useAreas";
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { fieldValuesChanges, formatFieldValue, type FieldFormValues } from "@/lib/areaTaskFields";
import type { AreaField, OrderAreaTask } from "@/types";

const NONE = "none";

function FieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: AreaField;
  value: FieldFormValues[string];
  disabled: boolean;
  onChange: (value: FieldFormValues[string]) => void;
}) {
  const id = `task-field-${field.key}`;
  const label = (
    <Label htmlFor={id} className="text-xs font-medium">
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
      {field.unit && <span className="font-normal text-muted-foreground"> ({field.unit})</span>}
    </Label>
  );
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch id={id} checked={value === true} disabled={disabled} onCheckedChange={onChange} />
        {label}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1">
        {label}
        <Select value={typeof value === "string" && value ? value : NONE} disabled={disabled} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
          <SelectTrigger id={id} className="h-8 text-xs" aria-label={field.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin definir</SelectItem>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {label}
      <Input
        id={id}
        value={value === undefined ? "" : String(value)}
        inputMode={field.type === "number" ? "decimal" : undefined}
        disabled={disabled}
        maxLength={200}
        className="h-8 text-xs"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/**
 * Lo que el área define para sus tareas (ver `Area.machines` y `Area.fields`):
 * la máquina que la trabaja y los datos propios (material, medidas...). Quien
 * puede editar (el área y Recepción) ve los controles; el resto, un resumen.
 */
export function AreaTaskExtras({
  orderId,
  task,
  canEdit,
}: {
  orderId: number;
  task: OrderAreaTask;
  canEdit: boolean;
}) {
  const area = useAreaCatalog().find((a) => a.slug === task.area);
  const { setMachine, setFieldValues } = useAreaTasks(orderId);
  const [form, setForm] = useState<FieldFormValues>(task.fieldValues ?? {});
  useEffect(() => setForm(task.fieldValues ?? {}), [task.fieldValues]);

  const machines = area?.machines ?? [];
  const fields = area?.fields ?? [];
  if (machines.length === 0 && fields.length === 0) return null;

  const changes = fieldValuesChanges(fields, task.fieldValues ?? {}, form);
  const dirty = Object.keys(changes).length > 0;
  const busy = setMachine.isPending || setFieldValues.isPending;

  const saveFields = async () => {
    try {
      await setFieldValues.mutateAsync({ taskId: task.id, values: changes });
      toast.success("Datos guardados");
    } catch {
      // El error del backend ya se avisa con un toast global.
    }
  };

  const changeMachine = async (value: string) => {
    try {
      await setMachine.mutateAsync({ taskId: task.id, machineId: value === NONE ? null : Number(value) });
    } catch {
      // Idem.
    }
  };

  return (
    <div className="order-last basis-full space-y-3 rounded-lg bg-muted/40 px-3 py-2.5" aria-label={`Datos de ${area?.name ?? task.area}`}>
      {machines.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="font-medium">Máquina</span>
          {canEdit ? (
            <Select value={task.machine ? String(task.machine.id) : NONE} disabled={busy} onValueChange={changeMachine}>
              <SelectTrigger className="h-8 w-44 text-xs" aria-label="Máquina">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={String(machine.id)}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground">{task.machine?.name ?? "Sin asignar"}</span>
          )}
        </div>
      )}

      {fields.length > 0 &&
        (canEdit ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  disabled={busy}
                  onChange={(value) => setForm((prev) => ({ ...prev, [field.key]: value }))}
                />
              ))}
            </div>
            <Button type="button" size="sm" className="h-7 text-xs" disabled={!dirty || busy} onClick={saveFields}>
              Guardar datos
            </Button>
          </div>
        ) : (
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="flex gap-1.5">
                <dt className="text-muted-foreground">{field.label}:</dt>
                <dd>{formatFieldValue(field, task.fieldValues?.[field.key])}</dd>
              </div>
            ))}
          </dl>
        ))}
    </div>
  );
}
