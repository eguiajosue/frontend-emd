import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  alarmPulse,
  bladeTravel,
  cameraDistanceForAspect,
  cameraDolly,
  cameraShake,
  CHOREO_3D,
  cutFlash,
  fanLayout,
  ledLevel,
  ndcToScreen,
  paperCurlOffset,
  printerPose,
  printTimeline,
  quadToScreenSheet,
  sheetPixelWidth,
  sheetScreenTarget,
  ticketMotion,
  worldWidthForPixels,
  type PrintTimeline,
  type PrinterChoreo,
  type ScreenSheet,
} from "@/lib/arrival3d";
import type { ArrivalPriority } from "@/lib/packageArrivals";
import { isSoftwareWebGL } from "./runtime";
import { createGlowSprite, createLogoTexture, headingFontFamily, paintTicketFromDom } from "./textures";
import { createThermalPrinter, PRINTER } from "./thermalPrinter";

/**
 * Escena 3D de la llegada de un pedido (three.js "a pelo": React Three Fiber
 * no anda con el React que trae Next 15): una impresora térmica entra, imprime
 * el ticket, lo corta y el ticket sube hasta mirar a la cámara. Un solo
 * WebGLRenderer compartido, creado al precalentar y reusado por la cola; se
 * libera al salir del Modo TV (`disposeSharedRenderer`).
 *
 * La pose de todo sale de `lib/arrival3d` en función del tiempo transcurrido:
 * si la pestaña se oculta (se pausa el loop) y vuelve, la escena salta al
 * momento correcto en vez de quedar atrasada respecto de los timers.
 */

const FOV = 30;
const BASE_DISTANCE = 9.2;
const LOOK_AT = new THREE.Vector3(0, 1.35, 0);
const CAMERA_HEIGHT = 4.6;
/** Giro de la impresora en reposo: tres cuartos, para que se lea el volumen. */
const REST_YAW = -0.32;
const MAX_DPR = 1.75;
/** Ancho del papel (mundo) mientras sale por la ranura. */
const FEED_WIDTH = PRINTER.slotWidth - 0.14;
/** Subdivisiones a lo largo del papel (para curvarlo). */
const PAPER_SEGMENTS = 24;
const CHIP_LIFE = 1.3;
/** Un plano de recorte que no recorta nada (el ticket ya cortado vuela libre). */
const NO_CLIP = 1e6;

interface Shared {
  renderer: THREE.WebGLRenderer;
  env: THREE.Texture;
  glow: THREE.Texture;
  logo: THREE.Texture;
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
  // El papel se recorta en la boca de la ranura: lo que sale ya está impreso.
  renderer.localClippingEnabled = true;
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

  shared = { renderer, env, glow: createGlowSprite(), logo: createLogoTexture(headingFontFamily()) };
  return shared;
}

/** Escena de precalentamiento: mantiene vivos los programas compilados hasta la primera llegada. */
let warmPlayer: ArrivalPlayer | null = null;
let warming: Promise<void> | null = null;

/**
 * Precalienta la escena con la tele abierta y en reposo: crea el renderer
 * compartido, hornea el entorno y compila los shaders de la impresora, el
 * papel (con un ticket en blanco), los papelitos y los brillos. En una GPU
 * floja (o WebGL por software) eso son segundos; así la primera impresora
 * aparece enseguida en vez de esperar.
 */
export function prewarmArrivalScene(): Promise<void> {
  if (warmPlayer || (shared && !warming)) return Promise.resolve();
  if (!warming) {
    warming = createArrivalPlayer(document.createElement("div"), { priority: "overdue", batch: false, sheets: [], blankTicket: true })
      .then((p) => {
        warmPlayer = p;
      })
      .finally(() => {
        warming = null;
      });
  }
  return warming;
}

/** Libera el renderer y todo lo compartido (al salir del Modo TV, o si se pierde el contexto). */
export function disposeSharedRenderer() {
  warmPlayer?.stop();
  warmPlayer = null;
  const s = shared;
  if (!s) return;
  shared = null;
  owner = null;
  s.renderer.setAnimationLoop(null);
  s.env.dispose();
  s.glow.dispose();
  s.logo.dispose();
  s.renderer.domElement.remove();
  s.renderer.dispose();
  s.renderer.forceContextLoss();
}

export interface ArrivalSceneOptions {
  priority: ArrivalPriority;
  batch: boolean;
  /** Tickets DOM (invisibles, ya en página) que se copian a 3D, en orden de impresión. */
  sheets: { root: HTMLElement }[];
  /** Precalentamiento: un ticket en blanco para compilar los shaders del papel. */
  blankTicket?: boolean;
}

export interface ArrivalPlayer {
  /** Arranca el reloj de la escena (t = 0). */
  start(): void;
  /**
   * Pase al DOM: dónde quedó cada ticket en pantalla y los oculta en 3D. La
   * impresora sigue hundiéndose sola.
   */
  handoff(): ScreenSheet[];
  stop(): void;
}

interface TicketRig {
  group: THREE.Group;
  front: THREE.Mesh;
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  frontMat: THREE.MeshBasicMaterial;
  geo: THREE.PlaneGeometry;
  base: Float32Array;
  /** Alto / ancho del ticket (el ancho local es 1). */
  aspect: number;
  /** Recorte en la boca de la ranura (propio: cada ticket se suelta en su corte). */
  clip: THREE.Plane;
  end: THREE.Vector3;
  qEnd: THREE.Quaternion;
  endScale: number;
  lastCurl: number;
  lastFed: number;
}

interface Chips {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocity: Float32Array;
  origin: Float32Array;
}

/**
 * Crea la escena de una llegada sobre `host` (un contenedor fijo a pantalla
 * completa). Lanza si no hay WebGL: el llamador cae a la animación SVG.
 */
export async function createArrivalPlayer(host: HTMLElement, opts: ArrivalSceneOptions): Promise<ArrivalPlayer> {
  const s = getShared();
  const { renderer } = s;
  const c: PrinterChoreo = CHOREO_3D[opts.priority];
  const count = Math.max(1, opts.sheets.length);
  const tl: PrintTimeline = printTimeline(opts.priority, opts.batch, count);
  const disposables: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const scene = new THREE.Scene();
  scene.environment = s.env;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);

  // --- Luces: llave cálida, relleno del cielo, contraluz del color de la prioridad.
  scene.add(new THREE.HemisphereLight("#fff6ea", "#22252b", 0.5));
  const key = new THREE.DirectionalLight("#fff1df", 2.4);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(c.color, 1.6);
  rim.position.set(3.5, 4, -6);
  scene.add(rim);
  const kick = new THREE.DirectionalLight("#dbe7ff", 0.7);
  kick.position.set(5, 2, 3);
  scene.add(kick);
  // Luz del LED (tiñe el frente) y del corte (destello en la boca).
  const ledLight = new THREE.PointLight(c.color, 0, 2.2, 2);
  scene.add(ledLight);
  const cutLight = new THREE.PointLight(c.color, 0, 4, 1.8);
  scene.add(cutLight);

  // --- Impresora.
  const printer = createThermalPrinter({ color: c.color, logo: s.logo });
  disposables.push(printer);
  scene.add(printer.root);

  // --- Sombra de contacto: dos manchas suaves en el piso (núcleo oscuro +
  // penumbra) que se abren y aclaran cuando la impresora está en el aire. Más
  // barato que renderizar profundidad cada frame y no toca el alfa del lienzo.
  const planeGeo = own(new THREE.PlaneGeometry(1, 1));
  const shadowMat = (opacity: number) =>
    own(new THREE.MeshBasicMaterial({ color: "#000000", map: s.glow, transparent: true, opacity, depthWrite: false }));
  const shadowCore = new THREE.Mesh(planeGeo, shadowMat(0.8));
  const shadowSoft = new THREE.Mesh(planeGeo, shadowMat(0.45));
  for (const m of [shadowSoft, shadowCore]) {
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.005;
    m.renderOrder = -1;
    scene.add(m);
  }

  // --- Brillos aditivos: halo del LED y destello del corte.
  const fxMat = (opacity: number) =>
    own(
      new THREE.MeshBasicMaterial({
        map: s.glow,
        color: c.color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
  const ledHalo = new THREE.Mesh(planeGeo, fxMat(0));
  scene.add(ledHalo);
  const flash = new THREE.Mesh(planeGeo, fxMat(0));
  flash.position.set(0, 0.05, 0.1);
  flash.scale.set(2.2, 0.5, 1);
  printer.feedFrame.add(flash);

  // --- Tickets (copiados del DOM con la fuente de la app).
  const painted = await Promise.all(opts.sheets.map((sh) => paintTicketFromDom(sh.root)));
  if (opts.blankTicket) {
    const blank = document.createElement("canvas");
    blank.width = blank.height = 4;
    painted.push({ texture: new THREE.CanvasTexture(blank), width: 288, height: 360 });
  }
  painted.forEach((p) => disposables.push(p.texture));
  const tickets: TicketRig[] = painted.map((p) => createTicketRig(p.texture, p.height / p.width, s.glow, c.color, own));
  tickets.forEach((t) => scene.add(t.group));

  // --- Papelitos del corte (uno por ticket: cada corte suelta los suyos).
  const density = isSoftwareWebGL() ? 0.6 : 1;
  const chips: Chips[] = tickets.map((_, i) => createChips(Math.round(c.chips * density), c.chipSpeed, i, own));
  chips.forEach((ch) => printer.feedFrame.add(ch.points));

  let width = 0;
  let height = 0;
  let distance = BASE_DISTANCE;
  const finalCamera = new THREE.Vector3();

  /** Tamaño, cámara y destino de cada ticket según el viewport actual. */
  const layout = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    distance = cameraDistanceForAspect(camera.aspect, BASE_DISTANCE, FOV, opts.batch ? 6.4 : 4.4);
    camera.updateProjectionMatrix();
    finalCamera.set(0, CAMERA_HEIGHT, distance);

    // El ticket termina en un punto fijo de la PANTALLA (no del mundo): a
    // cualquier tamaño/proporción queda entero, legible y arriba de la impresora.
    const n = tickets.length;
    const px = sheetPixelWidth(width, opts.batch, n);
    const fan = fanLayout(n);
    const target = sheetScreenTarget(opts.batch);
    const finalCam = camera.clone();
    finalCam.position.copy(finalCamera);
    finalCam.lookAt(LOOK_AT);
    finalCam.updateMatrixWorld(true);
    const dummy = new THREE.Object3D();
    tickets.forEach((rig, i) => {
      const f = fan[i];
      const ndcX = (f.offset * px * 2) / width;
      const ndcY = 1 - 2 * target.y;
      const dir = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(finalCam).sub(finalCamera).normalize();
      const d = target.distance - f.depth;
      rig.end.copy(finalCamera).addScaledVector(dir, d);
      rig.endScale = worldWidthForPixels(px, d, FOV, height);
      dummy.position.copy(rig.end);
      dummy.lookAt(finalCamera);
      dummy.rotateZ(f.angle);
      rig.qEnd.copy(dummy.quaternion);
      rig.glow.scale.set(1.45, rig.aspect + 0.45, 1);
    });
  };
  layout();

  let startAt = 0;
  let running = false;
  let handedOff = false;
  const lookAt = new THREE.Vector3();
  const slotPos = new THREE.Vector3();
  const slotQuat = new THREE.Quaternion();
  const feedDir = new THREE.Vector3();
  const startPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const ledPos = new THREE.Vector3();

  const frame = () => {
    const ms = performance.now() - startAt;
    const t = ms / 1000;

    // Cámara: acercamiento lento + temblor al aterrizar.
    const dolly = cameraDolly(ms, c, tl);
    const shake = cameraShake(ms, c, tl);
    camera.position.set(0, CAMERA_HEIGHT + shake + dolly * 0.2, distance + dolly);
    lookAt.copy(LOOK_AT).setY(LOOK_AT.y + shake * 0.5);
    camera.lookAt(lookAt);

    // Impresora.
    const pose = printerPose(ms, c, tl);
    printer.root.position.set(pose.x, pose.y, 0);
    printer.root.rotation.set(0, REST_YAW + pose.rotY, pose.rotZ);
    printer.body.scale.set(pose.sx, pose.sy, pose.sz);
    printer.root.updateMatrixWorld(true);
    printer.feedFrame.getWorldPosition(slotPos);
    printer.feedFrame.getWorldQuaternion(slotQuat);
    feedDir.set(0, 1, 0).applyQuaternion(slotQuat);
    host.style.opacity = String(pose.opacity);

    // LED de estado (+ su halo y la luz que tiñe el frente).
    const led = ledLevel(ms, c, tl);
    const pulse = alarmPulse(ms, c);
    printer.led.emissiveIntensity = 0.35 + led * 3.4;
    printer.ledAnchor.getWorldPosition(ledPos);
    ledHalo.position.copy(ledPos);
    ledHalo.quaternion.copy(camera.quaternion);
    ledHalo.scale.setScalar(0.32 + led * 0.28);
    ledHalo.material.opacity = led * 0.85;
    ledLight.position.copy(ledPos).add(tmp.set(0, 0, 0.25));
    ledLight.intensity = led * 1.4;
    rim.intensity = 1.6 + pulse * 1.8;

    // Guillotina, destello y papelitos de cada corte.
    let travel = 0;
    let flashLevel = 0;
    tl.tickets.forEach((slot, i) => {
      travel = Math.max(travel, bladeTravel(ms, slot));
      flashLevel = Math.max(flashLevel, cutFlash(ms, slot));
      if (chips[i]) updateChips(chips[i], (ms - slot.cut) / 1000);
    });
    printer.blade.visible = travel > 0.001;
    printer.blade.position.x = -PRINTER.slotWidth / 2 - 0.3 + travel * (PRINTER.slotWidth + 0.6);
    flash.material.opacity = Math.min(1, flashLevel * c.flash * 0.9);
    cutLight.position.copy(slotPos).addScaledVector(feedDir, 0.2);
    cutLight.intensity = flashLevel * c.flash * 14;

    // Tickets.
    tickets.forEach((rig, i) => {
      const m = ticketMotion(ms, c, tl, i);
      rig.group.visible = m.visible && !handedOff;
      if (!rig.group.visible) return;
      const h = rig.aspect * FEED_WIDTH;
      // En la ranura: el borde de arriba asoma `fed` del alto (más el saltito del corte).
      startPos.copy(slotPos).addScaledVector(feedDir, m.fed * h - h / 2 + m.pop * h);
      if (!m.cut) {
        rig.group.position.copy(startPos);
        rig.group.quaternion.copy(slotQuat);
        rig.group.scale.setScalar(FEED_WIDTH);
        rig.clip.setFromNormalAndCoplanarPoint(feedDir, slotPos);
      } else {
        rig.clip.set(feedDir, NO_CLIP);
        // Sube primero (se aleja de la ranura) y recién después viene hacia la cámara.
        const k = Math.min(1, m.lift);
        tmp.lerpVectors(startPos, rig.end, m.lift);
        tmp.y += 0.35 * Math.sin(Math.PI * k);
        tmp.z = startPos.z + (rig.end.z - startPos.z) * Math.max(0, Math.min(1, (m.lift - 0.2) / 0.8));
        // Flota apenas mientras se lee.
        tmp.y += Math.sin(t * 2.2 + i) * 0.02 * m.turn;
        rig.group.position.copy(tmp);
        rig.group.quaternion.slerpQuaternions(slotQuat, rig.qEnd, m.turn);
        rig.group.rotateZ(m.twist);
        rig.group.scale.setScalar(FEED_WIDTH + (rig.endScale - FEED_WIDTH) * Math.max(0, k));
      }
      bendPaper(rig, m.cut ? 1 : m.fed, m.curl);
      rig.frontMat.color.setScalar(0.9 + 0.1 * m.turn);
      rig.glow.material.opacity = m.turn * (0.42 + pulse * 0.4);
    });

    // Sombra: más grande y clara cuanto más alta está la impresora.
    const air = Math.max(0, pose.y);
    const spread = 1 + air * 0.22;
    const fade = 1 / (1 + air * 0.9);
    shadowCore.position.x = shadowSoft.position.x = pose.x;
    shadowCore.rotation.z = shadowSoft.rotation.z = REST_YAW + pose.rotY;
    shadowCore.scale.set(PRINTER.width * 1.15 * spread * pose.sx, PRINTER.depth * 1.15 * spread * pose.sz, 1);
    shadowSoft.scale.set(PRINTER.width * 1.9 * spread, PRINTER.depth * 2 * spread, 1);
    shadowCore.material.opacity = 0.85 * fade;
    shadowSoft.material.opacity = 0.45 * fade;

    renderer.render(scene, camera);
  };

  const onResize = () => layout();
  const onVisibility = () => {
    if (!running || owner !== token) return;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  };

  // Shaders compilados antes de arrancar: sin tirones en los primeros frames.
  tickets.forEach((r) => (r.group.visible = true));
  chips.forEach((ch) => (ch.points.visible = true));
  printer.blade.visible = true;
  await renderer.compileAsync(scene, camera);
  tickets.forEach((r) => (r.group.visible = false));
  chips.forEach((ch) => (ch.points.visible = false));
  printer.blade.visible = false;
  // Los programas ya quedaron tomados por esta escena: la de precalentamiento
  // puede soltarlos.
  if (warmPlayer && opts.sheets.length > 0) {
    warmPlayer.stop();
    warmPlayer = null;
  }

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
      // La pose de este instante (el ticket ya está plano y mirando a la cámara).
      frame();
      const rect = host.getBoundingClientRect();
      const viewport = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      const out = tickets.map((rig) => {
        rig.front.updateMatrixWorld(true);
        const x = 0.5;
        const y = rig.aspect / 2;
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

/**
 * Un ticket: papel térmico (frente con la textura copiada del DOM, dorso
 * blanco), subdividido a lo largo para curvarlo, con su propio plano de
 * recorte en la ranura y un brillo del color de la prioridad detrás.
 */
function createTicketRig(
  texture: THREE.Texture,
  aspect: number,
  glowMap: THREE.Texture,
  color: string,
  own: <T extends { dispose: () => void }>(x: T) => T
): TicketRig {
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), NO_CLIP);
  const geo = own(new THREE.PlaneGeometry(1, aspect, 1, PAPER_SEGMENTS));
  const base = Float32Array.from(geo.getAttribute("position").array as Float32Array);
  const vertexCount = base.length / 3;
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3));
  (geo.getAttribute("position") as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const frontMat = own(
    new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, toneMapped: false, side: THREE.FrontSide, clippingPlanes: [clip] })
  );
  const backMat = own(
    new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.85, side: THREE.BackSide, clippingPlanes: [clip] })
  );
  const front = new THREE.Mesh(geo, frontMat);
  const back = new THREE.Mesh(geo, backMat);
  const glow = new THREE.Mesh(
    own(new THREE.PlaneGeometry(1, 1)),
    own(
      new THREE.MeshBasicMaterial({
        map: glowMap,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    )
  );
  glow.position.z = -0.04;
  const group = new THREE.Group();
  group.add(glow, back, front);
  group.visible = false;
  return {
    group,
    front,
    glow,
    frontMat,
    geo,
    base,
    aspect,
    clip,
    end: new THREE.Vector3(),
    qEnd: new THREE.Quaternion(),
    endScale: 1,
    lastCurl: -1,
    lastFed: -1,
  };
}

/**
 * Curva el papel hacia atrás según la distancia a la ranura (como el rollo del
 * que sale) y lo sombrea apenas donde se curva. Plano cuando `curl` = 0.
 */
function bendPaper(rig: TicketRig, fed: number, curl: number) {
  if (Math.abs(curl - rig.lastCurl) < 1e-4 && Math.abs(fed - rig.lastFed) < 1e-4) return;
  rig.lastCurl = curl;
  rig.lastFed = fed;
  const pos = rig.geo.getAttribute("position") as THREE.BufferAttribute;
  const col = rig.geo.getAttribute("color") as THREE.BufferAttribute;
  const p = pos.array as Float32Array;
  const cArr = col.array as Float32Array;
  const emerged = fed * rig.aspect;
  for (let k = 0; k < p.length; k += 3) {
    const y = rig.base[k + 1];
    const d = y - rig.aspect / 2 + emerged;
    p[k + 2] = paperCurlOffset(d, curl);
    const shade = 1 - Math.min(0.28, Math.max(0, d) * curl * 1.4);
    cArr[k] = cArr[k + 1] = cArr[k + 2] = shade;
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
}

/** Papelitos del corte, en el marco de la ranura (+Z = hacia la cámara). */
function createChips(n: number, speed: number, seedOffset: number, own: <T extends { dispose: () => void }>(x: T) => T): Chips {
  const count = Math.max(1, n);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocity = new Float32Array(count * 3);
  const origin = new Float32Array(count * 3);
  // Determinista (el mismo corte en cada llegada de la misma prioridad).
  let seed = 1337 + seedOffset * 7919;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    origin[i * 3] = (rand() - 0.5) * FEED_WIDTH;
    origin[i * 3 + 1] = rand() * 0.04;
    origin[i * 3 + 2] = 0.02;
    velocity[i * 3] = (rand() - 0.5) * 0.9 * speed * 0.5;
    velocity[i * 3 + 1] = (0.4 + rand() * 0.9) * speed * 0.5;
    velocity[i * 3 + 2] = (0.5 + rand() * 1.1) * speed * 0.5;
    const tone = 0.86 + rand() * 0.14;
    colors.set([tone, tone, tone * 0.97], i * 3);
    positions.set([0, -50, 0], i * 3);
  }
  const geo = own(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = own(
    new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, depthWrite: false, opacity: 0 })
  );
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return { points, velocity, origin };
}

function updateChips(ch: Chips, age: number) {
  const mat = ch.points.material;
  if (age < 0 || age > CHIP_LIFE) {
    ch.points.visible = false;
    return;
  }
  ch.points.visible = true;
  mat.opacity = Math.min(1, (1 - age / CHIP_LIFE) * 2);
  const pos = ch.points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  const g = -6;
  // Arrastre del aire: el papel es liviano, frena enseguida y cae revoloteando.
  const drag = Math.exp(-age * 2.2);
  const floor = -0.95;
  for (let k = 0; k < arr.length; k += 3) {
    const a = Math.max(0, age - ((k / 3) % 5) * 0.01);
    const flutter = Math.sin(a * 14 + k) * 0.03 * a;
    arr[k] = ch.origin[k] + ch.velocity[k] * a * drag + flutter;
    arr[k + 1] = Math.max(floor, ch.origin[k + 1] + ch.velocity[k + 1] * a * drag + 0.5 * g * a * a * 0.35);
    arr[k + 2] = ch.origin[k + 2] + ch.velocity[k + 2] * a * drag;
  }
  pos.needsUpdate = true;
}
