"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookmarkPlus,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Minus,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PreviewImage } from "@/components/ui/preview-image";
import { CreateClientDialog } from "@/components/orders/CreateClientDialog";
import { SaveOrderTemplateDialog } from "@/components/orders/SaveOrderTemplateDialog";
import { OrderProductSizesField } from "@/components/orders/OrderProductSizesField";
import { CustomizeFrequentsDialog, resolveFrequents } from "@/components/orders/CustomizeFrequentsDialog";
import { InlineCombobox, type InlineOption } from "@/components/orders/composer/InlineCombobox";
import { mockupErrorMessage, orderMockupsKey, postOrderMockup } from "@/hooks/useOrderMockups";
import { useCreateProductPreset } from "@/hooks/useProductPresets";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { CATALOG_STALE_TIME, useAuthToken, useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { useClientOrders, useOrder } from "@/hooks/useOrders";
import { useClientOrderTemplates, useOrderTemplate, useOrderTemplateMutations } from "@/hooks/useOrderTemplates";
import { useClientInsights } from "@/hooks/useClientInsights";
import { COMPOSER_PREVIOUS_ORDERS_LIMIT, usePrefetchClientContext } from "@/hooks/useOrderComposerPrefetch";
import { usePermissions } from "@/hooks/usePermissions";
import { useMyBranch } from "@/hooks/useBranches";
import { useMotionPreset } from "@/lib/motion";
import { downloadFromUrl } from "@/lib/download";
import { buildMockupPayload, mockupFilename, type MockupStudioResult } from "@/lib/mockups/studio";
import { GARMENT_LABELS, type CreateOrderMockupPayload } from "@/lib/mockups/types";
import { sizeBreakdownTotal, type SizeBreakdown } from "@/lib/garmentSizes";
import { isAllowedUploadMime, normalizeImageFile, readFileAsUploadInput, UPLOAD_FILE_MAX_BYTES } from "@/lib/fileInput";
import { PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { DEFAULT_DELIVERY_TIME } from "@/lib/format";
import { orderCreatedMessage } from "@/lib/copy";
import { getErrorMessage, request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  DATE_FORMAT,
  DELIVERY_TIME_SLOTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_PRODUCT_LINES,
  MAX_QUANTITY,
  buildOrderSummary,
  buildRepeatPrefill,
  buildTemplatePrefill,
  clampName,
  describeOrderProducts,
  learnedLeadDays,
  learnedQuantityFor,
  mergeAreaSelection,
  normalizeProductKey,
  parseDeliveryDate,
  pushRecentClientId,
  readLastOrderDefaults,
  readRecentClientIds,
  shortDateLabel,
  suggestTemplateName,
  toRepeatMaterials,
  typicalDeliveryTime,
  writeLastOrderDefaults,
  type RepeatMaterial,
} from "@/lib/createOrderForm";
import {
  FIELD_LABELS,
  ORDER_FIELD_IDS as IDS,
  ROW_ERROR_MISSING_NAME,
  ROW_ERROR_MISSING_QUANTITY,
  buildCreateOrderPayload,
  buildTemplatePayload,
  completeRows as filterCompleteRows,
  computeValidation,
  deriveAssignment,
  missingFieldsInOrder,
  orderSchema,
  toOrderProducts,
  type FieldKey,
  type OrderFormData,
  type OrderProductRow,
} from "@/lib/createOrderPayload";
import {
  clearOrderDraft,
  clientLabel,
  deliveryChips,
  draftAgeLabel,
  hasExactClient,
  parseQuickAdd,
  readCreateAnother,
  readOrderDraft,
  readRememberedBranchEmployee,
  rememberBranchEmployee,
  routeFromInsights,
  searchClients,
  tidyProductName,
  shortAgo,
  writeCreateAnother,
  writeOrderDraft,
  type DraftBase,
  type OrderDraft,
  type OrderDraftData,
} from "@/lib/orderComposer";
import { format } from "date-fns";
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

/** El estudio 3D (three.js) pesa: se carga recién cuando alguien lo abre. */
const MockupStudioDialog = dynamic(
  () => import("@/components/mockups/MockupStudioDialog").then((m) => m.MockupStudioDialog),
  { ssr: false }
);

/* -------------------------------------------------------------------------- */
/* Constantes y tipos                                                         */
/* -------------------------------------------------------------------------- */

/** Radix Select no admite `value=""`: centinela para "Sin asignar" / "Sin hora". */
const NONE = "__none__";

/**
 * Foco visible del panel: anillo magenta pleno, separado del control por el
 * color del propio panel (en oscuro el panel usa `--elevation-2`). Se lee igual
 * sobre un chip vacío que sobre uno seleccionado en tinta.
 */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[hsl(var(--elevation-2,var(--popover)))]";

/** Chip seleccionable: la selección se pinta en tinta, nunca en magenta (DESIGN.md). */
const CHIP_CLASS =
  "min-h-11 shrink-0 rounded-full border border-border bg-card px-3 text-sm font-normal text-foreground gap-1.5 sm:min-h-9 sm:px-3.5 " +
  "hover:bg-muted data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-ink-foreground data-[state=on]:hover:bg-ink/90 " +
  FOCUS_RING;

/**
 * Fila de chips: en móvil no se parte en dos renglones, se desliza de lado y
 * llega hasta el borde de la pantalla (el chip cortado avisa que hay más). El
 * `py-1` deja lugar al anillo de foco, que el scroll recortaría.
 */
const CHIP_RAIL =
  "-mx-4 -my-1 flex flex-nowrap items-center gap-2 overflow-x-auto scroll-px-4 px-4 py-1 [scrollbar-width:none] " +
  "sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0";

/** Campo de selección a lo ancho en móvil (etiqueta a la izquierda, valor y flecha a la derecha). */
const FIELD_ROW_MOBILE = "w-full justify-start [&>svg]:ml-auto sm:w-auto sm:[&>svg]:ml-0";

/** Botones chicos: 44px de alto en móvil, compactos en escritorio. */
const TAP = "min-h-11 sm:min-h-9";

/** Texto de error con contraste AA también en modo oscuro. */
const ERROR_TEXT = "text-xs font-medium text-red-700 dark:text-red-400";

/** Campo con error: borde y anillo en rojo (no en el magenta del foco normal). */
const INVALID_FIELD =
  "aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus-visible:border-red-600 aria-[invalid=true]:focus-visible:ring-red-600/25 " +
  "dark:aria-[invalid=true]:border-red-400 dark:aria-[invalid=true]:focus-visible:border-red-400 dark:aria-[invalid=true]:focus-visible:ring-red-400/25";

/** Chips de "Empezar desde" visibles; el resto va en "Más". */
const START_CHIPS_MAX = 4;
/** Chips de "agregar rápido" (habituales del cliente + frecuentes). */
const QUICK_CHIPS_MAX = 6;
/** Se ofrecen como habituales los productos que aparecen en 2+ pedidos. */
const LEARNED_MIN_ORDERS = 2;
/** El aviso "✓ #123 creado" de "Crear otro al terminar". */
const CREATED_BANNER_MS = 5_000;

/** Estado del formulario antes de aplicar una base, para volver atrás. */
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

/** De dónde salió lo precargado: un pedido anterior, una plantilla o "lo habitual". */
type BaseSource =
  | { kind: "order"; id: number }
  | { kind: "template"; id: number; name: string }
  | { kind: "suggestion"; id: number; name: string };

type AppliedBase = BaseSource & { snapshot: FormSnapshot };

/** Quién puso la ruta que se ve: el último pedido, lo que suele pedir el cliente o nadie. */
type RouteOrigin = "defaults" | "insights" | null;

interface ComposerState {
  clientId?: number;
  clientNameOverride: string;
  /** Cliente recién dado de alta (o del borrador): se muestra aunque la lista no se refrescó. */
  fallbackClient: Client | null;
  branchEmployeeId?: number;
  requiresDesign: boolean;
  /** Áreas de producción en orden de elección: la primera es la principal. */
  areas: string[];
  /** Elección del usuario; el responsable efectivo lo deriva `deriveAssignment`. */
  assignedUserId?: number;
  description: string;
  deliveryDate: string;
  deliveryTime: string;
  rows: OrderProductRow[];
  /** Hoja de materiales copiada de la base: se carga en el pedido nuevo al crearlo. */
  materials: RepeatMaterial[];
  base: AppliedBase | null;
  routeOrigin: RouteOrigin;
  /** La ruta de antes de proponer la del cliente ("Deshacer"). */
  routeBeforeInsights: { requiresDesign: boolean; areas: string[]; routeOrigin: RouteOrigin } | null;
  defaultsApplied: boolean;
  routeTouched: boolean;
  descriptionTouched: boolean;
  /** Datos cargados por el usuario (nunca por efectos ni defaults): decide borrador / confirmación. */
  dirty: boolean;
}

/** Lo que se lleva el formulario siguiente con "Crear otro al terminar". */
export interface CreateAnotherCarry {
  seq: number;
  clientId?: number;
  clientNameOverride: string;
  fallbackClient: Client | null;
  branchEmployeeId?: number;
  created: { order: Order; destination?: string };
}

function baseLabel(source: BaseSource): string {
  if (source.kind === "order") return `el pedido #${source.id}`;
  if (source.kind === "template") return `la plantilla «${source.name}»`;
  return `lo habitual de ${source.name}`;
}

function baseMeta(source: BaseSource): string {
  if (source.kind === "order") return `Como el pedido #${source.id}`;
  if (source.kind === "template") return `Plantilla «${source.name}»`;
  return "Lo habitual";
}

/** "#88" / "«Figuras»" / "lo habitual" (línea de materiales). */
function baseShort(source: BaseSource): string {
  if (source.kind === "order") return `#${source.id}`;
  if (source.kind === "template") return `«${source.name}»`;
  return "lo habitual";
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

function focusById(id: string, fallbackId?: string) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id) ?? (fallbackId ? document.getElementById(fallbackId) : null);
    target?.focus();
  });
}

const sameName = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

/* -------------------------------------------------------------------------- */
/* Piezas chicas                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Rol tipográfico de cada zona de la comanda (Qué se pide, Descripción,
 * Entrega, Ruta): el "título de sección" del sistema, igual en todas, sin
 * tarjeta ni línea. La jerarquía la hacen el tipo y el espacio entre zonas.
 */
const ZONE_TITLE_CLASS = "text-section-title text-foreground";

/** Encabezado de zona, con un dato opcional a la derecha (conteo, origen, "opcional"). */
function ZoneTitle({
  id,
  children,
  meta,
  sub = false,
}: {
  id: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
  /** Sub-grupo dentro de una zona (ej. "Empezar desde" bajo el cliente): rol de etiqueta. */
  sub?: boolean;
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <h3 id={id} className={sub ? "text-label" : ZONE_TITLE_CLASS}>
        {children}
      </h3>
      {meta && <div className="flex min-w-0 items-center gap-1.5 text-meta">{meta}</div>}
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className={cn("flex items-center gap-1", ERROR_TEXT)}>
      <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
      {error}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Diálogo                                                                    */
/* -------------------------------------------------------------------------- */

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
  /**
   * Ofrece "Crear otro al terminar" (default sí). Un alta puntual —ej.
   * convertir una cotización— lo apaga: ahí lo que sigue es volver a la lista.
   */
  createAnotherEnabled?: boolean;
}

/**
 * "Nuevo pedido" (comanda): UNA pantalla para quien carga pedidos todo el día.
 * De arriba abajo: quién levanta (sucursal) → cliente → empezar desde → qué
 * se pide → entrega → ruta → extras, con un footer fijo que resume el pedido
 * y crea con ⌘/Ctrl+Enter. Lo poco usado (plantillas, frecuentes, foto) vive
 * en "⋯"; la ayuda, en "?". Panel lateral en escritorio, pantalla completa en
 * móvil. El contrato con el backend vive en `lib/createOrderPayload.ts`.
 *
 * El formulario se monta SÓLO mientras el panel está abierto y con una key
 * por apertura: cada vez arranca limpio, sin efectos de "reset" que compitan
 * con los de repetir pedido o plantilla.
 */
export function CreateOrderDialog(props: CreateOrderDialogProps) {
  const [session, setSession] = useState(0);
  const [prevOpen, setPrevOpen] = useState(props.open);
  const [carry, setCarry] = useState<CreateAnotherCarry | null>(null);
  if (props.open !== prevOpen) {
    setPrevOpen(props.open);
    if (props.open) {
      setSession((n) => n + 1);
      setCarry(null);
    }
  }
  /** Lo registra el formulario: cerrar puede guardar borrador o pedir confirmación. */
  const requestCloseRef = useRef<(() => void) | null>(null);

  return (
    <DialogPrimitive.Root
      open={props.open}
      onOpenChange={(next) => {
        if (next) return;
        if (requestCloseRef.current) requestCloseRef.current();
        else props.onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Sin backdrop-blur, mismo motivo que en ui/dialog.tsx: animar
            opacidad de un elemento con blur trababa la apertura. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          // El foco inicial lo decide el formulario (quién levanta, cliente o producto).
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            // Escape en un buscador con la lista abierta cierra la lista, no el panel.
            const target = e.target as HTMLElement | null;
            if (target?.getAttribute?.("role") === "combobox" && target.getAttribute("aria-expanded") === "true") {
              e.preventDefault();
            }
          }}
          className={cn(
            "elevation-2 bg-popover fixed z-50 flex flex-col shadow-lg outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            // Móvil: pantalla completa. `100dvh`, no `h-full` (=100vh): el
            // footer no queda tapado por las barras del navegador.
            "inset-0 h-[100dvh] w-full data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            // Escritorio: panel lateral de altura completa, desliza desde la derecha.
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-full sm:max-w-2xl sm:border-l sm:border-border/60 sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right"
          )}
        >
          <OrderComposer
            key={`${session}:${carry?.seq ?? 0}`}
            {...props}
            carry={carry}
            requestCloseRef={requestCloseRef}
            onCreateAnotherInPlace={(next) => setCarry({ ...next, seq: (carry?.seq ?? 0) + 1 })}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* Formulario                                                                 */
/* -------------------------------------------------------------------------- */

interface OrderComposerProps extends CreateOrderDialogProps {
  carry: CreateAnotherCarry | null;
  requestCloseRef: React.MutableRefObject<(() => void) | null>;
  onCreateAnotherInPlace: (carry: Omit<CreateAnotherCarry, "seq">) => void;
}

function OrderComposer({
  onClose,
  onCreated,
  initialClientId,
  initialClientNameOverride,
  initialDescription,
  onCreateAnother,
  repeatFromOrderId,
  templateId,
  createAnotherEnabled = true,
  carry,
  requestCloseRef,
  onCreateAnotherInPlace,
}: OrderComposerProps) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { session, isBranch } = usePermissions();
  const userId = session?.user?.id;
  const { branch: myBranch } = useMyBranch(isBranch);
  const { formButtonMotion, revealMotion, reduced } = useMotionPreset();
  const { data: clients } = useEntityList<Client>("clients");
  const { data: productPresets } = useEntityList<OrderProductPreset>("orderProductPresets", {
    staleTime: CATALOG_STALE_TIME,
  });
  // La sucursal no elige responsable (el backend lo fuerza): no pide usuarios.
  const { data: users, isPending: usersPending } = useEntityList<User>("users", { enabled: !isBranch });
  const { preferences, updatePreferences } = useUserPreferences();
  const { createPreset } = useCreateProductPreset();
  const myFrequents = useMemo(
    () => resolveFrequents(productPresets, preferences?.frequentProductIds),
    [productPresets, preferences?.frequentProductIds]
  );
  const { create } = useEntityMutations<Order, CreateOrderPayload>("orders");
  const templateMutations = useOrderTemplateMutations();
  const prefetchClient = usePrefetchClientContext();

  const hasPrefill =
    repeatFromOrderId !== undefined ||
    templateId !== undefined ||
    initialClientId !== undefined ||
    Boolean(initialClientNameOverride) ||
    Boolean(initialDescription) ||
    carry !== null;

  /* ------------------------------ Estado ---------------------------------- */

  const rowKeySeq = useRef(0);
  const nextRowKey = () => `row-${++rowKeySeq.current}`;

  const [form, setForm] = useState<ComposerState>(() => {
    const lastDefaults = isBranch ? null : readLastOrderDefaults();
    const fromCarry = carry !== null;
    return {
      clientId: fromCarry ? carry.clientId : initialClientId,
      clientNameOverride: fromCarry
        ? carry.clientNameOverride
        : initialClientId !== undefined
          ? ""
          : (initialClientNameOverride ?? ""),
      fallbackClient: carry?.fallbackClient ?? null,
      branchEmployeeId: isBranch ? (carry?.branchEmployeeId ?? readRememberedBranchEmployee(userId)) : undefined,
      requiresDesign: lastDefaults?.requiresDesign ?? true,
      areas: lastDefaults?.area ? [lastDefaults.area] : [],
      assignedUserId: undefined,
      description: initialDescription ?? "",
      deliveryDate: "",
      deliveryTime: "",
      rows: [],
      materials: [],
      base: null,
      routeOrigin: lastDefaults ? "defaults" : null,
      routeBeforeInsights: null,
      defaultsApplied: Boolean(lastDefaults),
      routeTouched: false,
      descriptionTouched: false,
      dirty: false,
    };
  });
  const update = (patch: Partial<ComposerState> | ((s: ComposerState) => Partial<ComposerState>)) =>
    setForm((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  const markDirty = () => update({ dirty: true });

  /** Borrador que había al abrir: se OFRECE (nunca se restaura solo) si no vino nada precargado. */
  const [pendingDraft, setPendingDraft] = useState<OrderDraft | null>(() => readOrderDraft(userId));
  const showDraftPrompt = pendingDraft !== null && !hasPrefill;
  /**
   * Mientras haya un borrador sin resolver, no se guarda encima (se perdería).
   * Con algo precargado el borrador viejo tampoco se pisa: cerrar con datos pide confirmar.
   */
  const draftBlocked = pendingDraft !== null;

  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  /** Ya se creó: ningún guardado de borrador pendiente puede revivirlo. */
  const createdRef = useRef(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Cambia en cada intento: remonta el contenido del aviso para que se vuelva a anunciar. */
  const [attempt, setAttempt] = useState(0);
  const [clientQuery, setClientQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [recentClientIds] = useState<number[]>(() => readRecentClientIds());
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [moreBasesOpen, setMoreBasesOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState<string | null>(null);
  const [createAnother, setCreateAnother] = useState(() => createAnotherEnabled && readCreateAnother(userId));
  const [createdBanner, setCreatedBanner] = useState(carry?.created ?? null);
  const [clientResourceFile, setClientResourceFile] = useState<UploadedFileInput | null>(null);
  const [clientResourceFilePreview, setClientResourceFilePreview] = useState<string | null>(null);
  /** Mockups 3D armados desde aquí: se guardan en el pedido (POST aparte) después de crearlo. */
  const [pendingMockups, setPendingMockups] = useState<{ key: string; result: MockupStudioResult }[]>([]);
  const [mockupStudioOpen, setMockupStudioOpen] = useState(false);
  const [mockupStudioLoaded, setMockupStudioLoaded] = useState(false);
  const [frequentsOpen, setFrequentsOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const mockupKeySeq = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const focusBeforeConfirmRef = useRef<HTMLElement | null>(null);
  /** Qué hacer después de confirmar el descarte (ej. abrir el pedido recién creado). */
  const afterDiscardRef = useRef<(() => void) | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  /** Invalida la carga de materiales de una base anterior (se cambió o se quitó). */
  const baseRequestRef = useRef(0);
  const appliedRepeatRef = useRef<number | null>(null);
  const appliedTemplateRef = useRef<number | null>(null);
  const appliedInsightsRef = useRef<number | null>(null);

  // "⌘↵" en Mac, "Ctrl ↵" en el resto. Después de montar (el SSR no sabe la plataforma).
  useEffect(() => {
    setShortcutLabel(isMac() ? "⌘↵" : "Ctrl ↵");
  }, []);

  // La preview (hasta 5 MB) no se retiene después de desmontar.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  // "✓ #123 creado" se va solo.
  useEffect(() => {
    if (!createdBanner) return;
    const timer = window.setTimeout(() => setCreatedBanner(null), CREATED_BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [createdBanner]);

  /* ---------------------------- Quién levanta ----------------------------- */

  const branchEmployees = myBranch?.employees ?? [];
  // Lo recordado sólo vale si sigue siendo un empleado activo de la sucursal.
  const branchEmployeeId =
    form.branchEmployeeId !== undefined && (!myBranch || branchEmployees.some((e) => e.id === form.branchEmployeeId))
      ? form.branchEmployeeId
      : undefined;

  /* ------------------------------- Cliente -------------------------------- */

  const selectedClient = form.clientId
    ? (clients.find((c) => c.id === form.clientId) ??
      (form.fallbackClient?.id === form.clientId ? form.fallbackClient : null))
    : null;
  const isFreeTextClient = !form.clientId && form.clientNameOverride.trim() !== "";
  const selectedClientLabel = selectedClient ? clientLabel(selectedClient) : form.clientNameOverride.trim();
  const hasClient = Boolean(form.clientId) || isFreeTextClient;

  const clientCtxId = form.clientId && !isBranch ? form.clientId : null;
  /**
   * Lo que el sistema aprendió del cliente (backend: client-insight.engine.ts):
   * qué suele pedir y cuánto, por dónde va y con cuánta anticipación.
   */
  const { insights, isLoading: insightsLoading } = useClientInsights(clientCtxId);
  const { orders: previousOrders, isLoading: previousLoading } = useClientOrders(clientCtxId, {
    limit: COMPOSER_PREVIOUS_ORDERS_LIMIT,
  });
  const { templates, isLoading: templatesLoading } = useClientOrderTemplates(clientCtxId);
  const { data: repeatSource } = useOrder(repeatFromOrderId, { enabled: repeatFromOrderId !== undefined });
  const { data: templateSource } = useOrderTemplate(templateId, { enabled: templateId !== undefined });

  const learnedProducts = useMemo(
    () => (insights?.products ?? []).filter((p) => p.orders >= LEARNED_MIN_ORDERS),
    [insights]
  );
  const leadDays = learnedLeadDays(insights);
  const learnedTime = useMemo(() => {
    const time = typicalDeliveryTime(insights?.recentDeliveries ?? []);
    return time && DELIVERY_TIME_SLOTS.includes(time) ? time : null;
  }, [insights]);

  const chooseClient = (id: number | undefined, freeText = "", fallback: Client | null = null) => {
    update({ clientId: id, clientNameOverride: freeText, fallbackClient: fallback, dirty: true });
    setClientQuery("");
    // El buscador se desmonta: lo siguiente es qué se pide.
    focusById(IDS.productAdd, IDS.description);
  };

  const clearClient = () => {
    baseRequestRef.current++;
    appliedInsightsRef.current = null;
    update((s) => {
      // La base y la ruta propuesta eran de ese cliente: se vuelve a lo de antes.
      const snapshot = s.base?.snapshot;
      const route =
        s.routeOrigin === "insights" && s.routeBeforeInsights
          ? { ...s.routeBeforeInsights, routeBeforeInsights: null }
          : {};
      return {
        ...(snapshot ? snapshotToState(snapshot) : {}),
        ...route,
        base: null,
        clientId: undefined,
        clientNameOverride: "",
        fallbackClient: null,
        dirty: true,
      };
    });
    setMaterialsLoading(false);
    focusById(IDS.client);
  };

  const clientResults = useMemo(
    () => searchClients(clients, clientQuery, recentClientIds),
    [clients, clientQuery, recentClientIds]
  );

  const clientOptions: InlineOption[] = useMemo(() => {
    const text = clampName(clientQuery);
    const options: InlineOption[] = clientResults.results.map((c) => ({
      id: `c-${c.id}`,
      label: clientLabel(c),
      textValue: clientLabel(c),
      hint: [c.phone, c.company?.name].filter(Boolean).join(" · ") || undefined,
      group: text ? undefined : clientResults.showingRecents ? "Recientes" : "Clientes",
      onSelect: () => chooseClient(c.id),
    }));
    if (text && !hasExactClient(clients, text)) {
      options.push({
        id: "free",
        label: `Usar "${text}" como nombre de cliente`,
        icon: <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />,
        onSelect: () => chooseClient(undefined, text),
      });
    }
    if (text) {
      options.push({
        id: "register",
        label: `Registrar «${text}»`,
        icon: <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />,
        onSelect: () => setNewClientName(text),
      });
    }
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientResults, clientQuery, clients]);

  /* ------------------------------ Productos ------------------------------- */

  const announceMerge = (name: string, quantity: number, key: string) => {
    setLiveMessage(`Se sumó a ${name} (ahora ${quantity})`);
    if (!reduced) {
      setHighlightKey(key);
      window.setTimeout(() => setHighlightKey((k) => (k === key ? null : k)), 600);
    }
  };

  function clearRowError(key: string) {
    setRowErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /**
   * Agrega un producto (chip o "Agregar producto…"): si ya está en la lista
   * suma en vez de duplicar la línea. Si el cliente ya lo pidió antes,
   * arranca con su cantidad habitual. `quantity` viene de "50 playera".
   */
  const addProduct = (rawName: string, quantity?: number) => {
    const name = tidyProductName(rawName);
    if (!name) return;
    const existing = form.rows.find((r) => sameName(r.customName, name));
    if (existing) {
      // Con tallas, la cantidad es su total: se suma en la grilla, no aquí.
      const sized = sizeBreakdownTotal(existing.sizes) > 0;
      const next = sized ? existing.quantity ?? 0 : Math.min((existing.quantity ?? 0) + (quantity ?? 1), MAX_QUANTITY);
      update((s) => ({
        rows: s.rows.map((r) => (r.key === existing.key ? { ...r, quantity: next } : r)),
        dirty: true,
      }));
      clearRowError(existing.key);
      announceMerge(existing.customName, next, existing.key);
      return;
    }
    if (form.rows.length >= MAX_PRODUCT_LINES) {
      toast.error(`Un pedido admite hasta ${MAX_PRODUCT_LINES} líneas de producto.`);
      return;
    }
    const key = nextRowKey();
    const learned = learnedQuantityFor(insights?.products, name);
    const initial = quantity ?? learned ?? 1;
    update((s) => ({ rows: [...s.rows, { key, customName: name, quantity: initial }], dirty: true }));
    setLiveMessage(
      quantity
        ? `${name} agregado: ${quantity}`
        : learned
          ? `${name} agregado con su cantidad habitual: ${learned}`
          : `${name} agregado`
    );
  };

  /** Cambia el nombre de una fila; si coincide con otra, se fusionan sumando cantidades. */
  const renameRow = (key: string, rawName: string) => {
    const name = clampName(rawName);
    const current = form.rows.find((r) => r.key === key);
    if (!name || !current || name === current.customName) return;
    clearRowError(key);
    const duplicate = form.rows.find((r) => r.key !== key && sameName(r.customName, name));
    if (!duplicate) {
      update((s) => ({ rows: s.rows.map((r) => (r.key === key ? { ...r, customName: name } : r)), dirty: true }));
      return;
    }
    const quantity = Math.min((duplicate.quantity ?? 0) + (current.quantity ?? 1), MAX_QUANTITY);
    update((s) => ({
      rows: s.rows
        .filter((r) => r.key !== key)
        // Al fusionar dos líneas el desglose deja de cuadrar: se descarta.
        .map((r) => (r.key === duplicate.key ? { ...r, quantity, sizes: null } : r)),
      dirty: true,
    }));
    announceMerge(duplicate.customName, quantity, duplicate.key);
    focusById(IDS.quantity(duplicate.key));
  };

  const setRowSizes = (key: string, sizes: SizeBreakdown | null, total: number) => {
    update((s) => ({
      rows: s.rows.map((r) => (r.key === key ? { ...r, sizes, quantity: total > 0 ? total : r.quantity } : r)),
      dirty: true,
    }));
  };

  const setQuantity = (key: string, quantity: number | undefined) => {
    const clamped = quantity === undefined ? undefined : Math.min(Math.max(quantity, 1), MAX_QUANTITY);
    // Con tallas cargadas la cantidad es su total: no se edita a mano.
    update((s) => ({
      rows: s.rows.map((r) => (r.key === key && !(sizeBreakdownTotal(r.sizes) > 0) ? { ...r, quantity: clamped } : r)),
      dirty: true,
    }));
    clearRowError(key);
  };

  const removeRow = (key: string) => {
    const index = form.rows.findIndex((r) => r.key === key);
    const remaining = form.rows.filter((r) => r.key !== key);
    update({ rows: remaining, dirty: true });
    clearRowError(key);
    // El botón se desmonta: el foco va a la fila vecina o a "Agregar producto".
    const neighbour = remaining[index] ?? remaining[index - 1];
    focusById(neighbour ? IDS.quantity(neighbour.key) : IDS.productAdd);
  };

  const completeRows = filterCompleteRows(form.rows);
  const unitCount = completeRows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);

  /** Chips de agregar rápido: primero lo que suele pedir el cliente (×cantidad), después mis frecuentes. */
  const quickChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: Array<{ id: string; name: string; habitQty?: number }> = [];
    for (const habit of learnedProducts) {
      if (seen.has(habit.key)) continue;
      seen.add(habit.key);
      chips.push({ id: `h-${habit.key}`, name: habit.name, habitQty: habit.typicalQuantity });
    }
    for (const preset of myFrequents) {
      const key = normalizeProductKey(preset.name);
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({ id: `p-${preset.id}`, name: preset.name });
    }
    return chips.slice(0, QUICK_CHIPS_MAX);
  }, [learnedProducts, myFrequents]);

  const productOptions: InlineOption[] = useMemo(() => {
    const { name, quantity } = parseQuickAdd(productQuery);
    if (!name) return [];
    const key = normalizeProductKey(name);
    const qtyHint = (product: string) => {
      const q = quantity ?? learnedQuantityFor(insights?.products, product);
      return q ? `×${q}` : undefined;
    };
    const startsWith = (p: OrderProductPreset) => normalizeProductKey(p.name).startsWith(key);
    const matches = productPresets
      .filter((p) => normalizeProductKey(p.name).includes(key))
      .sort((a, b) => Number(!startsWith(a)) - Number(!startsWith(b)))
      .slice(0, 6);
    const options: InlineOption[] = matches.map((p) => ({
      id: `p-${p.id}`,
      label: p.name,
      textValue: p.name,
      hint: qtyHint(p.name),
      onSelect: () => {
        addProduct(p.name, quantity);
        setProductQuery("");
      },
    }));
    if (!matches.some((p) => normalizeProductKey(p.name) === key)) {
      options.push({
        id: "new",
        label: `Usar "${tidyProductName(name)}" como producto nuevo`,
        hint: qtyHint(name),
        icon: <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />,
        onSelect: () => {
          addProduct(name, quantity);
          setProductQuery("");
        },
      });
    }
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery, productPresets, insights, form.rows]);

  /* --------------- Empezar desde: pedido, plantilla, lo habitual ---------- */

  // Los clientes suelen repetir el pedido aunque cambie el detalle y la fecha.
  // Usar una base copia lo que se pide, la descripción, la ruta y la hoja de
  // materiales; NUNCA la fecha ni el archivo. Siempre es una acción explícita
  // y se deshace tocando el mismo chip.

  const takeSnapshot = (s: ComposerState = form): FormSnapshot => ({
    requiresDesign: s.requiresDesign,
    areas: s.areas,
    assignedUserId: s.assignedUserId,
    description: s.description,
    rows: s.rows,
    materials: s.materials,
    defaultsApplied: s.defaultsApplied,
    routeTouched: s.routeTouched,
    descriptionTouched: s.descriptionTouched,
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

  function snapshotToState(snapshot: FormSnapshot): Partial<ComposerState> {
    return {
      requiresDesign: snapshot.requiresDesign,
      areas: snapshot.areas,
      assignedUserId: snapshot.assignedUserId,
      description: snapshot.description,
      rows: snapshot.rows,
      materials: snapshot.materials,
      defaultsApplied: snapshot.defaultsApplied,
      routeTouched: snapshot.routeTouched,
      descriptionTouched: snapshot.descriptionTouched,
      routeOrigin: snapshot.defaultsApplied && !snapshot.routeTouched ? "defaults" : null,
      routeBeforeInsights: null,
    };
  }

  /**
   * Vuelca lo precargado. `snapshot` es el formulario de ANTES de la primera
   * base: cambiar de una base a otra no lo pisa, así quitarla siempre vuelve
   * a lo que había cargado el usuario.
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
    snapshot: FormSnapshot,
    extra: Partial<ComposerState> = {}
  ) {
    baseRequestRef.current++;
    const nextRows = prefill.products.map((p) => ({ key: nextRowKey(), ...p }));
    update({
      ...extra,
      base: { ...source, snapshot },
      requiresDesign: prefill.requiresDesign,
      areas: prefill.areas,
      assignedUserId: prefill.assignedUserId,
      description: prefill.description,
      rows: nextRows,
      materials: prefill.materials,
      defaultsApplied: false,
      routeTouched: false,
      descriptionTouched: false,
      routeOrigin: null,
      routeBeforeInsights: null,
      dirty: true,
    });
    setRowErrors({});
    setMaterialsLoading(false);
    setLiveMessage(
      `Se cargó ${baseLabel(source)}: ${nextRows.length} ${
        nextRows.length === 1 ? "producto" : "productos"
      }. Revisa cantidades y descripción.`
    );
    // Lo que más cambia de una vez a otra es la cantidad: el foco va ahí.
    if (nextRows[0]) {
      requestAnimationFrame(() => {
        const input = document.getElementById(IDS.quantity(nextRows[0].key)) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      });
    }
  }

  /** Pedido anterior como base; su hoja de materiales se pide aparte. */
  function applyBase(order: Order, snapshot: FormSnapshot, extra: Partial<ComposerState> = {}) {
    loadPrefill({ kind: "order", id: order.id }, { ...buildRepeatPrefill(order), materials: [] }, snapshot, extra);
    const requestId = baseRequestRef.current;
    // El listado trae `materialItems` livianos: si viene vacío no hay nada que pedir.
    if (order.materialItems && order.materialItems.length === 0) return;
    setMaterialsLoading(true);
    request<OrderMaterialItem[]>(`${ENDPOINTS.orders}/${order.id}/materials`, { token })
      .then((items) => {
        if (requestId === baseRequestRef.current) update({ materials: toRepeatMaterials(items ?? []) });
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

  function applyTemplate(template: OrderTemplate, snapshot: FormSnapshot, extra: Partial<ComposerState> = {}) {
    loadPrefill({ kind: "template", id: template.id, name: template.name }, buildTemplatePrefill(template), snapshot, extra);
  }

  /** "Lo habitual": no trae descripción ni fecha (cambian cada vez): se respeta lo ya escrito. */
  function applySuggestion() {
    const suggestion = insights?.suggestion;
    if (!suggestion || !form.clientId) return;
    loadPrefill(
      { kind: "suggestion", id: form.clientId, name: selectedClientLabel || "el cliente" },
      {
        requiresDesign: suggestion.requiresDesign,
        areas: suggestion.areas.filter((a) => PRODUCTION_AREA_OPTIONS.some((o) => o.value === a)),
        assignedUserId: undefined,
        description: form.description,
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
      form.base?.snapshot ?? takeSnapshot()
    );
  }

  const baseChipId = (source: BaseSource) =>
    source.kind === "order"
      ? `order-previous-${source.id}`
      : source.kind === "template"
        ? `order-template-${source.id}`
        : "order-use-habitual";

  const removeBase = () => {
    const base = form.base;
    if (!base) return;
    baseRequestRef.current++;
    update({ ...snapshotToState(base.snapshot), base: null, dirty: true });
    setRowErrors({});
    setMaterialsLoading(false);
    setLiveMessage(`Se quitó ${baseLabel(base)}`);
    focusById(baseChipId(base), IDS.productAdd);
  };

  const removeMaterial = (key: string) => {
    const index = form.materials.findIndex((m) => m.key === key);
    const remaining = form.materials.filter((m) => m.key !== key);
    update({ materials: remaining, dirty: true });
    const neighbour = remaining[index] ?? remaining[index - 1];
    focusById(neighbour ? IDS.materialRemove(neighbour.key) : IDS.materials, IDS.description);
  };

  // "Repetir pedido" desde el detalle: cliente + base apenas llega el pedido.
  useEffect(() => {
    if (!repeatSource || repeatSource.id !== repeatFromOrderId) return;
    if (appliedRepeatRef.current === repeatSource.id) return;
    appliedRepeatRef.current = repeatSource.id;
    appliedInsightsRef.current = repeatSource.clientId ?? null;
    applyBase(repeatSource, openingSnapshot(), {
      clientId: repeatSource.clientId ?? undefined,
      clientNameOverride: repeatSource.clientId ? "" : repeatSource.clientNameOverride?.trim() ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatSource, repeatFromOrderId]);

  // "Nuevo pedido" desde las plantillas del cliente (pantalla Clientes).
  useEffect(() => {
    if (!templateSource || templateSource.id !== templateId) return;
    if (appliedTemplateRef.current === templateSource.id) return;
    appliedTemplateRef.current = templateSource.id;
    appliedInsightsRef.current = templateSource.clientId;
    applyTemplate(templateSource, openingSnapshot(), { clientId: templateSource.clientId, clientNameOverride: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateSource, templateId]);

  // La ruta con la que suele ir el cliente, si el usuario no tocó la ruta ni
  // cargó una base. Visible ("Como suele pedir") y con "Deshacer".
  useEffect(() => {
    if (isBranch || !form.clientId || !insights) return;
    if (appliedInsightsRef.current === form.clientId) return;
    appliedInsightsRef.current = form.clientId;
    if (form.routeTouched || form.base) return;
    const route = routeFromInsights(insights);
    if (!route) return;
    const same =
      route.requiresDesign === form.requiresDesign &&
      route.areas.length === form.areas.length &&
      route.areas.every((a, i) => form.areas[i] === a);
    if (same) return;
    update((s) => ({
      requiresDesign: route.requiresDesign,
      areas: route.areas,
      assignedUserId: undefined,
      routeOrigin: "insights",
      routeBeforeInsights: { requiresDesign: s.requiresDesign, areas: s.areas, routeOrigin: s.routeOrigin },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights, form.clientId]);

  const undoInsightsRoute = () => {
    update((s) =>
      s.routeBeforeInsights
        ? { ...s.routeBeforeInsights, routeBeforeInsights: null, routeTouched: true, dirty: true }
        : {}
    );
    setLiveMessage("Se volvió a la ruta anterior");
  };

  /* ------------------------------ Ruta ------------------------------------ */

  const primaryArea = form.areas[0];
  const assignment = useMemo(
    () =>
      deriveAssignment({
        users,
        requiresDesign: form.requiresDesign,
        areas: form.areas,
        assignedUserId: form.assignedUserId,
      }),
    [users, form.requiresDesign, form.areas, form.assignedUserId]
  );
  const { assignmentArea, sharedAccount, individuals, assignedUserId, isShared: isSharedAssignee } = assignment;

  const assignedUserLabel = (() => {
    if (!assignedUserId) return "Sin asignar";
    if (isSharedAssignee) {
      return form.requiresDesign ? "Cualquier diseñador" : `Cualquiera de ${getAreaLabel(assignmentArea ?? "")}`;
    }
    const u = users.find((usr) => usr.id === assignedUserId);
    return u ? userLabel(u) : "Sin asignar";
  })();

  const changeRoute = (value: string) => {
    if (!value) return;
    update({ requiresDesign: value === "design", routeTouched: true, routeOrigin: null, routeBeforeInsights: null, dirty: true });
  };

  const changeAreas = (next: string[]) => {
    update((s) => ({
      areas: mergeAreaSelection(s.areas, next),
      routeTouched: true,
      routeOrigin: null,
      routeBeforeInsights: null,
      dirty: true,
    }));
  };

  const noUsersForRole =
    !isBranch && !usersPending && Boolean(assignmentArea) && assignment.usersInArea.length === 0
      ? `No hay usuarios con el rol ${form.requiresDesign ? "Diseño" : getAreaLabel(assignmentArea ?? "")}.`
      : undefined;

  /* -------------------------------- Entrega ------------------------------- */

  // "Hoy" se fija al abrir: los atajos no cambian mientras se carga el pedido.
  const [today] = useState(() => new Date());
  const dateChips = useMemo(() => deliveryChips(today, leadDays), [today, leadDays]);
  const activeDateChip = dateChips.find((c) => c.date === form.deliveryDate)?.key ?? "";
  const isCustomDate = Boolean(form.deliveryDate) && !activeDateChip;

  /** Con fecha y sin hora elegida, propone la hora en que suele recibir el cliente. */
  const changeDeliveryDate = (date: string) => {
    update((s) => ({
      deliveryDate: date,
      deliveryTime: !date ? "" : s.deliveryTime || learnedTime || "",
      dirty: true,
    }));
  };

  /* -------------------------------- Archivo ------------------------------- */

  function revokePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setClientResourceFilePreview(null);
  }

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
      focusById(IDS.fileRemove);
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
    focusById(IDS.fileAttach);
  };

  /* -------------------------------- Mockups ------------------------------- */

  const openMockupStudio = () => {
    setMockupStudioLoaded(true);
    setMockupStudioOpen(true);
  };

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
   * Guarda un mockup en el pedido ya creado. Corre en segundo plano; si
   * falla, el toast trae "Reintentar", que reenvía el mismo cuerpo.
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

  /* ------------------------------ Plantillas ------------------------------ */

  const templatePayload = () =>
    buildTemplatePayload({
      requiresDesign: form.requiresDesign,
      areas: form.areas,
      description: form.description,
      rows: form.rows,
      materials: form.materials,
    });
  const canSaveTemplate = Boolean(form.clientId) && !isBranch && completeRows.length > 0;
  const templateContentSummary = [
    `${completeRows.length} ${completeRows.length === 1 ? "producto" : "productos"}`,
    form.description.trim() ? "la descripción" : null,
    form.requiresDesign ? "con diseño" : "sin diseño",
    form.areas.length > 0 ? form.areas.map((a) => getAreaLabel(a)).join(", ") : null,
    form.materials.length > 0
      ? `${form.materials.length} ${form.materials.length === 1 ? "material" : "materiales"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  const updateTemplate = async () => {
    const base = form.base;
    if (base?.kind !== "template") return;
    try {
      await templateMutations.update.mutateAsync({ id: base.id, payload: templatePayload() });
      toast.success(`Plantilla «${base.name}» actualizada`);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la plantilla."));
    }
  };

  /* ------------------------------ Borrador -------------------------------- */

  const draftData = (s: ComposerState): OrderDraftData => ({
    clientId: s.clientId,
    clientNameOverride: s.clientNameOverride,
    clientLabel: selectedClientLabel || undefined,
    requiresDesign: s.requiresDesign,
    areas: s.areas,
    assignedUserId: s.assignedUserId,
    description: s.description,
    deliveryDate: s.deliveryDate,
    deliveryTime: s.deliveryTime,
    rows: s.rows,
    materials: s.materials,
    base: s.base as DraftBase | null,
    routeTouched: s.routeTouched,
    descriptionTouched: s.descriptionTouched,
  });

  /** Guarda YA (al cerrar); devuelve si quedó guardado. Nunca con un borrador viejo sin resolver. */
  const saveDraftNow = (): boolean => {
    if (draftBlocked || createdRef.current || !userId) return false;
    return writeOrderDraft(userId, draftData(form));
  };

  // Autoguardado: medio segundo después del último cambio, sólo si hay algo cargado.
  useEffect(() => {
    if (!form.dirty || draftBlocked || !userId) return;
    const timer = window.setTimeout(() => {
      if (!createdRef.current && !submittingRef.current) writeOrderDraft(userId, draftData(form));
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, draftBlocked, userId]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    const d = pendingDraft.data;
    // Las claves de fila siguen siendo únicas después de restaurar.
    const keys = [...d.rows, ...((d.base?.snapshot as FormSnapshot | undefined)?.rows ?? [])].map((r) => r.key);
    const maxSeq = Math.max(0, ...keys.map((k) => Number(/^row-(\d+)$/.exec(k)?.[1] ?? 0)));
    rowKeySeq.current = Math.max(rowKeySeq.current, maxSeq);
    appliedInsightsRef.current = d.clientId ?? null;
    setForm((s) => ({
      ...s,
      clientId: d.clientId,
      clientNameOverride: d.clientNameOverride,
      fallbackClient:
        d.clientId && d.clientLabel ? ({ id: d.clientId, first_name: d.clientLabel } as Client) : null,
      requiresDesign: d.requiresDesign,
      areas: d.areas,
      assignedUserId: d.assignedUserId,
      description: d.description,
      deliveryDate: d.deliveryDate,
      deliveryTime: d.deliveryTime,
      rows: d.rows,
      materials: d.materials,
      base: d.base as AppliedBase | null,
      routeOrigin: null,
      routeBeforeInsights: null,
      defaultsApplied: false,
      routeTouched: d.routeTouched,
      descriptionTouched: d.descriptionTouched,
      dirty: true,
    }));
    setPendingDraft(null);
    setLiveMessage("Se recuperó el borrador");
    focusById(d.clientId || d.clientNameOverride ? IDS.productAdd : IDS.client, IDS.description);
  };

  const discardDraft = () => {
    clearOrderDraft(userId);
    setPendingDraft(null);
    setLiveMessage("Se descartó el borrador");
    focusById(IDS.client, IDS.productAdd);
  };

  /* ------------------------------- Cerrar --------------------------------- */

  /** ✕ / Escape / clic afuera: guarda borrador si hay datos; si no se puede, pide confirmar. */
  const requestClose = () => {
    if (submittingRef.current) return;
    if (form.dirty) {
      if (saveDraftNow()) {
        toast.message?.("Borrador guardado", { description: "Lo retomas al abrir «Nuevo pedido»." });
        onClose();
        return;
      }
      focusBeforeConfirmRef.current = document.activeElement as HTMLElement | null;
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });
  useEffect(
    () => () => {
      requestCloseRef.current = null;
    },
    [requestCloseRef]
  );

  /* ------------------------------ Validación ------------------------------ */

  const currentFormData = (): OrderFormData => ({
    isBranch,
    branchEmployeeId,
    clientId: form.clientId,
    clientNameOverride: form.clientNameOverride,
    area: primaryArea,
    requiresDesign: form.requiresDesign,
    description: form.description,
    deliveryDate: form.deliveryDate,
    assignedUserId,
    orderProducts: toOrderProducts(form.rows),
  });

  const validation = computeValidation(form.rows, currentFormData());
  const missingFields = missingFieldsInOrder(validation.fieldErrors);

  // Después del primer intento, los errores se recalculan en cada cambio.
  useEffect(() => {
    if (!submitAttempted) return;
    setErrors(validation.fieldErrors);
    setRowErrors(validation.rowErrors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitAttempted, form, branchEmployeeId, assignedUserId]);

  /** Antes del primer intento, sólo la descripción se valida al salir (si se tocó). */
  const validateDescriptionOnBlur = () => {
    if (!form.descriptionTouched || submitAttempted) return;
    setErrors((prev) => {
      const next = { ...prev };
      if (validation.fieldErrors.description) next.description = validation.fieldErrors.description;
      else delete next.description;
      return next;
    });
  };

  const focusField = (field: FieldKey, rowErrorMap: Record<string, string> = rowErrors) => {
    let target: HTMLElement | null = null;
    if (field === "branchEmployeeId") target = document.getElementById(IDS.branchEmployee);
    else if (field === "clientId") target = document.getElementById(IDS.client);
    else if (field === "area") target = document.querySelector<HTMLElement>(`#${IDS.areas} button`);
    else if (field === "assignedUserId") target = document.getElementById(IDS.assignee);
    else if (field === "description") target = document.getElementById(IDS.description);
    else if (field === "orderProducts") {
      const badRow = form.rows.find((r) => rowErrorMap[r.key]);
      target = badRow
        ? document.getElementById(
            rowErrorMap[badRow.key] === ROW_ERROR_MISSING_QUANTITY ? IDS.quantity(badRow.key) : IDS.product(badRow.key)
          )
        : document.getElementById(IDS.productAdd);
    }
    target?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    target?.focus();
  };

  /* --------------------------------- Envío -------------------------------- */

  const handleSubmit = async ({ invertCreateAnother = false } = {}) => {
    // Ref (no estado): un ⌘↵ repetido mientras responde la API no dispara otro POST.
    if (submittingRef.current) return;
    const { fieldErrors, rowErrors: nextRowErrors } = computeValidation(form.rows, currentFormData());
    setRowErrors(nextRowErrors);
    setErrors(fieldErrors);
    setSubmitError(null);
    setSubmitAttempted(true);
    setAttempt((n) => n + 1);

    const firstInvalid = missingFieldsInOrder(fieldErrors)[0];
    if (firstInvalid) {
      requestAnimationFrame(() => focusField(firstInvalid, nextRowErrors));
      return;
    }

    const parsed = orderSchema.parse(currentFormData());
    const andAnother = createAnotherEnabled && (invertCreateAnother ? !createAnother : createAnother);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const order = await create(
        buildCreateOrderPayload({
          parsed,
          areas: form.areas,
          deliveryTime: form.deliveryTime,
          isBranch,
          userId: Number(userId),
          clientResourceFile,
        })
      );
      createdRef.current = true;
      // Sólo el borrador de ESTE pedido: uno viejo sin resolver queda para después.
      if (!draftBlocked) clearOrderDraft(userId);

      // Hoja de materiales copiada de la base: una línea a la vez (la primera
      // dispara el evento "Compra de materiales"; en paralelo podían correr dos).
      let materialsFailed = 0;
      if (order?.id && form.materials.length > 0) {
        for (const m of form.materials) {
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
      if (form.base?.kind === "template") templateMutations.markUsed.mutate(form.base.id);

      // Mockups: después de crear y sin esperar (pueden pesar varios MB).
      if (order?.id && pendingMockups.length > 0) {
        pendingMockups.forEach((m, index) =>
          uploadMockup(
            order.id,
            { ...buildMockupPayload(m.result), branchEmployeeId: isBranch ? parsed.branchEmployeeId : undefined },
            pendingMockups.length > 1 ? `el mockup ${index + 1}` : "el mockup"
          )
        );
      }

      // Recientes, defaults del próximo pedido y "Crear otro para {cliente}".
      const submittedClientId = parsed.clientId;
      const submittedClientLabel = selectedClientLabel || parsed.clientNameOverride || "";
      if (submittedClientId) pushRecentClientId(submittedClientId);
      if (!isBranch) writeLastOrderDefaults({ requiresDesign: parsed.requiresDesign, area: primaryArea });

      const destination = isBranch
        ? undefined
        : parsed.requiresDesign
          ? `Diseño${!assignedUserId || isSharedAssignee ? ": lo toma quien esté libre" : ` (${assignedUserLabel})`}`
          : parsed.area
            ? getAreaLabel(parsed.area)
            : undefined;
      if (materialsFailed > 0) {
        toast.warning(
          materialsFailed === 1
            ? "El pedido se creó, pero no se pudo copiar 1 material. Cárgalo desde la hoja de materiales."
            : `El pedido se creó, pero no se pudieron copiar ${materialsFailed} materiales. Cárgalos desde la hoja de materiales.`
        );
      }

      if (andAnother) {
        // Mismo cliente, el resto limpio, foco en "Agregar producto".
        onCreateAnotherInPlace({
          clientId: submittedClientId,
          clientNameOverride: submittedClientId ? "" : submittedClientLabel,
          fallbackClient: selectedClient,
          branchEmployeeId,
          created: { order, destination },
        });
        return;
      }

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
      update({ dirty: false });
      onClose();
      onCreated?.(order);
    } catch (error) {
      // El toast de error ya lo dispara el feedback global (providers.tsx);
      // aquí sólo el aviso accesible del footer, con el mismo mensaje.
      setSubmitError(getErrorMessage(error, "No se pudo crear el pedido."));
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /** "Ver" en el aviso de creado: guarda lo que haya y abre el pedido. */
  const viewCreatedOrder = () => {
    const created = createdBanner;
    if (!created) return;
    if (form.dirty && !saveDraftNow()) {
      // Lo nuevo no se puede guardar: confirmar antes de perderlo.
      afterDiscardRef.current = () => onCreated?.(created.order);
      focusBeforeConfirmRef.current = document.activeElement as HTMLElement | null;
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
    onCreated?.(created.order);
  };

  /**
   * ⌘/Ctrl+Enter crea desde cualquier campo (incluida la descripción);
   * con Shift invierte "Crear otro al terminar" sólo esta vez.
   */
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    // Un combobox o un select abierto: su Enter es para elegir la opción
    // (`preventDefault`). Enviar en el mismo evento mandaría el estado ANTERIOR.
    // Los portales (selects, menús) burbujean por React pero no están en el form.
    if (e.defaultPrevented || !e.currentTarget.contains(e.target as Node)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit({ invertCreateAnother: e.shiftKey });
    }
  };

  /* ------------------------------ Foco inicial ---------------------------- */

  useEffect(() => {
    const prefilledClient = hasClient || repeatFromOrderId !== undefined || templateId !== undefined;
    const target =
      isBranch && form.branchEmployeeId === undefined
        ? IDS.branchEmployee
        : prefilledClient
          ? IDS.productAdd
          : IDS.client;
    focusById(target, IDS.client);
    // Sólo al montar (cada apertura / cada "crear otro" monta de nuevo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------- Footer -------------------------------- */

  const summaryParts = buildOrderSummary({
    clientLabel: selectedClientLabel,
    requiresDesign: isBranch ? true : form.requiresDesign,
    designerLabel: !isBranch && form.requiresDesign && assignedUserId ? assignedUserLabel : undefined,
    areaLabels: isBranch ? [] : form.areas.map((a) => getAreaLabel(a)),
    productCount: completeRows.length,
    unitCount,
    deliveryDate: form.deliveryDate,
    deliveryTime: form.deliveryTime,
  });
  const visibleErrors = missingFieldsInOrder(errors);
  const showErrorNotice = submitAttempted && (visibleErrors.length > 0 || Boolean(submitError));

  /* --------------------------- Datos para render -------------------------- */

  const clientContextLoading = Boolean(clientCtxId) && (insightsLoading || previousLoading || templatesLoading);
  const suggestion = clientCtxId ? insights?.suggestion ?? null : null;
  const lastOrder = previousOrders[0];
  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0)),
    [templates]
  );
  const templateSlots = Math.max(0, START_CHIPS_MAX - (suggestion ? 1 : 0) - (lastOrder ? 1 : 0));
  const chipTemplates = sortedTemplates.slice(0, templateSlots);
  const hasMoreBases = previousOrders.length > 1 || sortedTemplates.length > chipTemplates.length;
  const hasStartFrom = Boolean(suggestion) || templates.length > 0 || previousOrders.length > 0;
  const showStartFrom = Boolean(clientCtxId) && (clientContextLoading || hasStartFrom);
  /** Si ya estaba al abrir (cliente precargado), no se anima: el panel entra con todo en su lugar. */
  const [startFromAtMount] = useState(showStartFrom);

  const routeMeta =
    form.base && !form.routeTouched
      ? baseMeta(form.base)
      : form.routeOrigin === "insights"
        ? "Como suele pedir"
        : form.routeOrigin === "defaults" && !form.routeTouched
          ? "Como el último pedido"
          : undefined;

  const routeHelp = form.requiresDesign
    ? "Con diseño, el pedido entra a Diseño y pasa a producción cuando el cliente autoriza el montaje. Las áreas se pueden definir después; si eliges varias trabajan en paralelo y la primera es la principal."
    : "Sin diseño, el pedido va directo a producción. La primera área elegida es la principal y lo recibe; las demás trabajan en paralelo.";

  const assigneeHint = noUsersForRole ? `${noUsersForRole} Dar de alta uno para poder asignar el pedido.` : undefined;

  /* --------------------------------- Render ------------------------------- */

  return (
    <>
      {/*
        `display: contents`: el `<form>` no rompe el layout flex (header /
        cuerpo / footer). Enter NO envía (es una acción local en cada control);
        ⌘/Ctrl+Enter sí, desde cualquier campo.
      */}
      <form className="contents" noValidate onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown}>
        {/* ───────────── Cabecera ───────────── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <DialogPrimitive.Title className="font-heading text-xl font-semibold leading-tight tracking-tight">
            Nuevo pedido
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Cliente, qué se pide, entrega y ruta. Control o Comando más Enter crea el pedido.
          </DialogPrimitive.Description>
          {isBranch && (
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <span className="hidden text-meta sm:inline" aria-hidden>
                Levanta:
              </span>
              <Select
                value={branchEmployeeId ? String(branchEmployeeId) : ""}
                onValueChange={(v) => {
                  const id = v ? Number(v) : undefined;
                  update({ branchEmployeeId: id });
                  if (id) rememberBranchEmployee(userId, id);
                  focusById(hasClient ? IDS.productAdd : IDS.client, IDS.client);
                }}
              >
                <SelectTrigger
                  id={IDS.branchEmployee}
                  aria-label="¿Quién levanta el pedido?"
                  aria-required
                  aria-invalid={Boolean(errors.branchEmployeeId)}
                  aria-describedby={errors.branchEmployeeId ? `${IDS.branchEmployee}-error` : undefined}
                  className="h-11 min-w-[9rem] max-w-[14rem] rounded-full sm:h-9"
                >
                  <SelectValue placeholder="¿Quién levanta?" />
                </SelectTrigger>
                <SelectContent>
                  {branchEmployees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogPrimitive.Close
            type="button"
            aria-label="Cerrar"
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:size-9",
              !isBranch && "ml-auto"
            )}
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {isBranch && (errors.branchEmployeeId || (myBranch && branchEmployees.length === 0)) && (
          <div className="shrink-0 border-b border-border/60 px-4 py-2 sm:px-6">
            <FieldError id={IDS.branchEmployee} error={errors.branchEmployeeId} />
            {myBranch && branchEmployees.length === 0 && (
              <p className="text-meta">La sucursal no tiene empleados activos. Pide a administración que los agregue.</p>
            )}
          </div>
        )}

        {/* ───────────── Cuerpo ───────────── */}
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {/* Avisos arriba, fuera de la pila de zonas: el de "creado" lleva su
              espacio DENTRO (padding) para que al plegarse no salte un margen. */}
          {showDraftPrompt && pendingDraft && (
            <div
              role="status"
              className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm sm:mb-7"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                Borrador de {draftAgeLabel(pendingDraft.savedAt, Date.now())}
                {pendingDraft.data.clientLabel || pendingDraft.data.clientNameOverride
                  ? ` · ${pendingDraft.data.clientLabel || pendingDraft.data.clientNameOverride}`
                  : ""}
              </span>
              <span className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" className={TAP} onClick={restoreDraft}>
                  Continuar
                </Button>
                <Button type="button" size="sm" variant="ghost" className={TAP} onClick={discardDraft}>
                  Descartar
                </Button>
              </span>
            </div>
          )}

          {/* "✓ #123 creado": entra plegado desde arriba y se pliega al irse (5 s). */}
          <AnimatePresence>
            {createdBanner && (
              <motion.div key={createdBanner.order?.id ?? "created"} {...revealMotion}>
                <div className="pb-6 sm:pb-7">
                  <div
                    role="status"
                    className="flex min-h-11 items-center gap-2 rounded-xl bg-muted/60 py-1 pl-3 pr-1 text-sm sm:min-h-10"
                    data-testid="order-created-banner"
                  >
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium tabular-nums">#{createdBanner.order?.id}</span> creado
                      {createdBanner.destination ? (
                        <span className="text-muted-foreground"> · {createdBanner.destination}</span>
                      ) : null}
                    </span>
                    {onCreated && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn("px-3", TAP)}
                        onClick={viewCreatedOrder}
                      >
                        Ver
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6 sm:space-y-7">
            {/* ───────────── Cliente ───────────── */}
            <section aria-label="Cliente" className="space-y-3">
              {hasClient ? (
                <div className="flex min-h-11 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                  >
                    {initials(selectedClientLabel)}
                  </span>
                  <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="truncate text-base font-medium" data-testid="order-client-name">
                      {selectedClientLabel || "Cargando cliente…"}
                    </span>
                    {selectedClient && (selectedClient.phone || selectedClient.company?.name) && (
                      <span className="truncate text-meta">
                        {[selectedClient.phone, selectedClient.company?.name].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {isFreeTextClient && (
                      <span className="flex items-center gap-1.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Sin registrar</span>
                        <button
                          type="button"
                          className="text-xs underline underline-offset-2 hover:text-foreground"
                          onClick={() => setNewClientName(form.clientNameOverride)}
                        >
                          Registrar
                        </button>
                      </span>
                    )}
                  </p>
                  <Button
                    id={IDS.clientChange}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("shrink-0", TAP)}
                    onClick={clearClient}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <InlineCombobox
                    id={IDS.client}
                    label="Cliente"
                    placeholder="Buscar cliente…"
                    value={clientQuery}
                    onValueChange={setClientQuery}
                    options={clientOptions}
                    openOnEmpty
                    required
                    invalid={Boolean(errors.clientId)}
                    describedBy={errors.clientId ? `${IDS.client}-error` : undefined}
                    onActiveChange={(option) => {
                      if (option?.id.startsWith("c-") && !isBranch) prefetchClient(Number(option.id.slice(2)));
                    }}
                    leading={
                      <Search
                        className="pointer-events-none absolute left-3 top-[1.375rem] h-4 w-4 -translate-y-1/2 text-muted-foreground sm:top-5"
                        aria-hidden
                      />
                    }
                    inputClassName="pl-9"
                  />
                  <FieldError id={IDS.client} error={errors.clientId} />
                </div>
              )}

              {/* ───────────── Empezar desde ───────────── */}
              {showStartFrom && (
                // Aparece al elegir cliente: se despliega en vez de empujar todo de golpe.
                <motion.div
                  initial={startFromAtMount ? false : revealMotion.initial}
                  animate={revealMotion.animate}
                  className="space-y-1.5"
                >
                  <ZoneTitle sub id="order-start-from" meta={form.base ? baseMeta(form.base) : undefined}>
                    Empezar desde
                  </ZoneTitle>
                  <div
                    // Al pasar de esqueleto a chips el grupo se monta de nuevo y entra con un fundido.
                    key={clientContextLoading && !hasStartFrom ? "loading" : "ready"}
                    role="group"
                    aria-labelledby="order-start-from"
                    aria-busy={clientContextLoading && !hasStartFrom}
                    className={cn(
                      "flex min-h-11 flex-wrap items-center gap-2 sm:min-h-9",
                      !(clientContextLoading && !hasStartFrom) && "duration-200 animate-in fade-in-0"
                    )}
                  >
                    {clientContextLoading && !hasStartFrom ? (
                      <>
                        <Skeleton className="h-11 w-28 rounded-full sm:h-9" />
                        <Skeleton className="h-11 w-36 rounded-full sm:h-9" />
                        <Skeleton className="h-11 w-24 rounded-full sm:h-9" />
                      </>
                    ) : (
                      <>
                        {suggestion && (
                          <Button
                            id="order-use-habitual"
                            type="button"
                            variant="outline"
                            aria-pressed={form.base?.kind === "suggestion"}
                            data-state={form.base?.kind === "suggestion" ? "on" : "off"}
                            aria-label={
                              form.base?.kind === "suggestion"
                                ? "Quitar lo habitual"
                                : `Usar lo habitual de ${selectedClientLabel}`
                            }
                            title={`${describeOrderProducts(suggestion.products, 3)} · ${
                              suggestion.requiresDesign ? "con diseño" : "sin diseño"
                            } · aprendido de ${suggestion.basedOn} pedidos`}
                            className={CHIP_CLASS}
                            onClick={() => (form.base?.kind === "suggestion" ? removeBase() : applySuggestion())}
                          >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                            Lo habitual
                            {form.base?.kind === "suggestion" && <X className="h-3.5 w-3.5" aria-hidden />}
                          </Button>
                        )}
                        {chipTemplates.map((t) => {
                          const inUse = form.base?.kind === "template" && form.base.id === t.id;
                          return (
                            <Button
                              key={t.id}
                              id={`order-template-${t.id}`}
                              type="button"
                              variant="outline"
                              aria-pressed={inUse}
                              data-state={inUse ? "on" : "off"}
                              title={describeOrderProducts(t.products, 3)}
                              className={cn(CHIP_CLASS, "max-w-[14rem]")}
                              onClick={() =>
                                inUse ? removeBase() : applyTemplate(t, form.base?.snapshot ?? takeSnapshot())
                              }
                            >
                              <BookmarkPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{t.name}</span>
                              {inUse && <X className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                            </Button>
                          );
                        })}
                        {lastOrder && (
                          <PreviousOrderChip
                            order={lastOrder}
                            inUse={form.base?.kind === "order" && form.base.id === lastOrder.id}
                            now={today}
                            onUse={() => applyBase(lastOrder, form.base?.snapshot ?? takeSnapshot())}
                            onRemove={removeBase}
                          />
                        )}
                        {hasMoreBases && (
                          <Popover open={moreBasesOpen} onOpenChange={setMoreBasesOpen}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="ghost" className={cn("gap-1 rounded-full px-3 text-sm", TAP)}>
                                Más
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-80 p-2">
                              {previousOrders.length > 0 && (
                                <div className="space-y-0.5">
                                  <p className="px-2 pb-1 pt-1 text-label">Pedidos anteriores</p>
                                  <ul className="space-y-0.5">
                                    {previousOrders.map((o) => {
                                      const inUse = form.base?.kind === "order" && form.base.id === o.id;
                                      const hasProducts = (o.orderProducts ?? []).some((p) => p.customName?.trim());
                                      return (
                                        <li key={o.id}>
                                          <button
                                            type="button"
                                            disabled={!hasProducts && !inUse}
                                            aria-pressed={inUse}
                                            aria-label={
                                              inUse ? `Quitar base (pedido #${o.id})` : `Usar el pedido #${o.id} como base`
                                            }
                                            onClick={() => {
                                              setMoreBasesOpen(false);
                                              if (inUse) removeBase();
                                              else applyBase(o, form.base?.snapshot ?? takeSnapshot());
                                            }}
                                            className={cn(
                                              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50",
                                              TAP,
                                              inUse && "bg-muted"
                                            )}
                                          >
                                            <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate text-sm">
                                                {describeOrderProducts(o.orderProducts)}
                                              </span>
                                              <span className="block truncate text-meta tabular-nums">
                                                {[`#${o.id}`, shortAgo(o.creationDate, today)].filter(Boolean).join(" · ")}
                                              </span>
                                            </span>
                                            {inUse && <X className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              {sortedTemplates.length > 0 && (
                                <div className="mt-1 space-y-0.5 border-t border-border/60 pt-1">
                                  <p className="px-2 pb-1 pt-1 text-label">Plantillas</p>
                                  <ul className="space-y-0.5">
                                    {sortedTemplates.map((t) => {
                                      const inUse = form.base?.kind === "template" && form.base.id === t.id;
                                      return (
                                        <li key={t.id}>
                                          <button
                                            type="button"
                                            aria-pressed={inUse}
                                            onClick={() => {
                                              setMoreBasesOpen(false);
                                              if (inUse) removeBase();
                                              else applyTemplate(t, form.base?.snapshot ?? takeSnapshot());
                                            }}
                                            className={cn(
                                              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted",
                                              TAP,
                                              inUse && "bg-muted"
                                            )}
                                          >
                                            <BookmarkPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate text-sm">{t.name}</span>
                                              <span className="block truncate text-meta">
                                                {describeOrderProducts(t.products)}
                                              </span>
                                            </span>
                                            {inUse && <X className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </section>

            {/* ───────────── Qué se pide ───────────── */}
            <section aria-labelledby="order-products-title" className="space-y-3">
              <ZoneTitle
                id="order-products-title"
                meta={
                  completeRows.length > 0
                    ? `${completeRows.length} ${completeRows.length === 1 ? "producto" : "productos"} · ${unitCount} u.`
                    : undefined
                }
              >
                Qué se pide
              </ZoneTitle>

              {quickChips.length > 0 && (
                <div role="group" aria-label="Agregar rápido" className="flex flex-wrap gap-2">
                  {quickChips.map((chip) => {
                    const row = form.rows.find((r) => sameName(r.customName, chip.name));
                    if (chip.habitQty !== undefined) {
                      return (
                        <Button
                          key={chip.id}
                          type="button"
                          variant="outline"
                          onClick={() => (row ? focusById(IDS.quantity(row.key)) : addProduct(chip.name, chip.habitQty))}
                          aria-label={
                            row
                              ? `${chip.name} ya está en el pedido (${row.quantity ?? 0})`
                              : `Agregar ${chip.name}, ${chip.habitQty} (cantidad habitual)`
                          }
                          className={cn(CHIP_CLASS, row && "border-foreground/40")}
                        >
                          {row ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                          {chip.name}
                          <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-foreground">
                            ×{row?.quantity ?? chip.habitQty}
                          </span>
                        </Button>
                      );
                    }
                    return (
                      <Button
                        key={chip.id}
                        type="button"
                        variant="outline"
                        onClick={() => addProduct(chip.name)}
                        aria-label={`Agregar ${chip.name}${row?.quantity ? `, ${row.quantity} en el pedido` : ""}`}
                        className={cn(CHIP_CLASS, row && "border-foreground/40")}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        {chip.name}
                        {row?.quantity ? (
                          <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-foreground">
                            {row.quantity}
                          </span>
                        ) : null}
                      </Button>
                    );
                  })}
                </div>
              )}

              {form.rows.length > 0 && (
                // Columnas compartidas por todas las líneas (subgrid): la cantidad
                // y la papelera quedan alineadas tenga o no la línea "Tallas".
                <ul
                  aria-label="Productos"
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-1 divide-y divide-border/60 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-x-2"
                >
                  {form.rows.map((row, index) => {
                    const rowError = rowErrors[row.key];
                    const qty = row.quantity;
                    const sized = sizeBreakdownTotal(row.sizes) > 0;
                    return (
                      <motion.li
                        key={row.key}
                        initial={revealMotion.initial}
                        animate={revealMotion.animate}
                        className={cn(
                          "col-span-full grid grid-cols-subgrid items-center gap-y-1 py-2 transition-colors duration-300 sm:py-1.5",
                          highlightKey === row.key && "bg-muted"
                        )}
                      >
                        <input
                          key={row.customName}
                          id={IDS.product(row.key)}
                          aria-label={`Producto ${index + 1}`}
                          aria-invalid={rowError === ROW_ERROR_MISSING_NAME || undefined}
                          defaultValue={row.customName}
                          autoComplete="off"
                          maxLength={200}
                          className="col-span-full -ml-1 h-11 min-w-0 rounded-md bg-transparent px-1 text-base font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60 sm:col-span-1 sm:h-9 sm:text-sm"
                          onBlur={(e) => {
                            const next = e.currentTarget.value;
                            if (!clampName(next)) e.currentTarget.value = row.customName;
                            else renameRow(row.key, next);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                              e.preventDefault();
                              // Salir confirma el nombre (y fusiona si coincide con otra línea).
                              e.currentTarget.blur();
                              focusById(IDS.quantity(row.key));
                            } else if (e.key === "Escape") {
                              e.currentTarget.value = row.customName;
                            }
                          }}
                        />
                        <div className="inline-flex items-center justify-self-start rounded-full border border-border bg-card has-[input:focus-visible]:border-ring/60 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/30">
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
                            id={IDS.quantity(row.key)}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label={`Cantidad de ${row.customName}`}
                            aria-invalid={rowError === ROW_ERROR_MISSING_QUANTITY}
                            className="h-11 w-14 border-0 bg-transparent px-1 text-center tabular-nums shadow-none focus-visible:ring-0 sm:h-9"
                            value={qty ?? ""}
                            readOnly={sized}
                            title={sized ? "Se calcula con las tallas" : undefined}
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
                                document.getElementById(IDS.productAdd)?.focus();
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
                        <OrderProductSizesField
                          rowKey={row.key}
                          productName={row.customName}
                          sizes={row.sizes}
                          onChange={(sizes, total) => setRowSizes(row.key, sizes, total)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          // Lugar fijo (fila de controles, última columna): con el panel de
                          // tallas abierto la papelera no se cae debajo de la grilla.
                          className="col-start-3 row-start-2 size-11 justify-self-end text-muted-foreground hover:text-destructive focus-visible:text-destructive sm:col-start-4 sm:row-start-1 sm:size-9"
                          aria-label={`Quitar ${row.customName}`}
                          onClick={() => removeRow(row.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {rowError && (
                          <p className={cn("col-span-full flex items-center gap-1", ERROR_TEXT)}>
                            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                            {rowError}
                          </p>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              )}

              {form.rows.length < MAX_PRODUCT_LINES && (
                <InlineCombobox
                  id={IDS.productAdd}
                  label="Agregar producto"
                  placeholder="+ Agregar producto…"
                  value={productQuery}
                  onValueChange={setProductQuery}
                  options={productOptions}
                  invalid={Boolean(errors.orderProducts) && form.rows.length === 0}
                  describedBy={errors.orderProducts ? "order-products-error order-products-hint" : "order-products-hint"}
                  onEnterEmpty={() => document.getElementById(IDS.description)?.focus()}
                  inputClassName="border-dashed"
                />
              )}
              <p id="order-products-hint" className="sr-only">
                Escribe la cantidad al frente para agregarla de una vez, por ejemplo 50 playera. Enter agrega y deja el
                cursor aquí para el siguiente; Enter vacío pasa a la descripción.
              </p>
              <FieldError id="order-products" error={errors.orderProducts} />

              {/* Visualmente es una zona más (mismo título y mismo aire que las demás). */}
              <div className="space-y-3 pt-3 sm:pt-4">
                <div className="flex min-h-6 items-center">
                  <label htmlFor={IDS.description} className={ZONE_TITLE_CLASS}>
                    Descripción
                  </label>
                </div>
                <Textarea
                  id={IDS.description}
                  rows={2}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  value={form.description}
                  placeholder="Ubicación del logo, colores, textos…"
                  className={cn("min-h-[4.5rem] max-h-60 [field-sizing:content]", INVALID_FIELD)}
                  onChange={(e) => update({ description: e.target.value, descriptionTouched: true, dirty: true })}
                  onBlur={validateDescriptionOnBlur}
                  aria-required
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? `${IDS.description}-error` : undefined}
                />
                <div className="-mt-1.5 flex items-start justify-between gap-3 empty:hidden">
                  <FieldError id={IDS.description} error={errors.description} />
                  {form.description.length >= 900 && (
                    <span className="ml-auto text-meta tabular-nums">
                      {form.description.length}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* ───────────── Entrega ───────────── */}
            <section aria-labelledby="order-delivery-title" className="space-y-3">
              <ZoneTitle id="order-delivery-title" meta="opcional">
                Entrega
              </ZoneTitle>
              {/* Móvil: los días en una fila deslizable y la hora a lo ancho debajo.
                  Escritorio: todo en una línea (la fila se vuelve `contents`). */}
              <div className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:space-y-0">
                <div className={cn(CHIP_RAIL, "sm:contents")}>
                  <ToggleGroup
                    type="single"
                    value={activeDateChip}
                    onValueChange={(key) => {
                      const chip = dateChips.find((c) => c.key === key);
                      // Tocar el chip activo lo apaga (sin botón aparte para quitar la fecha).
                      changeDeliveryDate(chip ? chip.date : "");
                    }}
                    aria-label="Fecha de entrega"
                    className="flex shrink-0 flex-nowrap justify-start gap-2 sm:flex-wrap"
                  >
                    {dateChips.map((chip) => (
                      <ToggleGroupItem key={chip.key} value={chip.key} aria-label={chip.ariaLabel} className={CHIP_CLASS}>
                        {chip.key === "habitual" && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                        {chip.label}
                        {chip.hint && <span className="text-xs opacity-70">{chip.hint}</span>}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id={IDS.deliveryDate}
                        type="button"
                        variant="outline"
                        aria-pressed={isCustomDate}
                        aria-label={isCustomDate ? `Otra fecha: ${shortDateLabel(form.deliveryDate)}` : "Otra fecha"}
                        data-state={isCustomDate ? "on" : "off"}
                        className={CHIP_CLASS}
                      >
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {isCustomDate ? shortDateLabel(form.deliveryDate) : "Otra fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        locale={es}
                        weekStartsOn={1}
                        selected={parseDeliveryDate(form.deliveryDate)}
                        defaultMonth={parseDeliveryDate(form.deliveryDate) ?? today}
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
                {form.deliveryDate && (
                  <Select
                    value={form.deliveryTime || NONE}
                    onValueChange={(v) => update({ deliveryTime: v === NONE ? "" : v, dirty: true })}
                  >
                    <SelectTrigger
                      id={IDS.deliveryTime}
                      aria-label="Hora de entrega"
                      className={cn(
                        "h-11 min-w-[7.5rem] gap-1.5 rounded-full duration-200 animate-in fade-in-0 sm:h-9",
                        FIELD_ROW_MOBILE
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground sm:!hidden">Hora</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE}>Sin hora ({DEFAULT_DELIVERY_TIME})</SelectItem>
                      {DELIVERY_TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                          {slot === learnedTime ? " · habitual" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </section>

            {/* ───────────── Ruta ───────────── */}
            {!isBranch && (
              <section aria-labelledby="order-route-title" className="space-y-3">
                <ZoneTitle
                  id="order-route-title"
                  meta={
                    <>
                      {routeMeta && <span className="truncate">{routeMeta}</span>}
                      {form.routeOrigin === "insights" && form.routeBeforeInsights && (
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={undoInsightsRoute}
                        >
                          Deshacer
                        </button>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Ayuda sobre la ruta"
                            className={cn(
                            "-my-2 -mr-2 flex size-9 items-center justify-center rounded-full hover:bg-muted hover:text-foreground",
                            FOCUS_RING
                          )}
                          >
                            <HelpCircle className="h-4 w-4" aria-hidden />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 text-sm">
                          {routeHelp}
                        </PopoverContent>
                      </Popover>
                    </>
                  }
                >
                  Ruta
                </ZoneTitle>

                {/* Móvil: tipo de ruta y responsable apilados a lo ancho (sin cortes a media fila). */}
                <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <RadioGroupPrimitive.Root
                    value={form.requiresDesign ? "design" : "direct"}
                    onValueChange={changeRoute}
                    aria-label="¿Requiere diseño?"
                    className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/50 p-1 sm:inline-grid"
                  >
                    {[
                      { value: "design", label: "Con diseño" },
                      { value: "direct", label: "Sin diseño" },
                    ].map((option) => (
                      <RadioGroupPrimitive.Item
                        key={option.value}
                        value={option.value}
                        className={cn(
                          // El área táctil crece 4px arriba y abajo (44px en móvil) sin agrandar la píldora.
                          "relative min-h-9 rounded-full px-4 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-150 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:text-foreground sm:min-h-7",
                          "data-[state=checked]:bg-ink data-[state=checked]:text-ink-foreground data-[state=checked]:shadow-sm",
                          FOCUS_RING
                        )}
                      >
                        {option.label}
                      </RadioGroupPrimitive.Item>
                    ))}
                  </RadioGroupPrimitive.Root>

                  {assignmentArea ? (
                    <Select
                      value={assignedUserId !== undefined ? String(assignedUserId) : ""}
                      onValueChange={(v) =>
                        update({ assignedUserId: v && v !== NONE ? Number(v) : undefined, dirty: true })
                      }
                    >
                      <SelectTrigger
                        id={IDS.assignee}
                        aria-label="Asignar a"
                        aria-required={form.requiresDesign}
                        aria-invalid={Boolean(errors.assignedUserId)}
                        aria-describedby={errors.assignedUserId ? `${IDS.assignee}-error` : undefined}
                        className={cn("h-11 min-w-0 max-w-full gap-1.5 rounded-full sm:h-9", FIELD_ROW_MOBILE, INVALID_FIELD)}
                      >
                        <span className="shrink-0 text-muted-foreground">Asignar a</span>
                        <SelectValue placeholder={form.requiresDesign ? "Elige diseñador" : "Sin asignar"} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* "Sin asignar" sólo sin diseño y si el área no tiene cuenta compartida. */}
                        {!form.requiresDesign && !sharedAccount && <SelectItem value={NONE}>Sin asignar</SelectItem>}
                        {sharedAccount && (
                          <SelectItem value={String(sharedAccount.id)}>
                            {form.requiresDesign ? "Cualquier diseñador" : `Cualquiera de ${getAreaLabel(assignmentArea)}`}
                          </SelectItem>
                        )}
                        {sharedAccount && individuals.length > 0 && <SelectSeparator />}
                        {individuals.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {userLabel(u)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="flex min-h-9 items-center text-meta sm:min-h-0">Elige un área para asignar</span>
                  )}
                </div>

                <fieldset className="min-w-0">
                  <legend className="sr-only">Áreas de producción{form.requiresDesign ? " (opcional)" : ""}</legend>
                  <ToggleGroup
                    id={IDS.areas}
                    type="multiple"
                    value={form.areas}
                    onValueChange={changeAreas}
                    className={cn(CHIP_RAIL, "justify-start")}
                  >
                    {PRODUCTION_AREA_OPTIONS.map((option) => {
                      const isPrimary = form.areas.length > 1 && primaryArea === option.value;
                      return (
                        <ToggleGroupItem
                          key={option.value}
                          value={option.value}
                          aria-invalid={Boolean(errors.area)}
                          className={cn(CHIP_CLASS, "aria-[invalid=true]:border-red-600 dark:aria-[invalid=true]:border-red-400")}
                        >
                          <span
                            data-area={option.value}
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full bg-[hsl(var(--tone))]"
                          />
                          {option.label}
                          {isPrimary && (
                            <span className="rounded-full bg-ink-foreground/20 px-1.5 text-[11px] leading-4">principal</span>
                          )}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </fieldset>
                <FieldError id={IDS.areas} error={errors.area} />
                <FieldError id={IDS.assignee} error={errors.assignedUserId} />
                {assigneeHint && <p className="text-meta">{assigneeHint}</p>}
              </section>
            )}

            {/* ───────────── Extras ───────────── */}
            {/* Extras: una barra de herramientas callada, sin línea ni tarjeta. Los
                botones fantasma se corren su propio padding (-mx-3) para que el
                ícono de "Archivo" caiga en el borde del contenido y el de "⋯" en el
                borde derecho, alineados con todo lo de arriba. */}
            <section aria-label="Extras" className="space-y-2">
              {(materialsLoading || form.materials.length > 0) && (
                <div>
                  {materialsLoading ? (
                    <p className="flex min-h-9 items-center gap-1.5 text-meta">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Copiando materiales de {form.base ? baseLabel(form.base) : "la base"}…
                    </p>
                  ) : (
                    <>
                      <button
                        id={IDS.materials}
                        type="button"
                        aria-expanded={materialsOpen}
                        aria-controls="order-materials-list"
                        onClick={() => setMaterialsOpen((v) => !v)}
                        className={cn(
                          "-ml-2 flex items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                          TAP
                        )}
                      >
                        <ChevronRight
                          className={cn("h-4 w-4 transition-transform", materialsOpen && "rotate-90")}
                          aria-hidden
                        />
                        {form.materials.length} {form.materials.length === 1 ? "material" : "materiales"}
                        {form.base ? ` de ${baseShort(form.base)}` : ""}
                      </button>
                      {materialsOpen && (
                        <ul
                          id="order-materials-list"
                          aria-label="Hoja de materiales"
                          className="divide-y divide-border/60 pl-6"
                        >
                          {form.materials.map((m) => (
                            <li key={m.key} className="flex items-center gap-3 py-1">
                              <span className="min-w-0 flex-1 truncate text-sm">{m.description}</span>
                              <span className="shrink-0 text-meta tabular-nums">
                                {m.quantity}
                                {m.unitName ? ` ${m.unitName}` : ""}
                              </span>
                              <Button
                                id={IDS.materialRemove(m.key)}
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11 shrink-0 text-muted-foreground hover:text-destructive focus-visible:text-destructive sm:size-8"
                                aria-label={`Quitar ${m.description}`}
                                onClick={() => removeMaterial(m.key)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleClientResourceFileChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                accept="image/*"
                capture="environment"
                onChange={handleClientResourceFileChange}
              />
              <div className="-mx-3 flex flex-wrap items-center gap-1">
                {clientResourceFile ? (
                  <span className="ml-3 flex min-w-0 max-w-full items-center gap-2 rounded-full bg-muted/60 py-1 pl-1 pr-1 text-sm duration-200 animate-in fade-in-0">
                    {clientResourceFilePreview ? (
                      <PreviewImage
                        src={clientResourceFilePreview}
                        alt={clientResourceFile.filename}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <FileText className="ml-1.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className="min-w-0 max-w-[12rem] truncate">{clientResourceFile.filename}</span>
                    <Button
                      id={IDS.fileRemove}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full sm:size-7"
                      onClick={removeClientResourceFile}
                      aria-label="Quitar archivo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : (
                  <Button
                    id={IDS.fileAttach}
                    type="button"
                    variant="ghost"
                    title="Logo o referencias del cliente (PNG, JPG o PDF, hasta 5 MB). No es la hoja de autorización."
                    // Con diseño el archivo importa (el diseñador lo necesita): va en tinta; sin diseño, callado.
                    className={cn("gap-1.5 rounded-full px-3", TAP, !form.requiresDesign && "text-muted-foreground")}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" aria-hidden />
                    Archivo
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className={cn("gap-1.5 rounded-full px-3 text-muted-foreground", TAP)}
                  onClick={openMockupStudio}
                >
                  <Shirt className="h-4 w-4" aria-hidden />
                  Crear mockup
                </Button>
                {/* No modal: sus ítems abren otros diálogos (plantilla, frecuentes). */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      id={IDS.more}
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Más opciones"
                      className="ml-auto size-11 rounded-full text-muted-foreground sm:size-9"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {form.base?.kind === "template" && canSaveTemplate && (
                      <DropdownMenuItem disabled={templateMutations.update.isPending} onSelect={() => void updateTemplate()}>
                        <BookmarkPlus className="h-4 w-4" aria-hidden />
                        Actualizar plantilla «{form.base.name}»
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled={!canSaveTemplate} onSelect={() => setSaveTemplateOpen(true)}>
                      <BookmarkPlus className="h-4 w-4" aria-hidden />
                      {form.base?.kind === "template" ? "Guardar como plantilla nueva" : "Guardar como plantilla"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFrequentsOpen(true)}>
                      <SlidersHorizontal className="h-4 w-4" aria-hidden />
                      Personalizar frecuentes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => cameraInputRef.current?.click()}>
                      <Camera className="h-4 w-4" aria-hidden />
                      Tomar foto del archivo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {pendingMockups.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1" aria-label="Mockups para el pedido">
                  {pendingMockups.map((m, index) => {
                    const name = `Mockup ${index + 1}`;
                    return (
                      <li
                        key={m.key}
                        className="flex items-center gap-2 rounded-xl bg-muted/50 p-1.5 pr-1 duration-200 animate-in fade-in-0 motion-safe:zoom-in-95"
                      >
                        <PreviewImage
                          src={m.result.image.dataUrl}
                          alt={name}
                          className="h-10 w-20 rounded-md bg-white object-contain"
                        />
                        <span className="text-sm font-medium">{GARMENT_LABELS[m.result.config.garment]}</span>
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
            </section>
          </div>
        </div>

        {/* ───────────── Footer fijo ───────────── */}
        {/* Sin fondo propio: hereda el del panel (en oscuro, `elevation-2`); antes
            `bg-popover` lo dejaba un escalón más oscuro que el cuerpo. */}
        <div className="shrink-0 border-t border-border/60 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
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
              // Cada intento vuelve a montar el aviso: entra con un fundido corto (y un leve
              // ascenso si el sistema permite movimiento) para que se note que respondió.
              <span
                key={attempt}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 duration-200 animate-in fade-in-0 motion-safe:slide-in-from-bottom-1"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {submitError ? (
                  <span>No se pudo crear el pedido: {submitError}</span>
                ) : (
                  <>
                    <span>{visibleErrors.length === 1 ? "Falta 1 dato:" : `Faltan ${visibleErrors.length} datos:`}</span>
                    {visibleErrors.map((field) => (
                      <Button
                        key={field}
                        type="button"
                        variant="link"
                        className={cn("h-auto p-0 text-red-700 underline dark:text-red-400", TAP)}
                        onClick={() => focusField(field)}
                      >
                        {FIELD_LABELS[field]}
                      </Button>
                    ))}
                  </>
                )}
              </span>
            )}
          </div>

          {/* Renglón 1 (todo el ancho): qué falta y el resumen del pedido, para
              leerlo de un vistazo antes de crear. Renglón 2: el modo y la acción. */}
          <div className="min-w-0 space-y-0.5 pb-3 text-xs leading-snug sm:text-sm empty:hidden">
            {/* En móvil se alternan: "Falta: …" mientras falte algo, después el resumen. */}
            {!showErrorNotice && missingFields.length > 0 && (
              <p className="text-muted-foreground">
                Falta:{" "}
                <span className="text-foreground/80">
                  {missingFields.map((f) => FIELD_LABELS[f].toLowerCase()).join(", ")}
                </span>
              </p>
            )}
            {summaryParts.length > 0 && (
              <p
                className={cn(
                  "text-foreground/75 [overflow-wrap:anywhere]",
                  !showErrorNotice && missingFields.length > 0 && "max-sm:hidden"
                )}
                data-testid="order-summary"
              >
                {summaryParts.map((part, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="text-muted-foreground/70"> · </span>}
                    {/* El cliente manda: es lo primero que se confirma con la vista. */}
                    <span className={cn(index === 0 && selectedClientLabel && "font-medium text-foreground")}>
                      {part}
                    </span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            {createAnotherEnabled && (
              <label className="flex min-h-11 cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0">
                <Switch
                  className="data-[state=checked]:bg-ink"
                  checked={createAnother}
                  onCheckedChange={(checked) => {
                    setCreateAnother(checked);
                    writeCreateAnother(userId, checked);
                  }}
                  aria-keyshortcuts="Meta+Shift+Enter Control+Shift+Enter"
                />
                Crear otro al terminar
              </label>
            )}
            <motion.div tabIndex={-1} className="ml-auto" {...(submitting ? {} : formButtonMotion)}>
              <Button
                id={IDS.submit}
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

      {/* Sin borrador posible: confirmar antes de descartar lo cargado. */}
      <AlertDialog
        open={confirmDiscardOpen}
        onOpenChange={(next) => {
          setConfirmDiscardOpen(next);
          if (!next) afterDiscardRef.current = null;
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // Sin trigger, Radix no sabe a dónde devolver el foco: vuelve al
            // campo donde estaba el usuario (o al CTA si ya no existe).
            e.preventDefault();
            const previous = focusBeforeConfirmRef.current;
            const target =
              previous && previous.isConnected && previous !== document.body
                ? previous
                : document.getElementById(IDS.submit);
            target?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              {draftBlocked
                ? "Ya hay un borrador guardado de antes, así que este no se puede guardar. Si cierras ahora se pierde."
                : "Hay datos cargados que no se pudieron guardar como borrador. Si cierras ahora se pierden."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const after = afterDiscardRef.current;
                afterDiscardRef.current = null;
                setConfirmDiscardOpen(false);
                update({ dirty: false });
                onClose();
                after?.();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mockupStudioLoaded && (
        <MockupStudioDialog
          open={mockupStudioOpen}
          onOpenChange={setMockupStudioOpen}
          attachLabel="Agregar al pedido"
          onAttach={addPendingMockup}
        />
      )}

      <CustomizeFrequentsDialog
        open={frequentsOpen}
        onOpenChange={setFrequentsOpen}
        presets={productPresets}
        current={myFrequents}
        onSave={(ids) => updatePreferences({ frequentProductIds: ids })}
        onCreatePreset={createPreset}
      />
      <SaveOrderTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={(next) => {
          setSaveTemplateOpen(next);
          if (!next) focusById(IDS.more);
        }}
        clientLabel={selectedClientLabel}
        defaultName={suggestTemplateName(completeRows)}
        contentSummary={templateContentSummary}
        blocker={
          !form.requiresDesign && form.areas.length === 0
            ? "Elige al menos un área de producción: sin diseño, la plantilla necesita a dónde ir."
            : undefined
        }
        onSave={async (name) => {
          if (!form.clientId) return;
          const template = await templateMutations.create.mutateAsync({
            clientId: form.clientId,
            payload: { name, ...templatePayload() },
          });
          // Lo que está en pantalla ES la plantilla nueva: queda como base
          // (y al crear el pedido cuenta como un uso).
          update((s) => ({
            base: {
              kind: "template",
              id: template.id,
              name: template.name,
              snapshot: s.base?.snapshot ?? takeSnapshot(s),
            },
            routeTouched: false,
            descriptionTouched: false,
          }));
          toast.success(`Plantilla «${template.name}» guardada para ${selectedClientLabel}`);
        }}
      />

      <CreateClientDialog
        open={newClientName !== null}
        onClose={() => setNewClientName(null)}
        initialFirstName={newClientName ?? ""}
        onCreated={(client) => {
          setNewClientName(null);
          chooseClient(client.id, "", client);
        }}
      />
    </>
  );
}

/** "↻ #88 · hace 3 d": el último pedido del cliente como base. */
function PreviousOrderChip({
  order,
  inUse,
  now,
  onUse,
  onRemove,
}: {
  order: Order;
  inUse: boolean;
  now: Date;
  onUse: () => void;
  onRemove: () => void;
}) {
  const hasProducts = (order.orderProducts ?? []).some((p) => p.customName?.trim());
  const when = shortAgo(order.creationDate, now);
  return (
    <Button
      id={`order-previous-${order.id}`}
      type="button"
      variant="outline"
      disabled={!hasProducts && !inUse}
      aria-pressed={inUse}
      data-state={inUse ? "on" : "off"}
      aria-label={inUse ? `Quitar base (pedido #${order.id})` : `Usar el pedido #${order.id} como base`}
      title={describeOrderProducts(order.orderProducts, 3)}
      className={cn(CHIP_CLASS, "tabular-nums")}
      onClick={inUse ? onRemove : onUse}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />#{order.id}
      {when && <span className="text-xs opacity-70">· {when}</span>}
      {inUse && <X className="h-3.5 w-3.5" aria-hidden />}
    </Button>
  );
}
