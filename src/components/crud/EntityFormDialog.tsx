"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { useMotionPreset } from "@/lib/motion";
import { toast } from "sonner";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "textarea" | "select" | "date" | "multiselect" | "switch";
  options?: SelectOption[];
  helpText?: string;
  icon?: LucideIcon;
  /** Muestra el campo condicionalmente según el resto de los valores del formulario. */
  showIf?: (values: EntityValues) => boolean;
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const { formButtonMotion } = useMotionPreset();

  useEffect(() => {
    setValues(initialValues || {});
    setErrors({});
    setTouched({});
  }, [initialValues, open]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const markTouched = (name: string) => setTouched((prev) => ({ ...prev, [name]: true }));

  const handleSubmit = async () => {
    setTouched(Object.fromEntries(fields.map((f) => [f.name, true])));
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

  const visibleFields = fields.filter((f) => !f.showIf || f.showIf(values));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {visibleFields.map((field) => {
            const error = touched[field.name] ? errors[field.name] : undefined;
            if (field.type === "switch") {
              return (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3.5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium leading-none">{field.label}</p>
                    {field.helpText && (
                      <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                  <Switch
                    checked={Boolean(values[field.name])}
                    onCheckedChange={(checked) => handleChange(field.name, checked)}
                  />
                </div>
              );
            }

            return (
              <FormField
                key={field.name}
                label={field.label}
                icon={field.icon}
                error={error}
                hint={!error ? field.helpText : undefined}
              >
                {field.type === "multiselect" ? (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-input p-3 sm:grid-cols-3">
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
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
                    value={values[field.name] ?? ""}
                    onBlur={() => markTouched(field.name)}
                    onChange={(e) => {
                      handleChange(
                        field.name,
                        e.target.value === "" ? undefined : Number(e.target.value)
                      );
                    }}
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
                    onBlur={() => markTouched(field.name)}
                    className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
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
                    onBlur={() => markTouched(field.name)}
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
                    className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                )}
              </FormField>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <motion.div {...(submitting ? {} : formButtonMotion)}>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
