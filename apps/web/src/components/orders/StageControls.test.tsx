import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageControls } from "./StageControls";
import type { OrderAreaTask } from "@/types";
import { DEFAULT_AREAS, resetAreaCatalog, setAreaCatalog } from "@emd/business/src/areas";

const advanceStage = {
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};
const decideStage = {
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({ advanceStage, decideStage }),
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

const DIGITALIZADO = { id: 301, key: "digitalizado", name: "Digitalizado", kind: "work" } as const;
const EN_PRUEBAS = { id: 302, key: "en_pruebas", name: "En pruebas", kind: "review" } as const;

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

describe("StageControls", () => {
  it("en digitalizado ofrece mandar a pruebas", async () => {
    render(
      <StageControls
        orderId={9}
        task={task({ stage: DIGITALIZADO })}
        canAct
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Pasar a «En pruebas»" }),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Pasar a «En pruebas»" }).at(-1)!,
    );
    expect(advanceStage.mutateAsync).toHaveBeenCalledWith({
      taskId: 4,
      notes: undefined,
    });
  });

  it("rechazar exige observaciones", async () => {
    render(
      <StageControls
        orderId={9}
        task={task({ stage: EN_PRUEBAS })}
        canAct
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Rechazar" }),
    );
    const confirm = screen
      .getAllByRole("button", { name: "Rechazar" })
      .at(-1)!;
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Observaciones"), "hilo tenso");
    await userEvent.click(confirm);
    expect(decideStage.mutateAsync).toHaveBeenCalledWith({
      taskId: 4,
      result: "rechazada",
      notes: "hilo tenso",
    });
  });

  it("quien no puede actuar ve el registro pero no los botones", () => {
    render(
      <StageControls
        orderId={9}
        task={task({
          stage: DIGITALIZADO,
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
    expect(screen.getByText("Revisión 1")).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
  });

  it("no pinta nada fuera de las etapas y sin registro", () => {
    const { container } = render(
      <StageControls orderId={9} task={task({})} canAct />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("adjunta la foto de la prueba al mandarla a pruebas", async () => {
    advanceStage.mutateAsync.mockClear();
    render(
      <StageControls
        orderId={9}
        task={task({ stage: DIGITALIZADO })}
        canAct
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Pasar a «En pruebas»" }),
    );
    const input = document.querySelector(
      'input[type="file"]:not([capture])',
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["x"], "prueba.jpg", { type: "image/jpeg" }),
    );
    expect(
      await screen.findByAltText("Vista previa de la foto"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Pasar a «En pruebas»" }).at(-1)!,
    );
    const sent = advanceStage.mutateAsync.mock.calls[0][0];
    expect(sent.photo).toMatchObject({
      filename: "prueba.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("muestra 'Ver foto' sólo en las rondas que la traen y la abre al pedirla", async () => {
    render(
      <StageControls
        orderId={9}
        task={task({
          stage: EN_PRUEBAS,
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
    expect(await screen.findByAltText("Revisión 1")).toBeInTheDocument();
  });

  describe("área con etapas propias", () => {
    const CORTE = { id: 901, key: "corte", name: "Corte", kind: "work" } as const;
    const ARMADO = { id: 902, key: "armado", name: "Armado", kind: "work" } as const;

    beforeAll(() => {
      setAreaCatalog([
        ...DEFAULT_AREAS,
        { ...DEFAULT_AREAS[0], id: 9, slug: "carpinteria", name: "Carpintería", sortOrder: 70, stages: [CORTE, ARMADO] },
      ]);
    });
    afterAll(() => resetAreaCatalog());

    it("una etapa de trabajo ofrece pasar a la siguiente, sin foto ni observaciones", async () => {
      advanceStage.mutateAsync.mockClear();
      render(<StageControls orderId={9} task={task({ area: "carpinteria", stage: CORTE })} canAct />);

      await userEvent.click(screen.getByRole("button", { name: "Pasar a «Armado»" }));
      expect(screen.queryByLabelText("Observaciones")).toBeNull();
      expect(screen.queryByText("Foto para la revisión (opcional)")).toBeNull();
      await userEvent.click(screen.getAllByRole("button", { name: "Pasar a «Armado»" }).at(-1)!);
      expect(advanceStage.mutateAsync).toHaveBeenCalledWith({ taskId: 4, notes: undefined });
    });

    it("la última etapa se completa con 'Listo para producir'", async () => {
      render(<StageControls orderId={9} task={task({ area: "carpinteria", stage: ARMADO })} canAct />);
      expect(screen.getByRole("button", { name: "Listo para producir" })).toBeInTheDocument();
    });
  });
});
