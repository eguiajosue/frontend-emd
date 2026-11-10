import { describe, expect, it } from "vitest";
import { SESSION_EXPIRED_MESSAGE } from "@emd/api-client";
import { knownLoginMessage } from "./loginMessage";

describe("knownLoginMessage", () => {
  it("deja pasar el aviso de sesión expirada que genera la app", () => {
    expect(knownLoginMessage(SESSION_EXPIRED_MESSAGE)).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("descarta cualquier otro texto armado en la URL", () => {
    expect(knownLoginMessage("Tu cuenta fue bloqueada, llama al 555-0100")).toBeNull();
    expect(knownLoginMessage(`${SESSION_EXPIRED_MESSAGE} y llama al 555`)).toBeNull();
    expect(knownLoginMessage("")).toBeNull();
    expect(knownLoginMessage(null)).toBeNull();
  });
});
