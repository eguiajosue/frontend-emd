import { describe, expect, it } from "vitest";
import {
  alarmPulse,
  barcodeBars,
  bladeTravel,
  BLADE_MS,
  cameraDistanceForAspect,
  cameraDolly,
  CHOREO_3D,
  cutFlash,
  fanLayout,
  isFeeding,
  ledLevel,
  ndcToScreen,
  paperCurlOffset,
  printerPose,
  printTimeline,
  quadToScreenSheet,
  READ_HOLD_MS,
  sheetFlight,
  sheetPixelWidth,
  steppedFeed,
  ticketMotion,
  worldWidthForPixels,
} from "./arrival3d";
import { arrivalTimeline, PRIORITY_STYLE, type ArrivalPriority } from "./packageArrivals";

const PRIORITIES: ArrivalPriority[] = ["overdue", "at_risk", "calm", "changes"];

describe("horario de impresión", () => {
  it.each(PRIORITIES)("%s: respeta los tiempos de la 2D, imprime → corta → sube y deja leer antes de volar", (p) => {
    for (const [batch, count] of [
      [false, 1],
      [true, 4],
      [true, 5],
    ] as const) {
      const tl = printTimeline(p, batch, count);
      expect(tl).toMatchObject(arrivalTimeline(p, batch));
      expect(tl.tickets).toHaveLength(count);
      let prevCut = 0;
      for (const s of tl.tickets) {
        expect(s.feedStart).toBeGreaterThanOrEqual(tl.land);
        expect(s.feedEnd).toBeGreaterThan(s.feedStart);
        expect(s.cut).toBeGreaterThanOrEqual(s.feedEnd);
        expect(s.riseStart).toBeGreaterThan(s.cut);
        expect(s.riseEnd).toBeGreaterThan(s.riseStart);
        expect(tl.fly - s.riseEnd).toBeGreaterThanOrEqual(READ_HOLD_MS - 1);
        // En lote, uno detrás de otro: no se pisan en la ranura.
        expect(s.feedStart).toBeGreaterThanOrEqual(prevCut);
        prevCut = s.cut;
      }
      expect(tl.sinkEnd).toBeGreaterThan(tl.fly);
      expect(tl.sinkEnd).toBeLessThanOrEqual(tl.done);
    }
  });

  it("vencido imprime más rápido que urgente y que a tiempo", () => {
    const feed = (p: ArrivalPriority) => {
      const s = printTimeline(p).tickets[0];
      return s.feedEnd - s.feedStart;
    };
    expect(feed("overdue")).toBeLessThan(feed("at_risk"));
    expect(feed("at_risk")).toBeLessThan(feed("calm"));
    expect(printTimeline("overdue").tickets[0].cut).toBeLessThan(printTimeline("calm").tickets[0].cut);
  });

  it("toda la llegada dura alrededor de 4 s", () => {
    for (const p of PRIORITIES) {
      const { done } = printTimeline(p);
      expect(done).toBeGreaterThan(3000);
      expect(done).toBeLessThan(4600);
    }
  });

  it("el papel avanza a pasos de motor: monótono, con pausas, de 0 a 1", () => {
    expect(steppedFeed(0, 8)).toBe(0);
    expect(steppedFeed(1, 8)).toBe(1);
    const samples = Array.from({ length: 201 }, (_, i) => steppedFeed(i / 200, 8));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1e-9);
    // Quieto en el 40 % final de cada paso (la línea se imprime).
    expect(steppedFeed(0.1, 8)).toBeCloseTo(1 / 8);
    expect(steppedFeed(0.12, 8)).toBeCloseTo(1 / 8);
  });
});

describe("parámetros por prioridad", () => {
  it("usan el color del semáforo de la app", () => {
    for (const p of PRIORITIES) expect(CHOREO_3D[p].color).toBe(PRIORITY_STYLE[p].color);
  });

  it("vencido: LED que parpadea, tinta roja \"VENCIDO\", sacudida y más papelitos", () => {
    const { overdue, at_risk, calm, changes } = CHOREO_3D;
    expect(overdue.led).toBe("blink");
    expect(overdue.ledHz).toBeGreaterThan(2);
    expect(overdue.header).toBe("VENCIDO");
    expect(overdue.ink).toMatch(/^#d|^#e|^#f/i);
    expect(overdue.shake).toBeGreaterThan(0);
    expect(overdue.camShake).toBeGreaterThan(at_risk.camShake);
    expect(overdue.chips).toBeGreaterThan(at_risk.chips);
    expect(at_risk.chips).toBeGreaterThan(calm.chips);
    expect(at_risk.led).toBe("steady");
    expect(calm.led).toBe("breathe");
    expect(changes.header).toBe("CAMBIOS");
    expect(changes.entry).toBe("slide");
    expect(calm.entry).toBe("float");
  });
});

describe("impresora", () => {
  it("cae desde lo alto, se aplasta al tocar el piso y queda apoyada", () => {
    const c = CHOREO_3D.at_risk;
    const tl = printTimeline("at_risk");
    expect(printerPose(0, c, tl).y).toBeCloseTo(c.dropHeight);
    expect(printerPose(tl.land - 20, c, tl).sy).toBeGreaterThan(1);
    const squash = printerPose(tl.land + 80, c, tl);
    expect(squash.sy).toBeLessThan(1);
    expect(squash.sx).toBeGreaterThan(1);
    // Ya quieta antes de que salga el papel.
    expect(printerPose(tl.tickets[0].feedStart - 1, c, tl)).toMatchObject({ y: 0, sx: 1, sy: 1, x: 0 });
  });

  it("vibra mientras imprime y no cuando está quieta", () => {
    const c = CHOREO_3D.overdue;
    const tl = printTimeline("overdue");
    const s = tl.tickets[0];
    expect(isFeeding(s.feedStart + 10, tl)).toBe(true);
    expect(isFeeding(s.cut + 10, tl)).toBe(false);
    const xs = Array.from({ length: 30 }, (_, i) => Math.abs(printerPose(s.feedStart + 5 + i * 7, c, tl).x));
    expect(Math.max(...xs)).toBeGreaterThan(0);
    expect(printerPose(s.riseStart + 10, c, tl).x).toBe(0);
  });

  it("cambios entra deslizándose desde el costado y frena pasándose un poco", () => {
    const c = CHOREO_3D.changes;
    const tl = printTimeline("changes");
    expect(printerPose(0, c, tl).x).toBeCloseTo(c.slideFrom);
    const xs = Array.from({ length: 50 }, (_, i) => printerPose((tl.land * i) / 50, c, tl).x);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(printerPose(tl.land, c, tl).x).toBeCloseTo(0);
  });

  it("después del pase se hunde y se desvanece", () => {
    for (const p of PRIORITIES) {
      const c = CHOREO_3D[p];
      const tl = printTimeline(p);
      expect(printerPose(tl.fly, c, tl).opacity).toBe(1);
      const end = printerPose(tl.sinkEnd, c, tl);
      expect(end.opacity).toBeCloseTo(0);
      expect(end.y).toBeLessThan(0);
    }
  });

  it("LED: tenue en espera; vencido parpadea, calma respira, urgente fijo", () => {
    const tlO = printTimeline("overdue");
    expect(ledLevel(0, CHOREO_3D.overdue, tlO)).toBeLessThan(0.5);
    const blink = Array.from({ length: 40 }, (_, i) => ledLevel(tlO.land + 300 + i * 20, CHOREO_3D.overdue, tlO));
    expect(Math.max(...blink) - Math.min(...blink)).toBeGreaterThan(0.7);
    const tlC = printTimeline("calm");
    const breathe = Array.from({ length: 36 }, (_, i) => ledLevel(tlC.land + i * 25, CHOREO_3D.calm, tlC));
    expect(Math.min(...breathe)).toBeGreaterThan(0.15);
    expect(Math.max(...breathe)).toBeGreaterThan(0.9);
    const tlA = printTimeline("at_risk");
    expect(ledLevel(tlA.tickets[0].feedStart + 50, CHOREO_3D.at_risk, tlA)).toBe(1);
  });
});

describe("guillotina y ticket", () => {
  it("la cuchilla cruza justo al cortar y vuelve; el destello nace en el corte", () => {
    const s = printTimeline("at_risk").tickets[0];
    expect(bladeTravel(s.cut - BLADE_MS - 1, s)).toBe(0);
    expect(bladeTravel(s.cut, s)).toBeCloseTo(1);
    expect(bladeTravel(s.cut + 400, s)).toBeCloseTo(0);
    expect(cutFlash(s.cut - 1, s)).toBe(0);
    expect(cutFlash(s.cut + 40, s)).toBeCloseTo(1);
    expect(cutFlash(s.cut + 900, s)).toBeLessThan(0.02);
  });

  it("el ticket sale de la ranura, se corta, se aplana y termina mirando a cámara", () => {
    const c = CHOREO_3D.calm;
    const tl = printTimeline("calm");
    const s = tl.tickets[0];
    expect(ticketMotion(s.feedStart - 1, c, tl).visible).toBe(false);
    const mid = ticketMotion((s.feedStart + s.feedEnd) / 2, c, tl);
    expect(mid.fed).toBeGreaterThan(0.2);
    expect(mid.fed).toBeLessThan(0.8);
    expect(mid.cut).toBe(false);
    expect(mid.curl).toBeCloseTo(c.curl);
    expect(ticketMotion(s.feedEnd, c, tl).fed).toBe(1);
    expect(ticketMotion(s.cut, c, tl).cut).toBe(true);
    const done = ticketMotion(s.riseEnd, c, tl);
    expect(done).toMatchObject({ visible: true, turn: 1, curl: 0 });
    expect(done.lift).toBeCloseTo(1);
    expect(done.twist).toBeCloseTo(0);
    expect(ticketMotion(tl.fly, c, tl).visible).toBe(false);
  });

  it("en lote: el segundo ticket empieza a salir cuando el primero ya se cortó", () => {
    const c = CHOREO_3D.overdue;
    const tl = printTimeline("overdue", true, 5);
    const [a, b] = tl.tickets;
    expect(ticketMotion(a.feedStart + 10, c, tl, 1).visible).toBe(false);
    expect(ticketMotion(b.feedStart + 10, c, tl, 0).cut).toBe(true);
  });

  it("el papel se curva hacia atrás sólo fuera de la ranura", () => {
    expect(paperCurlOffset(-0.3, 0.2)).toBe(0);
    expect(paperCurlOffset(1, 0.2)).toBeCloseTo(-0.2);
    expect(paperCurlOffset(1, 0)).toBeCloseTo(0);
  });

  it("código de barras determinista que llena el ancho", () => {
    const a = barcodeBars(9001, 220);
    expect(a.reduce((x, y) => x + y, 0)).toBe(220);
    expect(barcodeBars(9001, 220)).toEqual(a);
    expect(barcodeBars(9002, 220)).not.toEqual(a);
  });

  it("latido sólo en vencido; la cámara llega cuando sube el último ticket", () => {
    const tl = printTimeline("overdue", true, 5);
    expect(alarmPulse(1234, CHOREO_3D.calm)).toBe(0);
    const pulses = Array.from({ length: 40 }, (_, i) => alarmPulse(i * 25, CHOREO_3D.overdue));
    expect(Math.max(...pulses) - Math.min(...pulses)).toBeGreaterThan(0.8);
    expect(cameraDolly(0, CHOREO_3D.overdue, tl)).toBeCloseTo(CHOREO_3D.overdue.dolly);
    expect(cameraDolly(tl.tickets[4].riseEnd, CHOREO_3D.overdue, tl)).toBeCloseTo(0);
  });
});

describe("pase del ticket 3D a la pantalla", () => {
  const viewport = { left: 0, top: 0, width: 1280, height: 720 };

  it("NDC → píxeles (y hacia abajo)", () => {
    expect(ndcToScreen({ x: -1, y: 1 }, viewport)).toEqual({ x: 0, y: 0 });
    expect(ndcToScreen({ x: 1, y: -1 }, viewport)).toEqual({ x: 1280, y: 720 });
    expect(ndcToScreen({ x: 0, y: 0 }, { left: 10, top: 20, width: 100, height: 50 })).toEqual({ x: 60, y: 45 });
  });

  it("cuatro esquinas → centro, tamaño y giro", () => {
    const flat = quadToScreenSheet([
      { x: 100, y: 50 },
      { x: 400, y: 50 },
      { x: 400, y: 250 },
      { x: 100, y: 250 },
    ]);
    expect(flat).toEqual({ cx: 250, cy: 150, width: 300, height: 200, angle: 0 });

    // El mismo rectángulo girado 10° alrededor de su centro.
    const a = (10 * Math.PI) / 180;
    const rot = (x: number, y: number) => ({
      x: 250 + x * Math.cos(a) - y * Math.sin(a),
      y: 150 + x * Math.sin(a) + y * Math.cos(a),
    });
    const turned = quadToScreenSheet([rot(-150, -100), rot(150, -100), rot(150, 100), rot(-150, 100)]);
    expect(turned.cx).toBeCloseTo(250);
    expect(turned.cy).toBeCloseTo(150);
    expect(turned.width).toBeCloseTo(300);
    expect(turned.height).toBeCloseTo(200);
    expect(turned.angle).toBeCloseTo(10);
  });

  it("el vuelo arranca donde quedó la hoja 3D y termina alineado arriba con la tarjeta", () => {
    const from = { cx: 640, cy: 200, width: 360, height: 250, angle: -6 };
    const natural = { width: 288, height: 200 };
    const target = { left: 40, top: 300, width: 400, height: 320 };
    const f = sheetFlight(from, target, natural);
    expect(f.startScale).toBeCloseTo(1.25);
    expect(f.endScale).toBeCloseTo(400 / 288);
    expect(f.startAngle).toBe(-6);
    // Centro final: el de la tarjeta en x; en y, el borde de arriba coincide.
    expect(from.cx + f.dx).toBeCloseTo(240);
    expect(from.cy + f.dy - (natural.height * f.endScale) / 2).toBeCloseTo(300);
  });

  it("tamaños en mundo ↔ píxeles y cámara para pantallas angostas", () => {
    // A 10 de distancia con 30° de FOV se ven 5.36 unidades de alto.
    const w = worldWidthForPixels(360, 10, 30, 720);
    expect(w).toBeCloseTo((360 * 2 * 10 * Math.tan(Math.PI / 12)) / 720);
    expect(worldWidthForPixels(100, 10, 30, 0)).toBe(0);
    expect(cameraDistanceForAspect(16 / 9, 10, 30, 4.6)).toBe(10);
    const portrait = cameraDistanceForAspect(9 / 16, 10, 30, 4.6);
    expect(portrait).toBeGreaterThan(10);
    // Con esa distancia la escena entra justo a lo ancho.
    const hHalf = Math.atan(Math.tan(Math.PI / 12) * (9 / 16));
    expect(2 * portrait * Math.tan(hHalf)).toBeCloseTo(4.6);
  });

  it("la hoja es legible y el abanico entra en pantalla", () => {
    expect(sheetPixelWidth(1920, false, 1)).toBe(380);
    expect(sheetPixelWidth(800, false, 1)).toBe(240);
    const each = sheetPixelWidth(1280, true, 5);
    expect(each).toBeLessThanOrEqual(230);
    const fan = fanLayout(5);
    const span = (fan[4].offset - fan[0].offset + 1) * each;
    expect(span).toBeLessThan(1280);
    // Una al lado de la otra: no se tapan el texto.
    expect(fan[1].offset - fan[0].offset).toBeGreaterThanOrEqual(1);
    expect(fan[2]).toEqual({ offset: 0, angle: -0, depth: -0 });
    expect(fan[0].angle).toBeCloseTo(-fan[4].angle);
  });
});
