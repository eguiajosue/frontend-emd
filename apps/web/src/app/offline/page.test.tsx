import { describe, expect, it } from "vitest";
import OfflinePage from "./page";

describe("/offline (Server Component)", () => {
  it("sólo pasa datos serializables a ErrorScreen (un ícono/función rompe el render en el servidor)", () => {
    const element = OfflinePage() as { props: Record<string, unknown> };
    const primary = element.props.primary as Record<string, unknown>;
    expect(primary).toMatchObject({ label: "Reintentar", href: "/dashboard" });
    for (const value of Object.values(element.props).concat(Object.values(primary))) {
      expect(typeof value).not.toBe("function");
      expect(typeof value === "object" && value !== null && "$$typeof" in (value as object)).toBe(false);
    }
  });
});
