/**
 * Forma del termo (tumbler de acero de ~30 oz con tapa) y de la taza de
 * cerámica (11 oz con asa), en metros y en el espacio local del modelo:
 * +Y arriba, +Z hacia el frente (vista "Frente"), +X a la izquierda de la
 * pantalla vista de frente… igual que la playera y la gorra.
 *
 * Funciones puras (sin DOM): las usan los modelos (`DrinkwareModel.ts`), la
 * proyección cilíndrica de diseños y los tests de los presets.
 */

export interface DrinkwareShape {
  /** Zona imprimible/grabable del cuerpo (los diseños se recortan fuera). */
  printMinY: number;
  printMaxY: number;
  /** Radio exterior del cuerpo a la altura `y`. */
  radiusAt: (y: number) => number;
  /** Pendiente dr/dy (para la normal de la superficie). */
  slopeAt: (y: number) => number;
}

/* --------------------------------- Termo --------------------------------- */

/** Tumbler cónico: más angosto abajo (cabe en el portavasos). */
export const TERMO = {
  bottomY: -0.105,
  topY: 0.084,
  /** Radio en la base y bajo la tapa. */
  bottomRadius: 0.0365,
  topRadius: 0.0445,
  /** Tapa a presión con corredera. */
  lidHeight: 0.024,
  lidRadius: 0.0458,
} as const;

const termoSlope = (TERMO.topRadius - TERMO.bottomRadius) / (TERMO.topY - TERMO.bottomY);

export const TERMO_SHAPE: DrinkwareShape = {
  printMinY: -0.088,
  printMaxY: 0.074,
  radiusAt: (y) => TERMO.bottomRadius + (Math.min(TERMO.topY, Math.max(TERMO.bottomY, y)) - TERMO.bottomY) * termoSlope,
  slopeAt: () => termoSlope,
};

/**
 * Perfil exterior del cuerpo del termo para `LatheGeometry` (de la base al
 * borde): base redondeada y luego el cono recto.
 */
export function termoBodyProfile(): [number, number][] {
  const { bottomY, topY, bottomRadius } = TERMO;
  const pts: [number, number][] = [[0, bottomY + 0.002]];
  // Fondo ligeramente cóncavo y canto redondeado (r = 4 mm).
  pts.push([bottomRadius * 0.7, bottomY + 0.0005]);
  const rr = 0.004;
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push([bottomRadius - rr + Math.cos(a) * rr, bottomY + rr + Math.sin(a) * rr]);
  }
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const y = bottomY + rr + ((topY - bottomY - rr) * i) / steps;
    pts.push([TERMO_SHAPE.radiusAt(y), y]);
  }
  return pts;
}

/** Perfil de la tapa (aro, cúpula baja y boquilla). */
export function termoLidProfile(): [number, number][] {
  const y0 = TERMO.topY - 0.004;
  const { lidRadius: r, lidHeight: h } = TERMO;
  return [
    [TERMO.topRadius - 0.0008, y0],
    [r, y0 + 0.0015],
    [r + 0.0004, y0 + h * 0.55],
    [r - 0.0006, y0 + h * 0.8],
    [r - 0.003, y0 + h * 0.92],
    [r * 0.75, y0 + h],
    [r * 0.35, y0 + h + 0.0008],
    [0, y0 + h + 0.0008],
  ];
}

/* --------------------------------- Taza ---------------------------------- */

export const TAZA = {
  bottomY: -0.048,
  topY: 0.047,
  radius: 0.041,
  wall: 0.0035,
  /** El asa sale hacia +X (izquierda de quien mira de frente es la pantalla derecha). */
  handleSide: 1,
} as const;

export const TAZA_SHAPE: DrinkwareShape = {
  printMinY: -0.038,
  printMaxY: 0.04,
  // Ligerísimo abombado (0.6 mm) para que no se vea como un tubo.
  radiusAt: (y) => {
    const t = (Math.min(TAZA.topY, Math.max(TAZA.bottomY, y)) - TAZA.bottomY) / (TAZA.topY - TAZA.bottomY);
    return TAZA.radius + Math.sin(t * Math.PI) * 0.0006;
  },
  slopeAt: (y) => {
    const h = TAZA.topY - TAZA.bottomY;
    const t = (Math.min(TAZA.topY, Math.max(TAZA.bottomY, y)) - TAZA.bottomY) / h;
    return (Math.cos(t * Math.PI) * Math.PI * 0.0006) / h;
  },
};

/** Perfil completo de la taza: exterior, borde redondeado e interior. */
export function tazaProfile(): { outer: [number, number][]; inner: [number, number][] } {
  const { bottomY, topY, wall } = TAZA;
  const outer: [number, number][] = [[0, bottomY + 0.003], [TAZA.radius * 0.78, bottomY]];
  const rr = 0.004;
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    const r = TAZA_SHAPE.radiusAt(bottomY + rr);
    outer.push([r - rr + Math.cos(a) * rr, bottomY + rr + Math.sin(a) * rr]);
  }
  for (let i = 1; i <= 30; i++) {
    const y = bottomY + rr + ((topY - bottomY - rr) * i) / 30;
    outer.push([TAZA_SHAPE.radiusAt(y), y]);
  }
  // Borde (labio) redondeado de lado a lado del grosor.
  const inner: [number, number][] = [];
  const rOut = TAZA_SHAPE.radiusAt(topY);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    inner.push([rOut - wall / 2 + (Math.cos(a) * wall) / 2, topY + Math.sin(a) * (wall / 2)]);
  }
  inner.push([rOut - wall, topY - 0.004], [rOut - wall - 0.0004, bottomY + 0.012], [rOut - wall - 0.006, bottomY + 0.0065], [0, bottomY + 0.006]);
  return { outer, inner };
}

/** Línea central del asa (en el plano XY, del lado +X). */
export function tazaHandlePath(): [number, number, number][] {
  const r = TAZA.radius - 0.002;
  const pts: [number, number, number][] = [];
  // Una "C" redondeada: sale arriba, baja y vuelve a entrar abajo.
  const top = 0.03;
  const bottom = -0.026;
  const reach = 0.036;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = Math.PI / 2 - t * Math.PI; // de arriba (+90°) a abajo (−90°)
    const y = (top + bottom) / 2 + (Math.sin(a) * (top - bottom)) / 2;
    const x = r + Math.cos(a) * reach * (0.92 + 0.08 * Math.cos(a));
    pts.push([x * TAZA.handleSide, y, 0]);
  }
  return pts;
}

/* ----------------------- Proyección cilíndrica --------------------------- */

/** Punto y normal de la superficie del cuerpo para (ángulo, y). */
export function surfacePoint(shape: DrinkwareShape, theta: number, y: number, lift = 0) {
  const r = shape.radiusAt(y) + lift;
  const slope = shape.slopeAt(y);
  // Normal del cono: (sinθ, −slope, cosθ) normalizada.
  const len = Math.hypot(1, slope);
  return {
    position: [Math.sin(theta) * r, y, Math.cos(theta) * r] as [number, number, number],
    normal: [Math.sin(theta) / len, -slope / len, Math.cos(theta) / len] as [number, number, number],
  };
}

/**
 * Malla de un diseño "envuelto" sobre el cuerpo: el ancho se mide sobre la
 * superficie (arco), así el arte no se estira hacia los lados como con un
 * proyector plano y puede dar la vuelta completa (taza "Alrededor").
 *
 * Devuelve posiciones, normales y UVs no indexados (triángulos), o null si el
 * diseño cae completamente fuera de la zona imprimible.
 */
export function wrapDecalArrays(
  shape: DrinkwareShape,
  center: { x: number; y: number; z: number },
  rotation: number,
  width: number,
  height: number,
  lift = 0.0004,
  segments = 64,
): { positions: number[]; normals: number[]; uvs: number[] } | null {
  const theta0 = Math.atan2(center.x, center.z);
  const y0 = center.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const segU = Math.max(8, Math.min(segments * 2, Math.ceil((width / 0.004) * 1.2)));
  const segV = Math.max(4, Math.min(segments, Math.ceil(height / 0.004)));
  const cols = segU + 1;
  const grid: { p: [number, number, number]; n: [number, number, number]; uv: [number, number]; y: number }[] = [];
  for (let j = 0; j <= segV; j++) {
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const v = j / segV;
      const s = (u - 0.5) * width;
      const t = (v - 0.5) * height;
      // Giro sobre la superficie desenrollada (positivo = antihorario desde afuera).
      const ds = s * cos - t * sin;
      const dt = s * sin + t * cos;
      const y = y0 + dt;
      const theta = theta0 + ds / shape.radiusAt(y);
      const { position, normal } = surfacePoint(shape, theta, y, lift);
      grid.push({ p: position, n: normal, uv: [u, v], y });
    }
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const inside = (k: number) => grid[k].y >= shape.printMinY && grid[k].y <= shape.printMaxY;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      for (const tri of [
        [a, b, d],
        [a, d, c],
      ]) {
        if (!tri.every(inside)) continue;
        for (const k of tri) {
          positions.push(...grid[k].p);
          normals.push(...grid[k].n);
          uvs.push(...grid[k].uv);
        }
      }
    }
  }
  return positions.length ? { positions, normals, uvs } : null;
}
