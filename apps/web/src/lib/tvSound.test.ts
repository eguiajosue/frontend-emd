import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chimePattern,
  isTvSoundMuted,
  motorSteps,
  playArrivalChime,
  playCutterSnip,
  playPrinterFeed,
  printerMotorParams,
  setTvSoundMuted,
  TV_MUTED_KEY,
} from "./tvSound";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("silencio del Modo TV", () => {
  it("por defecto suena; el silencio se guarda en localStorage", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    expect(isTvSoundMuted()).toBe(false);
    setTvSoundMuted(true);
    expect(storage.data.get(TV_MUTED_KEY)).toBe("true");
    expect(isTvSoundMuted()).toBe(true);
    setTvSoundMuted(false);
    expect(isTvSoundMuted()).toBe(false);
  });

  it("sin localStorage (o si tira) no rompe: queda con sonido", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    });
    expect(() => setTvSoundMuted(true)).not.toThrow();
    expect(isTvSoundMuted()).toBe(false);
  });

  it("sin audio desbloqueado no intenta sonar", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(playArrivalChime("overdue")).toBe(false);
  });
});

describe("campanita por prioridad", () => {
  it("vencido es más insistente: más notas y más fuerte", () => {
    const overdue = chimePattern("overdue");
    const calm = chimePattern("calm");
    expect(overdue.length).toBeGreaterThan(chimePattern("at_risk").length);
    expect(chimePattern("at_risk").length).toBeGreaterThan(calm.length);
    expect(Math.max(...overdue.map((n) => n.gain))).toBeGreaterThan(Math.max(...calm.map((n) => n.gain)));
  });

  it("cambios baja de tono; calma sube", () => {
    const [a, b] = chimePattern("changes");
    expect(b.freq).toBeLessThan(a.freq);
    const [c, d] = chimePattern("calm");
    expect(d.freq).toBeGreaterThan(c.freq);
  });

  it("todas las notas son cortas (menos de 1 s en total)", () => {
    for (const p of ["overdue", "at_risk", "calm", "changes"] as const) {
      const end = Math.max(...chimePattern(p).map((n) => n.at + n.dur));
      expect(end).toBeLessThan(1);
    }
  });
});

describe("motor de la impresora", () => {
  it("pulsos a pasos: suena el 60 % de cada paso, dentro de la duración", () => {
    const steps = motorSteps(0.8, 8);
    expect(steps).toHaveLength(8);
    expect(steps[0][0]).toBe(0);
    expect(steps[0][1]).toBeCloseTo(0.06);
    expect(steps[7][1]).toBeLessThanOrEqual(0.8);
    expect(motorSteps(0.5, 0)).toHaveLength(1);
  });

  it("vencido suena más agudo y fuerte que a tiempo", () => {
    expect(printerMotorParams("overdue").motorHz).toBeGreaterThan(printerMotorParams("calm").motorHz);
    expect(printerMotorParams("overdue").gain).toBeGreaterThan(printerMotorParams("calm").gain);
  });

  it("sin desbloquear el audio no suena nada (ni motor ni guillotina)", () => {
    expect(playPrinterFeed("overdue", 600, 8)).toBe(false);
    expect(playCutterSnip()).toBe(false);
  });
});
