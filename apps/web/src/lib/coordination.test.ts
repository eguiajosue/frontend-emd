import { describe, expect, it } from "vitest";
import { areaStageLabel, delayReasonLabel, formatHours, stuckAt, type OverdueOrder } from "./coordination";

describe("coordinación", () => {
  it("formatea horas en min, h o días", () => {
    expect(formatHours(null)).toBe("—");
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(6.54)).toBe("6.5 h");
    expect(formatHours(30)).toBe("1.3 días");
  });

  it("dice dónde está detenido cada área o el pedido", () => {
    expect(areaStageLabel({ area: "bordado", status: "pendiente", prepStage: "en_pruebas", assignee: "Luis" })).toBe("en pruebas (Luis)");
    expect(areaStageLabel({ area: "dtf", status: "en_proceso", prepStage: null, assignee: null })).toBe("en proceso");
    const o = { status: "esperando autorización" } as OverdueOrder;
    expect(stuckAt(o)).toBe("Esperando que el cliente autorice");
    expect(stuckAt({ ...o, status: "terminado" })).toBe("Listo, falta entregar");
    expect(delayReasonLabel("material")).toBe("Falta material");
  });
});
