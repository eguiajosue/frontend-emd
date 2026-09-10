import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueMutation,
  listPendingMutations,
  removePendingMutation,
} from "./offlineQueue";

// `openDB` cachea la conexión a nivel de módulo (ver `getDb` en
// `offlineQueue.ts`), así que entre tests no se reabre la DB: en cambio se
// vacía a mano, reusando `listPendingMutations`/`removePendingMutation` (ya
// probados acá abajo) en vez de tocar el detalle interno del store.
beforeEach(async () => {
  const pending = await listPendingMutations();
  await Promise.all(pending.map((m) => removePendingMutation(m.id)));
});

describe("offlineQueue", () => {
  it("encola una mutación y la devuelve con id y createdAt generados", async () => {
    const mutation = await enqueueMutation("/orders/7/area-tasks/2/status", "PATCH", {
      status: "en_proceso",
    });
    expect(mutation.id).toBeTruthy();
    expect(mutation.url).toBe("/orders/7/area-tasks/2/status");
    expect(mutation.method).toBe("PATCH");
    expect(mutation.body).toEqual({ status: "en_proceso" });
    expect(mutation.createdAt).toBeTypeOf("number");
  });

  it("lista las mutaciones pendientes, de la más vieja a la más nueva", async () => {
    // `createdAt` es `Date.now()`: dos llamadas seguidas pueden caer en el
    // mismo milisegundo real, así que se fuerza el reloj para que el orden no
    // dependa de la velocidad de la máquina que corre el test.
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);

    const first = await enqueueMutation("/orders/1", "PATCH", { statusId: 3 });
    const second = await enqueueMutation("/orders/2", "PATCH", { statusId: 4 });
    now.mockRestore();

    const pending = await listPendingMutations();

    expect(pending.map((m) => m.id)).toEqual([first.id, second.id]);
  });

  it("saca una mutación de la cola por id", async () => {
    const mutation = await enqueueMutation("/orders/9", "PATCH", { statusId: 5 });

    await removePendingMutation(mutation.id);

    const pending = await listPendingMutations();
    expect(pending.find((m) => m.id === mutation.id)).toBeUndefined();
  });

  it("sacar un id que no existe no rompe nada", async () => {
    await expect(removePendingMutation("no-existe")).resolves.toBeUndefined();
  });
});
