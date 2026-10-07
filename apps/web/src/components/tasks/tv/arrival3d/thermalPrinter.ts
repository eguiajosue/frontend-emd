import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Impresora térmica de tickets procedural (sin modelos descargados): cuerpo
 * de plástico oscuro con cantos redondeados, tapa clara con su junta, ranura
 * de salida con barra de corte dentada, guillotina, LED de estado, botón de
 * avance y logo en relieve.
 *
 * Espacio local: base en y=0, frente hacia +Z (la cámara), unidades "de
 * escena". El pivote está en la base para que el aplastón no la despegue del
 * piso. El papel sale por `slot` en la dirección `feedDir` (hacia arriba,
 * apenas inclinado hacia atrás, con la cara impresa hacia el frente).
 */

export const PRINTER = {
  width: 2.3,
  height: 0.92,
  depth: 1.8,
  /** Ancho útil de la ranura (el papel entra justo). */
  slotWidth: 1.72,
} as const;

/** Inclinación hacia atrás del papel al salir (rad). */
export const FEED_TILT = 0.2;

export interface ThermalPrinter {
  /** Raíz: posición y giros de la pose. */
  root: THREE.Group;
  /** Hijo que se escala (aplastón/estirón) desde la base. */
  body: THREE.Group;
  /** Marco de la ranura: origen en la boca, +Y = dirección del papel, +Z = cara impresa. */
  feedFrame: THREE.Object3D;
  /** Cuchilla de la guillotina (se mueve en x del marco de la ranura). */
  blade: THREE.Mesh;
  /** Material del LED (el emisivo sigue a `ledLevel`). */
  led: THREE.MeshStandardMaterial;
  /** Punto del LED (para el halo) en coordenadas de `body`. */
  ledAnchor: THREE.Object3D;
  dispose: () => void;
}

export function createThermalPrinter(opts: { color: string; logo: THREE.Texture }): ThermalPrinter {
  const { width: W, height: H, depth: D } = PRINTER;
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const mat = own;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shell = mat(
    new THREE.MeshPhysicalMaterial({ color: "#23272e", roughness: 0.48, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45 })
  );
  const cover = mat(
    new THREE.MeshPhysicalMaterial({ color: "#b9bec6", roughness: 0.36, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 })
  );
  const rubber = mat(new THREE.MeshStandardMaterial({ color: "#101215", roughness: 0.92 }));
  const gap = mat(new THREE.MeshStandardMaterial({ color: "#07080a", roughness: 0.8 }));
  const steel = mat(new THREE.MeshStandardMaterial({ color: "#c7ccd4", roughness: 0.26, metalness: 1 }));
  const button = mat(new THREE.MeshPhysicalMaterial({ color: "#3b414b", roughness: 0.4, clearcoat: 0.4 }));
  const led = mat(
    new THREE.MeshStandardMaterial({ color: "#1b1d22", emissive: new THREE.Color(opts.color), emissiveIntensity: 0.3, roughness: 0.2 })
  );
  const logo = mat(
    new THREE.MeshStandardMaterial({ map: opts.logo, transparent: true, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  );

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(own(geo), m);
    mesh.position.set(x, y, z);
    body.add(mesh);
    return mesh;
  };

  // Cuerpo: base de goma, carcasa oscura.
  add(new RoundedBoxGeometry(W - 0.06, 0.1, D - 0.06, 2, 0.04), rubber, 0, 0.05, 0);
  add(new RoundedBoxGeometry(W, H - 0.06, D, 5, 0.16), shell, 0, 0.06 + (H - 0.06) / 2, 0);

  // Tapa del rollo (los dos tercios de atrás), apenas más alta, con su junta.
  const coverD = D * 0.64;
  const coverZ = -D / 2 + coverD / 2 + 0.02;
  const coverTop = H + 0.2;
  add(new RoundedBoxGeometry(W - 0.05, 0.05, coverD + 0.02, 2, 0.02), gap, 0, H - 0.01, coverZ);
  add(new RoundedBoxGeometry(W - 0.08, coverTop - H + 0.06, coverD, 5, 0.12), cover, 0, H + (coverTop - H) / 2 - 0.03, coverZ);

  // Ranura de salida (entre el frente de la tapa y el labio) y barra de corte dentada.
  const slotZ = coverZ + coverD / 2 + 0.07;
  add(new THREE.BoxGeometry(PRINTER.slotWidth + 0.08, 0.05, 0.1), gap, 0, H - 0.005, slotZ);
  add(new RoundedBoxGeometry(PRINTER.slotWidth + 0.14, 0.05, 0.07, 2, 0.02), steel, 0, H + 0.01, slotZ + 0.085);
  const teeth = 36;
  const toothGeo = own(new THREE.ConeGeometry(0.022, 0.05, 4));
  const toothMesh = new THREE.InstancedMesh(toothGeo, steel, teeth);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < teeth; i++) {
    const x = -PRINTER.slotWidth / 2 + (i + 0.5) * (PRINTER.slotWidth / teeth);
    m4.makeTranslation(x, H + 0.055, slotZ + 0.075);
    toothMesh.setMatrixAt(i, m4);
  }
  body.add(toothMesh);

  // Marco del papel: en la boca de la ranura, inclinado hacia atrás.
  const feedFrame = new THREE.Object3D();
  feedFrame.position.set(0, H + 0.02, slotZ);
  feedFrame.rotation.x = -FEED_TILT;
  body.add(feedFrame);

  // Guillotina: hoja de acero fina que cruza la boca de lado a lado al cortar.
  const blade = new THREE.Mesh(own(new THREE.BoxGeometry(0.42, 0.018, 0.05)), steel);
  blade.position.set(-PRINTER.slotWidth / 2 - 0.3, 0.02, 0.02);
  feedFrame.add(blade);

  // Frente: LED de estado, botón de avance y logo.
  const front = D / 2;
  const ledMesh = new THREE.Mesh(own(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 20)), led);
  ledMesh.rotation.x = Math.PI / 2;
  ledMesh.position.set(-W / 2 + 0.34, H * 0.55, front + 0.005);
  body.add(ledMesh);
  const ledAnchor = new THREE.Object3D();
  ledAnchor.position.set(-W / 2 + 0.34, H * 0.55, front + 0.05);
  body.add(ledAnchor);
  add(new RoundedBoxGeometry(0.3, 0.11, 0.05, 2, 0.03), button, -W / 2 + 0.66, H * 0.55, front + 0.005);
  const logoMesh = add(new THREE.PlaneGeometry(0.72, 0.18), logo, W / 2 - 0.62, H * 0.55, front + 0.003);
  logoMesh.renderOrder = 1;

  return {
    root,
    body,
    feedFrame,
    blade,
    led,
    ledAnchor,
    dispose: () => owned.forEach((o) => o.dispose()),
  };
}
