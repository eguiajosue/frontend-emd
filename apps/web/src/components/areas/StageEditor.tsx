"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MAX_STAGES,
  STAGE_KIND_LABELS,
  STAGE_NAME_MAX,
  moveStage,
  validateStages,
  type StageDraft,
} from "@/lib/areaForm";
import type { AreaStageKind } from "@emd/types";

/**
 * Editor de las etapas previas a producción de un área: nombre y tipo de cada
 * una, en el orden en que las recorre una tarea. Una etapa de trabajo se
 * completa y pasa a la siguiente; una revisión se aprueba (sigue) o se
 * rechaza (regresa a la etapa anterior).
 */
export function StageEditor({
  value,
  onChange,
  disabled,
  showErrors = false,
}: {
  value: StageDraft[];
  onChange: (next: StageDraft[]) => void;
  disabled?: boolean;
  /** Muestra el motivo por el que la lista no sirve (después de intentar avanzar o guardar). */
  showErrors?: boolean;
}) {
  const error = showErrors ? validateStages(value) : undefined;
  const update = (index: number, patch: Partial<StageDraft>) =>
    onChange(value.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)));
  const add = (kind: AreaStageKind) => onChange([...value, { name: "", kind }]);

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3.5 py-4 text-center text-sm text-muted-foreground">
          Sin etapas: las tareas nacen listas para producir.
        </p>
      ) : (
        <ol aria-label="Etapas previas a producción" className="space-y-2">
          {value.map((stage, index) => (
            <li
              key={stage.id ?? `new-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5"
            >
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground" aria-hidden>
                {index + 1}
              </span>
              <Input
                value={stage.name}
                maxLength={STAGE_NAME_MAX}
                disabled={disabled}
                placeholder="Nombre de la etapa"
                aria-label={`Nombre de la etapa ${index + 1}`}
                className="h-9 min-w-[10rem] flex-1"
                onChange={(event) => update(index, { name: event.target.value })}
              />
              <Select
                value={stage.kind}
                disabled={disabled}
                onValueChange={(kind) => update(index, { kind: kind as AreaStageKind })}
              >
                <SelectTrigger className="w-32" aria-label={`Tipo de la etapa ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STAGE_KIND_LABELS) as AreaStageKind[]).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {STAGE_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Subir la etapa ${index + 1}`}
                  disabled={disabled || index === 0}
                  onClick={() => onChange(moveStage(value, index, -1))}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Bajar la etapa ${index + 1}`}
                  disabled={disabled || index === value.length - 1}
                  onClick={() => onChange(moveStage(value, index, 1))}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar la etapa ${index + 1}`}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || value.length >= MAX_STAGES}
          onClick={() => add("work")}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Agregar etapa
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || value.length === 0 || value.length >= MAX_STAGES}
          onClick={() => add("review")}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Agregar revisión
        </Button>
        <span className="text-xs text-muted-foreground">
          {value.length} de {MAX_STAGES}
        </span>
      </div>
    </div>
  );
}
