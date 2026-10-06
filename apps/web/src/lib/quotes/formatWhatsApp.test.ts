import { describe, expect, it } from "vitest";
import { formatWhatsAppLine, formatWhatsAppList } from "./formatWhatsApp";
import { parseWhatsAppList } from "./parseWhatsApp";
import { priorityDateFor } from "./priority";
import { WHATSAPP_FIXTURE } from "./whatsappFixture";
import type { Quote } from "./types";

// Lunes 5 de octubre de 2026, 10 a. m. hora local.
const NOW = new Date(2026, 9, 5, 10, 0, 0);

const quote = (over: Partial<Quote>): Quote => ({
  id: 1,
  clientId: null,
  clientName: "Taller Pérez",
  description: "Cotización",
  stage: "por_enviar",
  status: "lista",
  comment: null,
  priorityDate: null,
  sentAt: null,
  orderId: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  createdBy: null,
  ...over,
});

describe("formatWhatsAppLine", () => {
  it("✅ para enviada, cliente en mayúsculas", () => {
    expect(formatWhatsAppLine(quote({ clientName: "tex mex", stage: "enviada", status: "esperando_respuesta" }), NOW)).toBe(
      "* TEX MEX . ✅enviada"
    );
  });

  it("☑️ para por enviar, con subestado y prioridad mañana", () => {
    expect(
      formatWhatsAppLine(quote({ clientName: "Cliente", status: "pendiente_medidas", priorityDate: "2026-10-06" }), NOW)
    ).toBe("* CLIENTE . ☑️pendiente medidas *prioridad mañana");
  });

  it("Lista con HOY queda como en el chat: ☑️HOY", () => {
    expect(formatWhatsAppLine(quote({ clientName: "DDN", priorityDate: "2026-10-05" }), NOW)).toBe("* DDN . ☑️HOY");
  });

  it("Lista sin prioridad ni descripción: sólo la marca", () => {
    expect(formatWhatsAppLine(quote({ clientName: "GAMU" }), NOW)).toBe("* GAMU . ☑️");
    expect(formatWhatsAppLine(quote({ clientName: "GAMU", priorityDate: "2026-10-06" }), NOW)).toBe(
      "* GAMU . ☑️ *prioridad mañana"
    );
  });

  it("incluye descripción y comentario; atrasada se marca", () => {
    expect(
      formatWhatsAppLine(
        quote({
          clientName: "Ofisdeco",
          stage: "enviada",
          status: "comentarios",
          description: "50 playeras",
          comment: "en espera de montajes",
          priorityDate: "2026-10-01",
        }),
        NOW
      )
    ).toBe("* OFISDECO . ✅enviada - 50 playeras - en espera de montajes *atrasada");
  });

  it("aceptada, no aceptada, info y comentarios sin texto", () => {
    expect(formatWhatsAppLine(quote({ stage: "enviada", status: "aceptada" }), NOW)).toBe("* TALLER PÉREZ . ✅enviada - aceptada");
    expect(formatWhatsAppLine(quote({ stage: "enviada", status: "no_aceptada", comment: "muy caro" }), NOW)).toBe(
      "* TALLER PÉREZ . ✅enviada - no aceptada - muy caro"
    );
    expect(formatWhatsAppLine(quote({ status: "info" }), NOW)).toBe("* TALLER PÉREZ . ☑️pendiente info");
    expect(formatWhatsAppLine(quote({ stage: "enviada", status: "comentarios" }), NOW)).toBe(
      "* TALLER PÉREZ . ✅enviada - comentarios"
    );
  });

  it("varias líneas, en orden", () => {
    expect(formatWhatsAppList([quote({ clientName: "A" }), quote({ clientName: "B" })], NOW)).toBe("* A . ☑️\n* B . ☑️");
  });
});

describe("ida y vuelta con el parser", () => {
  it("el listado real formateado se vuelve a leer igual (etapa, subestado, prioridad, cliente)", () => {
    const parsed = parseWhatsAppList(WHATSAPP_FIXTURE);
    const quotes = parsed.map((p, i) =>
      quote({
        id: i + 1,
        clientName: p.clientName,
        description: p.description,
        stage: p.stage,
        status: p.status,
        comment: p.comment,
        priorityDate: priorityDateFor(p.priority, NOW),
      })
    );
    const again = parseWhatsAppList(formatWhatsAppList(quotes, NOW));
    expect(again.map((q) => [q.clientName, q.stage, q.status, q.priority, q.comment])).toEqual(
      parsed.map((q) => [q.clientName, q.stage, q.status, q.priority, q.comment])
    );
  });
});
