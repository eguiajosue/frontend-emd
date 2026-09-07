import { describe, expect, it } from "vitest";
import {
  auditAbsoluteTime,
  auditActorInitials,
  auditActorName,
  auditFieldLabel,
  auditRelativeTime,
  buildAuditLines,
  describeAuditChange,
  formatAuditValue,
} from "./orderAuditLog";
import type { OrderAuditLogEntry } from "@/types";

const labels = {
  statuses: { "4": "terminado" },
  users: { "7": "Ana Pérez" },
  clients: { "3": "Comercial Sur" },
};

const NOW = new Date("2026-03-12T12:00:00Z");

describe("auditFieldLabel", () => {
  it("traduce todos los campos auditables y nunca deja la columna cruda sola", () => {
    expect(auditFieldLabel("statusId")).toBe("el estado");
    expect(auditFieldLabel("deliveryDate")).toBe("la fecha de entrega");
    expect(auditFieldLabel("area")).toBe("el área");
    expect(auditFieldLabel("productionArea")).toBe("el área de producción");
    expect(auditFieldLabel("assignedUserId")).toBe("el usuario asignado");
    expect(auditFieldLabel("description")).toBe("la descripción");
    expect(auditFieldLabel("clientId")).toBe("el cliente");
    expect(auditFieldLabel("clientNameOverride")).toBe("el nombre del cliente");
    expect(auditFieldLabel("requiresDesign")).toBe("si el pedido requiere diseño");
    expect(auditFieldLabel("campoNuevo")).toBe("el campo «campoNuevo»");
  });
});

describe("formatAuditValue", () => {
  it("resuelve ids de estado, usuario y cliente contra las etiquetas del backend", () => {
    expect(formatAuditValue("statusId", 4, labels)).toBe("terminado");
    expect(formatAuditValue("assignedUserId", 7, labels)).toBe("Ana Pérez");
    expect(formatAuditValue("clientId", 3, labels)).toBe("Comercial Sur");
  });

  it("cae a los mapas locales si el backend no manda etiquetas", () => {
    expect(formatAuditValue("statusId", 1, undefined)).toBe("pendiente");
    // Estado retirado del flujo ("en pruebas"): el historial viejo sigue legible.
    expect(formatAuditValue("statusId", 2, undefined)).toBe("en pruebas");
  });

  it("degrada sin romperse ante un estado o usuario inexistente", () => {
    expect(formatAuditValue("statusId", 999, labels)).toBe("estado eliminado (#999)");
    expect(formatAuditValue("assignedUserId", 99, labels)).toBe(
      "usuario eliminado (#99)"
    );
    expect(formatAuditValue("clientId", 99, labels)).toBe("cliente eliminado (#99)");
  });

  it("muestra áreas acentuadas, booleanos y fechas en español", () => {
    expect(formatAuditValue("area", "diseno", labels)).toBe("Diseño");
    expect(formatAuditValue("productionArea", "laser", labels)).toBe("Láser");
    expect(formatAuditValue("requiresDesign", true, labels)).toBe("sí");
    expect(formatAuditValue("requiresDesign", false, labels)).toBe("no");
    expect(formatAuditValue("deliveryDate", "2026-03-20T12:00:00.000Z", labels)).toBe(
      "20 de marzo de 2026"
    );
  });

  it("recorta los textos largos y descarta los vacíos", () => {
    const shown = formatAuditValue("description", "a".repeat(120), labels) as string;
    expect(shown).toHaveLength(81);
    expect(shown.endsWith("…")).toBe(true);
    expect(formatAuditValue("description", "   ", labels)).toBeNull();
    expect(formatAuditValue("deliveryDate", null, labels)).toBeNull();
  });
});

describe("describeAuditChange", () => {
  it("redacta un cambio de estado con nombres", () => {
    expect(describeAuditChange("statusId", 1, 4, labels)).toBe(
      "cambió el estado de 'pendiente' a 'terminado'"
    );
  });

  it("usa 'estableció' cuando no había valor previo", () => {
    expect(describeAuditChange("deliveryDate", null, "2026-03-20T12:00:00Z", labels)).toBe(
      "estableció la fecha de entrega en 20 de marzo de 2026"
    );
    expect(describeAuditChange("description", "", "Playeras negras", labels)).toBe(
      "estableció la descripción en 'Playeras negras'"
    );
  });

  it("usa frases propias para la asignación", () => {
    expect(describeAuditChange("assignedUserId", null, 7, labels)).toBe(
      "asignó el pedido a Ana Pérez"
    );
    expect(describeAuditChange("assignedUserId", 7, null, labels)).toBe(
      "quitó la asignación del pedido"
    );
  });

  it("usa 'quitó' cuando el valor nuevo queda vacío", () => {
    expect(describeAuditChange("deliveryDate", "2026-03-20T12:00:00Z", null, labels)).toBe(
      "quitó la fecha de entrega"
    );
  });

  it("ignora cambios vacíos o sin diferencia real", () => {
    expect(describeAuditChange("description", null, null, labels)).toBeNull();
    expect(describeAuditChange("area", "diseno", "diseno", labels)).toBeNull();
  });

  it("redacta booleanos, áreas y clientes", () => {
    expect(describeAuditChange("requiresDesign", true, false, labels)).toBe(
      "cambió si el pedido requiere diseño de 'sí' a 'no'"
    );
    expect(describeAuditChange("area", "diseno", "laser", labels)).toBe(
      "cambió el área de 'Diseño' a 'Láser'"
    );
    expect(describeAuditChange("clientId", null, 3, labels)).toBe(
      "estableció el cliente en 'Comercial Sur'"
    );
    expect(describeAuditChange("clientNameOverride", "Juan", "Juana", labels)).toBe(
      "cambió el nombre del cliente de 'Juan' a 'Juana'"
    );
  });
});

describe("actor", () => {
  const user = { id: 7, firstName: "Ana", lastName: "Pérez", username: "ana" };

  it("arma nombre e iniciales", () => {
    expect(auditActorName(user)).toBe("Ana Pérez");
    expect(auditActorInitials(user)).toBe("AP");
    expect(auditActorInitials({ id: 8, firstName: "", username: "recepcion" })).toBe("RE");
  });

  it("marca las cuentas compartidas como área, igual que el resto de la app", () => {
    expect(auditActorName({ ...user, isSharedAccount: true })).toBe("Área: Ana Pérez");
  });

  it("tolera un usuario eliminado", () => {
    expect(auditActorName(null)).toBe("Usuario eliminado");
    expect(auditActorInitials(null)).toBe("?");
  });
});

describe("marcas de tiempo", () => {
  it("devuelve texto relativo en español", () => {
    expect(auditRelativeTime("2026-03-12T10:00:00Z", NOW)).toBe(
      "hace alrededor de 2 horas"
    );
    expect(auditRelativeTime("2026-03-09T12:00:00Z", NOW)).toBe("hace 3 días");
  });

  it("dice 'ayer' para el día anterior", () => {
    expect(auditRelativeTime("2026-03-11T09:00:00Z", NOW)).toBe("ayer");
  });

  it("no rompe con fechas inválidas", () => {
    expect(auditRelativeTime("no-es-fecha", NOW)).toBe("fecha desconocida");
    expect(auditAbsoluteTime("no-es-fecha")).toBe("Fecha desconocida");
  });
});

describe("buildAuditLines", () => {
  const base = {
    id: 1,
    orderId: 5,
    userId: 7,
    createdAt: "2026-03-12T10:00:00Z",
    user: { id: 7, firstName: "Ana", lastName: "Pérez", username: "ana" },
    labels,
  };

  it("arma una línea por campo cambiado", () => {
    const entry: OrderAuditLogEntry = {
      ...base,
      action: "updated",
      changes: {
        statusId: { before: 1, after: 4 },
        description: { before: null, after: "Playeras" },
      },
    };
    const lines = buildAuditLines(entry, NOW);
    expect(lines).toHaveLength(2);
    expect(lines[0].sentence).toBe(
      "Ana Pérez cambió el estado de 'pendiente' a 'terminado'"
    );
    expect(lines[1].sentence).toBe("Ana Pérez estableció la descripción en 'Playeras'");
    expect(lines[0].actorInitials).toBe("AP");
    expect(lines[0].relativeTime).toBe("hace alrededor de 2 horas");
    // La hora depende de la zona horaria del navegador; basta el formato.
    expect(lines[0].absoluteTime).toMatch(/^1[12] de marzo de 2026, \d{2}:\d{2}$/);
    expect(new Set(lines.map((l) => l.key)).size).toBe(2);
  });

  it("descarta una entrada cuyo diff no tiene valores", () => {
    const lines = buildAuditLines(
      { ...base, action: "updated", changes: { statusId: { before: null, after: null } } },
      NOW
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].sentence).toBe("Ana Pérez actualizó el pedido");
  });

  it("soporta el shape alternativo from/to", () => {
    const lines = buildAuditLines(
      { ...base, action: "updated", changes: { area: { from: "diseno", to: "laser" } } },
      NOW
    );
    expect(lines[0].sentence).toBe("Ana Pérez cambió el área de 'Diseño' a 'Láser'");
  });

  it("usa frases propias para la creación y el flujo de diseño", () => {
    expect(
      buildAuditLines({ ...base, action: "created", changes: {} }, NOW)[0].sentence
    ).toBe("Ana Pérez creó el pedido");
    expect(
      buildAuditLines(
        { ...base, action: "design_montage_sent", changes: { round: 2, statusId: 4 } },
        NOW
      )[0].sentence
    ).toBe("Ana Pérez envió un montaje para autorización");
  });

  it("no rompe con un estado retirado ni con un usuario borrado", () => {
    const lines = buildAuditLines(
      {
        ...base,
        user: null,
        labels: { statuses: { "4": "terminado" } },
        action: "updated",
        changes: { statusId: { before: 2, after: 4 } },
      },
      NOW
    );
    expect(lines[0].sentence).toBe(
      "Usuario eliminado cambió el estado de 'en pruebas' a 'terminado'"
    );
    expect(lines[0].actorInitials).toBe("?");
  });

  it("cae en una frase genérica si el cambio no es legible", () => {
    const lines = buildAuditLines({ ...base, action: "otra_cosa", changes: null }, NOW);
    expect(lines).toHaveLength(1);
    expect(lines[0].sentence).toBe("Ana Pérez actualizó el pedido");
  });
});
