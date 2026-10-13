import { describe, expect, it } from "vitest";
import {
  DRAFT_TTL_MS,
  clearOrderComposerMemory,
  clearOrderDraft,
  clientMatches,
  deliveryChips,
  draftAgeLabel,
  hasExactClient,
  orderDraftKey,
  parseQuickAdd,
  readCreateAnother,
  readOrderDraft,
  readRememberedBranchEmployee,
  rememberBranchEmployee,
  routeFromInsights,
  tidyProductName,
  searchClients,
  shortAgo,
  writeCreateAnother,
  writeOrderDraft,
  type OrderDraftData,
} from "./orderComposer";
import type { Client, ClientInsights } from "@/types";

/** localStorage en memoria (los tests de `src/lib` corren en node). */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    keys: () => [...map.keys()],
  };
}

describe("tidyProductName", () => {
  it.each([
    ["playera bordada", "Playera bordada"],
    ["  gorra ", "Gorra"],
    ["DTF frente", "DTF frente"],
    ["iPhone case", "iPhone case"],
    ["ñandú", "Ñandú"],
    ["50 cm lona", "50 cm lona"],
  ])("%s → %s", (input, expected) => {
    expect(tidyProductName(input)).toBe(expected);
  });
});

describe("parseQuickAdd: cantidad al frente", () => {
  it.each([
    ["50 playera", { name: "playera", quantity: 50 }],
    ["  12 gorras bordadas ", { name: "gorras bordadas", quantity: 12 }],
    ["50x playera", { name: "playera", quantity: 50 }],
    ["50 x playera", { name: "playera", quantity: 50 }],
    ["50× lona", { name: "lona", quantity: 50 }],
    ["playera", { name: "playera" }],
    ["3D figura", { name: "3D figura" }],
    ["50", { name: "50" }],
    ["0 playera", { name: "0 playera" }],
    ["50 xilófono", { name: "xilófono", quantity: 50 }],
    ["999999 taza", { name: "taza", quantity: 99_999 }],
  ])("%s", (text, expected) => {
    expect(parseQuickAdd(text)).toEqual(expected);
  });
});

const client = (id: number, first: string, last: string, extra: Partial<Client> = {}): Client =>
  ({ id, first_name: first, last_name: last, ...extra }) as Client;

const CLIENTS = [
  client(1, "Colegio", "San Marcos", { phone: "81 1234 5678" }),
  client(2, "Ferretería", "El Tornillo", { company: { id: 4, name: "Grupo Acero" } as Client["company"] }),
  client(3, "Ana", "López", { phone: "555-0100" }),
  client(4, "Mariana", "Ruiz"),
];

describe("búsqueda de clientes", () => {
  it("busca por nombre sin acentos ni mayúsculas", () => {
    expect(clientMatches(CLIENTS[1], "ferreteria")).toBe(true);
    expect(clientMatches(CLIENTS[0], "san marc")).toBe(true);
  });

  it("busca por teléfono aunque tenga espacios o guiones", () => {
    expect(searchClients(CLIENTS, "12345", []).results.map((c) => c.id)).toEqual([1]);
    expect(searchClients(CLIENTS, "5550100", []).results.map((c) => c.id)).toEqual([3]);
    // Muy pocos dígitos no buscan por teléfono (evita ruido).
    expect(clientMatches(CLIENTS[0], "81")).toBe(false);
  });

  it("busca por empresa", () => {
    expect(searchClients(CLIENTS, "acero", []).results.map((c) => c.id)).toEqual([2]);
  });

  it("los que empiezan con lo escrito van primero", () => {
    expect(searchClients(CLIENTS, "ana", []).results.map((c) => c.id)).toEqual([3, 4]);
  });

  it("sin texto muestra los recientes, o los primeros si no hay recientes", () => {
    expect(searchClients(CLIENTS, "", [4, 99, 1]).results.map((c) => c.id)).toEqual([4, 1]);
    expect(searchClients(CLIENTS, "", [4]).showingRecents).toBe(true);
    const all = searchClients(CLIENTS, "", []);
    expect(all.showingRecents).toBe(false);
    expect(all.results.map((c) => c.id)).toEqual([3, 1, 2, 4]);
  });

  it("detecta el nombre exacto", () => {
    expect(hasExactClient(CLIENTS, "ana lopez")).toBe(true);
    expect(hasExactClient(CLIENTS, "ana")).toBe(false);
  });
});

describe("deliveryChips", () => {
  const today = new Date(2026, 9, 12, 10); // lunes 12 oct 2026

  it("Hoy y Mañana con el día de la semana", () => {
    const chips = deliveryChips(today, null);
    expect(chips.map((c) => [c.key, c.label, c.hint, c.date])).toEqual([
      ["today", "Hoy", undefined, "2026-10-12"],
      ["tomorrow", "Mañana", "mar", "2026-10-13"],
    ]);
    expect(chips[1].ariaLabel).toBe("Mañana, martes 13 de octubre");
  });

  it("agrega la fecha habitual del cliente si no es hoy ni mañana", () => {
    const chips = deliveryChips(today, 7);
    expect(chips[2]).toMatchObject({ key: "habitual", label: "lun 19", hint: "habitual", date: "2026-10-19" });
    expect(deliveryChips(today, 1)).toHaveLength(2);
    expect(deliveryChips(today, 0)).toHaveLength(2);
  });
});

describe("routeFromInsights", () => {
  const insights = (over: Partial<ClientInsights>) =>
    ({ ordersAnalyzed: 6, route: { designShare: 1, requiresDesign: true, areas: [] }, suggestion: null, ...over }) as ClientInsights;

  it("usa la ruta del pedido habitual si existe", () => {
    expect(
      routeFromInsights(
        insights({
          suggestion: { requiresDesign: false, areas: ["impresiones", "diseno", "impresiones"] } as ClientInsights["suggestion"],
        })
      )
    ).toEqual({ requiresDesign: false, areas: ["impresiones"] });
  });

  it("si no, la ruta aprendida con las áreas frecuentes primero", () => {
    expect(
      routeFromInsights(
        insights({
          route: {
            designShare: 0.2,
            requiresDesign: false,
            areas: [
              { area: "dtf", share: 0.4 },
              { area: "bordado", share: 0.8 },
              { area: "laser", share: 0.1 },
            ],
          },
        })
      )
    ).toEqual({ requiresDesign: false, areas: ["bordado", "dtf"] });
  });

  it("sin datos suficientes no propone nada", () => {
    expect(routeFromInsights(null)).toBeNull();
    expect(routeFromInsights(insights({ ordersAnalyzed: 1 }))).toBeNull();
  });
});

describe("tiempos cortos", () => {
  const now = new Date(2026, 9, 12, 10);
  it("shortAgo", () => {
    expect(shortAgo(new Date(2026, 9, 12, 8).toISOString(), now)).toBe("hoy");
    expect(shortAgo(new Date(2026, 9, 11, 8).toISOString(), now)).toBe("ayer");
    expect(shortAgo(new Date(2026, 9, 9, 8).toISOString(), now)).toBe("hace 3 d");
    expect(shortAgo(new Date(2026, 5, 9, 8).toISOString(), now)).toBe("hace 4 meses");
    expect(shortAgo(null, now)).toBe("");
  });
  it("draftAgeLabel", () => {
    expect(draftAgeLabel(1_000, 20_000)).toBe("hace un momento");
    expect(draftAgeLabel(0, 12 * 60_000)).toBe("hace 12 min");
    expect(draftAgeLabel(0, 130 * 60_000)).toBe("hace 2 h");
  });
});

const DRAFT: OrderDraftData = {
  clientNameOverride: "Juan",
  requiresDesign: false,
  areas: ["taller"],
  description: "Playeras",
  deliveryDate: "",
  deliveryTime: "",
  rows: [{ key: "row-1", customName: "Playera", quantity: 5 }],
  materials: [],
  base: null,
  routeTouched: true,
  descriptionTouched: true,
};

describe("borrador por usuario", () => {
  it("guarda y lee el borrador de cada usuario por separado", () => {
    const store = memoryStorage();
    expect(writeOrderDraft(7, DRAFT, 1_000, store)).toBe(true);
    expect(readOrderDraft(7, 2_000, store)?.data.description).toBe("Playeras");
    expect(readOrderDraft(8, 2_000, store)).toBeNull();
    expect(store.keys()).toEqual([orderDraftKey(7)]);
    expect(orderDraftKey(7)).toBe("emd:orderDraft:v1:7");
  });

  it("vence a las 4 horas y se borra", () => {
    const store = memoryStorage();
    writeOrderDraft(7, DRAFT, 0, store);
    expect(readOrderDraft(7, DRAFT_TTL_MS - 1, store)).not.toBeNull();
    expect(readOrderDraft(7, DRAFT_TTL_MS + 1, store)).toBeNull();
    expect(store.length).toBe(0);
  });

  it("un borrador roto se descarta", () => {
    const store = memoryStorage();
    store.setItem(orderDraftKey(7), "{no es json");
    expect(readOrderDraft(7, 0, store)).toBeNull();
    store.setItem(orderDraftKey(7), JSON.stringify({ version: 2, savedAt: 0, data: DRAFT }));
    expect(readOrderDraft(7, 0, store)).toBeNull();
  });

  it("sin usuario no se guarda nada", () => {
    const store = memoryStorage();
    expect(writeOrderDraft(undefined, DRAFT, 0, store)).toBe(false);
    expect(readOrderDraft(undefined, 0, store)).toBeNull();
  });

  it("clearOrderDraft borra sólo el del usuario y el logout borra todos", () => {
    const store = memoryStorage();
    writeOrderDraft(7, DRAFT, 0, store);
    writeOrderDraft(8, DRAFT, 0, store);
    rememberBranchEmployee(9, 3, new Date(), store);
    writeCreateAnother(7, true, store);
    store.setItem("emd:recentClientIds", "[1]");
    clearOrderDraft(7, store);
    expect(readOrderDraft(7, 0, store)).toBeNull();
    expect(readOrderDraft(8, 0, store)).not.toBeNull();
    clearOrderComposerMemory(store);
    expect(store.keys().sort()).toEqual(["emd:orderCreateAnother:v1:7", "emd:recentClientIds"]);
  });
});

describe("quién levanta (sucursal)", () => {
  it("se recuerda hasta el fin del día local", () => {
    const store = memoryStorage();
    const morning = new Date(2026, 9, 12, 9);
    rememberBranchEmployee(9, 3, morning, store);
    expect(readRememberedBranchEmployee(9, new Date(2026, 9, 12, 23, 59).getTime(), store)).toBe(3);
    expect(readRememberedBranchEmployee(9, new Date(2026, 9, 13, 0, 1).getTime(), store)).toBeUndefined();
    expect(readRememberedBranchEmployee(10, morning.getTime(), store)).toBeUndefined();
  });
});

describe("crear otro al terminar", () => {
  it("se recuerda por usuario", () => {
    const store = memoryStorage();
    expect(readCreateAnother(7, store)).toBe(false);
    writeCreateAnother(7, true, store);
    expect(readCreateAnother(7, store)).toBe(true);
    expect(readCreateAnother(8, store)).toBe(false);
  });
});
