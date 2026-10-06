import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { DesignLayer, DesignPlacement } from "@/lib/mockups/types";

/**
 * Decals de diseño: proyectan la imagen del cliente sobre la superficie de la
 * prenda con `DecalGeometry` (lo mismo que usa el `<Decal>` de drei).
 *
 * Reconstruir un decal recorre la geometría de la prenda, así que:
 * - Se pre-filtran los triángulos cercanos al proyector (sopa en caché).
 * - Se descartan los que miran hacia otro lado (no "atraviesa" la manga
 *   hacia el torso ni sale del otro lado de la prenda).
 * - La escena reconstruye como mucho una vez por frame (arrastre).
 */

/** Triángulos de las mallas destino en coordenadas de mundo, listos para filtrar. */
export class TriangleSoup {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly centroids: Float32Array;
  readonly count: number;
  readonly maxEdge: number;

  constructor(meshes: THREE.Mesh[]) {
    const pos: number[] = [];
    const nor: number[] = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      const geo = mesh.geometry;
      const pa = geo.attributes.position;
      const na = geo.attributes.normal;
      const count = geo.index ? geo.index.count : pa.count;
      for (let i = 0; i < count; i++) {
        const k = geo.index ? geo.index.getX(i) : i;
        v.fromBufferAttribute(pa, k).applyMatrix4(mesh.matrixWorld);
        n.fromBufferAttribute(na, k).applyMatrix3(normalMatrix).normalize();
        pos.push(v.x, v.y, v.z);
        nor.push(n.x, n.y, n.z);
      }
    }
    this.positions = new Float32Array(pos);
    this.normals = new Float32Array(nor);
    this.count = this.positions.length / 9;
    this.centroids = new Float32Array(this.count * 3);
    let maxEdge = 0;
    for (let t = 0; t < this.count; t++) {
      const o = t * 9;
      for (let c = 0; c < 3; c++) {
        this.centroids[t * 3 + c] = (this.positions[o + c] + this.positions[o + 3 + c] + this.positions[o + 6 + c]) / 3;
      }
      const e1 = Math.hypot(
        this.positions[o] - this.positions[o + 3],
        this.positions[o + 1] - this.positions[o + 4],
        this.positions[o + 2] - this.positions[o + 5],
      );
      const e2 = Math.hypot(
        this.positions[o] - this.positions[o + 6],
        this.positions[o + 1] - this.positions[o + 7],
        this.positions[o + 2] - this.positions[o + 8],
      );
      maxEdge = Math.max(maxEdge, e1, e2);
    }
    this.maxEdge = maxEdge;
  }

  /** Malla temporal sólo con los triángulos dentro de `radius` de `center`. */
  near(center: THREE.Vector3, radius: number): THREE.Mesh | null {
    const r2 = (radius + this.maxEdge) ** 2;
    const pos: number[] = [];
    const nor: number[] = [];
    for (let t = 0; t < this.count; t++) {
      const dx = this.centroids[t * 3] - center.x;
      const dy = this.centroids[t * 3 + 1] - center.y;
      const dz = this.centroids[t * 3 + 2] - center.z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      for (let k = 0; k < 9; k++) {
        pos.push(this.positions[t * 9 + k]);
        nor.push(this.normals[t * 9 + k]);
      }
    }
    if (pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return new THREE.Mesh(geo); // matrixWorld = identidad: ya está en mundo
  }
}

const _helper = new THREE.Object3D();

/**
 * Orientación del proyector: +Z = normal de la superficie, +Y = "arriba" del
 * diseño (lo más cercano al +Y del mundo) y luego `rotation` alrededor de la
 * normal (positivo = antihorario visto desde afuera).
 */
export function decalOrientation(position: THREE.Vector3, normal: THREE.Vector3, rotation: number): THREE.Euler {
  _helper.position.copy(position);
  _helper.rotation.set(0, 0, 0);
  // En superficies casi horizontales (copa de la gorra) "arriba" = hacia atrás.
  if (Math.abs(normal.y) > 0.96) _helper.up.set(0, 0, -1);
  else _helper.up.set(0, 1, 0);
  _helper.lookAt(position.clone().add(normal));
  _helper.rotateZ(rotation);
  return _helper.rotation.clone();
}

/**
 * Geometría del decal (en mundo) o null si no toca la prenda.
 * `size` = [ancho, alto, profundidad de proyección].
 */
export function buildDecalGeometry(
  soup: TriangleSoup,
  position: THREE.Vector3,
  normal: THREE.Vector3,
  rotation: number,
  size: THREE.Vector3,
): THREE.BufferGeometry | null {
  const source = soup.near(position, size.length() / 2);
  if (!source) return null;
  const geo = new DecalGeometry(source, position, decalOrientation(position, normal, rotation), size);
  source.geometry.dispose();

  // Quita triángulos que miran en contra de la proyección.
  const pa = geo.attributes.position as THREE.BufferAttribute;
  const na = geo.attributes.normal as THREE.BufferAttribute;
  const ua = geo.attributes.uv as THREE.BufferAttribute;
  const keepPos: number[] = [];
  const keepNor: number[] = [];
  const keepUv: number[] = [];
  const n = new THREE.Vector3();
  for (let t = 0; t < pa.count; t += 3) {
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(new THREE.Vector3().fromBufferAttribute(na, t + k));
    if (n.normalize().dot(normal) < 0.15) continue;
    for (let k = 0; k < 3; k++) {
      keepPos.push(pa.getX(t + k), pa.getY(t + k), pa.getZ(t + k));
      keepNor.push(na.getX(t + k), na.getY(t + k), na.getZ(t + k));
      keepUv.push(ua.getX(t + k), ua.getY(t + k));
    }
  }
  geo.dispose();
  if (keepPos.length === 0) return null;
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(keepPos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(keepNor, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(keepUv, 2));
  out.computeBoundingSphere();
  return out;
}

export function samePlacement(a: DesignPlacement, b: DesignPlacement): boolean {
  return (
    a.scale === b.scale &&
    a.rotation === b.rotation &&
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2] &&
    a.normal[0] === b.normal[0] &&
    a.normal[1] === b.normal[1] &&
    a.normal[2] === b.normal[2]
  );
}

const textureLoader = new THREE.TextureLoader();

/** Un diseño sobre la prenda: textura + malla del decal. */
export class DesignDecal {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  layer: DesignLayer;
  dirty = true;
  /** Se resuelve cuando la textura está lista (o falló: no bloquea la exportación). */
  ready: Promise<void> = Promise.resolve();
  private textureUrl = "";
  private disposed = false;

  constructor(layer: DesignLayer, private readonly anisotropy: number, private readonly onChange: () => void) {
    this.layer = layer;
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        roughness: 0.85,
        metalness: 0,
        visible: false,
      }),
    );
    this.mesh.name = `design:${layer.id}`;
    this.mesh.userData.layerId = layer.id;
    this.setLayer(layer);
  }

  setLayer(layer: DesignLayer) {
    const placementChanged = !samePlacement(layer.placement, this.layer.placement) || layer.aspect !== this.layer.aspect;
    this.layer = layer;
    if (placementChanged) this.dirty = true;
    if (layer.dataUrl !== this.textureUrl) this.loadTexture(layer.dataUrl);
  }

  private loadTexture(url: string) {
    this.textureUrl = url;
    this.ready = textureLoader
      .loadAsync(url)
      .then((tex) => {
        if (this.disposed || url !== this.textureUrl) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.anisotropy;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        this.mesh.material.map?.dispose();
        this.mesh.material.map = tex;
        this.mesh.material.visible = true;
        this.mesh.material.needsUpdate = true;
        this.onChange();
      })
      .catch(() => {
        // Imagen ilegible: el diseño simplemente no se pinta.
      });
  }

  /** Tamaño del proyector: ancho = scale, alto = scale / aspect. */
  size(depth: number): THREE.Vector3 {
    const { scale } = this.layer.placement;
    const aspect = this.layer.aspect > 0 ? this.layer.aspect : 1;
    return new THREE.Vector3(scale, scale / aspect, depth);
  }

  dispose() {
    this.disposed = true;
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
  }
}

/** Textura del contorno de selección: borde fino con halo y esquinas marcadas. */
export function createSelectionTexture(color = "#e82687"): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const inset = 10;
    const r = 18;
    const rect = () => {
      ctx.beginPath();
      ctx.roundRect(inset, inset, S - inset * 2, S - inset * 2, r);
    };
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 9;
    rect();
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 12]);
    rect();
    ctx.stroke();
    ctx.setLineDash([]);
    // Esquinas: pequeñas escuadras sólidas.
    ctx.lineWidth = 7;
    const L = 46;
    for (const [x, y, dx, dy] of [
      [inset, inset, 1, 1],
      [S - inset, inset, -1, 1],
      [inset, S - inset, 1, -1],
      [S - inset, S - inset, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * L, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * L);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
