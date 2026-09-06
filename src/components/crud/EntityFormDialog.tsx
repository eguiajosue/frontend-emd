"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "textarea" | "select" | "date" | "multiselect";
  options?: SelectOption[];
  helpText?: string;
}

export type EntityValues = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface EntityFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: EntityValues) => Promise<void>;
  fields: FieldConfig[];
  schema: z.ZodTypeAny;
  initialValues?: EntityValues;
  title: string;
}

export function EntityFormDialog({
  open,
  onClose,
  onSubmit,
  fields,
  schema,
  initialValues,
  title,
}: EntityFormDialogProps) {
  const [values, setValues] = useState<EntityValues>(initialValues || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(initialValues || {});
    setErrors({});
  }, [initialValues, open]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const result = schema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.data as EntityValues);
      toast.success("Guardado correctamente");
      onClose();
    } catch {
      // El feedback de error es global y uniforme (ver src/app/providers.tsx):
      // acá sólo se evita cerrar el diálogo para no perder lo que el usuario cargó.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <Label>{field.label}</Label>
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
              {field.type === "multiselect" ? (
                <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
                  {field.options?.map((opt) => {
                    const selected: (string | number)[] = Array.isArray(values[field.name])
                      ? values[field.name]
                      : [];
                    const checked = selected.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-sm font-normal"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(state) => {
                            const isChecked = state === true;
                            const next = isChecked
                              ? [...selected, opt.value]
                              : selected.filter((v) => v !== opt.value);
                            handleChange(field.name, next);
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                  {(!field.options || field.options.length === 0) && (
                    <p className="col-span-full text-sm text-muted-foreground">
                      No hay opciones disponibles.
                    </p>
                  )}
                </div>
              ) : field.type === "select" ? (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                  value={values[field.name] ?? ""}
                  onChange={(e) =>
                    handleChange(
                      field.name,
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                >
                  <option value="">Selecciona...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <Textarea
                  value={values[field.name] ?? ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              ) : (
                <Input
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                      ? "date"
                      : field.type === "email"
                      ? "email"
                      : "text"
                  }
                  value={values[field.name] ?? ""}
                  onChange={(e) =>
                    handleChange(
                      field.name,
                      field.type === "number"
                        ? e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                        : e.target.value
                    )
                  }
                />
              )}
              {errors[field.name] && (
                <p className="text-sm text-destructive">{errors[field.name]}</p>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
