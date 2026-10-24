import type {
  Area,
  AreaField,
  AreaFieldInput,
  AreaFieldType,
  AreaMachine,
  AreaMachineInput,
  AreaOverview,
  AreaStage,
  AreaStageInput,
  AreaStageKind,
  CreateAreaPayload,
} from "@emd/types";

/**
 * Lógica pura del wizard de áreas (ver `AreaWizard`): borrador, pasos,
 * validaciones y payload. Sin React, para poder probarla aparte. Las reglas de
 * nombre (slug, reservados, repetidos) repiten las del backend
 * (`AreaAdminService`) para avisar antes de enviar; el backend las vuelve a
 * hacer cumplir.
 */

export const AREA_NAME_MIN = 2;
export const AREA_NAME_MAX = 40;
export const MAX_SUGGESTIONS = 20;
export const MAX_SUGGESTION_LENGTH = 40;

/** Nombres que el sistema usa para otra cosa (roles y filtros). */
const RESERVED_SLUGS = ["admin", "superuser", "recepcion", "sucursal", "all", "todas"];

/** Colores sugeridos: distintos entre sí y de los seis del sistema. */
export const AREA_COLOR_PRESETS = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#64748b",
] as const;

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const MAX_STAGES = 6;
export const STAGE_NAME_MIN = 2;
export const STAGE_NAME_MAX = 40;

/** Una etapa en el editor: sin `id` es nueva. */
export interface StageDraft {
  id?: number;
  name: string;
  kind: AreaStageKind;
}

export const STAGE_KIND_LABELS: Record<AreaStageKind, string> = {
  work: "Trabajo",
  review: "Revisión",
};

export const MAX_MACHINES = 12;
export const MAX_FIELDS = 10;
export const MIN_FIELD_OPTIONS = 2;
export const MAX_FIELD_OPTIONS = 10;
export const MAX_CAPACITY = 500;
export const MAX_TURNAROUND_HOURS = 720;
export const CONFIG_NAME_MIN = 2;
export const CONFIG_NAME_MAX = 40;

/** Una máquina en el editor: sin `id` es nueva. */
export interface MachineDraft {
  id?: number;
  name: string;
}

/** Un dato propio en el editor: sin `id` es nuevo y su tipo todavía se puede elegir. */
export interface FieldDraft {
  id?: number;
  label: string;
  type: AreaFieldType;
  required: boolean;
  options: string[];
  unit: string;
}

export const FIELD_TYPE_LABELS: Record<AreaFieldType, string> = {
  text: "Texto",
  number: "Número",
  select: "Lista de opciones",
  boolean: "Sí / no",
};

export interface AreaDraft {
  name: string;
  icon: string;
  color: string;
  isProductionDestination: boolean;
  hasInventory: boolean;
  generalViewEnabled: boolean;
  inventoryCategories: string[];
  inventoryUnits: string[];
  createSharedAccount: boolean;
  userIds: number[];
  stages: StageDraft[];
  /** Capacidad y horas como se teclean ("" = sin dato). */
  capacity: string;
  turnaroundHours: string;
  machines: MachineDraft[];
  fields: FieldDraft[];
}

export const EMPTY_DRAFT: AreaDraft = {
  name: "",
  icon: "Box",
  color: AREA_COLOR_PRESETS[0],
  isProductionDestination: true,
  hasInventory: true,
  generalViewEnabled: true,
  inventoryCategories: [],
  inventoryUnits: [],
  createSharedAccount: true,
  userIds: [],
  stages: [],
  capacity: "",
  turnaroundHours: "",
  machines: [],
  fields: [],
};

export type WizardStepId =
  | "identidad"
  | "comportamiento"
  | "etapas"
  | "capacidad"
  | "datos"
  | "inventario"
  | "equipo"
  | "resumen";

export const STEP_TITLES: Record<WizardStepId, string> = {
  identidad: "Identidad",
  comportamiento: "Comportamiento",
  etapas: "Etapas",
  capacidad: "Capacidad y máquinas",
  datos: "Datos del pedido",
  inventario: "Inventario inicial",
  equipo: "Equipo",
  resumen: "Resumen",
};

/**
 * Pasos del wizard: sin inventario propio no hay nada que sugerir, y un área
 * que no es destino de producción no recibe tareas, así que no tiene etapas.
 */
export function wizardSteps(
  draft: Pick<AreaDraft, "hasInventory" | "isProductionDestination">
): WizardStepId[] {
  return [
    "identidad",
    "comportamiento",
    ...(draft.isProductionDestination ? (["etapas", "capacidad", "datos"] as const) : []),
    ...(draft.hasInventory ? (["inventario"] as const) : []),
    "equipo",
    "resumen",
  ];
}

/** Las etapas de un área existente como borrador editable. */
export function stageDraftsOf(stages: readonly AreaStage[]): StageDraft[] {
  return stages.map(({ id, name, kind }) => ({ id, name, kind }));
}

/**
 * Errores de la lista de etapas, o `undefined` si sirve. Repite las reglas del
 * backend: hasta 6, nombres distintos, la primera es de trabajo y no hay dos
 * revisiones seguidas.
 */
export function validateStages(stages: readonly StageDraft[]): string | undefined {
  if (stages.length > MAX_STAGES) return `Un área puede tener hasta ${MAX_STAGES} etapas`;
  const seen = new Set<string>();
  for (const [index, stage] of stages.entries()) {
    const name = stage.name.trim();
    if (name.length < STAGE_NAME_MIN || name.length > STAGE_NAME_MAX) {
      return `El nombre de cada etapa debe tener entre ${STAGE_NAME_MIN} y ${STAGE_NAME_MAX} caracteres`;
    }
    if (seen.has(name.toLowerCase())) return `La etapa "${name}" está repetida`;
    seen.add(name.toLowerCase());
    if (stage.kind === "review") {
      if (index === 0) return `La primera etapa no puede ser una revisión ("${name}"): no habría nada que revisar`;
      if (stages[index - 1].kind === "review") return `"${name}" no puede ir justo después de otra revisión`;
    }
  }
  return undefined;
}

/** Lista de etapas lista para mandar (nombres recortados). */
export function stagesPayload(stages: readonly StageDraft[]): AreaStageInput[] {
  return stages.map(({ id, name, kind }) => ({ ...(id !== undefined && { id }), name: name.trim(), kind }));
}

/** ¿Cambió la lista de etapas respecto a la que tiene el área? (orden, nombre o tipo) */
export function stagesChanged(before: readonly AreaStage[], after: readonly StageDraft[]): boolean {
  return JSON.stringify(stagesPayload(stageDraftsOf(before))) !== JSON.stringify(stagesPayload(after));
}

/** Mueve la etapa `index` una posición (−1 arriba, +1 abajo); la misma lista si no se puede. */
export function moveStage(stages: readonly StageDraft[], index: number, delta: -1 | 1): StageDraft[] {
  const target = index + delta;
  if (target < 0 || target >= stages.length) return [...stages];
  const next = [...stages];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Slug que tendrá un nombre ("Impresión 3D" → "impresion-3d"). Igual que el backend. */
export function slugPreview(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Qué área ya tiene este nombre (o su mismo slug), si alguna; `exceptId` omite la que se edita. */
export function findNameClash(name: string, areas: readonly Area[], exceptId?: number): Area | undefined {
  const slug = slugPreview(name);
  const lower = name.trim().toLowerCase();
  return areas.find(
    (a) => a.id !== exceptId && (a.slug === slug || a.name.trim().toLowerCase() === lower)
  );
}

/** Errores del nombre, o `undefined` si sirve. */
export function validateName(name: string, areas: readonly Area[], exceptId?: number): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length < AREA_NAME_MIN) return `El nombre debe tener al menos ${AREA_NAME_MIN} caracteres`;
  if (trimmed.length > AREA_NAME_MAX) return `El nombre admite hasta ${AREA_NAME_MAX} caracteres`;
  const slug = slugPreview(trimmed);
  if (slug.length < 2) return "El nombre debe tener al menos dos letras o números";
  if (RESERVED_SLUGS.includes(slug)) return "Ese nombre está reservado por el sistema: elige otro";
  const clash = findNameClash(trimmed, areas, exceptId);
  if (clash) return `Ya existe un área parecida: "${clash.name}"`;
  return undefined;
}

export function validateColor(color: string): string | undefined {
  return HEX_COLOR.test(color.trim()) ? undefined : "Usa un color con formato #rrggbb";
}

/** Errores de un paso, por campo. Vacío = se puede avanzar. */
export function validateStep(
  step: WizardStepId,
  draft: AreaDraft,
  areas: readonly Area[]
): Partial<Record<"name" | "color" | "stages" | "capacity" | "turnaroundHours" | "machines" | "fields", string>> {
  if (step === "etapas") {
    const stages = validateStages(draft.stages);
    return stages ? { stages } : {};
  }
  if (step === "capacidad") {
    const errors: Partial<Record<"name" | "color" | "stages" | "capacity" | "turnaroundHours" | "machines" | "fields", string>> = {};
    const capacity = validateWhole(draft.capacity, MAX_CAPACITY, "La capacidad");
    if (capacity) errors.capacity = capacity;
    const hours = validateWhole(draft.turnaroundHours, MAX_TURNAROUND_HOURS, "Las horas");
    if (hours) errors.turnaroundHours = hours;
    const machines = validateMachines(draft.machines);
    if (machines) errors.machines = machines;
    return errors;
  }
  if (step === "datos") {
    const fields = validateFields(draft.fields);
    return fields ? { fields } : {};
  }
  if (step !== "identidad") return {};
  const errors: Partial<Record<"name" | "color" | "stages" | "capacity" | "turnaroundHours" | "machines" | "fields", string>> = {};
  const name = validateName(draft.name, areas);
  if (name) errors.name = name;
  const color = validateColor(draft.color);
  if (color) errors.color = color;
  return errors;
}

/**
 * Agrega una sugerencia a la lista: recorta espacios, ignora vacías y repetidas
 * (sin importar mayúsculas) y respeta el tope. Devuelve la misma lista si no
 * cambia nada.
 */
export function addSuggestion(list: readonly string[], text: string): string[] {
  const value = text.trim().slice(0, MAX_SUGGESTION_LENGTH);
  if (!value) return [...list];
  if (list.length >= MAX_SUGGESTIONS) return [...list];
  if (list.some((item) => item.toLowerCase() === value.toLowerCase())) return [...list];
  return [...list, value];
}

export function removeSuggestion(list: readonly string[], text: string): string[] {
  return list.filter((item) => item !== text);
}


/** Entero positivo tecleado (vacío = sin dato), o el motivo por el que no sirve. */
export function validateWhole(value: string, max: number, label: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > max) {
    return `${label} debe ser un número entero entre 1 y ${max}`;
  }
  return undefined;
}

/** "" → null; "6" → 6. */
export function wholeOrNull(value: string): number | null {
  const text = value.trim();
  return text ? Number(text) : null;
}

function validateNames(names: readonly string[], what: string, max: number): string | undefined {
  if (names.length > max) return `Un área puede tener hasta ${max} ${what}`;
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name.length < CONFIG_NAME_MIN || name.length > CONFIG_NAME_MAX) {
      return `El nombre debe tener entre ${CONFIG_NAME_MIN} y ${CONFIG_NAME_MAX} caracteres`;
    }
    if (seen.has(name.toLowerCase())) return `"${name}" está repetido`;
    seen.add(name.toLowerCase());
  }
  return undefined;
}

/** Errores de la lista de máquinas, o `undefined` si sirve. */
export function validateMachines(machines: readonly MachineDraft[]): string | undefined {
  return validateNames(
    machines.map((m) => m.name),
    "máquinas",
    MAX_MACHINES
  );
}

/** Errores de la lista de datos propios, o `undefined` si sirve. Repite las reglas del backend. */
export function validateFields(fields: readonly FieldDraft[]): string | undefined {
  const names = validateNames(
    fields.map((f) => f.label),
    "datos propios",
    MAX_FIELDS
  );
  if (names) return names;
  for (const field of fields) {
    const label = field.label.trim();
    if (field.type === "select") {
      const options = field.options.map((o) => o.trim());
      if (options.length < MIN_FIELD_OPTIONS || options.length > MAX_FIELD_OPTIONS) {
        return `"${label}" necesita entre ${MIN_FIELD_OPTIONS} y ${MAX_FIELD_OPTIONS} opciones`;
      }
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        return `Las opciones de "${label}" deben ser distintas`;
      }
    }
  }
  return undefined;
}

export function machineDraftsOf(machines: readonly AreaMachine[]): MachineDraft[] {
  return machines.map(({ id, name }) => ({ id, name }));
}

export function fieldDraftsOf(fields: readonly AreaField[]): FieldDraft[] {
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    options: [...f.options],
    unit: f.unit ?? "",
  }));
}

export function machinesPayload(machines: readonly MachineDraft[]): AreaMachineInput[] {
  return machines.map(({ id, name }) => ({ ...(id !== undefined && { id }), name: name.trim() }));
}

/** Datos listos para mandar: sólo lo que aplica al tipo (opciones en listas, unidad en números). */
export function fieldsPayload(fields: readonly FieldDraft[]): AreaFieldInput[] {
  return fields.map((f) => ({
    ...(f.id !== undefined && { id: f.id }),
    label: f.label.trim(),
    type: f.type,
    required: f.type === "boolean" ? false : f.required,
    ...(f.type === "select" && { options: f.options.map((o) => o.trim()) }),
    ...(f.type === "number" && f.unit.trim() && { unit: f.unit.trim() }),
  }));
}

export function machinesChanged(before: readonly AreaMachine[], after: readonly MachineDraft[]): boolean {
  return JSON.stringify(machinesPayload(machineDraftsOf(before))) !== JSON.stringify(machinesPayload(after));
}

export function fieldsChanged(before: readonly AreaField[], after: readonly FieldDraft[]): boolean {
  return JSON.stringify(fieldsPayload(fieldDraftsOf(before))) !== JSON.stringify(fieldsPayload(after));
}

/** Dato nuevo del editor. */
export const newField = (): FieldDraft => ({ label: "", type: "text", required: false, options: [], unit: "" });

/** Cuerpo de `POST /areas`. Sin inventario propio no se mandan sugerencias. */
export function draftToPayload(draft: AreaDraft): CreateAreaPayload {
  return {
    name: draft.name.trim(),
    icon: draft.icon,
    color: draft.color.trim().toLowerCase(),
    isProductionDestination: draft.isProductionDestination,
    hasInventory: draft.hasInventory,
    generalViewEnabled: draft.generalViewEnabled,
    inventoryCategories: draft.hasInventory ? draft.inventoryCategories : [],
    inventoryUnits: draft.hasInventory ? draft.inventoryUnits : [],
    createSharedAccount: draft.createSharedAccount,
    userIds: draft.userIds,
    // Un área que no recibe producción no tiene etapas, capacidad, máquinas ni datos.
    stages: draft.isProductionDestination ? stagesPayload(draft.stages) : [],
    capacity: draft.isProductionDestination ? wholeOrNull(draft.capacity) : null,
    turnaroundHours: draft.isProductionDestination ? wholeOrNull(draft.turnaroundHours) : null,
    machines: draft.isProductionDestination ? machinesPayload(draft.machines) : [],
    fields: draft.isProductionDestination ? fieldsPayload(draft.fields) : [],
  };
}

/** Por qué un área no se puede desactivar todavía, o `null` si ya se puede. */
export function deactivationBlocker(area: AreaOverview): string | null {
  if (area.isDesign) return "Diseño es la fase previa de los pedidos: no se desactiva.";
  const parts = [
    area.openOrders > 0 && `${area.openOrders} pedido${area.openOrders === 1 ? "" : "s"} abierto${area.openOrders === 1 ? "" : "s"}`,
    area.openTasks > 0 && `${area.openTasks} tarea${area.openTasks === 1 ? "" : "s"} sin terminar`,
  ].filter(Boolean);
  return parts.length > 0 ? `Tiene ${parts.join(" y ")}.` : null;
}

/** Frases del resumen: qué hará el área una vez creada. */
export function summaryLines(draft: AreaDraft, userCount: number): string[] {
  const lines: string[] = [];
  lines.push(
    draft.isProductionDestination
      ? "Los pedidos podrán producirse aquí: aparece al crear pedidos y como tarea de área."
      : "No será destino de producción: no se ofrece al crear pedidos."
  );
  lines.push(
    draft.hasInventory
      ? "Llevará inventario propio."
      : "Sin inventario propio: no aparece en Inventario."
  );
  lines.push(
    draft.generalViewEnabled
      ? "Todo el equipo del área ve todos los pedidos del área."
      : "Cada persona sólo ve lo que se le asignó (y lo que está libre)."
  );
  if (draft.isProductionDestination && draft.stages.length > 0) {
    lines.push(
      `Cada tarea pasará por ${draft.stages.map((stage) => `«${stage.name.trim()}»`).join(" → ")} antes de producir.`
    );
  }
  if (draft.isProductionDestination) {
    const capacity = wholeOrNull(draft.capacity);
    const hours = wholeOrNull(draft.turnaroundHours);
    if (capacity) lines.push(`Capacidad: ${capacity} tarea${capacity === 1 ? "" : "s"} abierta${capacity === 1 ? "" : "s"} a la vez; Coordinación la marcará sobrecargada al pasarse.`);
    if (hours) lines.push(`Cada tarea tarda unas ${hours} h: Coordinación estima las horas en cola.`);
    if (draft.machines.length > 0) {
      lines.push(`Máquinas: ${draft.machines.map((m) => m.name.trim()).join(", ")}.`);
    }
    if (draft.fields.length > 0) {
      lines.push(`En cada tarea se capturará: ${draft.fields.map((f) => f.label.trim()).join(", ")}.`);
    }
  }
  lines.push("Tendrá su canal de chat con Recepción.");
  if (draft.createSharedAccount) lines.push("Se creará su cuenta compartida (responsable por defecto de sus tareas).");
  if (userCount > 0) lines.push(`${userCount} persona${userCount === 1 ? "" : "s"} pasará${userCount === 1 ? "" : "n"} a trabajar en ella.`);
  return lines;
}
