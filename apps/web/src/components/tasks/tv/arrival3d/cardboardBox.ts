import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { CardboardMaps } from "./textures";

/**
 * Caja de cartón procedural (sin modelos descargados): cinco paredes con
 * canto redondeado, cuatro solapas con bisagra en el borde de arriba, cinta
 * cortada en el medio (una mitad por solapa larga, más los tramos que bajan
 * por los costados), etiqueta de envío y marcas impresas.
 *
 * Espacio local: base de la caja en y=0, frente hacia +Z (la cámara), metros
 * "de escena". El pivote está en la base para que el aplastón no la despegue
 * del piso.
 */

export interface BoxDims {
  width: number;
  height: number;
  depth: number;
}

export const SINGLE_BOX: BoxDims = { width: 2, height: 1.35, depth: 1.5 };
/** La caja grande de los lotes ("N pedidos nuevos"). */
export const BATCH_BOX: BoxDims = { width: 2.8, height: 1.55, depth: 1.9 };

const WALL = 0.045;

export interface CardboardBox {
  /** Raíz: posición y giros de la pose. */
  root: THREE.Group;
  /** Hijo que se escala (aplastón/estirón) desde la base. */
  body: THREE.Group;
  /** Bisagras en orden de apertura: frente, atrás (las largas, con cinta), izquierda, derecha. */
  flaps: { hinge: THREE.Group; axis: "x" | "z"; sign: 1 | -1 }[];
  /** Material de la cinta (el emisivo late en "vencido"). */
  tape: THREE.MeshStandardMaterial;
  dims: BoxDims;
  dispose: () => void;
}

interface BoxOptions {
  dims: BoxDims;
  maps: CardboardMaps;
  sidePrint: THREE.Texture;
  label: THREE.Texture;
  color: string;
  emissive: number;
}

export function createCardboardBox({ dims, maps, sidePrint, label, color, emissive }: BoxOptions): CardboardBox {
  const { width: W, height: H, depth: D } = dims;
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T): T => {
    owned.push(x);
    return x;
  };

  const outer = own(
    new THREE.MeshStandardMaterial({
      map: maps.outer,
      bumpMap: maps.bump,
      bumpScale: 1.2,
      roughness: 0.88,
      metalness: 0,
    })
  );
  // Adentro: más oscuro (oclusión "a mano", sin AO horneado).
  const inner = own(
    new THREE.MeshStandardMaterial({ map: maps.inner, roughness: 0.95, metalness: 0, color: "#e2d6c6" })
  );
  const tape = own(
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.32,
      metalness: 0.05,
      emissive: new THREE.Color(color),
      emissiveIntensity: emissive,
    })
  );

  const root = new THREE.Group();
  root.name = "caja";
  const body = new THREE.Group();
  root.add(body);

  // Orden de materiales de BoxGeometry: +x, −x, +y, −y, +z, −z.
  const wall = (w: number, h: number, d: number, faces: THREE.Material[]) => {
    const geo = own(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.45));
    const mesh = new THREE.Mesh(geo, faces);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Paredes: la cara de afuera kraft, la de adentro oscura.
  const front = wall(W, H, WALL, [outer, outer, outer, outer, outer, inner]);
  front.position.set(0, H / 2, D / 2 - WALL / 2);
  const back = wall(W, H, WALL, [outer, outer, outer, outer, inner, outer]);
  back.position.set(0, H / 2, -D / 2 + WALL / 2);
  const left = wall(WALL, H, D - WALL * 2, [inner, outer, outer, outer, outer, outer]);
  left.position.set(-W / 2 + WALL / 2, H / 2, 0);
  const right = wall(WALL, H, D - WALL * 2, [outer, inner, outer, outer, outer, outer]);
  right.position.set(W / 2 - WALL / 2, H / 2, 0);
  const bottom = wall(W - WALL * 2, WALL, D - WALL * 2, [outer, outer, inner, outer, outer, outer]);
  bottom.position.set(0, WALL / 2, 0);
  body.add(front, back, left, right, bottom);

  // Solapas: bisagra en el borde de arriba; cerrada, apunta hacia adentro.
  const flapDepth = D / 2 - 0.004;
  const flaps: CardboardBox["flaps"] = [];
  const makeFlap = (
    length: number,
    hingePos: THREE.Vector3,
    along: "x" | "z",
    inward: 1 | -1,
    lift: number,
    withTape: boolean
  ) => {
    const hinge = new THREE.Group();
    hinge.position.copy(hingePos);
    const isFrontBack = along === "x";
    const geo = own(
      new RoundedBoxGeometry(isFrontBack ? length : flapDepth, WALL * 0.9, isFrontBack ? flapDepth : length, 2, WALL * 0.4)
    );
    const flap = new THREE.Mesh(geo, [outer, outer, outer, inner, outer, outer]);
    flap.castShadow = true;
    const offset = (flapDepth / 2) * inward;
    if (isFrontBack) flap.position.set(0, lift, offset);
    else flap.position.set(offset, lift, 0);
    hinge.add(flap);
    if (withTape) {
      // Media cinta: la mitad que queda pegada a esta solapa al cortarla.
      const tapeW = 0.17;
      const tapeGeo = own(new THREE.BoxGeometry(W * 0.999, 0.006, tapeW / 2));
      const strip = new THREE.Mesh(tapeGeo, tape);
      strip.position.set(0, lift + WALL * 0.45 + 0.003, (flapDepth - tapeW / 4) * inward);
      hinge.add(strip);
    }
    body.add(hinge);
    return hinge;
  };

  // Las largas (frente/atrás) van encima, con la cinta; las cortas, debajo.
  const outerLift = WALL * 1.4;
  const innerLift = WALL * 0.45;
  const fFront = makeFlap(W, new THREE.Vector3(0, H, D / 2 - WALL / 2), "x", -1, outerLift, true);
  const fBack = makeFlap(W, new THREE.Vector3(0, H, -D / 2 + WALL / 2), "x", 1, outerLift, true);
  const fLeft = makeFlap(D - WALL * 2, new THREE.Vector3(-W / 2 + WALL / 2, H, 0), "z", 1, innerLift, false);
  const fRight = makeFlap(D - WALL * 2, new THREE.Vector3(W / 2 - WALL / 2, H, 0), "z", -1, innerLift, false);
  // Frente abre girando en +x; atrás en −x; izquierda en +z; derecha en −z.
  flaps.push({ hinge: fFront, axis: "x", sign: 1 }, { hinge: fBack, axis: "x", sign: -1 });
  flaps.push({ hinge: fLeft, axis: "z", sign: 1 }, { hinge: fRight, axis: "z", sign: -1 });

  // Tramos de cinta que bajan por los costados (quedan en la caja al abrir).
  const sideTapeGeo = own(new THREE.BoxGeometry(0.006, 0.42, 0.17));
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(sideTapeGeo, tape);
    t.position.set(sx * (W / 2 + 0.003), H - 0.21 + WALL, 0);
    body.add(t);
  }

  // Etiqueta de envío al frente y marcas en los costados (calcos).
  const labelMat = own(
    new THREE.MeshStandardMaterial({
      map: label,
      transparent: true,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  const labelW = Math.min(W * 0.52, 1.25);
  const labelGeo = own(new THREE.PlaneGeometry(labelW, labelW * (400 / 640)));
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(-W * 0.12, H * 0.47, D / 2 + 0.002);
  labelMesh.rotation.z = 0.025;
  body.add(labelMesh);

  const printMat = own(
    new THREE.MeshStandardMaterial({
      map: sidePrint,
      transparent: true,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  const printGeo = own(new THREE.PlaneGeometry(D * 0.8, D * 0.8));
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(printGeo, printMat);
    p.position.set(sx * (W / 2 + 0.002), H * 0.52, 0);
    p.rotation.y = (sx * Math.PI) / 2;
    body.add(p);
  }
  // También al frente, a la derecha de la etiqueta.
  const frontPrint = new THREE.Mesh(printGeo, printMat);
  frontPrint.scale.setScalar(0.55);
  frontPrint.position.set(W * 0.32, H * 0.62, D / 2 + 0.002);
  body.add(frontPrint);

  return {
    root,
    body,
    flaps,
    tape,
    dims,
    dispose: () => owned.forEach((o) => o.dispose()),
  };
}
