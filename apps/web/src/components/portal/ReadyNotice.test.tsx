import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadyNotice } from "./ReadyNotice";

const request = vi.fn();
vi.mock("@/lib/api", () => ({ request: (...args: unknown[]) => request(...args) }));
const getSub = vi.fn();
let supported = true;
vi.mock("@/lib/push", () => ({
  isPushSupported: () => supported,
  isIOSInstallRequired: () => false,
  getBrowserPushSubscription: () => getSub(),
}));

const TOKEN = "t".repeat(43);

beforeEach(() => {
  supported = true;
  request.mockReset().mockResolvedValue({});
  getSub.mockReset().mockResolvedValue({ endpoint: "https://push/1", keys: { p256dh: "k", auth: "a" } });
  localStorage.clear();
});

describe("Avísame cuando esté listo", () => {
  it("suscribe este navegador al aviso del pedido", async () => {
    render(<ReadyNotice token={TOKEN} stage="produccion" />);
    await userEvent.click(screen.getByRole("button", { name: "Avísame cuando esté listo" }));
    expect(request).toHaveBeenCalledWith(`portal/${TOKEN}/push`, {
      method: "POST",
      body: { endpoint: "https://push/1", keys: { p256dh: "k", auth: "a" } },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Te avisaremos en este dispositivo");
  });

  it("sin permiso explica qué pasó y no manda nada", async () => {
    getSub.mockResolvedValue(null);
    render(<ReadyNotice token={TOKEN} stage="diseno" />);
    await userEvent.click(screen.getByRole("button", { name: "Avísame cuando esté listo" }));
    expect(request).not.toHaveBeenCalled();
    expect(await screen.findByText(/No se pudo activar el aviso/)).toBeInTheDocument();
  });

  it("no aparece si ya está listo o si el navegador no recibe avisos", () => {
    const { container, rerender } = render(<ReadyNotice token={TOKEN} stage="listo" />);
    expect(container).toBeEmptyDOMElement();
    supported = false;
    rerender(<ReadyNotice token={`${TOKEN}x`} stage="produccion" />);
    expect(container).toBeEmptyDOMElement();
  });
});
