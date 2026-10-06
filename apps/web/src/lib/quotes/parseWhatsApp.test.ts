import { describe, expect, it } from "vitest";
import { parseWhatsAppLine, parseWhatsAppList } from "./parseWhatsApp";
import { WHATSAPP_FIXTURE } from "./whatsappFixture";

type Expected = {
  clientName: string;
  stage: "por_enviar" | "enviada";
  status: string;
  priority: "hoy" | "manana" | "normal";
  description?: string;
  comment?: string | null;
  mark: "done" | "pending" | null;
  warn?: boolean;
};

/** El listado real de Recepción, línea por línea. */
const EXPECTED: Expected[] = [
  { clientName: "OFISDECO", stage: "enviada", status: "comentarios", priority: "normal", comment: "en espera de montajes", mark: "done" },
  { clientName: "COLEGIO DE ARQUITECTOS", stage: "por_enviar", status: "esperando_montaje", priority: "normal", mark: "done", warn: true },
  { clientName: "ERIKA ALMANZA", stage: "enviada", status: "esperando_respuesta", priority: "normal", mark: "done" },
  { clientName: "TNL", stage: "enviada", status: "esperando_respuesta", priority: "normal", mark: "done" },
  { clientName: "STICHES", stage: "enviada", status: "esperando_respuesta", priority: "normal", mark: "pending", warn: true },
  {
    clientName: "ESTEBAN TALAMAS",
    stage: "por_enviar",
    status: "pendiente_medidas",
    priority: "normal",
    description: "pendiente lleve la camioneta para medir",
    mark: "pending",
  },
  { clientName: "DDN", stage: "por_enviar", status: "lista", priority: "hoy", mark: "pending" },
  { clientName: "TEX MEX", stage: "enviada", status: "esperando_respuesta", priority: "normal", mark: "done" },
  {
    clientName: "MARTHA RENDON PATRONATO PRO ANCIANOS",
    stage: "por_enviar",
    status: "esperando_montaje",
    priority: "manana",
    mark: "pending",
  },
  { clientName: "BRICER", stage: "por_enviar", status: "lista", priority: "manana", mark: "pending" },
  { clientName: "MARQUESITA", stage: "por_enviar", status: "lista", priority: "hoy", mark: "pending" },
  { clientName: "IHS", stage: "por_enviar", status: "esperando_montaje", priority: "manana", mark: "pending" },
  { clientName: "GAMU", stage: "por_enviar", status: "lista", priority: "manana", mark: "pending" },
];

describe("parseWhatsAppList con el listado real", () => {
  const parsed = parseWhatsAppList(WHATSAPP_FIXTURE);

  it("una cotización por línea, en orden", () => {
    expect(parsed).toHaveLength(13);
    expect(parsed.map((q) => q.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it.each(EXPECTED.map((e, i) => [i + 1, e.clientName, e] as const))("línea %i · %s", (index, _name, expected) => {
    const q = parsed[index - 1];
    expect(q.clientName).toBe(expected.clientName);
    expect(q.stage).toBe(expected.stage);
    expect(q.status).toBe(expected.status);
    expect(q.priority).toBe(expected.priority);
    expect(q.description).toBe(expected.description ?? "Cotización");
    expect(q.comment).toBe(expected.comment ?? null);
    expect(q.mark).toBe(expected.mark);
    expect(q.warnings.length > 0).toBe(Boolean(expected.warn));
  });

  it("8 por enviar y 5 enviadas", () => {
    expect(parsed.filter((q) => q.stage === "por_enviar")).toHaveLength(8);
    expect(parsed.filter((q) => q.stage === "enviada")).toHaveLength(5);
  });

  it("los avisos explican la duda", () => {
    expect(parsed[1].warnings[0]).toMatch(/no dice «enviada»/);
    expect(parsed[4].warnings[0]).toMatch(/☑️ pero dice «enviada»/);
  });
});

describe("parseWhatsAppLine", () => {
  it("salta líneas vacías, sin letras y encabezados", () => {
    expect(parseWhatsAppLine("")).toBeNull();
    expect(parseWhatsAppLine("   ")).toBeNull();
    expect(parseWhatsAppLine("* ✅")).toBeNull();
    expect(parseWhatsAppLine("*COTIZACIONES*")).toBeNull();
    expect(parseWhatsAppLine("Pendientes de hoy:")).toBeNull();
  });

  it("sin separador: toda la línea es el cliente y avisa", () => {
    const q = parseWhatsAppLine("* Taller Pérez")!;
    expect(q.clientName).toBe("Taller Pérez");
    expect(q.status).toBe("lista");
    expect(q.warnings[0]).toMatch(/separador/);
  });

  it("conserva mayúsculas y acentos del cliente; la descripción libre se queda", () => {
    const q = parseWhatsAppLine("1. José Peña . ☑️50 playeras bordadas *prioridad mañana")!;
    expect(q.clientName).toBe("José Peña");
    expect(q.description).toBe("50 playeras bordadas");
    expect(q.priority).toBe("manana");
  });

  it("info, aceptada, no aceptada y ✅ solo", () => {
    expect(parseWhatsAppLine("* A . ☑️falta info del logo")!.status).toBe("info");
    expect(parseWhatsAppLine("* B . ✅enviada aceptada")!.status).toBe("aceptada");
    expect(parseWhatsAppLine("* C . ✅enviada no aceptada")!.status).toBe("no_aceptada");
    const soloCheck = parseWhatsAppLine("* D . ✅")!;
    expect(soloCheck.status).toBe("esperando_respuesta");
    expect(soloCheck.warnings).toHaveLength(1);
  });

  it("prioridad hoy en minúsculas y sin acento en mañana", () => {
    expect(parseWhatsAppLine("* A . ☑️ prioridad hoy")!.priority).toBe("hoy");
    expect(parseWhatsAppLine("* A . ☑️ *prioridad manana")!.priority).toBe("manana");
  });

  it("varios estados a la vez: avisa", () => {
    const q = parseWhatsAppLine("* A . ☑️en espera de montajes y medidas")!;
    expect(q.status).toBe("esperando_montaje");
    expect(q.warnings.some((w) => /varios estados/.test(w))).toBe(true);
  });

  it("CRLF de Windows", () => {
    expect(parseWhatsAppList("* A . ✅enviada\r\n* B . ☑️HOY\r\n")).toHaveLength(2);
  });
});
