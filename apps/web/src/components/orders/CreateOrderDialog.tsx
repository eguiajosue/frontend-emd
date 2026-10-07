"use client";

import { OrderProductSizesField } from "@/components/orders/OrderProductSizesField";
import { sizeBreakdownTotal, type SizeBreakdown } from "@/lib/garmentSizes";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { toast } from "sonner";
import { z } from "zod";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookmarkPlus,
  CalendarDays,
  Check,
  Download,
  Sparkles,
  FileText,
  Loader2,
  Minus,
  Paperclip,
  Plus,
  RotateCcw,
  Shirt,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { PreviewImage } from "@/components/ui/preview-image";
import { CameraCaptureButton } from "@/components/ui/camera-capture-button";
import { CreateClientDialog } from "@/components/orders/CreateClientDialog";
import { SaveOrderTemplateDialog } from "@/components/orders/SaveOrderTemplateDialog";
import { MockupStudioDialog } from "@/components/mockups/MockupStudioDialog";
import { mockupErrorMessage, orderMockupsKey, postOrderMockup } from "@/hooks/useOrderMockups";
import { downloadFromUrl } from "@/lib/download";
import { buildMockupPayload, mockupFilename, type MockupStudioResult } from "@/lib/mockups/studio";
import { GARMENT_LABELS, type CreateOrderMockupPayload } from "@/lib/mockups/types";
import { CustomizeFrequentsDialog, resolveFrequents } from "@/components/orders/CustomizeFrequentsDialog";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { CATALOG_STALE_TIME, useAuthToken, useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { useClientOrders, useOrder } from "@/hooks/useOrders";
import {
  useClientOrderTemplates,
  useOrderTemplate,
  useOrderTemplateMutations,
} from "@/hooks/useOrderTemplates";
import { useClientInsights } from "@/hooks/useClientInsights";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import {
  isAllowedUploadMime,
  normalizeImageFile,
  readFileAsUploadInput,
  UPLOAD_FILE_MAX_BYTES,
} from "@/lib/fileInput";
import { AREA_ICONS, PRODUCTION_AREA_OPTIONS, getAreaLabel, type AreaValue } from "@/lib/areas";
import { DEFAULT_DELIVERY_TIME, combineDateAndTime } from "@/lib/format";
import { orderCreatedMessage } from "@/lib/copy";
import { getErrorMessage, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  DATE_FORMAT,
  DELIVERY_PRESETS,
  DELIVERY_TIME_SLOTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_LINES,
  MAX_QUANTITY,
  buildOrderSummary,
  buildRepeatPrefill,
  buildTemplatePrefill,
  clampName,
  describeOrderProducts,
  leadDaysLabel,
  learnedLeadDays,
  learnedQuantityFor,
  normalizeProductKey,
  typicalDeliveryTime,
  longDateLabel,
  mergeAreaSelection,
  parseDeliveryDate,
  presetDate,
  presetForDate,
  pushRecentClientId,
  readLastOrderDefaults,
  readRecentClientIds,
  shortDateLabel,
  suggestTemplateName,
  toRepeatMaterials,
  writeLastOrderDefaults,
  type RepeatMaterial,
} from "@/lib/createOrderForm";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import type {
  Client,
  CreateOrderPayload,
  Order,
  OrderMaterialItem,
  OrderProductPreset,
  OrderTemplate,
  UploadedFileInput,
  User,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Validación                                                                 */
/* -------------------------------------------------------------------------- */

const orderProductSchema = z.object({
  customName: z.string().min(1, "Falta el nombre del producto"),
  quantity: z.number().min(1, "La cantidad debe ser al menos 1"),
  /** Desglose de tallas; la forma fina la valida el backend. */
  sizes: z.record(z.string(), z.record(z.string(), z.number().int().min(0))).optional(),
});

/**
 * Reglas del alta (WORKFLOW.md §1). Sólo cambiaron los mensajes respecto al
 * wizard (todos en voseo); la lógica del `superRefine` es la misma.
 */
const orderSchema = z
  .object({
    clientId: z.number().optional(),
    clientNameOverride: z.string().optional(),
    area: z.string().optional(),
    requiresDesign: z.boolean(),
    description: z
      .string()
      .trim()
      .min(1, "Escribe una descripción")
      .max(MAX_DESCRIPTION_LENGTH, "Máximo 1000 caracteres"),
    deliveryDate: z.string().optional().or(z.literal("")),
    assignedUserId: z.number().optional(),
    orderProducts: z.array(orderProductSchema).min(1, "Agrega al menos un producto"),
  })
  .superRefine((data, ctx) => {
    if (!data.clientId && !data.clientNameOverride?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Selecciona o escribe un cliente",
      });
    }
    // Sin diseño el área destino es obligatoria (a donde va el pedido directo);
    // con diseño es opcional, se puede definir después (Recepción o Diseño).
    if (!data.requiresDesign && !data.area) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["area"],
        message: "Elige al menos un área de producción",
      });
    }
    // Con montaje el pedido arranca en Diseño y necesita responsable sí o sí
    // (ver WORKFLOW.md §1.a). "Cualquier diseñador" es una opción válida: se
    // resuelve a la cuenta compartida del área, no a "sin asignar".
    if (data.requiresDesign && !data.assignedUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedUserId"],
        message: "Elige un diseñador o «Cualquier diseñador»",
      });
    }
  });

/** Orden de los campos en pantalla: a dónde va el foco ante el primer error. */
const FIELD_ORDER = ["clientId", "area", "assignedUserId", "orderProducts", "description"] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

/** Iguales a los labels visibles (se usan en el aviso del footer y en "Falta: …"). */
const FIELD_LABELS: Record<FieldKey, string> = {
  clientId: "Cliente",
  area: "Áreas de producción",
  assignedUserId: "Asignar a",
  orderProducts: "Productos",
  description: "Descripción",
};

/** Rol del área de Diseño; los pedidos con montaje arrancan siempre aquí. */
const DESIGN_ROLE = "diseno";

/** Radix Select no admite `value=""`: centinela para "Sin asignar" / "Sin hora". */
const NONE = "__none__";

/** Chip seleccionable: la selección se pinta en tinta, nunca en magenta (DESIGN.md). */
const CHIP_CLASS =
  "min-h-11 rounded-full border border-border bg-card px-3.5 text-sm font-normal text-foreground gap-1.5 sm:min-h-9 " +
  "hover:bg-muted data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-ink-foreground data-[state=on]:hover:bg-ink/90";

/** Botones chicos: 44px de alto en móvil, compactos en escritorio. */
const TAP = "min-h-11 sm:min-h-0";

/** Texto de error con contraste AA también en modo oscuro. */
const ERROR_TEXT = "text-xs font-medium text-red-700 dark:text-red-400";

interface OrderProductRow {
  /** Clave estable de la fila (no viaja al backend). */
  key: string;
  customName: string;
  quantity?: number;
  /** Desglose de tallas (prendas). Si tiene piezas, `quantity` es su total. */
  sizes?: SizeBreakdown | null;
}

/** Estado del formulario antes de aplicar una base, para "Quitar base". */
interface FormSnapshot {
  requiresDesign: boolean;
  areas: string[];
  assignedUserId?: number;
  description: string;
  rows: OrderProductRow[];
  materials: RepeatMaterial[];
  defaultsApplied: boolean;
  routeTouched: boolean;
  descriptionTouched: boolean;
}

/**
 * De dónde salió lo precargado: un pedido anterior, una plantilla del
 * cliente o "lo habitual" que el sistema aprendió de sus pedidos.
 */
type BaseSource =
  | { kind: "order"; id: number }
  | { kind: "template"; id: number; name: string }
  | { kind: "suggestion"; id: number; name: string };

/** "el pedido #88" / "la plantilla «Figuras»" / "lo habitual de Luis" (para armar frases). */
function baseLabel(source: BaseSource): string {
  if (source.kind === "order") return `el pedido #${source.id}`;
  if (source.kind === "template") return `la plantilla «${source.name}»`;
  return `lo habitual de ${source.name}`;
}

/** Meta de las secciones precargadas. */
function baseMeta(source: BaseSource): string {
  if (source.kind === "order") return `Como el pedido #${source.id}`;
  if (source.kind === "template") return `Plantilla «${source.name}»`;
  return "Lo habitual";
}

/** "Del pedido #88" / "De la plantilla «X»" / "De lo habitual de Luis" (comienzo de frase). */
function baseOrigin(source: BaseSource): string {
  if (source.kind === "order") return `Del pedido #${source.id}`;
  if (source.kind === "template") return `De la plantilla «${source.name}»`;
  return `De lo habitual de ${source.name}`;
}

/** Productos que se muestran como "Suele pedir" (aparecen en 2+ pedidos suyos). */
const LEARNED_CHIPS_LIMIT = 6;

/** Pedidos anteriores que se muestran de entrada / al tocar "Ver más". */
const PREVIOUS_ORDERS_SHOWN = 3;
const PREVIOUS_ORDERS_LIMIT = 8;

interface CreateOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el pedido recién creado (ej. para abrir su detalle). */
  onCreated?: (order: Order) => void;
  /** Precarga el cliente (ver "Crear otro pedido para este cliente" en el toast de éxito). */
  initialClientId?: number;
  initialClientNameOverride?: string;
  /** Precarga la descripción (ej. "Convertir en pedido" desde una cotización aceptada). */
  initialDescription?: string;
  /**
   * Se llama al tocar "Crear otro pedido para {cliente}" en el toast de
   * éxito — el padre decide cómo reabrir el diálogo (ver `orders/page.tsx`).
   */
  onCreateAnother?: (clientId: number | undefined, clientNameOverride: string) => void;
  /**
   * "Repetir pedido" (menú del detalle): abre con el cliente y el pedido de
   * ese id ya cargados como base, sin fecha ni archivo del cliente.
   */
  repeatFromOrderId?: number;
  /** "Nuevo pedido" desde las plantillas del cliente: abre con esa plantilla aplicada. */
  templateId?: number;
}

function clientLabel(c: Client): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function userLabel(u: User): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

function focusById(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/* -------------------------------------------------------------------------- */
/* Piezas de layout                                                           */
/* -------------------------------------------------------------------------- */

/** Sección del formulario: título + contenido, separadas por espacio y hairline (sin cards). */
function Section({
  id,
  title,
  meta,
  first,
  children,
}: {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("space-y-4", !first && "border-t border-border/60 pt-6")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${id}-title`} className="text-section-title">
          {title}
        </h3>
        {meta && <span className="text-meta tabular-nums">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** Hint + error de un campo (los dos visibles a la vez, con ids para `aria-describedby`). */
function FieldMessages({ id, hint, error }: { id: string; hint?: React.ReactNode; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="text-meta">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={cn("flex items-center gap-1", ERROR_TEXT)}>
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

function OptionalTag() {
  return <span className="font-normal text-muted-foreground"> (opcional)</span>;
}

/* -------------------------------------------------------------------------- */
/* Componente                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Alta de pedido en UNA sola vista (reemplaza al wizard de 4 pasos; ver la
 * auditoría UX en el PR): Cliente → Diseño y producción → Qué se pide →
 * Entrega, con un footer fijo que resume el pedido en vivo y un único CTA.
 * Mismo contenedor que antes: panel lateral en escritorio, pantalla completa
 * en móvil. La lógica de negocio (schema, payload, asignación) no cambió.
 */
export function CreateOrderDialog({
  open,
  onClose,
  onCreated,
  initialClientId,
  initialClientNameOverride,
  initialDescription,
  onCreateAnother,
  repeatFromOrderId,
  templateId,
}: CreateOrderDialogProps) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { session } = usePermissions();
  const { formButtonMotion, reduced } = useMotionPreset();
  const { data: clients } = useEntityList<Client>("clients", { enabled: open });
  const { data: productPresets } = useEntityList<OrderProductPreset>("orderProductPresets", {
    enabled: open,
    staleTime: CATALOG_STALE_TIME,
  });
  const { data: users, isPending: usersPending } = useEntityList<User>("users", { enabled: open });
  const { preferences, updatePreferences } = useUserPreferences();
  const [frequentsOpen, setFrequentsOpen] = useState(false);
  const myFrequents = useMemo(
    () => resolveFrequents(productPresets, preferences?.frequentProductIds),
    [productPresets, preferences?.frequentProductIds]
  );
  const { create } = useEntityMutations<Order, CreateOrderPayload>("orders");

  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [clientNameOverride, setClientNameOverride] = useState("");
  /** Cliente recién dado de alta: se muestra aunque la lista todavía no se refrescó. */
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  const [requiresDesign, setRequiresDesign] = useState(true);
  /** Áreas de producción en orden de elección: la primera es la principal. */
  const [areas, setAreas] = useState<string[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [rows, setRows] = useState<OrderProductRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Cambia en cada intento: remonta el contenido del aviso para que se vuelva a anunciar. */
  const [attempt, setAttempt] = useState(0);
  /** Datos cargados por el usuario (nunca por efectos ni defaults): decide si cerrar pide confirmación. */
  const [dirty, setDirty] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [routeTouched, setRouteTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [clientResourceFile, setClientResourceFile] = useState<UploadedFileInput | null>(null);
  const [clientResourceFilePreview, setClientResourceFilePreview] = useState<string | null>(null);
  const [showFile, setShowFile] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [recentClientIds, setRecentClientIds] = useState<number[]>([]);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** URL de la preview vigente, para revocarla al cerrar o desmontar. */
  const previewUrlRef = useRef<string | null>(null);
  /** Dónde estaba el foco al pedir confirmación de descarte, para volver ahí. */
  const focusBeforeConfirmRef = useRef<HTMLElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const rowKeySeq = useRef(0);
  /** Pedido anterior o plantilla usada como base, y el estado previo a aplicarla. */
  const [base, setBase] = useState<(BaseSource & { snapshot: FormSnapshot }) | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  /** Hoja de materiales copiada de la base: se carga en el pedido nuevo al crearlo. */
  const [materials, setMaterials] = useState<RepeatMaterial[]>([]);
  /**
   * Mockups 3D armados desde aquí: se guardan en el pedido (POST aparte)
   * después de crearlo. Si alguno falla, el pedido no se toca (R2).
   */
  const [pendingMockups, setPendingMockups] = useState<{ key: string; result: MockupStudioResult }[]>([]);
  const [mockupStudioOpen, setMockupStudioOpen] = useState(false);
  const mockupKeySeq = useRef(0);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [showAllPrevious, setShowAllPrevious] = useState(false);
  /** Invalida la carga de materiales de una base anterior (se cambió o se quitó). */
  const baseRequestRef = useRef(0);
  /** Pedido (`repeatFromOrderId`) o plantilla (`templateId`) ya aplicado en esta apertura. */
  const appliedRepeatRef = useRef<number | null>(null);
  const appliedTemplateRef = useRef<number | null>(null);

  /**
   * Lo que el sistema aprendió del cliente elegido (backend:
   * client-insight.engine.ts): qué suele pedir y cuánto, por dónde va y con
   * cuánta anticipación. Alimenta "Lo habitual", los chips "Suele pedir", la
   * cantidad habitual al agregar un producto y la fecha sugerida.
   */
  const { insights } = useClientInsights(open && clientId ? clientId : null);
  const learnedProducts = useMemo(
    () => (insights?.products ?? []).filter((p) => p.orders >= 2).slice(0, LEARNED_CHIPS_LIMIT),
    [insights]
  );
  const learnedKeys = useMemo(() => new Set(learnedProducts.map((p) => p.key)), [learnedProducts]);
  const leadDays = learnedLeadDays(insights);
  const learnedTime = useMemo(() => {
    const time = typicalDeliveryTime(insights?.recentDeliveries ?? []);
    return time && DELIVERY_TIME_SLOTS.includes(time) ? time : null;
  }, [insights]);

  const nextRowKey = () => `row-${++rowKeySeq.current}`;
  const markDirty = () => setDirty(true);

  // "⌘↵" en Mac, "Ctrl ↵" en el resto. Se resuelve después de montar para no
  // desincronizar el HTML del servidor con el del cliente.
  useEffect(() => {
    setShortcutLabel(/Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘↵" : "Ctrl ↵");
  }, []);

  const clearState = () => {
    setClientId(undefined);
    setClientNameOverride("");
    setCreatedClient(null);
    setRequiresDesign(true);
    setAreas([]);
    setAssignedUserId(undefined);
    setDescription("");
    setDeliveryDate("");
    setDeliveryTime("");
    setRows([]);
    setRowErrors({});
    setErrors({});
    setSubmitError(null);
    setSubmitAttempted(false);
    setDirty(false);
    setDefaultsApplied(false);
    setRouteTouched(false);
    setDescriptionTouched(false);
    setShowFile(false);
    setLiveMessage("");
    setBase(null);
    setMaterials([]);
    setMaterialsLoading(false);
    setShowAllPrevious(false);
    setPendingMockups([]);
    baseRequestRef.current++;
    revokePreview();
    setClientResourceFile(null);
  };

  function revokePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setClientResourceFilePreview(null);
  }

  // La preview (hasta 5 MB) no se retiene después de cerrar ni de desmontar.
  useEffect(() => {
    if (!open) revokePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  // Cada apertura arranca limpia, con los últimos defaults de diseño/área a la
  // vista (antes sólo se aplicaban a partir de la segunda apertura) y, si
  // viene de "Crear otro para {cliente}", con el cliente precargado.
  useEffect(() => {
    if (!open) return;
    clearState();
    setRecentClientIds(readRecentClientIds());
    const lastDefaults = readLastOrderDefaults();
    if (lastDefaults) {
      setRequiresDesign(lastDefaults.requiresDesign);
      setAreas(lastDefaults.area ? [lastDefaults.area] : []);
      setDefaultsApplied(true);
    }
    if (initialClientId !== undefined || initialClientNameOverride) {
      setClientId(initialClientId);
      setClientNameOverride(initialClientNameOverride ?? "");
    }
    if (initialDescription) setDescription(initialDescription);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Cierra el diálogo — pide confirmar primero si el usuario cargó algo. */
  const handleClose = () => {
    if (submittingRef.current) return;
    if (dirty) {
      focusBeforeConfirmRef.current = document.activeElement as HTMLElement | null;
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  /* ------------------------------- Cliente -------------------------------- */

  const recentClients = useMemo(
    () =>
      recentClientIds
        .map((id) => clients.find((c) => c.id === id))
        .filter((c): c is Client => Boolean(c)),
    [recentClientIds, clients]
  );

  const selectedClient = clientId
    ? clients.find((c) => c.id === clientId) ?? (createdClient?.id === clientId ? createdClient : null)
    : null;
  const isFreeTextClient = !clientId && clientNameOverride.trim() !== "";
  const selectedClientLabel = selectedClient
    ? clientLabel(selectedClient)
    : clientNameOverride.trim();
  const hasClient = Boolean(clientId) || isFreeTextClient;

  const chooseClient = (id: number | undefined, freeText = "") => {
    setClientId(id);
    setClientNameOverride(freeText);
    markDirty();
    // El combobox se desmonta: el foco pasa a "Cambiar" para no perderse.
    focusById("order-client-change");
  };

  const clearClient = () => {
    // La base era de ese cliente: al cambiarlo se vuelve a lo que había antes.
    if (base) restoreSnapshot(base.snapshot);
    setClientId(undefined);
    setClientNameOverride("");
    setCreatedClient(null);
    markDirty();
    focusById("order-client");
  };

  /* -------------------------- Diseño y producción ------------------------- */

  const primaryArea = areas[0];
  // Área que decide a quién se le puede asignar el pedido (ver WORKFLOW.md §1):
  // con montaje siempre es Diseño, sin montaje es el área principal elegida.
  const assignmentArea = requiresDesign ? DESIGN_ROLE : primaryArea;

  const usersInAssignmentArea = useMemo(
    () =>
      assignmentArea ? users.filter((u) => u.roles?.some((r) => r.name === assignmentArea)) : [],
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

  // Al cambiar el área de asignación, una selección de otra área deja de ser
  // válida: se limpia y se propone la cuenta compartida del área nueva. No
  // marca `dirty` (no es algo que cargó el usuario).
  useEffect(() => {
    if (!assignmentArea) {
      if (assignedUserId !== undefined) setAssignedUserId(undefined);
      return;
    }
    const stillValid =
      assignedUserId !== undefined && usersInAssignmentArea.some((u) => u.id === assignedUserId);
    if (stillValid) return;
    if (assignedUserId !== sharedAccountForArea?.id) setAssignedUserId(sharedAccountForArea?.id);
  }, [assignmentArea, usersInAssignmentArea, sharedAccountForArea, assignedUserId]);

  const isSharedAssignee = assignedUserId !== undefined && sharedAccountForArea?.id === assignedUserId;

  const assignedUserLabel = useMemo(() => {
    if (!assignedUserId) return "Sin asignar";
    if (sharedAccountForArea?.id === assignedUserId) {
      return requiresDesign
        ? "Cualquier diseñador"
        : `Cualquiera de ${getAreaLabel(assignmentArea ?? "")}`;
    }
    const u = users.find((usr) => usr.id === assignedUserId);
    return u ? userLabel(u) : "Sin asignar";
  }, [assignedUserId, sharedAccountForArea, requiresDesign, assignmentArea, users]);

  const changeRoute = (value: string) => {
    if (!value) return;
    setRequiresDesign(value === "design");
    setRouteTouched(true);
    markDirty();
  };

  const changeAreas = (next: string[]) => {
    setAreas((prev) => mergeAreaSelection(prev, next));
    setRouteTouched(true);
    markDirty();
  };

  /* ------------------------------- Productos ------------------------------ */

  const announceMerge = (name: string, quantity: number, key: string) => {
    setLiveMessage(`Se sumó a ${name} (ahora ${quantity})`);
    if (!reduced) {
      setHighlightKey(key);
      window.setTimeout(() => setHighlightKey((k) => (k === key ? null : k)), 600);
    }
  };

  const sameName = (a?: string, b?: string) =>
    (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

  /**
   * Agrega un producto (chip frecuente o "Agregar producto…"): si ya está en
   * la lista suma 1 en vez de duplicar la línea. Si el cliente ya lo pidió
   * antes, arranca con su cantidad habitual (visible y editable).
   */
  const addProduct = (rawName: string, quantityOverride?: number) => {
    const name = clampName(rawName);
    if (!name) return;
    const existing = rows.find((r) => sameName(r.customName, name));
    markDirty();
    if (existing) {
      // Con tallas, la cantidad es su total: se suma en la grilla, no aquí.
      const sized = sizeBreakdownTotal(existing.sizes) > 0;
      const quantity = sized ? existing.quantity ?? 0 : Math.min((existing.quantity ?? 0) + 1, MAX_QUANTITY);
      setRows((prev) => prev.map((r) => (r.key === existing.key ? { ...r, quantity } : r)));
      clearRowError(existing.key);
      announceMerge(existing.customName, quantity, existing.key);
      return;
    }
    if (rows.length >= MAX_PRODUCT_LINES) {
      toast.error(`Un pedido admite hasta ${MAX_PRODUCT_LINES} líneas de producto.`);
      return;
    }
    const key = nextRowKey();
    const learned = quantityOverride ?? learnedQuantityFor(insights?.products, name);
    setRows((prev) => [...prev, { key, customName: name, quantity: learned ?? 1 }]);
    setLiveMessage(learned ? `${name} agregado con su cantidad habitual: ${learned}` : `${name} agregado`);
    // Con mouse/teclado se salta a la cantidad (escribir "50" la reemplaza).
    // En táctil no: abriría el teclado en cada toque de un chip.
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) {
      requestAnimationFrame(() => {
        const input = document.getElementById(`order-qty-${key}`) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      });
    }
  };

  /** Cambia el nombre de una fila; si coincide con otra fila, se fusionan sumando cantidades. */
  const renameRow = (key: string, rawName: string) => {
    const name = clampName(rawName);
    if (!name) return;
    markDirty();
    clearRowError(key);
    const current = rows.find((r) => r.key === key);
    const duplicate = rows.find((r) => r.key !== key && sameName(r.customName, name));
    if (!current) return;
    if (!duplicate) {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, customName: name } : r)));
      return;
    }
    const quantity = Math.min((duplicate.quantity ?? 0) + (current.quantity ?? 1), MAX_QUANTITY);
    setRows((prev) =>
      prev
        .filter((r) => r.key !== key)
        // Al fusionar dos líneas el desglose deja de cuadrar: se descarta.
        .map((r) => (r.key === duplicate.key ? { ...r, quantity, sizes: null } : r))
    );
    announceMerge(duplicate.customName, quantity, duplicate.key);
    focusById(`order-qty-${duplicate.key}`);
  };

  const setRowSizes = (key: string, sizes: SizeBreakdown | null, total: number) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, sizes, quantity: total > 0 ? total : r.quantity } : r))
    );
  };

  const setQuantity = (key: string, quantity: number | undefined) => {
    const clamped = quantity === undefined ? undefined : Math.min(Math.max(quantity, 1), MAX_QUANTITY);
    // Con tallas cargadas la cantidad es su total: no se edita a mano.
    setRows((prev) =>
      prev.map((r) => (r.key === key && !(sizeBreakdownTotal(r.sizes) > 0) ? { ...r, quantity: clamped } : r))
    );
    clearRowError(key);
    markDirty();
  };

  const removeRow = (key: string) => {
    const index = rows.findIndex((r) => r.key === key);
    const remaining = rows.filter((r) => r.key !== key);
    setRows(remaining);
    clearRowError(key);
    markDirty();
    // El botón se desmonta: el foco va a la fila vecina o a "Agregar producto".
    const neighbour = remaining[index] ?? remaining[index - 1];
    focusById(neighbour ? `order-qty-${neighbour.key}` : "order-product-add");
  };

  function clearRowError(key: string) {
    setRowErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const completeRows = rows.filter((r) => r.customName.trim() && r.quantity && r.quantity > 0);
  const unitCount = completeRows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

  /* --------------- Repetir un pedido anterior / usar una plantilla ---------- */

  // Los clientes suelen repetir el pedido ("Figuras", de vinil sobre
  // coroplast) aunque cambie el detalle (qué figuras) y la fecha. Usar un
  // pedido anterior o una plantilla del cliente como base copia lo que se
  // pide, la descripción, la ruta de diseño/producción y la hoja de
  // materiales; NUNCA la fecha ni el archivo del cliente. Siempre es una
  // acción explícita, visible y con "Quitar" para volver atrás.
  const { orders: previousOrders, isLoading: previousLoading } = useClientOrders(
    open && clientId ? clientId : null,
    { limit: PREVIOUS_ORDERS_LIMIT }
  );
  const visiblePrevious = showAllPrevious
    ? previousOrders
    : previousOrders.slice(0, PREVIOUS_ORDERS_SHOWN);
  const { templates } = useClientOrderTemplates(open && clientId ? clientId : null);
  const templateMutations = useOrderTemplateMutations();

  const { data: repeatSource } = useOrder(repeatFromOrderId, {
    enabled: open && repeatFromOrderId !== undefined,
  });
  const { data: templateSource } = useOrderTemplate(templateId, {
    enabled: open && templateId !== undefined,
  });

  const takeSnapshot = (): FormSnapshot => ({
    requiresDesign,
    areas,
    assignedUserId,
    description,
    rows,
    materials,
    defaultsApplied,
    routeTouched,
    descriptionTouched,
  });

  /** Formulario recién abierto (con los últimos defaults de diseño/área). */
  const openingSnapshot = (): FormSnapshot => {
    const lastDefaults = readLastOrderDefaults();
    return {
      requiresDesign: lastDefaults?.requiresDesign ?? true,
      areas: lastDefaults?.area ? [lastDefaults.area] : [],
      assignedUserId: undefined,
      description: "",
      rows: [],
      materials: [],
      defaultsApplied: Boolean(lastDefaults),
      routeTouched: false,
      descriptionTouched: false,
    };
  };

  function restoreSnapshot(snapshot: FormSnapshot) {
    baseRequestRef.current++;
    setRequiresDesign(snapshot.requiresDesign);
    setAreas(snapshot.areas);
    setAssignedUserId(snapshot.assignedUserId);
    setDescription(snapshot.description);
    setRows(snapshot.rows);
    setRowErrors({});
    setMaterials(snapshot.materials);
    setMaterialsLoading(false);
    setDefaultsApplied(snapshot.defaultsApplied);
    setRouteTouched(snapshot.routeTouched);
    setDescriptionTouched(snapshot.descriptionTouched);
    setBase(null);
  }

  /**
   * Vuelca lo precargado en el formulario. `snapshot` es el formulario de
   * ANTES de la primera base: cambiar de una base a otra no lo pisa, así
   * "Quitar" siempre vuelve a lo que había cargado el usuario.
   */
  function loadPrefill(
    source: BaseSource,
    prefill: {
      requiresDesign: boolean;
      areas: string[];
      assignedUserId?: number;
      description: string;
      products: Array<{ customName: string; quantity: number }>;
      materials: RepeatMaterial[];
    },
    snapshot: FormSnapshot
  ) {
    baseRequestRef.current++;
    const nextRows = prefill.products.map((p) => ({ key: nextRowKey(), ...p }));
    setBase({ ...source, snapshot });
    setRequiresDesign(prefill.requiresDesign);
    setAreas(prefill.areas);
    setAssignedUserId(prefill.assignedUserId);
    setDescription(prefill.description);
    setRows(nextRows);
    setRowErrors({});
    setDefaultsApplied(false);
    setRouteTouched(false);
    setDescriptionTouched(false);
    setMaterials(prefill.materials);
    setMaterialsLoading(false);
    markDirty();
    setLiveMessage(
      `Se cargó ${baseLabel(source)}: ${nextRows.length} ${
        nextRows.length === 1 ? "producto" : "productos"
      }. Revisa cantidades y descripción.`
    );
    // Lo que más cambia de una vez a otra es la cantidad: el foco va ahí.
    if (nextRows[0]) {
      requestAnimationFrame(() => {
        const input = document.getElementById(`order-qty-${nextRows[0].key}`) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      });
    }
  }

  /** Pedido anterior como base; su hoja de materiales se pide aparte. */
  function applyBase(order: Order, snapshot: FormSnapshot) {
    loadPrefill({ kind: "order", id: order.id }, { ...buildRepeatPrefill(order), materials: [] }, snapshot);

    const requestId = baseRequestRef.current;
    // El listado trae `materialItems` livianos: si viene vacío no hay nada que pedir.
    if (order.materialItems && order.materialItems.length === 0) return;
    setMaterialsLoading(true);
    request<OrderMaterialItem[]>(`${ENDPOINTS.orders}/${order.id}/materials`, { token })
      .then((items) => {
        if (requestId === baseRequestRef.current) setMaterials(toRepeatMaterials(items ?? []));
      })
      .catch(() => {
        if (requestId === baseRequestRef.current) {
          toast.error(`No se pudo copiar la hoja de materiales del pedido #${order.id}.`);
        }
      })
      .finally(() => {
        if (requestId === baseRequestRef.current) setMaterialsLoading(false);
      });
  }

  function applyTemplate(template: OrderTemplate, snapshot: FormSnapshot) {
    loadPrefill(
      { kind: "template", id: template.id, name: template.name },
      buildTemplatePrefill(template),
      snapshot
    );
  }

  /**
   * "Lo habitual": el pedido que el sistema aprendió de este cliente. No trae
   * descripción ni fecha (cambian cada vez): se respeta lo ya escrito.
   */
  function applySuggestion() {
    const suggestion = insights?.suggestion;
    if (!suggestion || !clientId) return;
    loadPrefill(
      { kind: "suggestion", id: clientId, name: selectedClientLabel || "el cliente" },
      {
        requiresDesign: suggestion.requiresDesign,
        areas: suggestion.areas.filter((a) => PRODUCTION_AREA_OPTIONS.some((o) => o.value === a)),
        assignedUserId: undefined,
        description,
        products: suggestion.products,
        materials: suggestion.materials.map((m) => ({
          key: `learned-${m.materialId}`,
          materialId: m.materialId,
          quantity: m.quantity,
          description: m.description,
          supplierId: m.supplierId,
          unitName: m.unitName,
        })),
      },
      base?.snapshot ?? takeSnapshot()
    );
  }

  const removeBase = () => {
    if (!base) return;
    const source: BaseSource = base;
    restoreSnapshot(base.snapshot);
    markDirty();
    setLiveMessage(`Se quitó ${baseLabel(source)}`);
    focusById(
      source.kind === "order"
        ? `order-previous-${source.id}`
        : source.kind === "template"
          ? `order-template-${source.id}`
          : "order-use-habitual"
    );
  };

  const removeMaterial = (key: string) => {
    const index = materials.findIndex((m) => m.key === key);
    const remaining = materials.filter((m) => m.key !== key);
    setMaterials(remaining);
    markDirty();
    const neighbour = remaining[index] ?? remaining[index - 1];
    focusById(neighbour ? `order-material-remove-${neighbour.key}` : "order-description");
  };

  // "Repetir pedido" desde el detalle: cliente + base apenas llega el pedido.
  // Corre después del efecto de apertura (que limpia el formulario).
  useEffect(() => {
    if (!open) {
      appliedRepeatRef.current = null;
      return;
    }
    if (!repeatSource || repeatSource.id !== repeatFromOrderId) return;
    if (appliedRepeatRef.current === repeatSource.id) return;
    appliedRepeatRef.current = repeatSource.id;
    setClientId(repeatSource.clientId ?? undefined);
    setClientNameOverride(repeatSource.clientId ? "" : repeatSource.clientNameOverride?.trim() ?? "");
    applyBase(repeatSource, openingSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repeatSource, repeatFromOrderId]);

  // "Nuevo pedido" desde las plantillas del cliente (pantalla Clientes).
  useEffect(() => {
    if (!open) {
      appliedTemplateRef.current = null;
      return;
    }
    if (!templateSource || templateSource.id !== templateId) return;
    if (appliedTemplateRef.current === templateSource.id) return;
    appliedTemplateRef.current = templateSource.id;
    setClientId(templateSource.clientId);
    setClientNameOverride("");
    applyTemplate(templateSource, openingSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateSource, templateId]);

  /** Lo que se guarda como plantilla: el pedido tal como está en pantalla. */
  const templatePayload = () => ({
    requiresDesign,
    productionAreas: areas,
    description: description.trim(),
    products: completeRows.map((r) => ({ customName: r.customName, quantity: r.quantity! })),
    materials: materials.map((m) => ({
      materialId: m.materialId,
      quantity: m.quantity,
      description: m.description,
      supplierId: m.supplierId,
    })),
  });
  const canSaveTemplate = Boolean(clientId) && completeRows.length > 0;
  const templateContentSummary = [
    `${completeRows.length} ${completeRows.length === 1 ? "producto" : "productos"}`,
    description.trim() ? "la descripción" : null,
    requiresDesign ? "con diseño" : "sin diseño",
    areas.length > 0 ? areas.map((a) => getAreaLabel(a)).join(", ") : null,
    materials.length > 0 ? `${materials.length} ${materials.length === 1 ? "material" : "materiales"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  /* -------------------------------- Archivo ------------------------------- */

  const handleClientResourceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      revokePreview();
      setClientResourceFile(parsedFile);
      if (normalized.type.startsWith("image/")) {
        previewUrlRef.current = URL.createObjectURL(normalized);
        setClientResourceFilePreview(previewUrlRef.current);
      }
      markDirty();
      focusById("order-file-remove");
    } catch {
      toast.error("No se pudo leer el archivo. Intenta de nuevo.");
    } finally {
      e.target.value = "";
    }
  };

  const removeClientResourceFile = () => {
    revokePreview();
    setClientResourceFile(null);
    markDirty();
    focusById("order-file-attach");
  };

  /* -------------------------------- Mockups ------------------------------- */

  const addPendingMockup = (result: MockupStudioResult) => {
    setPendingMockups((prev) => [...prev, { key: `mockup-${++mockupKeySeq.current}`, result }]);
    markDirty();
  };

  const removePendingMockup = (key: string) => {
    setPendingMockups((prev) => prev.filter((m) => m.key !== key));
    markDirty();
  };

  const downloadPendingMockup = (result: MockupStudioResult) => {
    downloadFromUrl(result.image.dataUrl, mockupFilename(result.config.garment)).catch(() =>
      toast.error("No se pudo descargar el mockup.")
    );
  };

  /**
   * Guarda un mockup en el pedido ya creado. Corre en segundo plano (no
   * frena el cierre del diálogo); si falla, el toast trae "Reintentar", que
   * reenvía el mismo cuerpo guardado en memoria.
   */
  const uploadMockup = (orderId: number, payload: CreateOrderMockupPayload, label: string) => {
    postOrderMockup(token, orderId, payload).then(
      () => {
        queryClient.invalidateQueries({ queryKey: orderMockupsKey(orderId), exact: true });
      },
      (error) => {
        toast.error(`El pedido #${orderId} se creó, pero no se pudo adjuntar ${label}.`, {
          description: mockupErrorMessage(error),
          duration: 20_000,
          style: { pointerEvents: "auto" },
          action: {
            label: "Reintentar",
            onClick: () => uploadMockup(orderId, payload, label),
          },
        });
      }
    );
  };

  /* -------------------------------- Entrega ------------------------------- */

  // "Hoy" se fija al abrir: los atajos no cambian mientras se carga el pedido.
  const today = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const activePreset = presetForDate(deliveryDate, today);
  const isCustomDate = Boolean(deliveryDate) && !activePreset;

  const changeDeliveryDate = (date: string) => {
    setDeliveryDate(date);
    if (!date) setDeliveryTime("");
    markDirty();
  };

  /* ------------------------------ Validación ------------------------------ */

  const currentFormData = () => ({
    clientId,
    clientNameOverride,
    area: primaryArea,
    requiresDesign,
    description,
    deliveryDate,
    assignedUserId,
    orderProducts: completeRows.map((r) => ({
      customName: r.customName,
      quantity: r.quantity!,
      ...(r.sizes && sizeBreakdownTotal(r.sizes) > 0 ? { sizes: r.sizes } : {}),
    })),
  });

  /**
   * Errores del formulario: schema + filas de producto. Una fila con nombre
   * pero sin cantidad nunca se descarta en silencio: bloquea con un error en
   * esa fila.
   */
  const computeValidation = () => {
    const nextRowErrors: Record<string, string> = {};
    rows.forEach((row) => {
      const hasName = Boolean(row.customName.trim());
      const hasQty = row.quantity !== undefined && row.quantity > 0;
      if (hasName && !hasQty) nextRowErrors[row.key] = "Falta la cantidad";
      else if (!hasName && hasQty) nextRowErrors[row.key] = "Falta el nombre del producto";
    });

    const fieldErrors: Partial<Record<FieldKey, string>> = {};
    const parsed = orderSchema.safeParse(currentFormData());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]) as FieldKey;
        if (FIELD_ORDER.includes(field) && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
    }
    if (Object.keys(nextRowErrors).length > 0) {
      fieldErrors.orderProducts = "Hay productos incompletos";
    } else if (completeRows.length === 0) {
      fieldErrors.orderProducts = "Agrega al menos un producto";
    }
    return { fieldErrors, rowErrors: nextRowErrors };
  };

  const validation = computeValidation();
  const missingFields = FIELD_ORDER.filter((f) => validation.fieldErrors[f]);

  // Después del primer intento, los errores se recalculan en cada cambio: el
  // mensaje desaparece apenas se corrige el dato.
  useEffect(() => {
    if (!submitAttempted) return;
    setErrors(validation.fieldErrors);
    setRowErrors(validation.rowErrors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    submitAttempted,
    clientId,
    clientNameOverride,
    requiresDesign,
    areas,
    assignedUserId,
    description,
    rows,
  ]);

  /** Antes del primer intento, sólo la descripción se valida al salir (si se tocó). */
  const validateDescriptionOnBlur = () => {
    if (!descriptionTouched || submitAttempted) return;
    setErrors((prev) => {
      const next = { ...prev };
      if (validation.fieldErrors.description) next.description = validation.fieldErrors.description;
      else delete next.description;
      return next;
    });
  };

  const focusField = (field: FieldKey, rowErrorMap: Record<string, string> = rowErrors) => {
    let target: HTMLElement | null = null;
    if (field === "clientId") target = document.getElementById("order-client");
    else if (field === "area")
      target = document.querySelector<HTMLElement>("#order-areas button");
    else if (field === "assignedUserId") target = document.getElementById("order-assignee");
    else if (field === "description") target = document.getElementById("order-description");
    else if (field === "orderProducts") {
      const badRow = rows.find((r) => rowErrorMap[r.key]);
      target = badRow
        ? document.getElementById(
            rowErrorMap[badRow.key] === "Falta la cantidad"
              ? `order-qty-${badRow.key}`
              : `order-product-${badRow.key}`
          )
        : document.getElementById("order-product-add");
    }
    target?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    target?.focus();
  };

  /* --------------------------------- Envío -------------------------------- */

  const handleSubmit = async () => {
    // Ref (no estado): un ⌘↵ repetido mientras responde la API no puede
    // disparar un segundo POST.
    if (submittingRef.current) return;
    const { fieldErrors, rowErrors: nextRowErrors } = computeValidation();
    setRowErrors(nextRowErrors);
    setErrors(fieldErrors);
    setSubmitError(null);
    setSubmitAttempted(true);
    setAttempt((n) => n + 1);

    const firstInvalid = FIELD_ORDER.find((f) => fieldErrors[f]);
    if (firstInvalid) {
      requestAnimationFrame(() => focusField(firstInvalid, nextRowErrors));
      return;
    }

    const parsed = orderSchema.parse(currentFormData());
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const order = await create({
        clientId: parsed.clientId,
        clientNameOverride: parsed.clientId ? undefined : parsed.clientNameOverride?.trim(),
        // Sin diseño, "área" es el destino directo. Con diseño, el pedido arranca
        // en Diseño y "área" no aplica — lo que se manda es la producción destino.
        area: parsed.requiresDesign ? undefined : parsed.area,
        requiresDesign: parsed.requiresDesign,
        productionArea: parsed.requiresDesign ? parsed.area : undefined,
        productionAreas: areas.length > 0 ? areas : undefined,
        userId: Number(session?.user?.id),
        assignedUserId: parsed.assignedUserId,
        statusId: 1,
        description: parsed.description,
        deliveryDate: combineDateAndTime(parsed.deliveryDate, deliveryTime),
        orderProducts: parsed.orderProducts,
        clientResourceFile: clientResourceFile ?? undefined,
      });

      // Hoja de materiales copiada de la base: una línea a la vez (la primera
      // dispara el evento "Compra de materiales"; en paralelo podían correr dos).
      let materialsFailed = 0;
      if (order?.id && materials.length > 0) {
        for (const m of materials) {
          try {
            await request(`${ENDPOINTS.orders}/${order.id}/materials`, {
              token,
              method: "POST",
              body: {
                materialId: m.materialId,
                quantity: m.quantity,
                description: m.description,
                supplierId: m.supplierId,
              },
            });
          } catch {
            materialsFailed++;
          }
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.all("orders") });
      }
      queryClient.invalidateQueries({ queryKey: ["clientOrders"] });
      if (base?.kind === "template") templateMutations.markUsed.mutate(base.id);

      // Mockups: después de crear y sin esperar (pueden pesar varios MB).
      if (order?.id && pendingMockups.length > 0) {
        pendingMockups.forEach((m, index) =>
          uploadMockup(
            order.id,
            buildMockupPayload(m.result),
            pendingMockups.length > 1 ? `el mockup ${index + 1}` : "el mockup"
          )
        );
      }

      // Se guardan ANTES de cerrar (el estado se limpia en la próxima apertura):
      // chip "Recientes", defaults del próximo pedido y "Crear otro para {cliente}".
      const submittedClientId = parsed.clientId;
      const submittedClientLabel = selectedClientLabel || parsed.clientNameOverride || "";
      if (submittedClientId) pushRecentClientId(submittedClientId);
      writeLastOrderDefaults({ requiresDesign: parsed.requiresDesign, area: primaryArea });

      const destination = parsed.requiresDesign
        ? `Diseño${!assignedUserId || isSharedAssignee ? ": lo toma quien esté libre" : ` (${assignedUserLabel})`}`
        : parsed.area
          ? getAreaLabel(parsed.area)
          : undefined;
      toast.success(orderCreatedMessage({ id: order?.id, destination }), {
        // Al crear se abre el detalle del pedido (modal), que deja el body con
        // pointer-events:none: sin esto "Crear otro para…" no se podía tocar.
        style: { pointerEvents: "auto" },
        action: onCreateAnother
          ? {
              label: submittedClientLabel ? `Crear otro para ${submittedClientLabel}` : "Crear otro pedido",
              onClick: () => onCreateAnother(submittedClientId, submittedClientLabel),
            }
          : undefined,
      });
      if (materialsFailed > 0) {
        toast.warning(
          materialsFailed === 1
            ? "El pedido se creó, pero no se pudo copiar 1 material. Cárgalo desde la hoja de materiales."
            : `El pedido se creó, pero no se pudieron copiar ${materialsFailed} materiales. Cárgalos desde la hoja de materiales.`
        );
      }
      setDirty(false);
      onClose();
      onCreated?.(order);
    } catch (error) {
      // El toast de error ya lo dispara el feedback global (providers.tsx); aquí
      // sólo el aviso accesible del footer, con el mismo mensaje.
      setSubmitError(getErrorMessage(error, "No se pudo crear el pedido."));
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /** ⌘/Ctrl+Enter crea el pedido desde cualquier campo (incluida la descripción). */
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    // Un combobox o un select abierto vive en un portal: su keydown sube por
    // React hasta aquí, pero ese Enter es para elegir la opción. Enviar en el
    // mismo evento mandaría el estado ANTERIOR a esa elección.
    if (e.defaultPrevented || !e.currentTarget.contains(e.target as Node)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  /* -------------------------------- Footer -------------------------------- */

  const summaryParts = buildOrderSummary({
    clientLabel: selectedClientLabel,
    requiresDesign,
    designerLabel: requiresDesign && assignedUserId ? assignedUserLabel : undefined,
    areaLabels: areas.map((a) => getAreaLabel(a)),
    productCount: completeRows.length,
    unitCount,
    deliveryDate,
    deliveryTime,
  });
  const visibleErrors = FIELD_ORDER.filter((f) => errors[f]);
  const showErrorNotice = submitAttempted && (visibleErrors.length > 0 || Boolean(submitError));

  /* --------------------------------- Render ------------------------------- */

  const areasHint = (() => {
    const primaryLabel = primaryArea ? getAreaLabel(primaryArea) : "";
    const parallel =
      areas.length > 1 ? `${areas.length} áreas van a trabajar este pedido en paralelo. ` : "";
    if (requiresDesign) {
      if (areas.length === 0) return "Se puede definir después (Recepción o Diseño).";
      return areas.length > 1 ? `${parallel}Principal: ${primaryLabel}.` : undefined;
    }
    if (areas.length === 0) return undefined;
    return `${parallel}Lo recibe ${primaryLabel}.`;
  })();

  const noUsersForRole =
    !usersPending && Boolean(assignmentArea) && usersInAssignmentArea.length === 0
      ? `No hay usuarios con el rol ${requiresDesign ? "Diseño" : getAreaLabel(assignmentArea ?? "")}. Dar de alta uno para poder asignar el pedido.`
      : undefined;
  const assigneeHint =
    noUsersForRole ??
    (isSharedAssignee
      ? requiresDesign
        ? "Lo toma quien esté libre."
        : "Queda a nombre del área; lo puede tomar cualquiera."
      : undefined);

  const fileExpanded = requiresDesign || showFile || Boolean(clientResourceFile);

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogPrimitive.Portal>
          {/* Sin backdrop-blur, mismo motivo que en ui/dialog.tsx: animar
              opacidad de un elemento con blur trababa la apertura. */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => {
              // Foco al primer campo real (nunca a la X): el cliente, o
              // "Agregar producto" si el cliente ya viene precargado.
              e.preventDefault();
              const prefilled =
                initialClientId !== undefined ||
                Boolean(initialClientNameOverride) ||
                repeatFromOrderId !== undefined;
              focusById(prefilled ? "order-product-add" : "order-client");
            }}
            className={cn(
              "elevation-2 bg-popover fixed z-50 flex flex-col shadow-lg outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              // Móvil: pantalla completa. `100dvh`, no `h-full` (=100vh): el
              // footer no queda tapado por las barras del navegador.
              "inset-0 h-[100dvh] w-full data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
              // Escritorio: panel lateral de altura completa, desliza desde la derecha.
              "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-full sm:max-w-3xl sm:border-l sm:border-border/60 sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right"
            )}
          >
            {/*
              `display: contents`: el `<form>` no rompe el layout flex
              (header/cuerpo/footer). Enter NO envía (es una acción local en
              cada control); ⌘/Ctrl+Enter sí, desde cualquier campo.
            */}
            <form
              className="contents"
              noValidate
              onSubmit={(e) => e.preventDefault()}
              onKeyDown={handleFormKeyDown}
            >
              {/* Cabecera fija. */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 pb-4 pt-[calc(0.875rem+env(safe-area-inset-top))] sm:px-8 sm:pb-5 sm:pt-6">
                <DialogPrimitive.Title className="font-heading text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                  Nuevo pedido
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Formulario para crear un pedido: cliente, diseño y producción, productos y entrega.
                </DialogPrimitive.Description>
                <DialogPrimitive.Close
                  type="button"
                  aria-label="Cerrar"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:size-10"
                >
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>

              {/* Cuerpo con scroll: las 4 secciones. */}
              <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6">
                <div className="space-y-6">
                  {/* ───────────── Cliente ───────────── */}
                  <Section id="order-section-client" title="Cliente" first>
                    {hasClient ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                          <Avatar className="size-9 shrink-0">
                            <AvatarFallback className="bg-card text-xs font-semibold">
                              {initials(selectedClientLabel)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" data-testid="order-client-name">
                              {selectedClientLabel || "Cargando cliente…"}
                            </p>
                            {isFreeTextClient ? (
                              <p className="flex flex-wrap items-center gap-x-2 text-meta">
                                <span className="rounded-full bg-muted px-2 py-0.5">Sin registrar</span>
                                <Button
                                  type="button"
                                  variant="link"
                                  className={cn("h-auto p-0 text-xs text-foreground underline", TAP)}
                                  onClick={() => setNewClientOpen(true)}
                                >
                                  Registrar cliente
                                </Button>
                              </p>
                            ) : (
                              selectedClient && (
                                <p className="truncate text-meta">
                                  {[selectedClient.phone, selectedClient.email, selectedClient.company?.name]
                                    .filter(Boolean)
                                    .join(" · ") || "Cliente registrado"}
                                </p>
                              )
                            )}
                          </div>
                          <Button
                            id="order-client-change"
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("shrink-0", TAP)}
                            onClick={clearClient}
                          >
                            Cambiar
                          </Button>
                        </div>

                        {clientId !== undefined && insights?.suggestion && (
                          <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                              <Sparkles className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                Lo habitual: {describeOrderProducts(insights.suggestion.products, 3)}
                              </p>
                              <p className="truncate text-meta">
                                {insights.suggestion.requiresDesign ? "Con diseño" : "Sin diseño"}
                                {insights.suggestion.areas.length > 0
                                  ? ` → ${insights.suggestion.areas.map((a) => getAreaLabel(a)).join(", ")}`
                                  : ""}
                                {insights.suggestion.materials.length > 0
                                  ? ` · ${insights.suggestion.materials.length} ${insights.suggestion.materials.length === 1 ? "material" : "materiales"}`
                                  : ""}
                                {` · aprendido de ${insights.suggestion.basedOn} pedidos`}
                              </p>
                            </div>
                            {base?.kind === "suggestion" ? (
                              <Button
                                id="order-use-habitual"
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn("shrink-0 gap-1.5", TAP)}
                                onClick={removeBase}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden />
                                Quitar
                              </Button>
                            ) : (
                              <Button
                                id="order-use-habitual"
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn("shrink-0", TAP)}
                                aria-label={`Usar lo habitual de ${selectedClientLabel}`}
                                onClick={applySuggestion}
                              >
                                Usar
                              </Button>
                            )}
                          </div>
                        )}

                        {clientId !== undefined && templates.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <p className="text-label" id="order-templates-label">
                              Plantillas
                            </p>
                            <div
                              role="group"
                              aria-labelledby="order-templates-label"
                              className="flex flex-wrap gap-2"
                            >
                              {templates.map((t) => {
                                const inUse = base?.kind === "template" && base.id === t.id;
                                return (
                                  <Button
                                    key={t.id}
                                    id={`order-template-${t.id}`}
                                    type="button"
                                    variant="outline"
                                    aria-pressed={inUse}
                                    data-state={inUse ? "on" : "off"}
                                    title={describeOrderProducts(t.products, 3)}
                                    className={cn(CHIP_CLASS, "max-w-[16rem]")}
                                    onClick={() =>
                                      inUse ? removeBase() : applyTemplate(t, base?.snapshot ?? takeSnapshot())
                                    }
                                  >
                                    <span className="truncate">{t.name}</span>
                                    {inUse && <X className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {clientId !== undefined && (previousLoading || previousOrders.length > 0) && (
                          <div className="space-y-1.5 pt-2">
                            <p className="text-label" id="order-previous-label">
                              Pedidos anteriores
                            </p>
                            {previousLoading ? (
                              <p className="flex items-center gap-1.5 text-meta">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Buscando sus pedidos…
                              </p>
                            ) : (
                              <ul aria-labelledby="order-previous-label" className="divide-y divide-border/60">
                                {visiblePrevious.map((o) => {
                                  const inUse = base?.kind === "order" && base.id === o.id;
                                  const hasProducts = (o.orderProducts ?? []).some((p) => p.customName?.trim());
                                  const route = o.requiresDesign
                                    ? "Con diseño"
                                    : o.productionArea || o.area
                                      ? getAreaLabel((o.productionArea || o.area) ?? "")
                                      : null;
                                  const when = o.creationDate
                                    ? formatDistanceToNowStrict(new Date(o.creationDate), { locale: es, addSuffix: true })
                                    : null;
                                  return (
                                    <li
                                      key={o.id}
                                      className={cn(
                                        "flex items-center gap-3 rounded-lg py-2",
                                        inUse && "-mx-2 bg-muted/60 px-2"
                                      )}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm">{describeOrderProducts(o.orderProducts)}</p>
                                        <p className="truncate text-meta tabular-nums">
                                          {[`#${o.id}`, when, route].filter(Boolean).join(" · ")}
                                        </p>
                                      </div>
                                      {inUse ? (
                                        <Button
                                          id={`order-previous-${o.id}`}
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className={cn("shrink-0 gap-1.5", TAP)}
                                          onClick={removeBase}
                                        >
                                          <X className="h-3.5 w-3.5" aria-hidden />
                                          Quitar base
                                        </Button>
                                      ) : (
                                        <Button
                                          id={`order-previous-${o.id}`}
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className={cn("shrink-0 gap-1.5", TAP)}
                                          disabled={!hasProducts}
                                          aria-label={`Usar el pedido #${o.id} como base`}
                                          onClick={() => applyBase(o, base?.snapshot ?? takeSnapshot())}
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                                          Usar como base
                                        </Button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {!previousLoading && !showAllPrevious && previousOrders.length > PREVIOUS_ORDERS_SHOWN && (
                              <Button
                                type="button"
                                variant="link"
                                className={cn("h-auto p-0 text-xs text-foreground underline", TAP)}
                                onClick={() => setShowAllPrevious(true)}
                              >
                                Ver más pedidos
                              </Button>
                            )}
                            {!previousLoading && !base && (
                              <p className="text-meta">
                                Copia lo que se pide, la descripción y los materiales. La fecha y el archivo se cargan de nuevo.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <label htmlFor="order-client" className="sr-only">
                            Cliente
                          </label>
                          <CreatableCombobox
                            id="order-client"
                            required
                            invalid={Boolean(errors.clientId)}
                            describedBy={errors.clientId ? "order-client-error" : undefined}
                            className="sm:flex-1"
                            items={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                            selectedId={null}
                            customValue=""
                            placeholder="Buscar cliente…"
                            createLabel={(value) => `Usar "${value}" como nombre de cliente`}
                            emptyLabel="Todavía no hay clientes. Escribe un nombre para usarlo."
                            onSelectItem={(item) => chooseClient(Number(item.id))}
                            onUseCustom={(text) => chooseClient(undefined, clampName(text))}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 shrink-0 gap-1.5 sm:h-9"
                            onClick={() => setNewClientOpen(true)}
                          >
                            <UserPlus className="h-4 w-4" /> Nuevo cliente
                          </Button>
                        </div>
                        {recentClients.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-label" id="order-recent-clients">
                              Recientes
                            </p>
                            <div
                              role="group"
                              aria-labelledby="order-recent-clients"
                              className="flex flex-wrap gap-2"
                            >
                              {recentClients.map((c) => (
                                <Button
                                  key={c.id}
                                  type="button"
                                  variant="outline"
                                  title={clientLabel(c)}
                                  className={cn(CHIP_CLASS, "max-w-[14rem]")}
                                  onClick={() => chooseClient(c.id)}
                                >
                                  <span className="truncate">{clientLabel(c)}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        <FieldMessages id="order-client" error={errors.clientId} />
                      </div>
                    )}
                  </Section>

                  {/* ───────────── Diseño y producción ───────────── */}
                  <Section
                    id="order-section-route"
                    title="Diseño y producción"
                    meta={
                      base && !routeTouched
                        ? baseMeta(base)
                        : defaultsApplied && !routeTouched
                          ? "Como el último pedido"
                          : undefined
                    }
                  >
                    <div className="space-y-2">
                      <RadioGroupPrimitive.Root
                        value={requiresDesign ? "design" : "direct"}
                        onValueChange={changeRoute}
                        aria-label="¿Requiere diseño?"
                        className="grid w-full grid-cols-2 gap-1 rounded-full border border-border/60 bg-card p-1 sm:inline-grid sm:w-auto"
                      >
                        {[
                          { value: "design", label: "Con diseño" },
                          { value: "direct", label: "Sin diseño" },
                        ].map((option) => (
                          <RadioGroupPrimitive.Item
                            key={option.value}
                            value={option.value}
                            className="min-h-11 rounded-full px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=checked]:bg-ink data-[state=checked]:text-ink-foreground sm:min-h-9"
                          >
                            {option.label}
                          </RadioGroupPrimitive.Item>
                        ))}
                      </RadioGroupPrimitive.Root>
                      <p className="text-meta">
                        {requiresDesign
                          ? "El pedido entra a Diseño y pasa a producción recién cuando el cliente autorice el montaje."
                          : "El pedido va directo al área elegida, sin pasar por Diseño."}
                      </p>
                    </div>

                    <fieldset
                      className="min-w-0 space-y-2"
                      aria-describedby={describedBy("order-areas", areasHint, errors.area)}
                    >
                      <legend className="mb-2 text-sm font-medium">
                        Áreas de producción
                        {requiresDesign && <OptionalTag />}
                      </legend>
                      <ToggleGroup
                        id="order-areas"
                        type="multiple"
                        value={areas}
                        onValueChange={changeAreas}
                        className="flex flex-wrap justify-start gap-2"
                      >
                        {PRODUCTION_AREA_OPTIONS.map((option) => {
                          const Icon = AREA_ICONS[option.value as AreaValue];
                          const isPrimary = areas.length > 1 && primaryArea === option.value;
                          return (
                            <ToggleGroupItem
                              key={option.value}
                              value={option.value}
                              aria-invalid={Boolean(errors.area)}
                              className={CHIP_CLASS}
                            >
                              <Icon aria-hidden />
                              {option.label}
                              {isPrimary && (
                                <span className="rounded-full bg-ink-foreground/20 px-1.5 text-[11px] leading-4">
                                  principal
                                </span>
                              )}
                            </ToggleGroupItem>
                          );
                        })}
                      </ToggleGroup>
                      <FieldMessages id="order-areas" hint={areasHint} error={errors.area} />
                    </fieldset>

                    <div className="space-y-1.5">
                      {React.createElement(
                        assignmentArea ? "label" : "p",
                        { htmlFor: assignmentArea ? "order-assignee" : undefined, className: "text-sm font-medium" },
                        "Asignar a",
                        !requiresDesign && !sharedAccountForArea ? <OptionalTag key="opt" /> : null
                      )}
                      {assignmentArea ? (
                        <Select
                          value={assignedUserId !== undefined ? String(assignedUserId) : ""}
                          onValueChange={(v) => {
                            setAssignedUserId(v && v !== NONE ? Number(v) : undefined);
                            markDirty();
                          }}
                        >
                          <SelectTrigger
                            id="order-assignee"
                            aria-required={requiresDesign}
                            aria-invalid={Boolean(errors.assignedUserId)}
                            aria-describedby={describedBy("order-assignee", assigneeHint, errors.assignedUserId)}
                            className="h-11 w-full sm:h-9 sm:max-w-sm"
                          >
                            <SelectValue placeholder={requiresDesign ? "Elige un diseñador…" : "Sin asignar"} />
                          </SelectTrigger>
                          <SelectContent>
                            {/* "Sin asignar" sólo sin diseño y si el área no tiene cuenta compartida. */}
                            {!requiresDesign && !sharedAccountForArea && (
                              <SelectItem value={NONE}>Sin asignar</SelectItem>
                            )}
                            {sharedAccountForArea && (
                              <SelectItem value={String(sharedAccountForArea.id)}>
                                {requiresDesign
                                  ? "Cualquier diseñador"
                                  : `Cualquiera de ${getAreaLabel(assignmentArea)}`}
                              </SelectItem>
                            )}
                            {sharedAccountForArea && individualsInArea.length > 0 && <SelectSeparator />}
                            {individualsInArea.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {userLabel(u)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-meta">
                          Elige primero un área de producción.
                        </p>
                      )}
                      <FieldMessages
                        id="order-assignee"
                        hint={assignmentArea ? assigneeHint : undefined}
                        error={errors.assignedUserId}
                      />
                    </div>
                  </Section>

                  {/* ───────────── Qué se pide ───────────── */}
                  <Section
                    id="order-section-products"
                    title="Qué se pide"
                    meta={
                      completeRows.length > 0
                        ? `${completeRows.length} ${completeRows.length === 1 ? "producto" : "productos"} · ${unitCount} u.`
                        : undefined
                    }
                  >
                    <div className="space-y-3">
                      <p className="text-sm font-medium" id="order-products-label">
                        Productos
                      </p>

                      {learnedProducts.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-label" id="order-learned-label">
                            Suele pedir
                          </p>
                          <div role="group" aria-labelledby="order-learned-label" className="flex flex-wrap gap-2">
                            {learnedProducts.map((habit) => {
                              const row = rows.find((r) => sameName(r.customName, habit.name));
                              return (
                                <Button
                                  key={habit.key}
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    row ? focusById(`order-qty-${row.key}`) : addProduct(habit.name, habit.typicalQuantity)
                                  }
                                  aria-label={
                                    row
                                      ? `${habit.name} ya está en el pedido (${row.quantity ?? 0})`
                                      : `Agregar ${habit.name}, ${habit.typicalQuantity} (cantidad habitual)`
                                  }
                                  className={cn(CHIP_CLASS, row && "border-foreground/40")}
                                >
                                  {row ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                                  {habit.name}
                                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-foreground">
                                    ×{row?.quantity ?? habit.typicalQuantity}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {productPresets.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-label">Frecuentes</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => setFrequentsOpen(true)}
                            >
                              Personalizar
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {myFrequents
                              .filter((preset) => !learnedKeys.has(normalizeProductKey(preset.name)))
                              .map((preset) => {
                              const row = rows.find((r) => sameName(r.customName, preset.name));
                              return (
                                <Button
                                  key={preset.id}
                                  type="button"
                                  variant="outline"
                                  onClick={() => addProduct(preset.name)}
                                  aria-label={`Agregar ${preset.name}${row?.quantity ? `, ${row.quantity} en el pedido` : ""}`}
                                  className={cn(CHIP_CLASS, row && "border-foreground/40")}
                                >
                                  <Plus className="h-3.5 w-3.5" aria-hidden />
                                  {preset.name}
                                  {row?.quantity ? (
                                    <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-foreground">
                                      {row.quantity}
                                    </span>
                                  ) : null}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {productPresets.length > 0
                            ? "Toca un frecuente o busca un producto."
                            : "Busca o escribe un producto."}
                        </p>
                      ) : (
                        <ul aria-labelledby="order-products-label" className="divide-y divide-border/60">
                          {rows.map((row, index) => {
                            const rowError = rowErrors[row.key];
                            const qty = row.quantity;
                            return (
                              <li
                                key={row.key}
                                className={cn(
                                  "grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg py-2 transition-colors sm:grid-cols-[1fr_auto_auto]",
                                  highlightKey === row.key && "bg-muted"
                                )}
                              >
                                <div className="col-span-full min-w-0 sm:col-span-1">
                                  <label htmlFor={`order-product-${row.key}`} className="sr-only">
                                    Producto {index + 1}
                                  </label>
                                  <CreatableCombobox
                                    id={`order-product-${row.key}`}
                                    invalid={rowError === "Falta el nombre del producto"}
                                    items={productPresets.map((p) => ({ id: p.id, label: p.name }))}
                                    selectedId={null}
                                    customValue={row.customName}
                                    placeholder="Buscar producto…"
                                    createLabel={(value) => `Usar "${value}" como producto nuevo`}
                                    emptyLabel="Todavía no hay productos frecuentes. Escribe uno para usarlo."
                                    onSelectItem={(item) => renameRow(row.key, item.label)}
                                    onUseCustom={(text) => renameRow(row.key, text)}
                                  />
                                </div>
                                <div className="inline-flex items-center justify-self-start rounded-full border border-border focus-within:ring-2 focus-within:ring-ring/60">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-11 rounded-full aria-disabled:opacity-60 sm:size-9"
                                    aria-label={`Restar 1 a ${row.customName}`}
                                    aria-disabled={!qty || qty <= 1}
                                    onClick={() => qty && qty > 1 && setQuantity(row.key, qty - 1)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    id={`order-qty-${row.key}`}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    aria-label={`Cantidad de ${row.customName}`}
                                    aria-invalid={rowError === "Falta la cantidad"}
                                    className="h-11 w-16 border-0 bg-transparent px-1 text-center tabular-nums shadow-none focus-visible:ring-0 sm:h-9"
                                    value={qty ?? ""}
                                    readOnly={sizeBreakdownTotal(row.sizes) > 0}
                                    title={sizeBreakdownTotal(row.sizes) > 0 ? "Se calcula con las tallas" : undefined}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/\D/g, "");
                                      setQuantity(row.key, digits ? Number(digits) : undefined);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setQuantity(row.key, (qty ?? 0) + 1);
                                      } else if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        if (qty && qty > 1) setQuantity(row.key, qty - 1);
                                      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                                        e.preventDefault();
                                        document.getElementById("order-product-add")?.focus();
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-11 rounded-full sm:size-9"
                                    aria-label={`Sumar 1 a ${row.customName}`}
                                    onClick={() => setQuantity(row.key, (qty ?? 0) + 1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-11 justify-self-end text-muted-foreground hover:text-destructive focus-visible:text-destructive sm:size-9"
                                  aria-label={`Quitar ${row.customName}`}
                                  onClick={() => removeRow(row.key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <OrderProductSizesField
                                  rowKey={row.key}
                                  productName={row.customName}
                                  sizes={row.sizes}
                                  onChange={(sizes, total) => setRowSizes(row.key, sizes, total)}
                                />
                                {rowError && (
                                  <p className={cn("col-span-full flex items-center gap-1", ERROR_TEXT)}>
                                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                                    {rowError}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {rows.length < MAX_PRODUCT_LINES && (
                        <div>
                          <label htmlFor="order-product-add" className="sr-only">
                            Agregar producto
                          </label>
                          <CreatableCombobox
                            id="order-product-add"
                            className="border-dashed text-muted-foreground"
                            describedBy={errors.orderProducts ? "order-products-error" : undefined}
                            invalid={Boolean(errors.orderProducts) && rows.length === 0}
                            items={productPresets.map((p) => ({ id: p.id, label: p.name }))}
                            selectedId={null}
                            customValue=""
                            placeholder="+ Agregar producto…"
                            createLabel={(value) => `Usar "${value}" como producto nuevo`}
                            emptyLabel="Todavía no hay productos frecuentes. Escribe uno para usarlo."
                            onSelectItem={(item) => addProduct(item.label)}
                            onUseCustom={(text) => addProduct(text)}
                          />
                        </div>
                      )}
                      <FieldMessages id="order-products" error={errors.orderProducts} />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="order-description" className="text-sm font-medium">
                        Descripción
                      </label>
                      <Textarea
                        id="order-description"
                        rows={3}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        value={description}
                        placeholder="Ubicación del logo, colores, tallas, textos…"
                        className="min-h-[5.5rem] max-h-60 [field-sizing:content]"
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setDescriptionTouched(true);
                          markDirty();
                        }}
                        onBlur={validateDescriptionOnBlur}
                        aria-required
                        aria-invalid={Boolean(errors.description)}
                        aria-describedby={describedBy("order-description", false, errors.description)}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <FieldMessages
                          id="order-description"
                          hint={
                            base && base.kind !== "suggestion" && !descriptionTouched && description
                              ? `${base.kind === "order" ? `Copiada del pedido #${base.id}` : baseOrigin(base)}: ajusta lo que cambia esta vez.`
                              : undefined
                          }
                          error={errors.description}
                        />
                        {description.length >= 900 && (
                          <span className="ml-auto text-meta tabular-nums">
                            {description.length}/{MAX_DESCRIPTION_LENGTH}
                          </span>
                        )}
                      </div>
                    </div>

                    {(materialsLoading || materials.length > 0) && (
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium" id="order-materials-label">
                          Hoja de materiales
                        </p>
                        {materialsLoading ? (
                          <p className="flex items-center gap-1.5 text-meta">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            Copiando materiales de {base ? baseLabel(base) : "la base"}…
                          </p>
                        ) : (
                          <ul aria-labelledby="order-materials-label" className="divide-y divide-border/60">
                            {materials.map((m) => (
                              <li key={m.key} className="flex items-center gap-3 py-1.5">
                                <span className="min-w-0 flex-1 truncate text-sm">{m.description}</span>
                                <span className="shrink-0 text-meta tabular-nums">
                                  {m.quantity}
                                  {m.unitName ? ` ${m.unitName}` : ""}
                                </span>
                                <Button
                                  id={`order-material-remove-${m.key}`}
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-11 shrink-0 text-muted-foreground hover:text-destructive focus-visible:text-destructive sm:size-9"
                                  aria-label={`Quitar ${m.description}`}
                                  onClick={() => removeMaterial(m.key)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-meta">
                          {base ? `${baseOrigin(base)}. ` : ""}Se cargan en la hoja de materiales del pedido nuevo; las cantidades se ajustan ahí.
                        </p>
                      </div>
                    )}

                    {canSaveTemplate && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {base?.kind === "template" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("-ml-2 gap-1.5 text-muted-foreground", TAP)}
                            disabled={templateMutations.update.isPending}
                            onClick={async () => {
                              try {
                                await templateMutations.update.mutateAsync({
                                  id: base.id,
                                  payload: templatePayload(),
                                });
                                toast.success(`Plantilla «${base.name}» actualizada`);
                              } catch (error) {
                                toast.error(getErrorMessage(error, "No se pudo actualizar la plantilla."));
                              }
                            }}
                          >
                            {templateMutations.update.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <BookmarkPlus className="h-4 w-4" aria-hidden />
                            )}
                            Actualizar plantilla «{base.name}»
                          </Button>
                        )}
                        <Button
                          id="order-save-template"
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(base?.kind !== "template" && "-ml-2", "gap-1.5 text-muted-foreground", TAP)}
                          onClick={() => setSaveTemplateOpen(true)}
                        >
                          <BookmarkPlus className="h-4 w-4" aria-hidden />
                          {base?.kind === "template" ? "Guardar como plantilla nueva" : "Guardar como plantilla"}
                        </Button>
                      </div>
                    )}

                    {fileExpanded ? (
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium" id="order-file-label">
                          Archivo del cliente
                          <OptionalTag />
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          tabIndex={-1}
                          aria-hidden
                          className="sr-only"
                          accept="image/png,image/jpeg,application/pdf"
                          onChange={handleClientResourceFileChange}
                        />
                        {clientResourceFile ? (
                          <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-2.5">
                            {clientResourceFilePreview ? (
                              <PreviewImage
                                src={clientResourceFilePreview}
                                alt={clientResourceFile.filename}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            ) : (
                              <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
                            )}
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">
                              {clientResourceFile.filename}
                            </p>
                            <Button
                              id="order-file-remove"
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11 sm:size-9"
                              onClick={removeClientResourceFile}
                              aria-label="Quitar archivo"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              id="order-file-attach"
                              type="button"
                              variant="outline"
                              className="h-11 gap-1.5 sm:h-9"
                              aria-describedby="order-file-hint"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Paperclip className="h-4 w-4" /> Adjuntar archivo
                            </Button>
                            <CameraCaptureButton
                              onChange={handleClientResourceFileChange}
                              className="h-11 sm:h-9"
                            />
                            <span className="text-meta">PNG, JPG o PDF · hasta 5 MB</span>
                          </div>
                        )}
                        <p id="order-file-hint" className="text-meta">
                          Logo o referencias que mandó el cliente. No es la hoja de autorización.
                        </p>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("-ml-2 gap-1.5 text-muted-foreground", TAP)}
                        onClick={() => {
                          setShowFile(true);
                          focusById("order-file-attach");
                        }}
                      >
                        <Paperclip className="h-4 w-4" /> Adjuntar archivo del cliente
                      </Button>
                    )}

                    {/* Mockups 3D: se guardan en el pedido al crearlo. */}
                    <div className="space-y-2">
                      {pendingMockups.length > 0 && (
                        <ul className="flex flex-wrap gap-2" aria-label="Mockups para el pedido">
                          {pendingMockups.map((m, index) => {
                            const name = `Mockup ${index + 1}`;
                            return (
                              <li
                                key={m.key}
                                className="flex items-center gap-2 rounded-xl bg-muted/50 p-1.5 pr-1"
                              >
                                <PreviewImage
                                  src={m.result.image.dataUrl}
                                  alt={name}
                                  className="h-10 w-20 rounded-md bg-white object-contain"
                                />
                                <span className="text-sm font-medium">
                                  {GARMENT_LABELS[m.result.config.garment]}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-11 sm:size-8"
                                  onClick={() => downloadPendingMockup(m.result)}
                                  aria-label={`Descargar ${name.toLowerCase()}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-11 sm:size-8"
                                  onClick={() => removePendingMockup(m.key)}
                                  aria-label={`Quitar ${name.toLowerCase()}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn("-ml-2 gap-1.5 text-muted-foreground", TAP)}
                        onClick={() => setMockupStudioOpen(true)}
                      >
                        <Shirt className="h-4 w-4" /> Crear mockup
                      </Button>
                    </div>
                  </Section>

                  {/* ───────────── Entrega ───────────── */}
                  <Section
                    id="order-section-delivery"
                    title={
                      <>
                        Entrega
                        <OptionalTag />
                      </>
                    }
                  >
                    <div className="flex flex-wrap gap-2">
                      <ToggleGroup
                        type="single"
                        value={activePreset ?? ""}
                        onValueChange={(key) => {
                          const preset = DELIVERY_PRESETS.find((p) => p.key === key);
                          changeDeliveryDate(preset ? presetDate(preset.days, today) : "");
                        }}
                        aria-label="Fecha de entrega"
                        className="flex flex-wrap justify-start gap-2"
                      >
                        {DELIVERY_PRESETS.map((preset) => (
                          <ToggleGroupItem key={preset.key} value={preset.key} className={CHIP_CLASS}>
                            {preset.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="order-delivery-date"
                            type="button"
                            variant="outline"
                            aria-pressed={isCustomDate}
                            aria-label={
                              isCustomDate ? `Fecha a medida: ${shortDateLabel(deliveryDate)}` : "Elegir otra fecha"
                            }
                            className={cn(
                              CHIP_CLASS,
                              isCustomDate && "border-ink bg-ink text-ink-foreground hover:bg-ink/90"
                            )}
                          >
                            <CalendarDays className="h-4 w-4" aria-hidden />
                            {isCustomDate ? shortDateLabel(deliveryDate) : "Elegir fecha…"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            locale={es}
                            weekStartsOn={1}
                            selected={parseDeliveryDate(deliveryDate)}
                            defaultMonth={parseDeliveryDate(deliveryDate) ?? today}
                            onSelect={(d) => {
                              changeDeliveryDate(d ? format(d, DATE_FORMAT) : "");
                              setDatePickerOpen(false);
                            }}
                            classNames={{
                              head_cell: "text-muted-foreground rounded-md w-11 font-normal text-[0.8rem] sm:w-8",
                              day: cn(
                                buttonVariants({ variant: "ghost" }),
                                "h-11 w-11 rounded-full p-0 font-normal aria-selected:opacity-100 sm:h-8 sm:w-8"
                              ),
                              day_selected:
                                "bg-ink text-ink-foreground hover:bg-ink hover:text-ink-foreground focus:bg-ink focus:text-ink-foreground",
                              day_today: "bg-muted font-semibold text-foreground",
                              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                              nav_button: cn(
                                buttonVariants({ variant: "outline" }),
                                "h-11 w-11 rounded-full bg-transparent p-0 sm:h-7 sm:w-7"
                              ),
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {leadDays !== null && !deliveryDate && (
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          {selectedClientLabel || "Este cliente"} suele pedir con {leadDaysLabel(leadDays)} de anticipación.
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          className={cn("h-auto p-0 text-xs text-foreground underline", TAP)}
                          onClick={() => {
                            changeDeliveryDate(presetDate(leadDays, today));
                            if (learnedTime) setDeliveryTime(learnedTime);
                            // El atajo desaparece al elegir la fecha: el foco pasa a la hora.
                            focusById("order-delivery-time");
                          }}
                        >
                          Usar {shortDateLabel(presetDate(leadDays, today))}
                          {learnedTime ? `, ${learnedTime}` : ""}
                        </Button>
                      </p>
                    )}

                    {deliveryDate && (
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm">
                          Entrega el <span className="font-medium">{longDateLabel(deliveryDate)}</span>
                        </p>
                        <label htmlFor="order-delivery-time" className="sr-only">
                          Hora de entrega
                        </label>
                        <Select
                          value={deliveryTime || NONE}
                          onValueChange={(v) => {
                            setDeliveryTime(v === NONE ? "" : v);
                            markDirty();
                          }}
                        >
                          <SelectTrigger id="order-delivery-time" className="h-11 w-40 sm:h-9">
                            <SelectValue placeholder="Hora (opcional)" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value={NONE}>Sin hora ({DEFAULT_DELIVERY_TIME})</SelectItem>
                            {DELIVERY_TIME_SLOTS.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!deliveryTime && (
                          <p className="basis-full text-meta">
                            Sin hora, se toma el fin de la jornada ({DEFAULT_DELIVERY_TIME}).
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn("text-muted-foreground", TAP)}
                          onClick={() => {
                            changeDeliveryDate("");
                            focusById("order-delivery-date");
                          }}
                        >
                          Quitar fecha
                        </Button>
                      </div>
                    )}
                  </Section>
                </div>
              </div>

              {/* Footer fijo: aviso de errores, resumen vivo y el único CTA. */}
              <div className="shrink-0 border-t border-border/60 bg-popover px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:py-4">
                <div
                  ref={errorSummaryRef}
                  role="alert"
                  tabIndex={-1}
                  className={cn(
                    "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm outline-none",
                    showErrorNotice && "mb-2",
                    "text-red-700 dark:text-red-400"
                  )}
                >
                  {showErrorNotice && (
                    <React.Fragment key={attempt}>
                      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                      {submitError ? (
                        <span>No se pudo crear el pedido: {submitError}</span>
                      ) : (
                        <>
                          <span>
                            {visibleErrors.length === 1
                              ? "Falta 1 dato:"
                              : `Faltan ${visibleErrors.length} datos:`}
                          </span>
                          {visibleErrors.map((field, i) => (
                            <Button
                              key={field}
                              type="button"
                              variant="link"
                              className={cn(
                                "h-auto p-0 text-red-700 underline dark:text-red-400",
                                TAP,
                                i > 0 && "hidden sm:inline-flex"
                              )}
                              onClick={() => focusField(field)}
                            >
                              {FIELD_LABELS[field]}
                            </Button>
                          ))}
                          {visibleErrors.length > 1 && (
                            <span className="sm:hidden">y {visibleErrors.length - 1} más</span>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {!showErrorNotice && missingFields.length > 0 && (
                      <p className="truncate text-meta">
                        Falta: {missingFields.map((f) => FIELD_LABELS[f].toLowerCase()).join(", ")}
                      </p>
                    )}
                    {summaryParts.length > 0 && (
                      <p
                        className={cn(
                          "truncate text-xs text-foreground/80",
                          missingFields.length > 0 && "hidden sm:block"
                        )}
                        data-testid="order-summary"
                      >
                        {summaryParts.join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="hidden sm:inline-flex"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <motion.div tabIndex={-1} {...(submitting ? {} : formButtonMotion)}>
                    <Button
                      id="order-submit"
                      type="button"
                      className="h-11 gap-2 px-5 sm:h-10"
                      onClick={() => void handleSubmit()}
                      disabled={submitting}
                      aria-keyshortcuts="Meta+Enter Control+Enter"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {submitting ? "Guardando…" : "Crear pedido"}
                      {!submitting && shortcutLabel && (
                        <kbd
                          aria-hidden
                          className="hidden rounded bg-ink-foreground/15 px-1.5 font-sans text-[11px] md:inline-flex"
                        >
                          {shortcutLabel}
                        </kbd>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>

              <p className="sr-only" aria-live="polite">
                {liveMessage}
              </p>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Confirmar antes de descartar un pedido con datos cargados (Escape, click afuera, X, Cancelar). */}
      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // Sin trigger, Radix no sabe a dónde devolver el foco: vuelve al
            // campo donde estaba el usuario (o al CTA si ya no existe).
            e.preventDefault();
            const previous = focusBeforeConfirmRef.current;
            const target =
              previous && previous.isConnected && previous !== document.body
                ? previous
                : document.getElementById("order-submit");
            target?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay datos cargados que todavía no se guardaron. Si cierras ahora se pierden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDiscardOpen(false);
                setDirty(false);
                onClose();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MockupStudioDialog
        open={mockupStudioOpen}
        onOpenChange={setMockupStudioOpen}
        attachLabel="Agregar al pedido"
        onAttach={addPendingMockup}
      />

      <CustomizeFrequentsDialog
        open={frequentsOpen}
        onOpenChange={setFrequentsOpen}
        presets={productPresets}
        current={myFrequents}
        onSave={(ids) => updatePreferences({ frequentProductIds: ids })}
      />
      <SaveOrderTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={(next) => {
          setSaveTemplateOpen(next);
          if (!next) focusById("order-save-template");
        }}
        clientLabel={selectedClientLabel}
        defaultName={suggestTemplateName(completeRows)}
        contentSummary={templateContentSummary}
        blocker={
          !requiresDesign && areas.length === 0
            ? "Elige al menos un área de producción: sin diseño, la plantilla necesita a dónde ir."
            : undefined
        }
        onSave={async (name) => {
          if (!clientId) return;
          const template = await templateMutations.create.mutateAsync({
            clientId,
            payload: { name, ...templatePayload() },
          });
          // Lo que está en pantalla ES la plantilla nueva: queda como base
          // (y al crear el pedido cuenta como un uso).
          setBase((prev) => ({
            kind: "template",
            id: template.id,
            name: template.name,
            snapshot: prev?.snapshot ?? takeSnapshot(),
          }));
          setRouteTouched(false);
          setDescriptionTouched(false);
          toast.success(`Plantilla «${template.name}» guardada para ${selectedClientLabel}`);
        }}
      />

      <CreateClientDialog
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        initialFirstName={clientNameOverride}
        onCreated={(client) => {
          setCreatedClient(client);
          chooseClient(client.id);
        }}
      />
    </>
  );
}
