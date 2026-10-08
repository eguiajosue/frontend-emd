import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readyNoticeLabel, ShareWithClientButton, viewedLabel } from "./ShareWithClient";
import type { Order } from "@/types";

let state: { link: unknown; pendingResponse: null } = { link: null, pendingResponse: null };
const create = vi.fn();
const regenerate = vi.fn();
const revoke = vi.fn();
const mutation = (fn: ReturnType<typeof vi.fn>) => ({ mutate: fn, reset: vi.fn(), isPending: false, isError: false });
vi.mock("@/hooks/useClientPortal", () => ({
  useShareState: () => ({ data: state, isSuccess: true, isPending: false }),
  useShareLinkActions: () => ({ create: mutation(create), regenerate: mutation(regenerate), revoke: mutation(revoke) }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const order = {
  id: 108,
  description: "Gorras",
  client: { id: 1, first_name: "Ana", last_name: "Ruiz", phone: "55 1234 5678" },
} as unknown as Order;

describe("compartir con el cliente", () => {
  it("al abrir sin enlace lo crea", async () => {
    state = { link: null, pendingResponse: null };
    create.mockClear();
    render(<ShareWithClientButton order={order} />);
    await userEvent.click(screen.getByRole("button", { name: /Compartir/ }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("con enlace: copiar, WhatsApp al teléfono del cliente, QR y regenerar", async () => {
    state = { link: { token: "abc123", createdAt: "", lastViewedAt: null, viewCount: 0 }, pendingResponse: null };
    render(<ShareWithClientButton order={order} />);
    await userEvent.click(screen.getByRole("button", { name: /Compartir/ }));
    expect(screen.getByRole("textbox", { name: "Enlace del pedido" })).toHaveValue(`${window.location.origin}/p/abc123`);
    const wa = screen.getByRole("link", { name: /Enviar por WhatsApp/ });
    expect(wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/525512345678\?text=/);
    expect(decodeURIComponent(wa.getAttribute("href")!)).toContain("Hola Ana, aquí puedes ver tu pedido #108");
    expect(screen.getByText("Todavía no lo abre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Código QR" }));
    expect(screen.getByRole("img", { name: "Código QR del enlace del pedido" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Generar enlace nuevo" }));
    expect(regenerate).toHaveBeenCalled();
  });

  it("'Visto hace…' con las veces que lo abrió", () => {
    expect(viewedLabel({ lastViewedAt: new Date().toISOString(), viewCount: 3 })).toMatch(/^Visto hace .* · 3 veces$/);
    expect(viewedLabel(null)).toBeNull();
  });

  it("pedido listo: WhatsApp de 'ya está listo' y estado del aviso automático", async () => {
    state = {
      link: { token: "abc123", createdAt: "", lastViewedAt: null, viewCount: 0, readyNotifiedAt: new Date().toISOString(), pushSubscribers: 1 },
      pendingResponse: null,
    };
    render(<ShareWithClientButton order={{ ...order, statusId: 4 } as Order} />);
    await userEvent.click(screen.getByRole("button", { name: /Compartir/ }));
    const wa = screen.getByRole("link", { name: /Avisar que está listo/ });
    expect(decodeURIComponent(wa.getAttribute("href")!)).toContain("tu pedido #108 de EMD ya está listo");
    expect(screen.getByText(/Aviso de "pedido listo" enviado hace/)).toBeInTheDocument();
  });

  it("aviso pedido por el cliente, todavía sin mandar", () => {
    expect(readyNoticeLabel({ readyNotifiedAt: null, pushSubscribers: 2 })).toMatch(/en 2 dispositivos/);
    expect(readyNoticeLabel({ readyNotifiedAt: null, pushSubscribers: 0 })).toBeNull();
  });
});
