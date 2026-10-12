import { z } from "zod";
import { sizeBreakdownTotal, type SizeBreakdown } from "@/lib/garmentSizes";
import { MAX_DESCRIPTION_LENGTH, type RepeatMaterial } from "@/lib/createOrderForm";
import { combineDateAndTime } from "@/lib/format";
import type { CreateOrderPayload, UploadedFileInput, User } from "@/types";

/**
 * Lógica pura del alta de pedido que decide QUÉ se manda al backend: reglas
 * de validación, el payload de `POST /orders`, el de una plantilla y a quién
 * queda asignado. Sin React: el diálogo (`CreateOrderDialog`) sólo junta el
 * estado y llama a estas funciones, así el contrato con el backend se prueba
 * aparte y no se rompe al cambiar el markup.
 */

/* -------------------------------------------------------------------------- */
/* Ids de los campos                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Ids de los controles del formulario. Viven en un solo lugar porque el foco
 * los usa (primer campo con error, a dónde saltar después de elegir algo):
 * si el markup cambia, el foco no se pierde en silencio.
 */
export const ORDER_FIELD_IDS = {
  branchEmployee: "order-branch-employee",
  client: "order-client",
  clientChange: "order-client-change",
  areas: "order-areas",
  assignee: "order-assignee",
  productAdd: "order-product-add",
  description: "order-description",
  deliveryDate: "order-delivery-date",
  deliveryTime: "order-delivery-time",
  submit: "order-submit",
  fileAttach: "order-file-attach",
  fileRemove: "order-file-remove",
  more: "order-more",
  materials: "order-materials",
  quantity: (rowKey: string) => `order-qty-${rowKey}`,
  product: (rowKey: string) => `order-product-${rowKey}`,
  materialRemove: (key: string) => `order-material-remove-${key}`,
} as const;

/* -------------------------------------------------------------------------- */
/* Validación                                                                 */
/* -------------------------------------------------------------------------- */

const orderProductSchema = z.object({
  customName: z.string().min(1, "Falta el nombre del producto"),
  quantity: z.number().min(1, "La cantidad debe ser al menos 1"),
  /** Desglose de tallas; la forma fina la valida el backend. */
  sizes: z.record(z.string(), z.record(z.string(), z.number().int().min(0))).optional(),
});

/** Reglas del alta (WORKFLOW.md §1). */
export const orderSchema = z
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
    /** Cuenta de sucursal: el empleado que levanta el pedido es obligatorio. */
    isBranch: z.boolean().optional(),
    branchEmployeeId: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isBranch && !data.branchEmployeeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchEmployeeId"],
        message: "Elige quién levanta el pedido",
      });
    }
    if (!data.clientId && !data.clientNameOverride?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Selecciona o escribe un cliente",
      });
    }
    // La sucursal no decide la ruta: el backend la fuerza (con diseño, a la
    // cuenta compartida de Diseño). No hay nada que validar de su lado.
    if (data.isBranch) return;
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

export type OrderFormData = z.input<typeof orderSchema>;
export type ParsedOrderForm = z.output<typeof orderSchema>;

/** Orden de los campos en pantalla: a dónde va el foco ante el primer error. */
export const FIELD_ORDER = [
  "branchEmployeeId",
  "clientId",
  "orderProducts",
  "description",
  "area",
  "assignedUserId",
] as const;
export type FieldKey = (typeof FIELD_ORDER)[number];

/** Iguales a los labels visibles (se usan en el aviso del footer y en "Falta: …"). */
export const FIELD_LABELS: Record<FieldKey, string> = {
  branchEmployeeId: "Quién levanta",
  clientId: "Cliente",
  area: "Áreas de producción",
  assignedUserId: "Asignar a",
  orderProducts: "Productos",
  description: "Descripción",
};

export const ROW_ERROR_MISSING_QUANTITY = "Falta la cantidad";
export const ROW_ERROR_MISSING_NAME = "Falta el nombre del producto";

/** Línea de producto del formulario. */
export interface OrderProductRow {
  /** Clave estable de la fila (no viaja al backend). */
  key: string;
  customName: string;
  quantity?: number;
  /** Desglose de tallas (prendas). Si tiene piezas, `quantity` es su total. */
  sizes?: SizeBreakdown | null;
}

/** Filas con nombre y cantidad (las únicas que se mandan). */
export function completeRows(rows: OrderProductRow[]): OrderProductRow[] {
  return rows.filter((r) => r.customName.trim() && r.quantity && r.quantity > 0);
}

/** Líneas del payload: el desglose de tallas sólo si tiene piezas. */
export function toOrderProducts(rows: OrderProductRow[]): NonNullable<OrderFormData["orderProducts"]> {
  return completeRows(rows).map((r) => ({
    customName: r.customName,
    quantity: r.quantity!,
    ...(r.sizes && sizeBreakdownTotal(r.sizes) > 0 ? { sizes: r.sizes } : {}),
  }));
}

export interface OrderValidation {
  fieldErrors: Partial<Record<FieldKey, string>>;
  rowErrors: Record<string, string>;
}

/**
 * Errores del formulario: schema + filas de producto. Una fila con nombre
 * pero sin cantidad nunca se descarta en silencio: bloquea con un error en
 * esa fila.
 */
export function computeValidation(rows: OrderProductRow[], data: OrderFormData): OrderValidation {
  const rowErrors: Record<string, string> = {};
  rows.forEach((row) => {
    const hasName = Boolean(row.customName.trim());
    const hasQty = row.quantity !== undefined && row.quantity > 0;
    if (hasName && !hasQty) rowErrors[row.key] = ROW_ERROR_MISSING_QUANTITY;
    else if (!hasName && hasQty) rowErrors[row.key] = ROW_ERROR_MISSING_NAME;
  });

  const fieldErrors: Partial<Record<FieldKey, string>> = {};
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]) as FieldKey;
      if ((FIELD_ORDER as readonly string[]).includes(field) && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
  }
  if (Object.keys(rowErrors).length > 0) {
    fieldErrors.orderProducts = "Hay productos incompletos";
  } else if (completeRows(rows).length === 0) {
    fieldErrors.orderProducts = "Agrega al menos un producto";
  }
  return { fieldErrors, rowErrors };
}

/** Campos con error, en el orden en que aparecen en pantalla. */
export function missingFieldsInOrder(fieldErrors: Partial<Record<FieldKey, string>>): FieldKey[] {
  return FIELD_ORDER.filter((f) => fieldErrors[f]);
}

/* -------------------------------------------------------------------------- */
/* Payloads                                                                   */
/* -------------------------------------------------------------------------- */

export interface BuildCreateOrderInput {
  /** Resultado de `orderSchema.parse` (ya validado). */
  parsed: ParsedOrderForm;
  /** Áreas de producción en orden de elección: la primera es la principal. */
  areas: string[];
  deliveryTime: string;
  isBranch: boolean;
  userId: number;
  clientResourceFile?: UploadedFileInput | null;
}

/**
 * Cuerpo de `POST /orders`. El contrato con el backend (create-order.dto.ts)
 * NO cambia con el rediseño: mismas claves y mismas reglas.
 *
 * - Sin diseño, `area` es el destino directo. Con diseño el pedido arranca en
 *   Diseño y `area` no aplica: lo que se manda es la producción destino.
 * - La sucursal no decide la ruta (el backend la fuerza): no se mandan áreas
 *   ni responsable, y siempre va con diseño.
 */
export function buildCreateOrderPayload(input: BuildCreateOrderInput): CreateOrderPayload {
  const { parsed, isBranch } = input;
  const requiresDesign = isBranch ? true : parsed.requiresDesign;
  const areas = isBranch ? [] : input.areas;
  return {
    clientId: parsed.clientId,
    clientNameOverride: parsed.clientId ? undefined : parsed.clientNameOverride?.trim(),
    area: requiresDesign || isBranch ? undefined : parsed.area,
    requiresDesign,
    productionArea: requiresDesign && !isBranch ? parsed.area : undefined,
    productionAreas: areas.length > 0 ? areas : undefined,
    userId: input.userId,
    branchEmployeeId: isBranch ? parsed.branchEmployeeId : undefined,
    assignedUserId: isBranch ? undefined : parsed.assignedUserId,
    statusId: 1,
    description: parsed.description,
    deliveryDate: combineDateAndTime(parsed.deliveryDate, input.deliveryTime),
    orderProducts: parsed.orderProducts,
    clientResourceFile: input.clientResourceFile ?? undefined,
  };
}

export interface TemplatePayloadInput {
  requiresDesign: boolean;
  areas: string[];
  description: string;
  rows: OrderProductRow[];
  materials: RepeatMaterial[];
}

/** Lo que se guarda como plantilla: el pedido tal como está en pantalla (sin fecha ni archivo). */
export function buildTemplatePayload(input: TemplatePayloadInput) {
  return {
    requiresDesign: input.requiresDesign,
    productionAreas: input.areas,
    description: input.description.trim(),
    products: completeRows(input.rows).map((r) => ({ customName: r.customName, quantity: r.quantity! })),
    materials: input.materials.map((m) => ({
      materialId: m.materialId,
      quantity: m.quantity,
      description: m.description,
      supplierId: m.supplierId,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Asignación                                                                 */
/* -------------------------------------------------------------------------- */

/** Rol del área de Diseño; los pedidos con montaje arrancan siempre aquí. */
export const DESIGN_ROLE = "diseno";

export interface AssignmentInput {
  users: User[];
  requiresDesign: boolean;
  areas: string[];
  /** Lo que eligió el usuario (puede haber quedado de otra área). */
  assignedUserId?: number;
}

export interface Assignment {
  /** Área que decide a quién se le puede asignar: Diseño con montaje, la principal sin él. */
  assignmentArea?: string;
  usersInArea: User[];
  /** Cuenta compartida del área ("Área: Diseño"), usada como "cualquiera del área". */
  sharedAccount?: User;
  individuals: User[];
  /**
   * Responsable efectivo: la elección del usuario si sigue siendo del área;
   * si no, la cuenta compartida del área (o nadie). Derivado, no guardado:
   * cambiar de área nunca deja una asignación de otra área ni marca el
   * formulario como modificado.
   */
  assignedUserId?: number;
  isShared: boolean;
}

/** A quién queda asignado el pedido (ver WORKFLOW.md §1). */
export function deriveAssignment(input: AssignmentInput): Assignment {
  const assignmentArea = input.requiresDesign ? DESIGN_ROLE : input.areas[0];
  const usersInArea = assignmentArea
    ? input.users.filter((u) => u.roles?.some((r) => r.name === assignmentArea))
    : [];
  const sharedAccount = usersInArea.find((u) => u.isSharedAccount);
  const individuals = usersInArea.filter((u) => !u.isSharedAccount);
  const chosenIsValid =
    input.assignedUserId !== undefined && usersInArea.some((u) => u.id === input.assignedUserId);
  const assignedUserId = !assignmentArea
    ? undefined
    : chosenIsValid
      ? input.assignedUserId
      : sharedAccount?.id;
  return {
    assignmentArea,
    usersInArea,
    sharedAccount,
    individuals,
    assignedUserId,
    isShared: assignedUserId !== undefined && assignedUserId === sharedAccount?.id,
  };
}
