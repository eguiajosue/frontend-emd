import { describe, expect, it } from "vitest";
import { connectionLabel } from "./ConnectionStatus";

describe("estado de la conexión", () => {
  it("sin red dice cuántos cambios esperan", () => {
    expect(connectionLabel({ online: false, pending: 0, justSynced: false })).toBe("Sin conexión");
    expect(connectionLabel({ online: false, pending: 2, justSynced: false })).toBe("Sin conexión · 2 cambios por enviar");
  });
  it("con red: enviando, atorados o todo enviado", () => {
    expect(connectionLabel({ online: true, pending: 1, justSynced: false })).toBe("Enviando 1 cambio…");
    expect(connectionLabel({ online: true, pending: 1, justSynced: false, stuck: true })).toBe("1 cambio sin enviar");
    expect(connectionLabel({ online: true, pending: 0, justSynced: true })).toBe("Todo enviado");
    expect(connectionLabel({ online: true, pending: 0, justSynced: false })).toBeNull();
  });
});
