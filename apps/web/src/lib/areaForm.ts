import type { Area, AreaOverview, CreateAreaPayload } from "@emd/types";

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
};

export type WizardStepId = "identidad" | "comportamiento" | "inventario" | "equipo" | "resumen";

export const STEP_TITLES: Record<WizardStepId, string> = {
  identidad: "Identidad",
  comportamiento: "Comportamiento",
  inventario: "Inventario inicial",
  equipo: "Equipo",
  resumen: "Resumen",
};

/** Pasos del wizard: sin inventario propio no hay nada que sugerir. */
export function wizardSteps(draft: Pick<AreaDraft, "hasInventory">): WizardStepId[] {
  return draft.hasInventory
    ? ["identidad", "comportamiento", "inventario", "equipo", "resumen"]
    : ["identidad", "comportamiento", "equipo", "resumen"];
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
): Partial<Record<"name" | "color", string>> {
  if (step !== "identidad") return {};
  const errors: Partial<Record<"name" | "color", string>> = {};
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
  lines.push("Tendrá su canal de chat con Recepción.");
  if (draft.createSharedAccount) lines.push("Se creará su cuenta compartida (responsable por defecto de sus tareas).");
  if (userCount > 0) lines.push(`${userCount} persona${userCount === 1 ? "" : "s"} pasará${userCount === 1 ? "" : "n"} a trabajar en ella.`);
  return lines;
}
