import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  alarmPulse,
  arrival3DTimeline,
  boxPose,
  burstEnvelope,
  cameraDistanceForAspect,
  cameraDolly,
  cameraShake,
  CHOREO_3D,
  fanLayout,
  flapAngle,
  ndcToScreen,
  quadToScreenSheet,
  ringProgress,
  sheetMotion,
  sheetPixelWidth,
  sheetScreenTarget,
  worldWidthForPixels,
  type Arrival3DTimeline,
  type Choreo3D,
  type ScreenSheet,
} from "@/lib/arrival3d";
import type { ArrivalPriority } from "@/lib/packageArrivals";
import { isSoftwareWebGL } from "./runtime";
import { BATCH_BOX, createCardboardBox, SINGLE_BOX, type CardboardBox } from "./cardboardBox";
import {
  createCardboardMaps,
  createGlowSprite,
  createRingSprite,
  createShippingLabel,
  createSidePrint,
  headingFontFamily,
  paintSheetFromDom,
  SHEET_RING_PX,
  type CardboardMaps,
} from "./textures";

/**
 * Escena 3D de la llegada de un paquete (three.js "a pelo": React Three Fiber
 * no anda con el React que trae Next 15). Un solo WebGLRenderer compartido,
 * creado con la primera llegada y reusado por la cola; se libera al salir
 * del Modo TV (`disposeSharedRenderer`).
 *
 * La pose de todo sale de `lib/arrival3d` en función del tiempo transcurrido:
 * si la pestaña se oculta (se pausa el loop) y vuelve, la escena salta al
 * momento correcto en vez de quedar atrasada respecto de los timers.
 */

/** Capa de efectos (partículas, brillos, hojas): la sombra de contacto no la ve. */
const FX_LAYER = 2;
const FOV = 30;
const BASE_DISTANCE = 9;
const LOOK_AT = new THREE.Vector3(0, 1.3, 0);
const CAMERA_HEIGHT = 5;
const MAX_DPR = 1.75;
const PARTICLE_LIFE = 1.5;

interface Shared {
  renderer: THREE.WebGLRenderer;
  env: THREE.Texture;
  maps: CardboardMaps;
  sidePrint: THREE.Texture;
  glow: THREE.Texture;
  ring: THREE.Texture;
  font: string;
}

let shared: Shared | null = null;
/** La llegada que hoy usa el lienzo compartido. */
let owner: object | null = null;

function getShared(): Shared {
  if (shared) return shared;
  // Con WebGL por software (SwiftShader, llvmpipe) se baja la calidad: sin MSAA.
  const renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareWebGL(), alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");
  canvas.addEventListener("webglcontextlost", () => disposeSharedRenderer());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
    }
  });

  shared = {
    renderer,
    env,
    maps: createCardboardMaps(),
    sidePrint: createSidePrint(),
    glow: createGlowSprite(),
    ring: createRingSprite(),
    font: headingFontFamily(),
  };
  return shared;
}

/** Libera el renderer y todo lo compartido (al salir del Modo TV, o si se pierde el contexto). */
export function disposeSharedRenderer() {
  const s = shared;
  if (!s) return;
  shared = null;
  owner = null;
  s.renderer.setAnimationLoop(null);
  s.env.dispose();
  s.maps.outer.dispose();
  s.maps.inner.dispose();
  s.maps.bump.dispose();
  s.sidePrint.dispose();
  s.glow.dispose();
  s.ring.dispose();
  s.renderer.domElement.remove();
  s.renderer.dispose();
  s.renderer.forceContextLoss();
}

export interface ArrivalSceneOptions {
  priority: ArrivalPriority;
  batch: boolean;
  /** Texto grande de la etiqueta ("#9001" o "5 pedidos"). */
  labelTitle: string;
  /** Franja de la etiqueta ("Vencido", "Nuevos"…). */
  labelSubtitle: string;
  /** Hojas DOM (invisibles, ya en página) que se copian a 3D, en orden de abanico. */
  sheets: { root: HTMLElement; color: string }[];
}

export interface ArrivalPlayer {
  /** Arranca el reloj de la escena (t = 0). */
  start(): void;
  /**
   * Pase al DOM: dónde quedó cada hoja en pantalla (rectángulo interior, sin
   * el aro) y las oculta en 3D. La caja sigue hundiéndose sola.
   */
  handoff(): ScreenSheet[];
  /** Opacidad que debe tener el lienzo (se apaga con la caja al final). */
  stop(): void;
}

interface SheetRig {
  group: THREE.Group;
  front: THREE.Mesh;
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Medio ancho / medio alto del rectángulo interior (sin aro), en unidades locales. */
  innerHalf: THREE.Vector2;
  start: THREE.Vector3;
  end: THREE.Vector3;
  qStart: THREE.Quaternion;
  qEnd: THREE.Quaternion;
}

interface Particles {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocity: Float32Array;
  origin: Float32Array;
  spawned: boolean;
}

/**
 * Crea la escena de una llegada sobre `host` (un contenedor fijo a pantalla
 * completa). Lanza si no hay WebGL: el llamador cae a la animación SVG.
 */
export async function createArrivalPlayer(host: HTMLElement, opts: ArrivalSceneOptions): Promise<ArrivalPlayer> {
  const s = getShared();
  const { renderer } = s;
  const c: Choreo3D = CHOREO_3D[opts.priority];
  const tl: Arrival3DTimeline = arrival3DTimeline(opts.priority, opts.batch);
  const disposables: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const scene = new THREE.Scene();
  scene.environment = s.env;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.layers.enable(FX_LAYER);

  // --- Luces: llave cálida, relleno del cielo, contraluz del color de la prioridad.
  scene.add(new THREE.HemisphereLight("#fff6ea", "#2a2522", 0.45));
  const key = new THREE.DirectionalLight("#fff1df", 2.6);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(c.color, 1.6);
  rim.position.set(3.5, 4, -6);
  scene.add(rim);
  const kick = new THREE.DirectionalLight("#dbe7ff", 0.6);
  kick.position.set(5, 2, 3);
  scene.add(kick);
  const burstLight = new THREE.PointLight(c.color, 0, 9, 1.6);
  scene.add(burstLight);

  // --- Caja.
  const dims = opts.batch ? BATCH_BOX : SINGLE_BOX;
  const label = own(
    createShippingLabel({
      title: opts.labelTitle,
      subtitle: opts.labelSubtitle,
      color: c.color,
      font: s.font,
      stamp: opts.priority === "changes" ? "CAMBIOS" : undefined,
    })
  );
  const box: CardboardBox = createCardboardBox({
    dims,
    maps: s.maps,
    sidePrint: s.sidePrint,
    label,
    color: c.color,
    emissive: c.emissive,
  });
  disposables.push(box);
  scene.add(box.root);

  // --- Sombra de contacto: dos manchas suaves en el piso (núcleo oscuro +
  // penumbra) que se abren y aclaran cuando la caja está en el aire. Más
  // barato que renderizar profundidad cada frame y no toca el alfa del lienzo
  // (que es transparente sobre el tablero).
  const shadowGeo = own(new THREE.PlaneGeometry(1, 1));
  const shadowMat = (opacity: number) =>
    own(new THREE.MeshBasicMaterial({ color: "#000000", map: s.glow, transparent: true, opacity, depthWrite: false }));
  const shadowCore = new THREE.Mesh(shadowGeo, shadowMat(0.75));
  const shadowSoft = new THREE.Mesh(shadowGeo, shadowMat(0.4));
  for (const m of [shadowSoft, shadowCore]) {
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.005;
    m.renderOrder = -1;
    scene.add(m);
  }

  // --- Destello en la boca de la caja + ondas en el piso.
  const fxMat = (opacity: number, map: THREE.Texture) =>
    own(
      new THREE.MeshBasicMaterial({
        map,
        color: c.color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
  const planeGeo = own(new THREE.PlaneGeometry(1, 1));
  const flash = new THREE.Mesh(planeGeo, fxMat(0, s.glow));
  flash.layers.set(FX_LAYER);
  scene.add(flash);
  const rings = Array.from({ length: c.rings }, () => {
    const m = new THREE.Mesh(planeGeo, fxMat(0, s.ring));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    m.layers.set(FX_LAYER);
    scene.add(m);
    return m;
  });

  // --- Partículas: chispas que salen de la boca al abrir.
  const particles = createParticles(c, isSoftwareWebGL() ? 0.5 : 1, dims.width, dims.depth, s.glow, own);
  particles.points.layers.set(FX_LAYER);
  scene.add(particles.points);

  // --- Hojas (copiadas del DOM con la fuente de la app).
  const painted = await Promise.all(opts.sheets.map((sh) => paintSheetFromDom(sh.root, sh.color)));
  painted.forEach((p) => disposables.push(p.texture));

  let width = 0;
  let height = 0;
  let distance = BASE_DISTANCE;
  const finalCamera = new THREE.Vector3();
  const sheets: SheetRig[] = painted.map((p) => {
    const group = new THREE.Group();
    group.layers.set(FX_LAYER);
    const frontMat = own(
      new THREE.MeshBasicMaterial({ map: p.texture, transparent: true, toneMapped: false, side: THREE.FrontSide })
    );
    const backMat = own(new THREE.MeshStandardMaterial({ color: "#f3f0ea", roughness: 0.8, side: THREE.BackSide }));
    const geo = own(new THREE.PlaneGeometry(1, p.height / p.width));
    const front = new THREE.Mesh(geo, frontMat);
    const back = new THREE.Mesh(geo, backMat);
    front.layers.set(FX_LAYER);
    back.layers.set(FX_LAYER);
    const glow = new THREE.Mesh(planeGeo, fxMat(0, s.glow));
    glow.position.z = -0.03;
    glow.layers.set(FX_LAYER);
    group.add(glow, back, front);
    group.visible = false;
    scene.add(group);
    const innerW = (p.width - SHEET_RING_PX * 2) / p.width;
    const innerH = ((p.height - SHEET_RING_PX * 2) / p.width) * 1;
    return {
      group,
      front,
      glow,
      innerHalf: new THREE.Vector2(innerW / 2, innerH / 2),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      qStart: new THREE.Quaternion(),
      qEnd: new THREE.Quaternion(),
    };
  });

  /** Tamaño, cámara y destino de cada hoja según el viewport actual. */
  const layout = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    distance = cameraDistanceForAspect(camera.aspect, BASE_DISTANCE, FOV, opts.batch ? 6.2 : 4.6);
    camera.updateProjectionMatrix();
    finalCamera.set(0, CAMERA_HEIGHT, distance);

    // La hoja termina en un punto fijo de la PANTALLA (no del mundo): a
    // cualquier tamaño/proporción queda entera, legible y arriba de la caja.
    const n = sheets.length;
    const px = sheetPixelWidth(width, opts.batch, n);
    const fan = fanLayout(n);
    const target = sheetScreenTarget(opts.batch);
    const finalCam = camera.clone();
    finalCam.position.copy(finalCamera);
    finalCam.lookAt(LOOK_AT);
    finalCam.updateMatrixWorld(true);
    const dummy = new THREE.Object3D();
    sheets.forEach((rig, i) => {
      const f = fan[i];
      const ndcX = (f.offset * px * 2) / width;
      const ndcY = 1 - 2 * target.y;
      const dir = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(finalCam).sub(finalCamera).normalize();
      const d = target.distance - f.depth;
      rig.end.copy(finalCamera).addScaledVector(dir, d);
      const sheetW = worldWidthForPixels(px, d, FOV, height) / (rig.innerHalf.x * 2);
      rig.group.scale.setScalar(sheetW);
      rig.start.set(f.offset * 0.25, dims.height * 0.45, 0);
      dummy.position.copy(rig.end);
      dummy.lookAt(finalCamera);
      dummy.rotateZ(f.angle);
      rig.qEnd.copy(dummy.quaternion);
      rig.qStart.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, f.angle * 2 + 0.3));
      rig.glow.scale.set(1.5, (rig.innerHalf.y * 2) / (rig.innerHalf.x * 2) + 0.5, 1);
    });
  };
  layout();

  let startAt = 0;
  let running = false;
  let handedOff = false;
  const tmp = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  const frame = () => {
    const ms = performance.now() - startAt;
    const t = ms / 1000;

    // Cámara: acercamiento lento + temblor al aterrizar.
    const dolly = cameraDolly(ms, c, tl);
    const shake = cameraShake(ms, c, tl);
    camera.position.set(0, CAMERA_HEIGHT + shake + dolly * 0.25, distance + dolly);
    lookAt.copy(LOOK_AT).setY(LOOK_AT.y + shake * 0.5);
    camera.lookAt(lookAt);

    // Caja.
    const pose = boxPose(ms, c, tl);
    box.root.position.set(pose.x, pose.y, 0);
    box.root.rotation.set(0, pose.rotY, pose.rotZ);
    box.body.scale.set(pose.sx, pose.sy, pose.sz);
    box.flaps.forEach((f, i) => {
      const a = flapAngle(ms, c, tl, i) * f.sign;
      if (f.axis === "x") f.hinge.rotation.x = a;
      else f.hinge.rotation.z = a;
    });
    const pulse = alarmPulse(ms, c);
    box.tape.emissiveIntensity = c.emissive + pulse * 1.4;
    rim.intensity = 1.6 + pulse * 1.8;
    host.style.opacity = String(pose.opacity);

    // Destello y luz de la apertura.
    const burst = burstEnvelope(ms, tl) * c.burst;
    burstLight.position.set(pose.x, dims.height + 0.4, 0.3);
    burstLight.intensity = burst * 40;
    flash.position.set(pose.x, dims.height + 0.15, 0);
    flash.quaternion.copy(camera.quaternion);
    flash.scale.setScalar(1.2 + burst * 4.5);
    flash.material.opacity = Math.min(1, burst * 0.9);

    rings.forEach((ring, i) => {
      const u = ringProgress(ms, c, tl, i);
      ring.visible = u != null;
      if (u == null) return;
      ring.position.x = pose.x;
      ring.scale.setScalar(dims.width * (0.9 + u * 2.6));
      ring.material.opacity = (1 - u) ** 2 * 0.9;
    });

    updateParticles(particles, ms, tl, c, box.root.position.x, dims.height);

    // Hojas.
    sheets.forEach((rig, i) => {
      const m = sheetMotion(ms, tl, i);
      rig.group.visible = m.visible && !handedOff;
      if (!rig.group.visible) return;
      // Sube primero (sale de la caja) y recién después viene hacia la cámara.
      const forward = Math.min(1, Math.max(0, (m.lift - 0.25) / 0.75));
      tmp.set(
        rig.start.x + (rig.end.x - rig.start.x) * m.lift,
        // Arco: sube un poco más de la cuenta mientras sale y se asienta en su lugar.
        rig.start.y + (rig.end.y - rig.start.y) * m.lift + 0.45 * Math.sin(Math.PI * Math.min(1, m.lift)),
        rig.start.z + (rig.end.z - rig.start.z) * forward
      );
      // Flota apenas mientras se lee.
      tmp.y += Math.sin(t * 2.2 + i) * 0.025 * m.turn;
      rig.group.position.copy(tmp);
      rig.group.quaternion.slerpQuaternions(rig.qStart, rig.qEnd, m.turn);
      rig.group.rotateZ(m.twist);
      rig.glow.material.opacity = m.turn * (0.45 + pulse * 0.4);
    });

    // Sombra: más grande y clara cuanto más alta está la caja.
    const air = Math.max(0, pose.y);
    const spread = 1 + air * 0.22;
    const fade = 1 / (1 + air * 0.9);
    shadowCore.position.x = shadowSoft.position.x = pose.x;
    shadowCore.rotation.z = shadowSoft.rotation.z = pose.rotY;
    shadowCore.scale.set(dims.width * 1.25 * spread * pose.sx, dims.depth * 1.3 * spread * pose.sz, 1);
    shadowSoft.scale.set(dims.width * 2.1 * spread, dims.depth * 2.3 * spread, 1);
    shadowCore.material.opacity = 0.8 * fade;
    shadowSoft.material.opacity = 0.45 * fade;

    renderer.render(scene, camera);
  };

  const onResize = () => layout();
  const onVisibility = () => {
    if (!running || owner !== token) return;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  };

  // Shaders compilados antes de arrancar: sin tirones en los primeros frames.
  sheets.forEach((r) => (r.group.visible = true));
  await renderer.compileAsync(scene, camera);
  sheets.forEach((r) => (r.group.visible = false));

  const token = {};
  return {
    start() {
      // El lienzo es uno solo: la llegada que arranca se lo queda.
      owner = token;
      host.appendChild(renderer.domElement);
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      layout();
      startAt = performance.now();
      running = true;
      frame();
      if (!document.hidden) renderer.setAnimationLoop(frame);
    },
    handoff() {
      if (!running) return [];
      // La pose de este instante (la cámara ya terminó el acercamiento).
      frame();
      const rect = host.getBoundingClientRect();
      const viewport = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      const out = sheets.map((rig) => {
        rig.front.updateMatrixWorld(true);
        const { x, y } = rig.innerHalf;
        const corners = [
          [-x, y],
          [x, y],
          [x, -y],
          [-x, -y],
        ].map(([cx, cy]) => {
          const v = new THREE.Vector3(cx, cy, 0).applyMatrix4(rig.front.matrixWorld).project(camera);
          return ndcToScreen({ x: v.x, y: v.y }, viewport);
        }) as [ReturnType<typeof ndcToScreen>, ReturnType<typeof ndcToScreen>, ReturnType<typeof ndcToScreen>, ReturnType<typeof ndcToScreen>];
        return quadToScreenSheet(corners);
      });
      handedOff = true;
      return out;
    },
    stop() {
      running = false;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      // Una escena que nunca arrancó (o ya fue reemplazada) no toca el lienzo de otra.
      if (owner === token) {
        owner = null;
        renderer.setAnimationLoop(null);
        if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      }
      disposables.forEach((d) => d.dispose());
      renderer.renderLists.dispose();
    },
  };
}

function createParticles(
  c: Choreo3D,
  density: number,
  boxW: number,
  boxD: number,
  sprite: THREE.Texture,
  own: <T extends { dispose: () => void }>(x: T) => T
): Particles {
  const n = Math.round(c.particles * density);
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const velocity = new Float32Array(n * 3);
  const origin = new Float32Array(n * 3);
  const base = new THREE.Color(c.color);
  const white = new THREE.Color("#ffffff");
  const tmp = new THREE.Color();
  // Determinista (mismo estallido en cada llegada de la misma prioridad).
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    origin[i * 3] = (rand() - 0.5) * boxW * 0.8;
    origin[i * 3 + 1] = 0;
    origin[i * 3 + 2] = (rand() - 0.5) * boxD * 0.7;
    const angle = rand() * Math.PI * 2;
    const spread = 0.25 + rand() * 0.55;
    const speed = c.particleSpeed * (0.55 + rand() * 0.6);
    velocity[i * 3] = Math.cos(angle) * spread * speed;
    velocity[i * 3 + 1] = speed * (0.75 + rand() * 0.5);
    velocity[i * 3 + 2] = Math.sin(angle) * spread * speed * 0.8 + 0.6;
    tmp.copy(base).lerp(white, rand() * 0.55);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    positions.set([0, -10, 0], i * 3);
  }
  const geo = own(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = own(
    new THREE.PointsMaterial({
      size: 0.18,
      map: sprite,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      opacity: 0,
    })
  );
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, velocity, origin, spawned: false };
}

function updateParticles(p: Particles, ms: number, tl: Arrival3DTimeline, c: Choreo3D, boxX: number, mouthY: number) {
  const age = (ms - tl.burst) / 1000;
  const mat = p.points.material;
  if (age < 0 || age > PARTICLE_LIFE) {
    mat.opacity = 0;
    p.points.visible = false;
    return;
  }
  p.points.visible = true;
  mat.opacity = Math.min(1, (1 - age / PARTICLE_LIFE) * 1.4);
  mat.size = 0.18 * (1 - age / PARTICLE_LIFE * 0.6);
  const pos = p.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  const g = -7.5;
  // Arrastre del aire: las chispas frenan y caen.
  const drag = Math.exp(-age * 1.1);
  const n = arr.length / 3;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    // Salida escalonada (no todas en el mismo frame).
    const delay = (i % 7) * 0.012;
    const a = Math.max(0, age - delay);
    arr[k] = boxX + p.origin[k] + p.velocity[k] * a * drag;
    arr[k + 1] = mouthY + p.velocity[k + 1] * a * drag + 0.5 * g * a * a;
    arr[k + 2] = p.origin[k + 2] + p.velocity[k + 2] * a * drag;
  }
  pos.needsUpdate = true;
  void c;
}
