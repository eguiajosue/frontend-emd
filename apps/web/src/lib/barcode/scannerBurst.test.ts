import { describe, expect, it } from "vitest";
import {
  INITIAL_BURST_STATE,
  burstStep,
  createBurstDetector,
  createDuplicateGuard,
  type BurstResult,
} from "./scannerBurst";

/** Teclea `text` (+ Enter) empezando en `start`, con `gap` ms entre teclas. */
function typeAll(
  text: string,
  { start = 1000, gap = 10, enterGap }: { start?: number; gap?: number; enterGap?: number } = {}
): BurstResult[] {
  const detector = createBurstDetector();
  const results: BurstResult[] = [];
  let t = start;
  for (const ch of text) {
    results.push(detector.push(ch, t));
    t += gap;
  }
  results.push(detector.push("Enter", t - gap + (enterGap ?? gap)));
  return results;
}

describe("scannerBurst", () => {
  it("una ráfaga rápida que termina en Enter es un escaneo", () => {
    const results = typeAll("EMD-000001", { gap: 8 });
    expect(results.at(-1)).toEqual({ kind: "scan", code: "EMD-000001" });
    // Desde la segunda tecla ya se reconoce como ráfaga.
    expect(results[0]).toEqual({ kind: "none" });
    expect(results[1]).toEqual({ kind: "burst", length: 2 });
  });

  it("el tecleo humano (≈ 120 ms entre teclas) no es un escaneo", () => {
    const results = typeAll("hilo rojo", { gap: 120 });
    expect(results.every((r) => r.kind === "none")).toBe(true);
  });

  it("acepta hasta el umbral de 35 ms y corta por encima", () => {
    expect(typeAll("ABC123", { gap: 35 }).at(-1)).toEqual({ kind: "scan", code: "ABC123" });
    expect(typeAll("ABC123", { gap: 36 }).at(-1)).toEqual({ kind: "none" });
  });

  it("menos de 3 caracteres no cuenta, aunque sean rápidos", () => {
    expect(typeAll("AB", { gap: 5 }).at(-1)).toEqual({ kind: "none" });
  });

  it("un Enter que llega tarde (la persona apretó Enter después) no es escaneo", () => {
    expect(typeAll("EMD-000001", { gap: 5, enterGap: 400 }).at(-1)).toEqual({ kind: "none" });
  });

  it("Enter solo (sin ráfaga) no hace nada y deja el detector limpio", () => {
    const { state, result } = burstStep(INITIAL_BURST_STATE, { key: "Enter", time: 10 });
    expect(result).toEqual({ kind: "none" });
    expect(state).toEqual(INITIAL_BURST_STATE);
  });

  it("si la persona escribía y después pasa el lector, sólo cuenta la ráfaga", () => {
    const detector = createBurstDetector();
    let t = 0;
    for (const ch of "abc") detector.push(ch, (t += 150));
    t += 600;
    let last: BurstResult = { kind: "none" };
    for (const ch of "7501234567890") last = detector.push(ch, (t += 6));
    expect(last).toEqual({ kind: "burst", length: 13 });
    expect(detector.push("Enter", t + 6)).toEqual({ kind: "scan", code: "7501234567890" });
  });

  it("Shift (mayúsculas del lector) no corta la ráfaga; Tab o flechas sí", () => {
    const detector = createBurstDetector();
    let t = 0;
    for (const key of ["Shift", "E", "Shift", "M", "Shift", "D", "-", "1"]) detector.push(key, (t += 4));
    expect(detector.push("Enter", t + 4)).toEqual({ kind: "scan", code: "EMD-1" });

    for (const ch of "ABC") detector.push(ch, (t += 4));
    detector.push("Tab", (t += 4));
    expect(detector.push("Enter", t + 4)).toEqual({ kind: "none" });
  });

  it("descarta lo que pase de 64 caracteres", () => {
    expect(typeAll("X".repeat(65), { gap: 2 }).at(-1)).toEqual({ kind: "none" });
    expect(typeAll("X".repeat(64), { gap: 2 }).at(-1)).toEqual({ kind: "scan", code: "X".repeat(64) });
  });

  it("después de un escaneo arranca de cero", () => {
    const detector = createBurstDetector();
    let t = 0;
    for (const ch of "AAA") detector.push(ch, (t += 5));
    expect(detector.push("Enter", (t += 5))).toEqual({ kind: "scan", code: "AAA" });
    for (const ch of "BBB") detector.push(ch, (t += 5));
    expect(detector.push("Enter", (t += 5))).toEqual({ kind: "scan", code: "BBB" });
  });
});

describe("createDuplicateGuard", () => {
  it("ignora el mismo código dentro de 800 ms y lo acepta después", () => {
    const guard = createDuplicateGuard(800);
    expect(guard.accept("EMD-000001", 0)).toBe(true);
    expect(guard.accept("EMD-000001", 500)).toBe(false);
    expect(guard.accept("EMD-000001", 1400)).toBe(true);
  });

  it("la ventana se corre mientras el código se siga viendo (cámara)", () => {
    const guard = createDuplicateGuard(800);
    expect(guard.accept("A", 0)).toBe(true);
    expect(guard.accept("A", 700)).toBe(false);
    expect(guard.accept("A", 1400)).toBe(false);
    expect(guard.accept("A", 2300)).toBe(true);
  });

  it("un código distinto siempre pasa", () => {
    const guard = createDuplicateGuard(800);
    expect(guard.accept("A", 0)).toBe(true);
    expect(guard.accept("B", 10)).toBe(true);
    expect(guard.accept("A", 20)).toBe(true);
  });
});
