import { describe, expect, it } from "vitest";
import { groupMyTasks, taskAreas } from "./myTasks";
import type { MyTask } from "@/types";

const NOW = new Date("2026-10-03T12:00:00Z").getTime();
const HOUR = 3_600_000;

function task(key: string, extra: Partial<MyTask> & { due?: number | null } = {}): MyTask {
  const { due, ...rest } = extra;
  return {
    key,
    kind: "production",
    area: "taller",
    taskId: 1,
    status: "pendiente",
    mine: false,
    assignee: null,
    startedAt: null,
    order: {
      id: Number(key.replace(/\D/g, "")) || 1,
      description: key,
      deliveryDate: due == null ? null : new Date(NOW + due).toISOString(),
      creationDate: new Date(NOW - 10 * HOUR).toISOString(),
      statusId: 9,
      clientNameOverride: null,
      designStartedAt: null,
      designStartedByName: null,
      client: null,
      status: { id: 9, name: "autorizado" },
    },
    ...rest,
  };
}

describe("groupMyTasks", () => {
  it("separa lo propio de lo libre y ordena por urgencia (vencido primero, sin fecha al final)", () => {
    const { mine, free } = groupMyTasks(
      [
        task("t1", { mine: true, due: 72 * HOUR }),
        task("t2", { mine: true, due: -2 * HOUR }),
        task("t3", { due: null }),
        task("t4", { due: 5 * HOUR }),
      ],
      NOW
    );
    expect(mine.map((t) => t.key)).toEqual(["t2", "t1"]);
    expect(free.map((t) => t.key)).toEqual(["t4", "t3"]);
  });

  it("lo que ya está en curso va antes que lo que falta empezar", () => {
    const { mine } = groupMyTasks(
      [
        task("t1", { mine: true, due: 1 * HOUR }),
        task("t2", { mine: true, due: 90 * HOUR, status: "en_proceso" }),
      ],
      NOW
    );
    expect(mine.map((t) => t.key)).toEqual(["t2", "t1"]);
  });

  it("filtra por área", () => {
    const { free } = groupMyTasks([task("t1"), task("t2", { area: "dtf" })], NOW, "dtf");
    expect(free.map((t) => t.key)).toEqual(["t2"]);
  });
});

describe("taskAreas", () => {
  it("sólo las áreas que tienen tareas, en el orden de los roles", () => {
    expect(taskAreas([task("t1", { area: "dtf" }), task("t2", { area: "diseno" })], ["diseno", "taller", "dtf"])).toEqual([
      "diseno",
      "dtf",
    ]);
  });
});
