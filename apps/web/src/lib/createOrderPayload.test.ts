import { describe, expect, it } from "vitest";
import {
  FIELD_ORDER,
  ORDER_FIELD_IDS,
  buildCreateOrderPayload,
  buildTemplatePayload,
  completeRows,
  computeValidation,
  deriveAssignment,
  missingFieldsInOrder,
  orderSchema,
  toOrderProducts,
  type OrderFormData,
  type OrderProductRow,
} from "./createOrderPayload";
import type { User } from "@/types";

const row = (key: string, customName: string, quantity?: number, sizes?: OrderProductRow["sizes"]): OrderProductRow => ({
  key,
  customName,
  quantity,
  sizes,
});

const base: OrderFormData = {
  isBranch: false,
  clientNameOverride: "Juan Pérez",
  requiresDesign: false,
  area: "taller",
  description: "Bordado urgente",
  deliveryDate: "",
  orderProducts: [{ customName: "Playera", quantity: 5 }],
};

describe("computeValidation", () => {
  const cases: Array<{ name: string; rows: OrderProductRow[]; data: Partial<OrderFormData>; errors: string[]; rowErrors?: Record<string, string> }> = [
    { name: "pedido directo completo", rows: [row("a", "Playera", 5)], data: {}, errors: [] },
    {
      name: "sin cliente",
      rows: [row("a", "Playera", 5)],
      data: { clientNameOverride: "  " },
      errors: ["clientId"],
    },
    {
      name: "sin diseño y sin área",
      rows: [row("a", "Playera", 5)],
      data: { area: undefined },
      errors: ["area"],
    },
    {
      name: "con diseño sin responsable",
      rows: [row("a", "Playera", 5)],
      data: { requiresDesign: true, area: undefined },
      errors: ["assignedUserId"],
    },
    {
      name: "con diseño y cuenta compartida",
      rows: [row("a", "Playera", 5)],
      data: { requiresDesign: true, area: undefined, assignedUserId: 50 },
      errors: [],
    },
    {
      name: "descripción vacía (sólo espacios)",
      rows: [row("a", "Playera", 5)],
      data: { description: "   " },
      errors: ["description"],
    },
    {
      name: "fila con nombre sin cantidad no se descarta",
      rows: [row("a", "Playera")],
      data: { orderProducts: [] },
      errors: ["orderProducts"],
      rowErrors: { a: "Falta la cantidad" },
    },
    {
      name: "fila con cantidad sin nombre",
      rows: [row("a", " ", 3)],
      data: { orderProducts: [] },
      errors: ["orderProducts"],
      rowErrors: { a: "Falta el nombre del producto" },
    },
    {
      name: "sucursal sin empleado (la ruta no se valida)",
      rows: [row("a", "Playera", 5)],
      data: { isBranch: true, requiresDesign: true, area: undefined },
      errors: ["branchEmployeeId"],
    },
    {
      name: "sucursal con empleado",
      rows: [row("a", "Playera", 5)],
      data: { isBranch: true, branchEmployeeId: 3, requiresDesign: true, area: undefined },
      errors: [],
    },
    {
      name: "todo vacío, en el orden de la pantalla",
      rows: [],
      data: { clientNameOverride: "", description: "", area: undefined, orderProducts: [] },
      errors: ["clientId", "orderProducts", "description", "area"],
    },
  ];

  it.each(cases)("$name", ({ rows, data, errors, rowErrors }) => {
    const result = computeValidation(rows, { ...base, ...data });
    expect(missingFieldsInOrder(result.fieldErrors)).toEqual(errors);
    expect(result.rowErrors).toEqual(rowErrors ?? {});
  });

  it("FIELD_ORDER sigue el orden visual: quién levanta, cliente, productos, descripción, ruta", () => {
    expect(FIELD_ORDER).toEqual(["branchEmployeeId", "clientId", "orderProducts", "description", "area", "assignedUserId"]);
  });
});

describe("filas", () => {
  it("sólo manda filas completas y el desglose de tallas cuando tiene piezas", () => {
    const rows = [
      row("a", "Playera", 8, { general: { M: 5 }, mujer: { S: 3 } }),
      row("b", "Gorra", 2, { general: {} }),
      row("c", "Taza"),
    ];
    expect(completeRows(rows).map((r) => r.key)).toEqual(["a", "b"]);
    expect(toOrderProducts(rows)).toEqual([
      { customName: "Playera", quantity: 8, sizes: { general: { M: 5 }, mujer: { S: 3 } } },
      { customName: "Gorra", quantity: 2 },
    ]);
  });
});

describe("buildCreateOrderPayload (contrato con el backend)", () => {
  const parse = (data: Partial<OrderFormData>) => orderSchema.parse({ ...base, ...data });

  const cases: Array<{ name: string; data: Partial<OrderFormData>; areas: string[]; isBranch?: boolean; time?: string; expected: Record<string, unknown> }> = [
    {
      name: "sin diseño, cliente libre",
      data: {},
      areas: ["taller"],
      expected: {
        clientId: undefined,
        clientNameOverride: "Juan Pérez",
        area: "taller",
        requiresDesign: false,
        productionArea: undefined,
        productionAreas: ["taller"],
        assignedUserId: undefined,
        branchEmployeeId: undefined,
        statusId: 1,
        userId: 7,
        description: "Bordado urgente",
        deliveryDate: undefined,
        orderProducts: [{ customName: "Playera", quantity: 5 }],
        clientResourceFile: undefined,
      },
    },
    {
      name: "con diseño: área vacía, producción destino y responsable",
      data: { requiresDesign: true, area: "bordado", assignedUserId: 50, clientId: 9, clientNameOverride: "Ignorado" },
      areas: ["bordado", "dtf"],
      expected: {
        clientId: 9,
        clientNameOverride: undefined,
        area: undefined,
        requiresDesign: true,
        productionArea: "bordado",
        productionAreas: ["bordado", "dtf"],
        assignedUserId: 50,
      },
    },
    {
      name: "con diseño sin áreas",
      data: { requiresDesign: true, area: undefined, assignedUserId: 50 },
      areas: [],
      expected: { area: undefined, productionArea: undefined, productionAreas: undefined },
    },
    {
      name: "sucursal: la ruta la decide el backend",
      data: { isBranch: true, branchEmployeeId: 3, requiresDesign: false, area: "taller", assignedUserId: 2 },
      areas: ["taller"],
      isBranch: true,
      expected: {
        requiresDesign: true,
        area: undefined,
        productionArea: undefined,
        productionAreas: undefined,
        assignedUserId: undefined,
        branchEmployeeId: 3,
      },
    },
    {
      name: "fecha sin hora: fin de la jornada",
      data: { deliveryDate: "2026-10-20" },
      areas: ["taller"],
      expected: { deliveryDate: expect.stringMatching(/^2026-10-2\dT/) },
    },
  ];

  it.each(cases)("$name", ({ data, areas, isBranch, time, expected }) => {
    const payload = buildCreateOrderPayload({
      parsed: parse(data),
      areas,
      deliveryTime: time ?? "",
      isBranch: Boolean(isBranch),
      userId: 7,
    });
    expect(payload).toMatchObject(expected);
  });

  it("la hora elegida viaja en la fecha", () => {
    const payload = buildCreateOrderPayload({
      parsed: parse({ deliveryDate: "2026-10-20" }),
      areas: ["taller"],
      deliveryTime: "09:15",
      isBranch: false,
      userId: 7,
    });
    expect(new Date(payload.deliveryDate!).getHours()).toBe(9);
    expect(new Date(payload.deliveryDate!).getMinutes()).toBe(15);
  });

  it("adjunta el archivo del cliente tal cual", () => {
    const file = { data: "AAA", filename: "logo.png", mimeType: "image/png" as const };
    expect(
      buildCreateOrderPayload({ parsed: parse({}), areas: ["taller"], deliveryTime: "", isBranch: false, userId: 7, clientResourceFile: file })
        .clientResourceFile
    ).toBe(file);
  });
});

describe("buildTemplatePayload", () => {
  it("guarda productos completos, ruta, descripción y materiales (sin fecha ni archivo)", () => {
    expect(
      buildTemplatePayload({
        requiresDesign: false,
        areas: ["bordado"],
        description: "  Logo en el pecho ",
        rows: [row("a", "Playera", 40), row("b", "Taza")],
        materials: [{ key: "m", materialId: 12, quantity: 6, description: "Vinil", supplierId: 2, unitName: "Hoja" }],
      })
    ).toEqual({
      requiresDesign: false,
      productionAreas: ["bordado"],
      description: "Logo en el pecho",
      products: [{ customName: "Playera", quantity: 40 }],
      materials: [{ materialId: 12, quantity: 6, description: "Vinil", supplierId: 2 }],
    });
  });
});

describe("deriveAssignment", () => {
  const users = [
    { id: 50, username: "diseno", firstName: "Diseño", isSharedAccount: true, roles: [{ id: 1, name: "diseno" }] },
    { id: 51, username: "ana", firstName: "Ana", roles: [{ id: 1, name: "diseno" }] },
    { id: 60, username: "taller", firstName: "Taller", isSharedAccount: true, roles: [{ id: 2, name: "taller" }] },
    { id: 70, username: "luis", firstName: "Luis", roles: [{ id: 3, name: "dtf" }] },
  ] as User[];

  const cases: Array<{ name: string; requiresDesign: boolean; areas: string[]; chosen?: number; expected: number | undefined; area?: string }> = [
    { name: "con diseño propone la cuenta compartida", requiresDesign: true, areas: [], expected: 50, area: "diseno" },
    { name: "con diseño respeta al diseñador elegido", requiresDesign: true, areas: [], chosen: 51, expected: 51 },
    { name: "una elección de otra área se descarta", requiresDesign: true, areas: [], chosen: 60, expected: 50 },
    { name: "sin diseño y sin área: nadie", requiresDesign: false, areas: [], chosen: 51, expected: undefined, area: undefined },
    { name: "sin diseño: la compartida del área principal", requiresDesign: false, areas: ["taller", "dtf"], expected: 60, area: "taller" },
    { name: "sin diseño y sin cuenta compartida: sin asignar", requiresDesign: false, areas: ["dtf"], expected: undefined },
    { name: "sin diseño con persona del área", requiresDesign: false, areas: ["dtf"], chosen: 70, expected: 70 },
  ];

  it.each(cases)("$name", ({ requiresDesign, areas, chosen, expected, area }) => {
    const result = deriveAssignment({ users, requiresDesign, areas, assignedUserId: chosen });
    expect(result.assignedUserId).toBe(expected);
    if (area !== undefined || expected === undefined) expect(result.assignmentArea).toBe(area ?? result.assignmentArea);
    expect(result.isShared).toBe(expected !== undefined && result.sharedAccount?.id === expected);
  });

  it("separa la cuenta compartida de las personas", () => {
    const result = deriveAssignment({ users, requiresDesign: true, areas: [] });
    expect(result.sharedAccount?.id).toBe(50);
    expect(result.individuals.map((u) => u.id)).toEqual([51]);
  });
});

describe("ORDER_FIELD_IDS", () => {
  it("arma ids estables por fila", () => {
    expect(ORDER_FIELD_IDS.quantity("row-3")).toBe("order-qty-row-3");
    expect(ORDER_FIELD_IDS.client).toBe("order-client");
  });
});
