import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmbroideryPrepControls } from "./EmbroideryPrepControls";
import type { OrderAreaTask } from "@/types";

const sendToTest = {
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};
const decideTest = {
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({ sendToTest, decideTest }),
  useSampleTestPhoto: (
    _o: number,
    _t: number,
    _id: number,
    enabled: boolean,
  ) => ({
    isLoading: false,
    isError: false,
    data: enabled
      ? {
          filename: "p.jpg",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,AAAA",
        }
      : undefined,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const task = (over: Partial<OrderAreaTask>): OrderAreaTask =>
  ({
    id: 4,
    orderId: 9,
    area: "bordado",
    status: "pendiente",
    createdAt: "",
    ...over,
  }) as OrderAreaTask;

beforeAll(() => {
  // jsdom no implementa object URLs.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("EmbroideryPrepControls", () => {
  it("en digitalizado ofrece mandar a pruebas", async () => {
    render(
      <EmbroideryPrepControls
        orderId={9}
        task={task({ prepStage: "digitalizado" })}
        canAct
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mandar a pruebas" }),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Mandar a pruebas" }).at(-1)!,
    );
    expect(sendToTest.mutateAsync).toHaveBeenCalledWith({
      taskId: 4,
      notes: undefined,
    });
  });

  it("rechazar exige observaciones", async () => {
    render(
      <EmbroideryPrepControls
        orderId={9}
        task={task({ prepStage: "en_pruebas" })}
        canAct
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Rechazar prueba" }),
    );
    const confirm = screen
      .getAllByRole("button", { name: "Rechazar prueba" })
      .at(-1)!;
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Observaciones"), "hilo tenso");
    await userEvent.click(confirm);
    expect(decideTest.mutateAsync).toHaveBeenCalledWith({
      taskId: 4,
      result: "rechazada",
      notes: "hilo tenso",
    });
  });

  it("quien no puede actuar ve el registro pero no los botones", () => {
    render(
      <EmbroideryPrepControls
        orderId={9}
        task={task({
          prepStage: "digitalizado",
          sampleTests: [
            {
              id: 1,
              round: 1,
              sentAt: "2026-10-08T10:00:00Z",
              result: "rechazada",
              resultNotes: "hilo tenso",
            },
          ],
        })}
        canAct={false}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Prueba 1")).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
  });

  it("no pinta nada fuera de las etapas y sin registro", () => {
    const { container } = render(
      <EmbroideryPrepControls orderId={9} task={task({})} canAct />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("adjunta la foto de la prueba al mandarla a pruebas", async () => {
    sendToTest.mutateAsync.mockClear();
    render(
      <EmbroideryPrepControls
        orderId={9}
        task={task({ prepStage: "digitalizado" })}
        canAct
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mandar a pruebas" }),
    );
    const input = document.querySelector(
      'input[type="file"]:not([capture])',
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["x"], "prueba.jpg", { type: "image/jpeg" }),
    );
    expect(
      await screen.findByAltText("Vista previa de la prueba"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Mandar a pruebas" }).at(-1)!,
    );
    const sent = sendToTest.mutateAsync.mock.calls[0][0];
    expect(sent.photo).toMatchObject({
      filename: "prueba.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("muestra 'Ver foto' sólo en las rondas que la traen y la abre al pedirla", async () => {
    render(
      <EmbroideryPrepControls
        orderId={9}
        task={task({
          prepStage: "en_pruebas",
          sampleTests: [
            {
              id: 1,
              round: 1,
              sentAt: "2026-10-08T10:00:00Z",
              result: "rechazada",
              photoName: "p.jpg",
            },
            { id: 2, round: 2, sentAt: "2026-10-09T10:00:00Z", result: null },
          ],
        })}
        canAct
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Ver foto" });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(await screen.findByAltText("Prueba 1")).toBeInTheDocument();
  });
});
