"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FormField, FormSection } from "@/components/ui/form-field";
import {
  AlertCircle,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  UserPlus,
  UserRound,
  Users2,
  Package,
  CalendarClock,
  Building2,
  Clock,
  X,
} from "lucide-react";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import { CreateClientDialog } from "@/components/orders/CreateClientDialog";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { Switch } from "@/components/ui/switch";
import { AREA_OPTIONS, PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import { combineDateAndTime } from "@/lib/format";
import { orderCreatedMessage } from "@/lib/copy";
import type {
  AuthorizationFileInput,
  Client,
  CreateOrderPayload,
  Order,
  OrderProductPreset,
  User,
} from "@/types";

const AUTHORIZATION_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5MB, igual que el límite del backend.
const ALLOWED_AUTHORIZATION_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;

/** Lee un File a `{ data, filename, mimeType }` (base64 sin el prefijo data:...;base64,). */
function readFileAsAuthorizationInput(file: File): Promise<AuthorizationFileInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      resolve({
        data: base64,
        filename: file.name,
        mimeType: file.type as AuthorizationFileInput["mimeType"],
      });
    };
    reader.readAsDataURL(file);
  });
}

const orderProductSchema = z.object({
  customName: z.string({ required_error: "Elegí un producto" }).min(1, "Elegí un producto"),
  quantity: z.number().min(1, "La cantidad debe ser mayor a 0"),
});

const orderSchema = z
  .object({
    clientId: z.number().optional(),
    clientNameOverride: z.string().optional(),
    area: z.string().optional(),
    requiresDesign: z.boolean(),
    description: z.string().min(1, "La descripción es requerida"),
    deliveryDate: z.string().optional().or(z.literal("")),
    assignedUserId: z.number().optional(),
    orderProducts: z.array(orderProductSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.clientId && !data.clientNameOverride?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Selecciona o escribí un cliente",
      });
    }
    // Sin diseño el área destino es obligatoria (a donde va el pedido directo);
    // con diseño es opcional, se puede definir después (recepción o diseño).
    if (!data.requiresDesign && !data.area) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["area"],
        message: "El área es requerida",
      });
    }
  });

/** Labels legibles de cada campo, usados en el resumen de errores. */
const FIELD_LABELS: Record<string, string> = {
  clientId: "Cliente",
  area: "Área",
  description: "Descripción",
};

interface OrderProductRow {
  customName?: string;
  quantity?: number;
}

interface CreateOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el pedido recién creado (ej. para abrir su detalle). */
  onCreated?: (order: Order) => void;
}

function clientLabel(c: Client): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

/**
 * Formulario de alta de pedido, en un diálogo reutilizable desde la pantalla
 * unificada de Pedidos (antes era la página aparte `/dashboard/orders/new`).
 */
export function CreateOrderDialog({ open, onClose, onCreated }: CreateOrderDialogProps) {
  const { session } = usePermissions();
  const { formButtonMotion } = useMotionPreset();
  const { data: clients } = useEntityList<Client>("clients", { enabled: open });
  const { data: productPresets } = useEntityList<OrderProductPreset>("orderProductPresets", {
    enabled: open,
  });
  const { data: users } = useEntityList<User>("users", { enabled: open });
  const { create } = useEntityMutations<Order, CreateOrderPayload>("orders");

  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [clientNameOverride, setClientNameOverride] = useState("");
  const [requiresDesign, setRequiresDesign] = useState(true);
  const [area, setArea] = useState<string | undefined>(undefined);
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [rows, setRows] = useState<OrderProductRow[]>([{}]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authorizationFile, setAuthorizationFile] = useState<AuthorizationFileInput | null>(null);
  const [authorizationFilePreview, setAuthorizationFilePreview] = useState<string | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const resetForm = () => {
    setClientId(undefined);
    setClientNameOverride("");
    setRequiresDesign(true);
    setArea(undefined);
    setAssignedUserId(undefined);
    setDescription("");
    setDeliveryDate("");
    setDeliveryTime("");
    setRows([{}]);
    setErrors({});
    setSubmitError(null);
    if (authorizationFilePreview) URL.revokeObjectURL(authorizationFilePreview);
    setAuthorizationFile(null);
    setAuthorizationFilePreview(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleAuthorizationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !ALLOWED_AUTHORIZATION_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_AUTHORIZATION_MIME_TYPES)[number]
      )
    ) {
      toast.error("La hoja de autorización debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > AUTHORIZATION_FILE_MAX_BYTES) {
      toast.error("La hoja de autorización no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsedFile = await readFileAsAuthorizationInput(file);
      setAuthorizationFile(parsedFile);
      setAuthorizationFilePreview(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentá de nuevo.");
    } finally {
      e.target.value = "";
    }
  };

  const removeAuthorizationFile = () => {
    if (authorizationFilePreview) URL.revokeObjectURL(authorizationFilePreview);
    setAuthorizationFile(null);
    setAuthorizationFilePreview(null);
  };

  const addRow = () => setRows((prev) => [...prev, {}]);
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));
  const updateRow = <K extends keyof OrderProductRow>(
    index: number,
    field: K,
    value: OrderProductRow[K]
  ) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  // Mejora de UX: si hay usuarios con el rol del área elegida, el selector
  // "Asignar a" se filtra a ellos; si no, se muestran todos los usuarios igual.
  const usersForArea = area
    ? users.filter((u) => u.roles?.some((r) => r.name === area))
    : users;
  const assignableUsers = usersForArea.length > 0 ? usersForArea : users;

  const currentFormData = () => ({
    clientId,
    clientNameOverride,
    area,
    requiresDesign,
    description,
    deliveryDate,
    assignedUserId,
    orderProducts: rows.filter((r) => r.customName && r.quantity),
  });

  /** Valida un único campo al perder foco, sin pisar errores de otros campos. */
  const validateFieldOnBlur = (field: string) => {
    const parsed = orderSchema.safeParse(currentFormData());
    setErrors((prev) => {
      const next = { ...prev };
      const issue = parsed.success
        ? undefined
        : parsed.error.issues.find((i) => String(i.path[0]) === field);
      if (issue) {
        next[field] = issue.message;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const scrollToField = (field: string) => {
    const el = fieldRefs.current[field];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus?.();
  };

  const handleSubmit = async () => {
    const parsed = orderSchema.safeParse(currentFormData());

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(fieldErrors);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const order = await create({
        clientId: parsed.data.clientId,
        clientNameOverride: parsed.data.clientId ? undefined : parsed.data.clientNameOverride?.trim(),
        // Sin diseño, "área" es el destino directo. Con diseño, el pedido arranca
        // en Diseño y "área" no aplica — lo que se manda es la producción destino.
        area: parsed.data.requiresDesign ? undefined : parsed.data.area,
        requiresDesign: parsed.data.requiresDesign,
        productionArea: parsed.data.requiresDesign ? parsed.data.area : undefined,
        userId: Number(session?.user?.id),
        assignedUserId: parsed.data.assignedUserId,
        statusId: 1,
        description: parsed.data.description,
        deliveryDate: combineDateAndTime(parsed.data.deliveryDate, deliveryTime),
        orderProducts: parsed.data.orderProducts,
        authorizationFile: authorizationFile ?? undefined,
      });
      toast.success(orderCreatedMessage());
      resetForm();
      onClose();
      onCreated?.(order);
    } catch (error) {
      // El toast de error ya lo dispara el feedback global (ver
      // src/app/providers.tsx); acá sólo sumamos el resumen accesible.
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo crear el pedido."
      );
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Pedido</DialogTitle>
          </DialogHeader>

          {(Object.keys(errors).length > 0 || submitError) && (
            <div
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
              className="mb-4 space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 outline-none"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertCircle className="h-4 w-4" />
                Revisá los siguientes datos antes de continuar
              </p>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              {Object.keys(errors).length > 0 && (
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {Object.entries(errors).map(([field, message]) => (
                    <li key={field}>
                      <button
                        type="button"
                        className="text-left text-destructive underline underline-offset-2 hover:no-underline"
                        onClick={() => scrollToField(field)}
                      >
                        {FIELD_LABELS[field] ?? field}: {message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-6">
            <FormSection icon={UserRound} title="Datos generales" description="Cliente, área y a quién se asigna el pedido">
              <FormField label="Cliente" icon={UserRound} required error={errors.clientId}>
                <div
                  ref={(el) => {
                    fieldRefs.current.clientId = el;
                  }}
                  tabIndex={-1}
                  className="flex gap-2 outline-none"
                >
                  <CreatableCombobox
                    className="flex-1"
                    items={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                    selectedId={clientId ?? null}
                    customValue={clientNameOverride}
                    placeholder="Buscar o escribir nombre de cliente..."
                    createLabel={(value) => `Usar "${value}" como nombre de cliente`}
                    emptyLabel="No hay clientes registrados. Escribí un nombre para usarlo directamente."
                    onSelectItem={(item) => {
                      setClientId(Number(item.id));
                      setClientNameOverride("");
                      setErrors((prev) => {
                        const { clientId: _clientId, ...rest } = prev;
                        return rest;
                      });
                    }}
                    onUseCustom={(text) => {
                      setClientId(undefined);
                      setClientNameOverride(text);
                      setErrors((prev) => {
                        const { clientId: _clientId, ...rest } = prev;
                        return rest;
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => setNewClientOpen(true)}
                    title="Dar de alta un cliente completo (teléfono, email, empresa) sin salir de este formulario"
                  >
                    <UserPlus className="h-4 w-4" /> Nuevo cliente
                  </Button>
                </div>
              </FormField>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <Switch
                  id="requires-design"
                  checked={requiresDesign}
                  onCheckedChange={setRequiresDesign}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <label htmlFor="requires-design" className="cursor-pointer text-sm font-medium">
                    ¿Requiere diseño?
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {requiresDesign
                      ? "El pedido entra a Diseño y pasa a producción recién cuando el cliente autorice el montaje."
                      : "El pedido va directo al área elegida, sin pasar por Diseño."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label={requiresDesign ? "Área de producción (opcional)" : "Área destino"}
                  icon={Building2}
                  required={!requiresDesign}
                  error={errors.area}
                  hint={
                    requiresDesign
                      ? "Se puede dejar sin definir y elegirla más adelante (Recepción o Diseño)."
                      : undefined
                  }
                >
                  <select
                    ref={(el) => {
                      fieldRefs.current.area = el;
                    }}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
                    value={area ?? ""}
                    onChange={(e) => setArea(e.target.value || undefined)}
                    onBlur={() => validateFieldOnBlur("area")}
                  >
                    <option value="">
                      {requiresDesign ? "Sin definir todavía..." : "Selecciona un área..."}
                    </option>
                    {(requiresDesign ? PRODUCTION_AREA_OPTIONS : AREA_OPTIONS).map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Asignar a (opcional)"
                  icon={Users2}
                  hint="Quién va a encargarse. Se puede cambiar después."
                >
                  <select
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
                    value={assignedUserId ?? ""}
                    onChange={(e) =>
                      setAssignedUserId(e.target.value ? Number(e.target.value) : undefined)
                    }
                  >
                    <option value="">Sin asignar</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.isSharedAccount
                          ? `Área: ${[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}`
                          : [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Descripción" icon={FileText} required error={errors.description}>
                <Textarea
                  ref={(el) => {
                    fieldRefs.current.description = el;
                  }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => validateFieldOnBlur("description")}
                  className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Fecha de Entrega" icon={CalendarClock}>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                </FormField>
                <FormField label="Hora de Entrega (opcional)" icon={Clock}>
                  <Input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    disabled={!deliveryDate}
                    className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection icon={Package} title="Productos" description="Agregá una línea por cada producto del pedido">
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <CreatableCombobox
                      className="flex-1"
                      items={productPresets.map((p) => ({ id: p.id, label: p.name }))}
                      selectedId={null}
                      customValue={row.customName}
                      placeholder="Buscar o escribir producto..."
                      createLabel={(value) => `Usar "${value}" como producto nuevo`}
                      emptyLabel="No hay productos frecuentes aún. Escribí uno para usarlo."
                      onSelectItem={(item) => updateRow(index, "customName", item.label)}
                      onUseCustom={(text) => updateRow(index, "customName", text)}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-24 focus-visible:ring-0 focus-visible:border-primary transition-colors"
                      placeholder="Cant."
                      value={row.quantity ?? ""}
                      onChange={(e) =>
                        updateRow(index, "quantity", Number(e.target.value))
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      aria-label="Quitar producto"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Agregar producto
                </Button>
              </div>
            </FormSection>

            <FormSection icon={Paperclip} title="Adjuntos" description="Hoja de autorización, opcional">
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={handleAuthorizationFileChange}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG o PDF. Máximo 5MB.
                </p>

                {authorizationFile && (
                  <div className="flex items-center gap-3 rounded-lg border p-2">
                    {authorizationFilePreview ? (
                      <img
                        src={authorizationFilePreview}
                        alt={authorizationFile.filename}
                        className="h-14 w-14 rounded object-cover"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{authorizationFile.filename}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" /> Listo para enviar
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeAuthorizationFile}
                      aria-label="Quitar archivo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </FormSection>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
                Cancelar
              </Button>
              <motion.div {...(submitting ? {} : formButtonMotion)}>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Guardando..." : "Crear Pedido"}
                </Button>
              </motion.div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateClientDialog
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onCreated={(client) => setClientId(client.id)}
      />
    </>
  );
}
