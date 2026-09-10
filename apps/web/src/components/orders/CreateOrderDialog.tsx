"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FormField } from "@/components/ui/form-field";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
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
import {
  isAllowedUploadMime,
  normalizeImageFile,
  readFileAsUploadInput,
  UPLOAD_FILE_MAX_BYTES,
} from "@/lib/fileInput";
import { Switch } from "@/components/ui/switch";
import { AREA_OPTIONS, PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { combineDateAndTime } from "@/lib/format";
import { orderCreatedMessage } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { PreviewImage } from "@/components/ui/preview-image";
import { CameraCaptureButton } from "@/components/ui/camera-capture-button";
import type {
  AuthorizationFileInput,
  Client,
  CreateOrderPayload,
  Order,
  OrderProductPreset,
  User,
} from "@/types";

const orderProductSchema = z.object({
  customName: z.string({ required_error: "Producto requerido" }).min(1, "Producto requerido"),
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
    // Con montaje el pedido arranca en Diseño y necesita responsable sí o sí
    // (ver WORKFLOW.md §1.a). "Cualquier diseñador" es una opción válida: se
    // resuelve a la cuenta compartida del área, no a "sin asignar".
    if (data.requiresDesign && !data.assignedUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedUserId"],
        message: "Elegir un diseñador (o 'Cualquier diseñador')",
      });
    }
  });

/** Labels legibles de cada campo, usados en el resumen de errores. */
const FIELD_LABELS: Record<string, string> = {
  clientId: "Cliente",
  area: "Área",
  description: "Descripción",
  assignedUserId: "Asignación",
};

/** Rol del área de Diseño; los pedidos con montaje arrancan siempre acá. */
const DESIGN_ROLE = "diseno";

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
 * Los 4 pasos del wizard. `fields` son las claves del schema que ese paso
 * valida antes de dejar avanzar con "Siguiente" — el resto del schema se
 * valida igual al final, en el submit real.
 */
const STEPS: {
  key: string;
  label: string;
  icon: typeof UserRound;
  fields: string[];
}[] = [
  { key: "client", label: "Cliente", icon: UserRound, fields: ["clientId"] },
  { key: "details", label: "Detalles del pedido", icon: Building2, fields: ["area", "assignedUserId", "description"] },
  { key: "products", label: "Productos", icon: Package, fields: [] },
  { key: "review", label: "Revisar", icon: ClipboardCheck, fields: [] },
];

/** En qué paso vive cada campo, para saltar ahí si el submit final falla. */
const FIELD_STEP: Record<string, number> = {
  clientId: 0,
  area: 1,
  assignedUserId: 1,
  description: 1,
};

/**
 * Formulario de alta de pedido, en un diálogo reutilizable desde la pantalla
 * unificada de Pedidos (antes era la página aparte `/dashboard/orders/new`).
 *
 * Es un wizard de 4 pasos: en móvil, pantalla completa con progreso
 * segmentado arriba; en escritorio, panel lateral de altura completa con los
 * pasos como lista de progreso. La lógica de negocio (validaciones, payload)
 * es la misma que antes — sólo cambió cómo se presenta.
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

  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [clientNameOverride, setClientNameOverride] = useState("");
  const [requiresDesign, setRequiresDesign] = useState(true);
  const [area, setArea] = useState<string | undefined>(undefined);
  // Áreas de producción EXTRA (además de `area`): un pedido puede necesitar
  // varias técnicas y todas trabajan en paralelo (ver WORKFLOW.md §3).
  const [extraAreas, setExtraAreas] = useState<string[]>([]);
  const [showExtraAreas, setShowExtraAreas] = useState(false);
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
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  // Arranca siempre en el paso 1 cada vez que se abre.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const resetForm = () => {
    setStep(0);
    setClientId(undefined);
    setClientNameOverride("");
    setRequiresDesign(true);
    setArea(undefined);
    setExtraAreas([]);
    setShowExtraAreas(false);
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

    const normalized = await normalizeImageFile(file);
    if (!normalized || !isAllowedUploadMime(normalized.type)) {
      toast.error("La hoja de autorización debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (normalized.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("La hoja de autorización no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsedFile = await readFileAsUploadInput(normalized);
      setAuthorizationFile(parsedFile);
      setAuthorizationFilePreview(
        normalized.type.startsWith("image/") ? URL.createObjectURL(normalized) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentar de nuevo.");
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

  /**
   * Toca un chip de producto frecuente: si ya está en la lista suma 1 a la
   * cantidad, si hay una fila vacía la usa, si no agrega una fila nueva.
   */
  const addPresetProduct = (name: string) => {
    setRows((prev) => {
      const existingIndex = prev.findIndex(
        (r) => r.customName?.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: (next[existingIndex].quantity ?? 0) + 1,
        };
        return next;
      }
      const emptyIndex = prev.findIndex((r) => !r.customName);
      if (emptyIndex >= 0) {
        const next = [...prev];
        next[emptyIndex] = { customName: name, quantity: 1 };
        return next;
      }
      return [...prev, { customName: name, quantity: 1 }];
    });
  };

  // Todas las áreas de producción del pedido: la principal más las extra. Con
  // montaje la principal puede estar sin definir todavía y quedar sólo las
  // extra (o ninguna, y se definen al autorizar).
  const productionAreas = useMemo(() => {
    const primary = area && area !== DESIGN_ROLE ? [area] : [];
    return [...new Set([...primary, ...extraAreas])];
  }, [area, extraAreas]);

  // Área que decide a quién se le puede asignar el pedido (ver WORKFLOW.md §1):
  // con montaje siempre es Diseño, sin montaje es el área destino elegida.
  const assignmentArea = requiresDesign ? DESIGN_ROLE : area;

  const usersInAssignmentArea = useMemo(
    () =>
      assignmentArea
        ? users.filter((u) => u.roles?.some((r) => r.name === assignmentArea))
        : [],
    [users, assignmentArea]
  );

  /** Cuenta compartida del área ("Área: Diseño"), usada como "cualquiera del área". */
  const sharedAccountForArea = useMemo(
    () => usersInAssignmentArea.find((u) => u.isSharedAccount),
    [usersInAssignmentArea]
  );

  const individualsInArea = useMemo(
    () => usersInAssignmentArea.filter((u) => !u.isSharedAccount),
    [usersInAssignmentArea]
  );

  // Con montaje el selector muestra SOLO gente de Diseño; sin montaje, sólo
  // gente del área destino. Si el área todavía no tiene usuarios cargados se
  // cae a la lista completa para no dejar el formulario sin salida.
  const assignableUsers =
    usersInAssignmentArea.length > 0 ? usersInAssignmentArea : assignmentArea ? [] : users;

  // Al cambiar el área de asignación, una selección previa de otra área deja de
  // ser válida: se limpia y se propone la cuenta compartida del área nueva.
  useEffect(() => {
    if (!assignmentArea) return;
    const stillValid =
      assignedUserId !== undefined &&
      usersInAssignmentArea.some((u) => u.id === assignedUserId);
    if (stillValid) return;
    setAssignedUserId(sharedAccountForArea?.id);
  }, [assignmentArea, usersInAssignmentArea, sharedAccountForArea, assignedUserId]);

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
    const targetStep = FIELD_STEP[field];
    if (targetStep !== undefined && targetStep !== step) {
      setStep(targetStep);
      requestAnimationFrame(() => fieldRefs.current[field]?.focus?.());
      return;
    }
    const el = fieldRefs.current[field];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus?.();
  };

  const isFirstStep = step === 0;
  const isLastStep = step === STEPS.length - 1;

  // Mueve el foco al contenido del paso nuevo cada vez que cambia (avanzar,
  // volver, o el salto automático a un paso con error en el submit) — sin
  // esto, un lector de pantalla no se entera de que la pantalla cambió.
  // Se salta el primer render: `onOpenAutoFocus` ya decide qué pasa al abrir.
  const skipNextFocusRef = useRef(true);
  useEffect(() => {
    if (skipNextFocusRef.current) {
      skipNextFocusRef.current = false;
      return;
    }
    // Si el cambio de paso vino con un error (el salto automático del
    // submit), el resumen de errores ya se enfoca solo — no competir por
    // el foco con eso.
    if (Object.keys(errors).length > 0 || submitError) return;
    contentScrollRef.current?.focus();
  }, [step]);

  /** Valida sólo los campos del paso actual; si pasan, avanza. */
  const goNext = () => {
    const fields = STEPS[step].fields;
    if (fields.length > 0) {
      const parsed = orderSchema.safeParse(currentFormData());
      const relevantIssues = parsed.success
        ? []
        : parsed.error.issues.filter((i) => fields.includes(String(i.path[0])));
      if (relevantIssues.length > 0) {
        const fieldErrors: Record<string, string> = {};
        relevantIssues.forEach((issue) => {
          fieldErrors[String(issue.path[0])] = issue.message;
        });
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        fields.forEach((f) => delete next[f]);
        return next;
      });
    }
    contentScrollRef.current?.scrollTo({ top: 0 });
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (isFirstStep) {
      handleClose();
      return;
    }
    contentScrollRef.current?.scrollTo({ top: 0 });
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const parsed = orderSchema.safeParse(currentFormData());

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(fieldErrors);
      // Saltar al paso más temprano que tenga un error, así el usuario nunca
      // ve "hay errores" sin poder ubicarlos en la pantalla actual.
      const earliestStep = Math.min(
        ...Object.keys(fieldErrors).map((f) => FIELD_STEP[f] ?? STEPS.length - 1)
      );
      if (Number.isFinite(earliestStep) && earliestStep !== step) {
        setStep(earliestStep);
      }
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
        productionAreas: productionAreas.length > 0 ? productionAreas : undefined,
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

  const selectedClientLabel = clientId
    ? clientLabel(clients.find((c) => c.id === clientId) ?? ({} as Client)) || clientNameOverride
    : clientNameOverride;

  const assignedUserLabel = useMemo(() => {
    if (!assignedUserId) return "Sin asignar";
    if (sharedAccountForArea?.id === assignedUserId) {
      return requiresDesign ? "Cualquier diseñador (área Diseño)" : `Área: ${getAreaLabel(assignmentArea ?? "")}`;
    }
    const u = users.find((usr) => usr.id === assignedUserId);
    return u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username : "Sin asignar";
  }, [assignedUserId, sharedAccountForArea, requiresDesign, assignmentArea, users]);

  const namedProductRows = rows.filter((r) => r.customName && r.quantity);

  const errorSummary = (Object.keys(errors).length > 0 || submitError) && (
    <div
      ref={errorSummaryRef}
      role="alert"
      tabIndex={-1}
      className="mb-4 space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 outline-none"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertCircle className="h-4 w-4" />
        Revisar los siguientes datos antes de continuar
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
  );

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "elevation-2 bg-popover fixed z-50 flex flex-col shadow-lg outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              // Móvil: wizard a pantalla completa.
              "inset-0 h-full w-full data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
              // Escritorio: panel lateral de altura completa, desliza desde la derecha.
              "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-full sm:max-w-3xl sm:border-l sm:border-border sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right"
            )}
          >
            <DialogPrimitive.Title className="sr-only">Nuevo pedido</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Formulario de creación de pedido en pasos: cliente, detalles, productos y revisión.
            </DialogPrimitive.Description>

            {/* Cabecera: título + progreso + cerrar. Fija arriba. */}
            <div className="shrink-0 border-b border-border px-4 pb-3 pt-[calc(0.875rem+env(safe-area-inset-top))] sm:px-8 sm:pb-4 sm:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight sm:text-lg">Nuevo Pedido</p>
                  <p className="text-xs text-muted-foreground sm:hidden" aria-live="polite">
                    Paso {step + 1} de {STEPS.length} · {STEPS[step].label}
                  </p>
                </div>
                <DialogPrimitive.Close
                  aria-label="Cerrar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>
              {/* Progreso segmentado, sólo en móvil (en escritorio la lista lateral ya lo muestra). */}
              <div className="mt-3 flex gap-1 sm:hidden">
                {STEPS.map((s, i) => (
                  <div
                    key={s.key}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= step ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 sm:flex-row">
              {/* Lista de pasos, sólo escritorio — indicador de progreso, no clicable. */}
              <div className="hidden w-56 shrink-0 border-r border-border p-6 sm:block">
                <ol className="space-y-1">
                  {STEPS.map((s, i) => {
                    const StepIcon = s.icon;
                    const isDone = i < step;
                    const isCurrent = i === step;
                    return (
                      <li
                        key={s.key}
                        aria-current={isCurrent ? "step" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                          isCurrent && "bg-primary/10 font-medium text-primary",
                          !isCurrent && isDone && "text-foreground",
                          !isCurrent && !isDone && "text-muted-foreground"
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        ) : isCurrent ? (
                          <StepIcon className="h-4 w-4 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 opacity-40" />
                        )}
                        <span className="truncate">{s.label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Contenido del paso actual. */}
              <div
                ref={contentScrollRef}
                tabIndex={-1}
                className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 outline-none sm:px-8 sm:py-6"
              >
                {errorSummary}

                {step === 0 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold">Cliente</h3>
                      <p className="text-xs text-muted-foreground">
                        A quién se le factura y entrega este pedido.
                      </p>
                    </div>
                    <FormField label="Cliente" icon={UserRound} required error={errors.clientId}>
                      <div
                        ref={(el) => {
                          fieldRefs.current.clientId = el;
                        }}
                        tabIndex={-1}
                        className="flex flex-col gap-2 outline-none sm:flex-row"
                      >
                        <CreatableCombobox
                          className="flex-1"
                          items={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                          selectedId={clientId ?? null}
                          customValue={clientNameOverride}
                          placeholder="Buscar o escribir nombre de cliente..."
                          createLabel={(value) => `Usar "${value}" como nombre de cliente`}
                          emptyLabel="No hay clientes registrados. Escribir un nombre para usarlo directamente."
                          onSelectItem={(item) => {
                            setClientId(Number(item.id));
                            setClientNameOverride("");
                            setErrors((prev) => {
                              const rest = { ...prev };
                              delete rest.clientId;
                              return rest;
                            });
                          }}
                          onUseCustom={(text) => {
                            setClientId(undefined);
                            setClientNameOverride(text);
                            setErrors((prev) => {
                              const rest = { ...prev };
                              delete rest.clientId;
                              return rest;
                            });
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full shrink-0 gap-1.5 sm:w-auto"
                          onClick={() => setNewClientOpen(true)}
                          title="Dar de alta un cliente completo (teléfono, email, empresa) sin salir de este formulario"
                        >
                          <UserPlus className="h-4 w-4" /> Nuevo cliente
                        </Button>
                      </div>
                    </FormField>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold">Detalles del pedido</h3>
                      <p className="text-xs text-muted-foreground">
                        Área, quién lo trabaja y qué se pide.
                      </p>
                    </div>

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
                          className="flex h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none sm:h-9"
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
                        label={requiresDesign ? "Asignar a diseñador" : "Asignar a"}
                        icon={Users2}
                        required={requiresDesign}
                        error={errors.assignedUserId}
                        hint={
                          requiresDesign
                            ? "El pedido arranca en Diseño. Se puede dejar en \"Cualquier diseñador\" para que lo tome quien esté libre."
                            : area
                            ? "Por defecto queda a nombre del área. Se puede nominar a una persona concreta."
                            : "Elegir primero el área destino."
                        }
                      >
                        <select
                          ref={(el) => {
                            fieldRefs.current.assignedUserId = el;
                          }}
                          className="flex h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none sm:h-9"
                          value={assignedUserId ?? ""}
                          disabled={!assignmentArea}
                          onChange={(e) =>
                            setAssignedUserId(e.target.value ? Number(e.target.value) : undefined)
                          }
                          onBlur={() => validateFieldOnBlur("assignedUserId")}
                        >
                          {/* Sin montaje la asignación sigue siendo opcional. */}
                          {!requiresDesign && <option value="">Sin asignar</option>}
                          {requiresDesign && !sharedAccountForArea && (
                            <option value="">Elegir diseñador...</option>
                          )}
                          {sharedAccountForArea && (
                            <option value={sharedAccountForArea.id}>
                              {requiresDesign
                                ? "Cualquier diseñador (área Diseño)"
                                : `Área: ${
                                    [sharedAccountForArea.firstName, sharedAccountForArea.lastName]
                                      .filter(Boolean)
                                      .join(" ") || sharedAccountForArea.username
                                  }`}
                            </option>
                          )}
                          {individualsInArea.map((u) => (
                            <option key={u.id} value={u.id}>
                              {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                            </option>
                          ))}
                          {/* Fallback: área sin usuarios con ese rol cargados. */}
                          {assignmentArea &&
                            usersInAssignmentArea.length === 0 &&
                            assignableUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                              </option>
                            ))}
                        </select>
                        {assignmentArea && usersInAssignmentArea.length === 0 && (
                          <p className="mt-1 text-xs text-destructive">
                            No hay usuarios con el rol{" "}
                            {requiresDesign ? "Diseño" : getAreaLabel(assignmentArea)}. Dar de alta
                            uno para poder asignar el pedido.
                          </p>
                        )}
                      </FormField>
                    </div>

                    {/* Áreas extra: caso secundario, oculto por defecto para no competir
                        visualmente con los campos principales. */}
                    {!showExtraAreas && extraAreas.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowExtraAreas(true)}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        + Agregar otra área
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium">¿Necesita más de un área?</p>
                        <p className="text-xs text-muted-foreground">
                          Marcar las áreas extra que van a trabajar el pedido. Cada una avanza por
                          su cuenta y el pedido queda listo cuando todas terminan.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {PRODUCTION_AREA_OPTIONS.filter((option) => option.value !== area).map(
                            (option) => {
                              const checked = extraAreas.includes(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  aria-pressed={checked}
                                  onClick={() =>
                                    setExtraAreas((prev) =>
                                      prev.includes(option.value)
                                        ? prev.filter((a) => a !== option.value)
                                        : [...prev, option.value]
                                    )
                                  }
                                  className={cn(
                                    "min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97]",
                                    checked
                                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                                      : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                                  )}
                                >
                                  {option.label}
                                </button>
                              );
                            }
                          )}
                        </div>
                        {productionAreas.length > 1 && (
                          <p className="pt-1 text-xs text-primary">
                            {productionAreas.length} áreas van a trabajar este pedido en paralelo.
                          </p>
                        )}
                      </div>
                    )}

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
                          className="h-11 focus-visible:ring-0 focus-visible:border-primary transition-colors sm:h-9"
                        />
                      </FormField>
                      <FormField label="Hora de Entrega (opcional)" icon={Clock}>
                        <Input
                          type="time"
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value)}
                          disabled={!deliveryDate}
                          className="h-11 focus-visible:ring-0 focus-visible:border-primary transition-colors sm:h-9"
                        />
                      </FormField>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold">Productos</h3>
                      <p className="text-xs text-muted-foreground">
                        Una línea por cada producto del pedido.
                      </p>
                    </div>

                    {productPresets.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Frecuentes — tocar para agregar
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {productPresets.slice(0, 10).map((preset) => {
                            const row = rows.find(
                              (r) => r.customName?.trim().toLowerCase() === preset.name.trim().toLowerCase()
                            );
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => addPresetProduct(preset.name)}
                                className={cn(
                                  "flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97]",
                                  row
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                                )}
                              >
                                <Plus className="h-3 w-3" />
                                {preset.name}
                                {row?.quantity ? (
                                  <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                                    {row.quantity}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {rows.map((row, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <CreatableCombobox
                            className="min-w-[10rem] flex-1"
                            items={productPresets.map((p) => ({ id: p.id, label: p.name }))}
                            selectedId={null}
                            customValue={row.customName}
                            placeholder="Buscar o escribir producto..."
                            createLabel={(value) => `Usar "${value}" como producto nuevo`}
                            emptyLabel="No hay productos frecuentes aún. Escribir uno para usarlo."
                            onSelectItem={(item) => updateRow(index, "customName", item.label)}
                            onUseCustom={(text) => updateRow(index, "customName", text)}
                          />
                          <Input
                            type="number"
                            min={1}
                            className="h-11 w-24 focus-visible:ring-0 focus-visible:border-primary transition-colors sm:h-9"
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
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold">Revisar y confirmar</h3>
                      <p className="text-xs text-muted-foreground">
                        Un último vistazo antes de crear el pedido.
                      </p>
                    </div>

                    <div className="divide-y divide-border/60 rounded-xl border border-border">
                      <SummaryRow label="Cliente" value={selectedClientLabel || "—"} />
                      <SummaryRow label="¿Requiere diseño?" value={requiresDesign ? "Sí" : "No"} />
                      <SummaryRow
                        label={requiresDesign ? "Área de producción" : "Área destino"}
                        value={area ? getAreaLabel(area) : "Sin definir"}
                      />
                      {productionAreas.length > 1 && (
                        <SummaryRow
                          label="Áreas extra"
                          value={productionAreas
                            .filter((a) => a !== area)
                            .map((a) => getAreaLabel(a))
                            .join(", ")}
                        />
                      )}
                      <SummaryRow label="Asignado a" value={assignedUserLabel} />
                      <SummaryRow label="Descripción" value={description || "—"} />
                      <SummaryRow
                        label="Entrega"
                        value={
                          deliveryDate
                            ? `${deliveryDate}${deliveryTime ? ` · ${deliveryTime}` : ""}`
                            : "Sin definir"
                        }
                      />
                      <SummaryRow
                        label="Productos"
                        value={
                          namedProductRows.length > 0
                            ? namedProductRows.map((r) => `${r.customName} ×${r.quantity}`).join(", ")
                            : "Sin productos cargados"
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Hoja de autorización (opcional)</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,application/pdf"
                          onChange={handleAuthorizationFileChange}
                          className="block flex-1 min-w-[12rem] text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                        />
                        <CameraCaptureButton onChange={handleAuthorizationFileChange} />
                      </div>
                      <p className="text-xs text-muted-foreground">PNG, JPG o PDF. Máximo 5MB.</p>

                      {authorizationFile && (
                        <div className="flex items-center gap-3 rounded-lg border p-2">
                          {authorizationFilePreview ? (
                            <PreviewImage
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
                  </div>
                )}
              </div>
            </div>

            {/* Navegación: fija abajo. */}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-between sm:px-8 sm:py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={goBack}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {isFirstStep ? "Cancelar" : "Atrás"}
              </Button>
              {isLastStep ? (
                <motion.div className="w-full sm:w-auto" {...(submitting ? {} : formButtonMotion)}>
                  <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Guardando..." : "Crear Pedido"}
                  </Button>
                </motion.div>
              ) : (
                <Button type="button" onClick={goNext} className="w-full sm:w-auto">
                  Siguiente
                </Button>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <CreateClientDialog
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onCreated={(client) => setClientId(client.id)}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{value}</span>
    </div>
  );
}
