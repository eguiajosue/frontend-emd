import { describe, expect, it } from "vitest";
import {
  alarmPulse,
  arrival3DTimeline,
  boxPose,
  burstEnvelope,
  cameraDistanceForAspect,
  cameraDolly,
  CHOREO_3D,
  fanLayout,
  FLAP_OPEN_ANGLE,
  flapAngle,
  ndcToScreen,
  quadToScreenSheet,
  ringProgress,
  sheetFlight,
  sheetMotion,
  sheetPixelWidth,
  worldWidthForPixels,
} from "./arrival3d";
import { arrivalTimeline, PRIORITY_STYLE, type ArrivalPriority } from "./packageArrivals";

const PRIORITIES: ArrivalPriority[] = ["overdue", "at_risk", "calm", "changes"];

describe("línea de tiempo 3D", () => {
  it.each(PRIORITIES)("%s: respeta los tiempos de la 2D y deja leer la hoja antes de volar", (p) => {
    for (const batch of [false, true]) {
      const tl = arrival3DTimeline(p, batch);
      const base = arrivalTimeline(p, batch);
      expect(tl).toMatchObject(base);
      expect(tl.burst).toBeGreaterThan(tl.open);
      expect(tl.riseStart).toBeGreaterThan(tl.open);
      expect(tl.riseEnd).toBeGreaterThan(tl.riseStart);
      expect(tl.fly - tl.riseEnd).toBeGreaterThanOrEqual(450);
      expect(tl.sinkEnd).toBeGreaterThan(tl.fly);
      expect(tl.sinkEnd).toBeLessThanOrEqual(tl.done);
    }
  });

  it("toda la llegada dura alrededor de 4 s", () => {
    for (const p of PRIORITIES) {
      const { done } = arrival3DTimeline(p);
      expect(done).toBeGreaterThan(3000);
      expect(done).toBeLessThan(4600);
    }
  });
});

describe("parámetros por prioridad", () => {
  it("usan el color del semáforo de la app", () => {
    for (const p of PRIORITIES) expect(CHOREO_3D[p].color).toBe(PRIORITY_STYLE[p].color);
  });

  it("vencido cae más rápido y más fuerte, sacude, late y estalla más", () => {
    const { overdue, at_risk, calm } = CHOREO_3D;
    expect(arrival3DTimeline("overdue").land).toBeLessThan(arrival3DTimeline("at_risk").land);
    expect(overdue.dropHeight).toBeGreaterThan(at_risk.dropHeight);
    expect(overdue.squash).toBeGreaterThan(at_risk.squash);
    expect(overdue.shake).toBeGreaterThan(0);
    expect(overdue.pulseHz).toBeGreaterThan(0);
    expect(overdue.particles).toBeGreaterThan(at_risk.particles);
    expect(at_risk.particles).toBeGreaterThan(calm.particles);
    expect(overdue.rings).toBeGreaterThan(calm.rings);
  });

  it("urgente rebota; a tiempo flota sin rebote; cambios vuelve deslizándose", () => {
    expect(CHOREO_3D.at_risk.entry).toBe("drop");
    expect(CHOREO_3D.at_risk.bounces).toBeGreaterThan(CHOREO_3D.overdue.bounces);
    expect(CHOREO_3D.at_risk.shake).toBe(0);
    expect(CHOREO_3D.calm.entry).toBe("float");
    expect(CHOREO_3D.calm.bounces).toBe(0);
    expect(CHOREO_3D.calm.hover).toBeGreaterThan(0);
    expect(CHOREO_3D.changes.entry).toBe("slide");
    expect(CHOREO_3D.changes.slideFrom).toBeGreaterThan(0);
  });
});

describe("pose de la caja", () => {
  it("cae desde lo alto, se aplasta al tocar el piso y queda apoyada", () => {
    const c = CHOREO_3D.at_risk;
    const tl = arrival3DTimeline("at_risk");
    expect(boxPose(0, c, tl).y).toBeCloseTo(c.dropHeight);
    // Se estira mientras cae…
    expect(boxPose(tl.land - 20, c, tl).sy).toBeGreaterThan(1);
    // …y se aplasta al aterrizar, sin volumen raro (x/z se ensanchan).
    const squash = boxPose(tl.land + 85, c, tl);
    expect(squash.sy).toBeLessThan(1);
    expect(squash.sx).toBeGreaterThan(1);
    expect(squash.y).toBe(0);
    // Rebota (sube un poco) y después queda quieta en el piso.
    const peaks = Array.from({ length: 60 }, (_, i) => boxPose(tl.land + i * 10, c, tl).y);
    expect(Math.max(...peaks)).toBeGreaterThan(0.2);
    // Los rebotes terminan antes de que la hoja termine de salir.
    expect(boxPose(tl.riseStart + 200, c, tl)).toMatchObject({ y: 0, sx: 1, sy: 1, x: 0 });
  });

  it("vencido sacude de lado al aterrizar", () => {
    const c = CHOREO_3D.overdue;
    const tl = arrival3DTimeline("overdue");
    const xs = Array.from({ length: 40 }, (_, i) => Math.abs(boxPose(tl.land + i * 10, c, tl).x));
    expect(Math.max(...xs)).toBeGreaterThan(0.05);
    expect(boxPose(tl.land + c.shakeMs + 10, c, tl).x).toBe(0);
  });

  it("cambios entra deslizándose desde el costado y frena pasándose un poco", () => {
    const c = CHOREO_3D.changes;
    const tl = arrival3DTimeline("changes");
    expect(boxPose(0, c, tl).x).toBeCloseTo(c.slideFrom);
    const xs = Array.from({ length: 50 }, (_, i) => boxPose((tl.land * i) / 50, c, tl).x);
    expect(Math.min(...xs)).toBeLessThan(0); // overshoot
    expect(boxPose(tl.land, c, tl).x).toBeCloseTo(0);
    expect(boxPose(tl.land / 2, c, tl).y).toBe(0);
  });

  it("a tiempo baja flotando y nunca se mete bajo el piso", () => {
    const c = CHOREO_3D.calm;
    const tl = arrival3DTimeline("calm");
    for (let ms = 0; ms < tl.fly; ms += 37) expect(boxPose(ms, c, tl).y).toBeGreaterThanOrEqual(0);
    expect(boxPose(tl.land - 1, c, tl).y).toBeLessThan(0.05);
  });

  it("después del pase se hunde y se desvanece", () => {
    for (const p of PRIORITIES) {
      const c = CHOREO_3D[p];
      const tl = arrival3DTimeline(p);
      expect(boxPose(tl.fly, c, tl).opacity).toBe(1);
      const end = boxPose(tl.sinkEnd, c, tl);
      expect(end.opacity).toBeCloseTo(0);
      expect(end.y).toBeLessThan(0);
    }
  });
});

describe("solapas, hoja, luz y cámara", () => {
  it("las solapas se abren en orden, se pasan un poco y quedan abiertas", () => {
    const c = CHOREO_3D.at_risk;
    const tl = arrival3DTimeline("at_risk");
    expect(flapAngle(tl.open - 1, c, tl, 0)).toBe(0);
    expect(flapAngle(tl.open + 50, c, tl, 0)).toBeGreaterThan(flapAngle(tl.open + 50, c, tl, 3));
    const samples = Array.from({ length: 80 }, (_, i) => flapAngle(tl.open + i * 10, c, tl, 0));
    expect(Math.max(...samples)).toBeGreaterThan(FLAP_OPEN_ANGLE);
    expect(flapAngle(tl.sheet + 1000, c, tl, 3)).toBeCloseTo(FLAP_OPEN_ANGLE);
  });

  it("la hoja sale después de abrir, termina mirando a cámara y se oculta en el pase", () => {
    const tl = arrival3DTimeline("calm");
    expect(sheetMotion(tl.riseStart - 1, tl).visible).toBe(false);
    const done = sheetMotion(tl.riseEnd, tl);
    expect(done).toMatchObject({ visible: true, turn: 1 });
    expect(done.lift).toBeCloseTo(1);
    expect(done.twist).toBeCloseTo(0);
    expect(sheetMotion(tl.fly, tl).visible).toBe(false);
    // En lote salen escalonadas.
    expect(sheetMotion(tl.riseStart + 60, tl, 0).visible).toBe(true);
    expect(sheetMotion(tl.riseStart + 60, tl, 1).visible).toBe(false);
  });

  it("el destello sube y se apaga; el latido sólo en vencido; la cámara llega antes de volar", () => {
    const tl = arrival3DTimeline("overdue");
    expect(burstEnvelope(tl.burst - 1, tl)).toBe(0);
    expect(burstEnvelope(tl.burst + 90, tl)).toBeCloseTo(1);
    expect(burstEnvelope(tl.burst + 1500, tl)).toBeLessThan(0.02);
    expect(alarmPulse(1234, CHOREO_3D.calm)).toBe(0);
    const pulses = Array.from({ length: 40 }, (_, i) => alarmPulse(i * 25, CHOREO_3D.overdue));
    expect(Math.max(...pulses) - Math.min(...pulses)).toBeGreaterThan(0.8);
    expect(cameraDolly(0, CHOREO_3D.overdue, tl)).toBeCloseTo(CHOREO_3D.overdue.dolly);
    expect(cameraDolly(tl.riseEnd, CHOREO_3D.overdue, tl)).toBeCloseTo(0);
    expect(ringProgress(tl.land + 10, CHOREO_3D.overdue, tl, 0)).not.toBeNull();
    expect(ringProgress(tl.land + 10, CHOREO_3D.calm, arrival3DTimeline("calm"), 1)).toBeNull();
  });
});

describe("pase de la hoja 3D a la pantalla", () => {
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
