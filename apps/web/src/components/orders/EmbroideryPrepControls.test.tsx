import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmbroideryPrepControls } from "./EmbroideryPrepControls";
import type { OrderAreaTask } from "@/types";

const sendToTest = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const decideTest = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };

vi.mock("@/hooks/useAreaTasks", () => ({
  useAreaTasks: () => ({ sendToTest, decideTest }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const task = (over: Partial<OrderAreaTask>): OrderAreaTask =>
  ({ id: 4, orderId: 9, area: "bordado", status: "pendiente", createdAt: "", ...over }) as OrderAreaTask;

describe("EmbroideryPrepControls", () => {
  it("en digitalizado ofrece mandar a pruebas", async () => {
    render(<EmbroideryPrepControls orderId={9} task={task({ prepStage: "digitalizado" })} canAct />);
    await userEvent.click(screen.getByRole("button", { name: "Mandar a pruebas" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Mandar a pruebas" }).at(-1)!);
    expect(sendToTest.mutateAsync).toHaveBeenCalledWith({ taskId: 4, notes: undefined });
  });

  it("rechazar exige observaciones", async () => {
    render(<EmbroideryPrepControls orderId={9} task={task({ prepStage: "en_pruebas" })} canAct />);
    await userEvent.click(screen.getByRole("button", { name: "Rechazar prueba" }));
    const confirm = screen.getAllByRole("button", { name: "Rechazar prueba" }).at(-1)!;
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
            { id: 1, round: 1, sentAt: "2026-10-08T10:00:00Z", result: "rechazada", resultNotes: "hilo tenso" },
          ],
        })}
        canAct={false}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Prueba 1")).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
  });

  it("no pinta nada fuera de las etapas y sin registro", () => {
    const { container } = render(<EmbroideryPrepControls orderId={9} task={task({})} canAct />);
    expect(container).toBeEmptyDOMElement();
  });
});
