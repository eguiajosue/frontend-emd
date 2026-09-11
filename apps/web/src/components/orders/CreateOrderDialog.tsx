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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AREA_OPTIONS, PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { combineDateAndTime } from "@/lib/format";
import { orderCreatedMessage } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import { PreviewImage } from "@/components/ui/preview-image";
import { CameraCaptureButton } from "@/components/ui/camera-capture-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  UploadedFileInput,
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
    orderProducts: z.array(orderProductSchema).min(1, "Agregá al menos un producto"),
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
  orderProducts: "Productos",
};

/** Rol del área de Diseño; los pedidos con montaje arrancan siempre acá. */
const DESIGN_ROLE = "diseno";

/**
 * Memoria local (por navegador, no por servidor) para reducir repetición en
 * jornadas de muchos pedidos seguidos: último cliente usado (para el chip
 * "Recientes") y últimos valores de área/diseño (como default sugerido, no
 * autocompletado silencioso — siempre editable antes de enviar).
 */
const RECENT_CLIENTS_KEY = "emd:recentClientIds";
const LAST_DEFAULTS_KEY = "emd:lastOrderDefaults";
const MAX_RECENT_CLIENTS = 6;

interface LastOrderDefaults {
  requiresDesign: boolean;
  area?: string;
}

function readRecentClientIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CLIENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

function pushRecentClientId(id: number) {
  if (typeof window === "undefined") return;
  try {
    const next = [id, ...readRecentClientIds().filter((existing) => existing !== id)].slice(
      0,
      MAX_RECENT_CLIENTS
    );
    window.localStorage.setItem(RECENT_CLIENTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage puede fallar (modo privado, cuota) — no es crítico, se ignora.
  }
}

function readLastOrderDefaults(): LastOrderDefaults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_DEFAULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      requiresDesign: Boolean(parsed.requiresDesign),
      area: typeof parsed.area === "string" ? parsed.area : undefined,
    };
  } catch {
    return null;
  }
}

function writeLastOrderDefaults(defaults: LastOrderDefaults) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // Ídem: no crítico si falla.
  }
}

interface OrderProductRow {
  customName?: string;
  quantity?: number;
}

interface CreateOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el pedido recién creado (ej. para abrir su detalle). */
  onCreated?: (order: Order) => void;
  /** Precarga el cliente (ver "Crear otro pedido para este cliente" en el toast de éxito). */
  initialClientId?: number;
  initialClientNameOverride?: string;
  /**
   * Se llama al tocar "Crear otro pedido para {cliente}" en el toast de
   * éxito — el padre decide cómo reabrir el diálogo (ver `orders/page.tsx`).
   */
  onCreateAnother?: (clientId: number | undefined, clientNameOverride: string) => void;
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
  orderProducts: 2,
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
export function CreateOrderDialog({
  open,
  onClose,
  onCreated,
  initialClientId,
  initialClientNameOverride,
  onCreateAnother,
}: CreateOrderDialogProps) {
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
  /** Fila con nombre pero sin cantidad (o viceversa): error puntual por fila, en vez de descartarla en silencio. */
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientResourceFile, setClientResourceFile] = useState<UploadedFileInput | null>(null);
  const [clientResourceFilePreview, setClientResourceFilePreview] = useState<string | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [recentClientIds, setRecentClientIds] = useState<number[]>([]);
  /** Confirmación antes de cerrar y perder datos ya cargados (Escape, click afuera, "Cancelar"). */
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  // Arranca siempre en el paso 1 cada vez que se abre — salvo que venga con
  // un cliente precargado ("Crear otro pedido para {cliente}" desde el toast
  // de éxito), en cuyo caso ese paso ya está resuelto y se salta directo a
  // Detalles.
  useEffect(() => {
    if (!open) return;
    setRecentClientIds(readRecentClientIds());
    if (initialClientId !== undefined || initialClientNameOverride) {
      setClientId(initialClientId);
      setClientNameOverride(initialClientNameOverride ?? "");
      setStep(1);
    } else {
      setStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setStep(0);
    setClientId(undefined);
    setClientNameOverride("");
    const lastDefaults = readLastOrderDefaults();
    setRequiresDesign(lastDefaults?.requiresDesign ?? true);
    setArea(lastDefaults?.area);
    setExtraAreas([]);
    setShowExtraAreas(false);
    setAssignedUserId(undefined);
    setDescription("");
    setDeliveryDate("");
    setDeliveryTime("");
    setRows([{}]);
    setRowErrors({});
    setErrors({});
    setSubmitError(null);
    if (clientResourceFilePreview) URL.revokeObjectURL(clientResourceFilePreview);
    setClientResourceFile(null);
    setClientResourceFilePreview(null);
  };

  /** `true` si hay algo cargado que se perdería al cerrar sin confirmar. */
  const hasUnsavedData = () =>
    Boolean(
      clientId ||
        clientNameOverride.trim() ||
        description.trim() ||
        area ||
        assignedUserId ||
        deliveryDate ||
        extraAreas.length > 0 ||
        rows.some((r) => r.customName?.trim() || r.quantity) ||
        clientResourceFile
    );

  const discardAndClose = () => {
    resetForm();
    onClose();
  };

  /** Cierra el diálogo — pide confirmar primero si hay datos cargados (Escape, click afuera, X, Cancelar). */
  const handleClose = () => {
    if (submitting) return;
    if (hasUnsavedData()) {
      setConfirmDiscardOpen(true);
      return;
    }
    discardAndClose();
  };

  const handleClientResourceFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalized = await normalizeImageFile(file);
    if (!normalized || !isAllowedUploadMime(normalized.type)) {
      toast.error("Los archivos del cliente deben ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (normalized.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("Cada archivo del cliente puede pesar hasta 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsedFile = await readFileAsUploadInput(normalized);
      setClientResourceFile(parsedFile);
      setClientResourceFilePreview(
        normalized.type.startsWith("image/") ? URL.createObjectURL(normalized) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentar de nuevo.");
    } finally {
      e.target.value = "";
    }
  };

  const removeClientResourceFile = () => {
    if (clientResourceFilePreview) URL.revokeObjectURL(clientResourceFilePreview);
    setClientResourceFile(null);
    setClientResourceFilePreview(null);
  };

  const addRow = () => setRows((prev) => [...prev, {}]);
  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([i, msg]) => {
        const n = Number(i);
        if (n < index) next[n] = msg;
        else if (n > index) next[n - 1] = msg;
      });
      return next;
    });
  };
  const updateRow = <K extends keyof OrderProductRow>(
    index: number,
    field: K,
    value: OrderProductRow[K]
  ) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
    setRowErrors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  /**
   * Elige el producto de una fila desde el combobox (preset o texto libre):
   * si ya hay otra fila con el mismo nombre, fusiona ahí en vez de dejar dos
   * líneas separadas del mismo producto (ver auditoría de power users).
   */
  const setRowProductName = (index: number, name: string) => {
    setRows((prev) => {
      const dupIndex = prev.findIndex(
        (r, i) => i !== index && r.customName?.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (dupIndex < 0) {
        return prev.map((row, i) => (i === index ? { ...row, customName: name } : row));
      }
      const next = [...prev];
      next[dupIndex] = {
        ...next[dupIndex],
        quantity: (next[dupIndex].quantity ?? 0) + (prev[index].quantity ?? 1),
      };
      if (next.length > 1) {
        next.splice(index, 1);
      } else {
        next[index] = {};
      }
      return next;
    });
    setRowErrors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  /**
   * Filas con nombre pero sin cantidad (o viceversa) — antes se descartaban
   * en silencio al enviar; ahora bloquean el avance con un error puntual.
   * Filas totalmente vacías (la de arranque, o una agregada y no tocada) se
   * ignoran: no son un error, son espacio sin usar.
   */
  const getProductRowIssues = () => {
    const nextRowErrors: Record<number, string> = {};
    let completeCount = 0;
    rows.forEach((row, i) => {
      const hasName = Boolean(row.customName?.trim());
      const hasQty = row.quantity !== undefined && row.quantity > 0;
      if (hasName && hasQty) {
        completeCount++;
      } else if (hasName && !hasQty) {
        nextRowErrors[i] = "Falta la cantidad";
      } else if (!hasName && hasQty) {
        nextRowErrors[i] = "Falta el nombre del producto";
      }
    });
    return { rowErrors: nextRowErrors, hasAtLeastOne: completeCount > 0 };
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

  /** Últimos clientes usados (ver `pushRecentClientId`), resueltos contra la lista real. */
  const recentClients = useMemo(
    () =>
      recentClientIds
        .map((id) => clients.find((c) => c.id === id))
        .filter((c): c is Client => Boolean(c)),
    [recentClientIds, clients]
  );

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
    // Paso "Productos": validación propia por fila (no por schema global, así
    // se puede avisar "falta la cantidad" en la fila exacta en vez de
    // descartarla en silencio al enviar — ver auditoría UX).
    if (STEPS[step].key === "products") {
      const { rowErrors: nextRowErrors, hasAtLeastOne } = getProductRowIssues();
      if (Object.keys(nextRowErrors).length > 0 || !hasAtLeastOne) {
        setRowErrors(nextRowErrors);
        setErrors((prev) => ({
          ...prev,
          orderProducts: hasAtLeastOne
            ? "Hay productos incompletos"
            : "Agregá al menos un producto",
        }));
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }
      setRowErrors({});
      setErrors((prev) => {
        const next = { ...prev };
        delete next.orderProducts;
        return next;
      });
      contentScrollRef.current?.scrollTo({ top: 0 });
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      return;
    }

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
    const { rowErrors: nextRowErrors, hasAtLeastOne } = getProductRowIssues();
    if (Object.keys(nextRowErrors).length > 0 || !hasAtLeastOne) {
      setRowErrors(nextRowErrors);
      setErrors((prev) => ({
        ...prev,
        orderProducts: hasAtLeastOne ? "Hay productos incompletos" : "Agregá al menos un producto",
      }));
      setStep(FIELD_STEP.orderProducts);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

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
        clientResourceFile: clientResourceFile ?? undefined,
      });

      // Guardado ANTES de resetForm()/onClose(), que borran clientId — se
      // usan para el chip "Recientes" del próximo pedido y la acción "Crear
      // otro pedido para {cliente}" del toast.
      const submittedClientId = parsed.data.clientId;
      const submittedClientLabel = selectedClientLabel || parsed.data.clientNameOverride || "";
      if (submittedClientId) pushRecentClientId(submittedClientId);
      writeLastOrderDefaults({ requiresDesign: parsed.data.requiresDesign, area: parsed.data.area });

      toast.success(orderCreatedMessage(), {
        action: onCreateAnother
          ? {
              label: submittedClientLabel
                ? `Crear otro para ${submittedClientLabel}`
                : "Crear otro pedido",
              onClick: () => onCreateAnother(submittedClientId, submittedClientLabel),
            }
          : undefined,
      });
      resetForm();
      onClose();
      onCreated?.(order);
    } catch (error) {
      // El toast de error ya lo dispara el feedback global (ver
      // src/app/providers.tsx); acá sólo sumamos el resumen accesible —
      // mismo mensaje que ese toast (no uno crudo distinto), vía el mismo
      // helper `getErrorMessage`.
      setSubmitError(getErrorMessage(error, "No se pudo crear el pedido."));
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLastStep) {
      void handleSubmit();
    } else {
      goNext();
    }
  };

  /** Ctrl/Cmd+Enter avanza o crea el pedido desde cualquier campo, no sólo desde Revisar. */
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (isLastStep) {
        void handleSubmit();
      } else {
        goNext();
      }
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
            onOpenAutoFocus={(e) => {
              // Sin esto el foco por defecto de Radix iría al primer elemento
              // tabbable en orden de DOM — la "X" de cerrar — en vez del
              // primer campo real del wizard.
              e.preventDefault();
              requestAnimationFrame(() => fieldRefs.current.clientId?.focus());
            }}
            className={cn(
              "elevation-2 bg-popover fixed z-50 flex flex-col shadow-lg outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              // Móvil: wizard a pantalla completa. `100dvh`, no `h-full`
              // (=100vh): con `fixed` + `h-full`, el teclado en pantalla no
              // reduce la altura del contenedor y el footer con
              // Atrás/Siguiente puede quedar tapado (mismo bug ya resuelto en
              // el chat, ver dashboard/chat/page.tsx).
              "inset-0 h-[100dvh] w-full data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
              // Escritorio: panel lateral de altura completa, desliza desde la derecha.
              "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-full sm:max-w-3xl sm:border-l sm:border-border sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right"
            )}
          >
            <DialogPrimitive.Title className="sr-only">Nuevo pedido</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Formulario de creación de pedido en pasos: cliente, detalles, productos y revisión.
            </DialogPrimitive.Description>

            {/*
              `display: contents` (className "contents"): un `<form>` no
              rompe el layout flex del Content (header/body/footer) porque
              queda "invisible" para el flujo, pero habilita Enter para
              avanzar de paso / crear el pedido (excepto en el Textarea de
              descripción, donde Enter escribe un salto de línea como
              siempre) y Ctrl/Cmd+Enter para lo mismo desde cualquier campo.
            */}
            <form
              className="contents"
              onSubmit={handleFormSubmit}
              onKeyDown={handleFormKeyDown}
            >
            {/* Cabecera: título + progreso + cerrar. Fija arriba. */}
            <div className="shrink-0 border-b border-border px-4 pb-3 pt-[calc(0.875rem+env(safe-area-inset-top))] sm:px-8 sm:pb-4 sm:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight sm:text-lg">Nuevo pedido</p>
                  {/*
                    `sm:sr-only`, no `sm:hidden`: en escritorio la lista de
                    pasos ya lo muestra visualmente, pero el anuncio en vivo
                    para lectores de pantalla ("cambió el paso") tiene que
                    seguir en el árbol de accesibilidad — `hidden` lo sacaba
                    también de ahí, así que sólo móvil se enteraba del cambio.
                  */}
                  <p className="text-xs text-muted-foreground sm:sr-only" aria-live="polite">
                    Paso {step + 1} de {STEPS.length} · {STEPS[step].label}
                  </p>
                </div>
                <DialogPrimitive.Close
                  type="button"
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
              <div className="hidden w-64 shrink-0 border-r border-border p-6 sm:block">
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
                    {recentClients.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Recientes — tocar para elegir
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {recentClients.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              aria-pressed={clientId === c.id}
                              onClick={() => {
                                setClientId(c.id);
                                setClientNameOverride("");
                                setErrors((prev) => {
                                  const rest = { ...prev };
                                  delete rest.clientId;
                                  return rest;
                                });
                              }}
                              className={cn(
                                "flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9",
                                clientId === c.id
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                              )}
                            >
                              <UserRound className="h-3 w-3" />
                              {clientLabel(c)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <FormField
                      label="Cliente"
                      htmlFor="order-client"
                      icon={UserRound}
                      required
                      error={errors.clientId}
                    >
                      <div
                        ref={(el) => {
                          fieldRefs.current.clientId = el;
                        }}
                        tabIndex={-1}
                        className="flex flex-col gap-2 outline-none sm:flex-row"
                      >
                        <CreatableCombobox
                          id="order-client"
                          required
                          invalid={Boolean(errors.clientId)}
                          describedBy={errors.clientId ? "order-client-error" : undefined}
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
                        htmlFor="order-area"
                        icon={Building2}
                        required={!requiresDesign}
                        error={errors.area}
                        hint={
                          requiresDesign
                            ? "Se puede dejar sin definir y elegirla más adelante (Recepción o Diseño)."
                            : undefined
                        }
                      >
                        <Select
                          value={area ?? ""}
                          onValueChange={(v) => {
                            setArea(v || undefined);
                            setErrors((prev) => {
                              const rest = { ...prev };
                              delete rest.area;
                              return rest;
                            });
                          }}
                        >
                          <SelectTrigger
                            id="order-area"
                            ref={(el) => {
                              fieldRefs.current.area = el;
                            }}
                            aria-required={!requiresDesign}
                            aria-invalid={Boolean(errors.area)}
                            aria-describedby={errors.area ? "order-area-error" : undefined}
                            onBlur={() => validateFieldOnBlur("area")}
                            className="h-11 sm:h-9"
                          >
                            <SelectValue
                              placeholder={
                                requiresDesign ? "Sin definir todavía..." : "Selecciona un área..."
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(requiresDesign ? PRODUCTION_AREA_OPTIONS : AREA_OPTIONS).map((a) => (
                              <SelectItem key={a.value} value={a.value}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        label={requiresDesign ? "Asignar a diseñador" : "Asignar a"}
                        htmlFor="order-assigned"
                        icon={Users2}
                        required={requiresDesign}
                        error={
                          errors.assignedUserId ??
                          (assignmentArea && usersInAssignmentArea.length === 0
                            ? `No hay usuarios con el rol ${
                                requiresDesign ? "Diseño" : getAreaLabel(assignmentArea)
                              }. Dar de alta uno para poder asignar el pedido.`
                            : undefined)
                        }
                        hint={
                          requiresDesign
                            ? "El pedido arranca en Diseño. Se puede dejar en \"Cualquier diseñador\" para que lo tome quien esté libre."
                            : area
                            ? "Por defecto queda a nombre del área. Se puede nominar a una persona concreta."
                            : "Elegir primero el área destino."
                        }
                      >
                        <Select
                          value={assignedUserId !== undefined ? String(assignedUserId) : ""}
                          disabled={!assignmentArea}
                          onValueChange={(v) => {
                            setAssignedUserId(
                              v && v !== "__none__" ? Number(v) : undefined
                            );
                            setErrors((prev) => {
                              const rest = { ...prev };
                              delete rest.assignedUserId;
                              return rest;
                            });
                          }}
                        >
                          <SelectTrigger
                            id="order-assigned"
                            ref={(el) => {
                              fieldRefs.current.assignedUserId = el;
                            }}
                            aria-required={requiresDesign}
                            aria-invalid={Boolean(errors.assignedUserId)}
                            aria-describedby={
                              errors.assignedUserId ? "order-assigned-error" : undefined
                            }
                            onBlur={() => validateFieldOnBlur("assignedUserId")}
                            className="h-11 sm:h-9"
                          >
                            <SelectValue
                              placeholder={!requiresDesign ? "Sin asignar" : "Elegir diseñador..."}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Sin montaje la asignación sigue siendo opcional. */}
                            {!requiresDesign && (
                              <SelectItem value="__none__">Sin asignar</SelectItem>
                            )}
                            {sharedAccountForArea && (
                              <SelectItem value={String(sharedAccountForArea.id)}>
                                {requiresDesign
                                  ? "Cualquier diseñador (área Diseño)"
                                  : `Área: ${
                                      [sharedAccountForArea.firstName, sharedAccountForArea.lastName]
                                        .filter(Boolean)
                                        .join(" ") || sharedAccountForArea.username
                                    }`}
                              </SelectItem>
                            )}
                            {individualsInArea.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                              </SelectItem>
                            ))}
                            {/* Fallback: área sin usuarios con ese rol cargados. */}
                            {assignmentArea &&
                              usersInAssignmentArea.length === 0 &&
                              assignableUsers.map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
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
                                    "min-h-11 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9",
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

                    <FormField
                      label="Descripción"
                      htmlFor="order-description"
                      icon={FileText}
                      required
                      error={errors.description}
                    >
                      <Textarea
                        id="order-description"
                        ref={(el) => {
                          fieldRefs.current.description = el;
                        }}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => validateFieldOnBlur("description")}
                        aria-required
                        aria-invalid={Boolean(errors.description)}
                        aria-describedby={errors.description ? "order-description-error" : undefined}
                        className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Fecha de Entrega" htmlFor="order-delivery-date" icon={CalendarClock}>
                        <Input
                          id="order-delivery-date"
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="h-11 focus-visible:ring-0 focus-visible:border-primary transition-colors sm:h-9"
                        />
                      </FormField>
                      <FormField
                        label="Hora de Entrega (opcional)"
                        htmlFor="order-delivery-time"
                        icon={Clock}
                      >
                        <Input
                          id="order-delivery-time"
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
                                  "flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-9",
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
                        <div key={index} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CreatableCombobox
                              className="min-w-[10rem] flex-1"
                              invalid={Boolean(rowErrors[index])}
                              items={productPresets.map((p) => ({ id: p.id, label: p.name }))}
                              selectedId={null}
                              customValue={row.customName}
                              placeholder="Buscar o escribir producto..."
                              createLabel={(value) => `Usar "${value}" como producto nuevo`}
                              emptyLabel="No hay productos frecuentes aún. Escribir uno para usarlo."
                              onSelectItem={(item) => setRowProductName(index, item.label)}
                              onUseCustom={(text) => setRowProductName(index, text)}
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              aria-invalid={Boolean(rowErrors[index])}
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
                          {rowErrors[index] && (
                            <p role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              {rowErrors[index]}
                            </p>
                          )}
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

                    <FormField
                      label="Archivos del cliente (opcional)"
                      htmlFor="order-client-resource-file"
                      icon={Paperclip}
                      hint="Los recursos que mandó el cliente para poder hacer el diseño (logo, referencias). No es la hoja de autorización: esa la arma Diseño más adelante. PNG, JPG o PDF, máximo 5MB."
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="order-client-resource-file"
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,application/pdf"
                          onChange={handleClientResourceFileChange}
                          className="block flex-1 min-w-[12rem] rounded-lg border border-input text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                        />
                        <CameraCaptureButton onChange={handleClientResourceFileChange} />
                      </div>

                      {clientResourceFile && (
                        <div className="flex items-center gap-3 rounded-lg border p-2">
                          {clientResourceFilePreview ? (
                            <PreviewImage
                              src={clientResourceFilePreview}
                              alt={clientResourceFile.filename}
                              className="h-14 w-14 rounded object-cover"
                            />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{clientResourceFile.filename}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip className="h-3 w-3" /> Listo para enviar
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={removeClientResourceFile}
                            aria-label="Quitar archivo"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </FormField>
                  </div>
                )}
              </div>
            </div>

            {/* Navegación: fija abajo. Los botones son `type="submit"`: el
                `<form>` de arriba decide avanzar o crear según `isLastStep`
                (ver `handleFormSubmit`), lo que además habilita Enter/Ctrl+Enter. */}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-between sm:px-8 sm:py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={goBack}
                disabled={submitting}
                className="h-11 w-full sm:h-9 sm:w-auto"
              >
                {isFirstStep ? "Cancelar" : "Atrás"}
              </Button>
              {isLastStep ? (
                <motion.div className="w-full sm:w-auto" {...(submitting ? {} : formButtonMotion)}>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 w-full sm:h-9 sm:w-auto"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Guardando..." : "Crear Pedido"}
                  </Button>
                </motion.div>
              ) : (
                <Button type="submit" className="h-11 w-full sm:h-9 sm:w-auto">
                  Siguiente
                </Button>
              )}
            </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Confirmar antes de descartar un pedido con datos cargados (Escape, click afuera, X, Cancelar). */}
      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay datos cargados que todavía no se guardaron. Si cerrás ahora se pierden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDiscardOpen(false);
                discardAndClose();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateClientDialog
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        initialFirstName={clientNameOverride}
        onCreated={(client) => {
          setClientId(client.id);
          setClientNameOverride("");
        }}
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
