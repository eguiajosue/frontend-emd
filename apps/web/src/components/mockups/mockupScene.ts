import * as THREE from "three";
import type { SizeBreakdown } from "@/lib/garmentSizes";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  DesignPlacement,
  Garment,
  MockupConfig,
  MockupExport,
  MockupView,
  Vec3,
} from "@/lib/mockups/types";
import { MAX_TEMPLATE_THUMBNAIL_BYTES } from "@/lib/mockups/types";
import { dataUrlBytes } from "@/lib/mockups/dataUrl";
import { buildDecalGeometry, createSelectionTexture, DesignDecal, TriangleSoup } from "./DesignDecal";
import {
  composeSheet,
  sheetViewsFor,
  THUMBNAIL_SIZE,
  VIEW_AZIMUTH,
  type ComposeOptions,
  type SheetView,
} from "./exportMockup";
import type { GarmentModel } from "./garmentModel";
import { loadShirtModel } from "./ShirtModel";
import { ContactShadows, createStudioEnvironment, StudioLightRig } from "./studioLighting";
import { createTruckerCapModel } from "./TruckerCapModel";
import { createTazaModel, createTermoModel } from "./DrinkwareModel";
import { PRINT_FINISH, type DecalFinish } from "./DesignDecal";
import { isLaserEngraved } from "@/lib/mockups/garments";
import { laserSettings } from "@/lib/mockups/laserEngrave";
import { isRawSteel } from "@/lib/mockups/types";

/**
 * Escena del creador de mockups en Three.js "vanilla".
 *
 * Por qué no @react-three/fiber: Next 15 (App Router) corre con su React 19
 * empaquetado y fiber v8 truena al cargar ("ReactCurrentOwner" undefined, el
 * mismo choque que obligó a quitar las escenas del login, ver
 * components/three/ParticleField.tsx). Aquí no hay reconciliador: React sólo
 * monta el contenedor y esta clase dibuja.
 */

export type SceneStatus = "loading" | "ready" | "error";

export interface MockupSceneCallbacks {
  onSelectLayer: (id: string | null) => void;
  onPlacementChange: (id: string, placement: DesignPlacement) => void;
  onViewChange?: (view: MockupView | null) => void;
  onStatus?: (status: SceneStatus) => void;
}

interface GarmentState {
  garment: Garment;
  model: GarmentModel;
  soup: TriangleSoup;
  center: THREE.Vector3;
  radius: number;
  /** Medio alto y medio ancho (el mayor entre X y Z) para encuadrar. */
  halfHeight: number;
  halfWidth: number;
}

interface DragState {
  layerId: string;
  pointerId: number;
  /** Desfase en px entre el puntero y el centro del diseño al agarrarlo. */
  offsetX: number;
  offsetY: number;
  pending: { x: number; y: number } | null;
}

const FOV = 25;
const CLICK_SLOP_PX = 6;
const round = (v: number) => Math.round(v * 1e5) / 1e5;

export class MockupScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
  private readonly controls: OrbitControls;
  private readonly envTexture: THREE.Texture;
  private readonly lights = new StudioLightRig();
  private readonly shadows = new ContactShadows(512);
  private readonly garmentGroup = new THREE.Group();
  private readonly decalGroup = new THREE.Group();
  private readonly selection: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly anisotropy: number;

  private config: MockupConfig | null = null;
  private selectedId: string | null = null;
  private view: MockupView = "front";
  private viewFree = false;
  private userOrbiting = false;
  private camAnim: { theta: number; phi: number; radius: number } | null = null;
  private current: GarmentState | null = null;
  private loadingGarment: Garment | null = null;
  private garmentPromise: Promise<void> = Promise.resolve();
  private loadToken = 0;
  private decals = new Map<string, DesignDecal>();
  private selectionDirty = true;
  private drag: DragState | null = null;
  private press: { x: number; y: number; onGarment: boolean } | null = null;
  private frame = 0;
  private lastTime = 0;
  private renderFrames = 2;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: () => MockupSceneCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // "Khronos PBR Neutral": respeta el color elegido (pensado para producto).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);

    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.outline = "none";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    this.envTexture = createStudioEnvironment(this.renderer);
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.85;
    this.scene.add(this.lights.group, this.shadows.group, this.garmentGroup, this.decalGroup);

    this.selection = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        map: createSelectionTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
        toneMapped: false,
      }),
    );
    this.selection.renderOrder = 1000;
    this.selection.visible = false;
    this.decalGroup.add(this.selection);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener("start", this.onControlsStart);
    this.controls.addEventListener("end", this.onControlsEnd);
    this.controls.addEventListener("change", this.onControlsChange);

    // Captura: decide antes que OrbitControls si el gesto es arrastrar un diseño.
    canvas.addEventListener("pointerdown", this.onPointerDown, { capture: true });
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("webglcontextlost", this.onContextLost);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.frame = requestAnimationFrame(this.tick);
  }

  // -------------------------------------------------------------------------
  // API pública (la usa MockupCanvas)
  // -------------------------------------------------------------------------

  setConfig(config: MockupConfig) {
    const prev = this.config;
    this.config = config;
    const garmentChanged = !prev || prev.garment !== config.garment;
    if (garmentChanged && this.loadingGarment !== config.garment) {
      this.loadGarment(config);
    } else if (this.current && this.current.garment === config.garment) {
      this.current.model.setColors(config.colors);
    }
    this.syncLayers();
    this.invalidate();
  }

  setSelected(id: string | null) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.selectionDirty = true;
    this.invalidate();
  }

  /** Gira la cámara a una vista fija (animada salvo `immediate`). */
  setView(view: MockupView, immediate = false) {
    this.view = view;
    this.viewFree = false;
    const target = this.viewSpherical(view);
    if (immediate || !this.current) {
      this.camAnim = null;
      this.placeCamera(target);
    } else {
      this.camAnim = target;
    }
    this.invalidate();
  }

  /** Espera a que la prenda y todas las texturas estén listas. */
  async whenReady(): Promise<void> {
    // Repite por si la config cambia mientras se espera.
    for (let i = 0; i < 5; i++) {
      const garmentPromise = this.garmentPromise;
      const decalPromises = [...this.decals.values()].map((d) => d.ready);
      await garmentPromise;
      await Promise.all(decalPromises);
      if (
        garmentPromise === this.garmentPromise &&
        [...this.decals.values()].every((d, k) => d.ready === decalPromises[k])
      ) {
        return;
      }
    }
  }

  async exportSheet(sizes?: SizeBreakdown | null): Promise<MockupExport> {
    return this.exportComposite((layers) => sheetViewsFor(layers), { sizes });
  }

  /**
   * Miniatura de plantilla: sólo el frente, cuadrada (THUMBNAIL_SIZE) y en
   * JPEG para que pese pocos KB (el backend acepta ≤ 300 KB).
   */
  async exportThumbnail(): Promise<MockupExport> {
    // Del más nítido al más liviano hasta caber en el tope del backend (R6).
    const attempts = [
      { size: THUMBNAIL_SIZE, quality: 0.86 },
      { size: THUMBNAIL_SIZE, quality: 0.7 },
      { size: 320, quality: 0.65 },
      { size: 240, quality: 0.6 },
    ];
    let last: MockupExport | null = null;
    for (const { size, quality } of attempts) {
      last = await this.exportComposite(() => [{ view: "front", label: "Frente" }], {
        width: size,
        height: size,
        padding: Math.round(size * 0.04),
        gap: 0,
        labels: false,
        supersample: 1.5,
        mimeType: "image/jpeg",
        quality,
      });
      if (dataUrlBytes(last.dataUrl) <= MAX_TEMPLATE_THUMBNAIL_BYTES) return last;
    }
    return last!;
  }

  private async exportComposite(
    viewsFor: (layers: MockupConfig["layers"]) => SheetView[],
    options: ComposeOptions,
  ): Promise<MockupExport> {
    await this.whenReady();
    // Si la prenda elegida no cargó (p. ej. falló el GLB), en pantalla sigue la
    // anterior: exportar guardaría la imagen de una prenda con la config de otra.
    // El mensaje empieza con "El 3D" para que el estudio lo muestre tal cual.
    if (this.disposed || !this.current || !this.config || this.current.garment !== this.config.garment) {
      throw new Error("El 3D no terminó de cargar la prenda. Espera un momento o recarga la página.");
    }
    this.rebuildDirtyDecals();

    const views = viewsFor(this.config.layers);
    const prev = {
      pixelRatio: this.renderer.getPixelRatio(),
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      aspect: this.camera.aspect,
      target: this.controls.target.clone(),
      selection: this.selection.visible,
    };
    try {
      this.selection.visible = false;
      this.renderer.setPixelRatio(1);
      this.shadows.update(this.renderer, this.scene);
      return composeSheet(views, (view, w, h) => {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.placeCamera(this.viewSpherical(view, w / h, 1.06), false);
        this.lights.follow(this.camera);
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
      }, options);
    } finally {
      this.renderer.setPixelRatio(prev.pixelRatio);
      this.renderer.setSize(this.width, this.height, false);
      this.camera.aspect = prev.aspect;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(prev.position);
      this.camera.quaternion.copy(prev.quaternion);
      this.controls.target.copy(prev.target);
      this.selection.visible = prev.selection;
      this.lights.follow(this.camera);
      this.renderer.render(this.scene, this.camera);
      this.invalidate();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown, { capture: true });
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.controls.dispose();
    this.decals.forEach((d) => d.dispose());
    this.decals.clear();
    this.current?.model.dispose();
    this.selection.geometry.dispose();
    this.selection.material.map?.dispose();
    this.selection.material.dispose();
    this.shadows.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  // -------------------------------------------------------------------------
  // Prenda
  // -------------------------------------------------------------------------

  private loadGarment(config: MockupConfig) {
    const token = ++this.loadToken;
    const garment = config.garment;
    this.loadingGarment = garment;
    this.callbacks().onStatus?.("loading");
    // Sólo playera y gorra tienen modelo (ver lib/mockups/garments.ts): una
    // prenda sin modelo termina en "error" en vez de dibujar otra.
    const load: Promise<GarmentModel> =
      garment === "tshirt"
        ? loadShirtModel(config.colors)
        : garment === "cap"
          ? Promise.resolve(createTruckerCapModel(config.colors))
          : garment === "termo"
            ? Promise.resolve(createTermoModel(config.colors))
            : garment === "taza"
              ? Promise.resolve(createTazaModel(config.colors))
              : Promise.reject(new Error(`La prenda «${garment}» todavía no tiene modelo 3D`));
    this.garmentPromise = load.then(
      (model) => {
        if (this.disposed || token !== this.loadToken) {
          model.dispose();
          return;
        }
        this.mountGarment(garment, model);
        this.syncLayers();
        this.loadingGarment = null;
        this.callbacks().onStatus?.("ready");
      },
      (err) => {
        if (token !== this.loadToken) return;
        this.loadingGarment = null;
        console.error("[mockups] no se pudo cargar la prenda", err);
        this.callbacks().onStatus?.("error");
      },
    );
  }

  private mountGarment(garment: Garment, model: GarmentModel) {
    if (this.current) {
      this.garmentGroup.remove(this.current.model.root);
      this.current.model.dispose();
    }
    model.setColors(this.config?.colors ?? { body: "#ffffff" }, true);
    this.garmentGroup.add(model.root);
    model.root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model.root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = model.focus?.clone() ?? box.getCenter(new THREE.Vector3());
    this.current = {
      garment,
      model,
      soup: new TriangleSoup(model.decalTargets),
      center,
      radius: sphere.radius,
      halfHeight: Math.max(box.max.y - center.y, center.y - box.min.y),
      // Extensión desde el foco (no desde el centro de la caja) para encuadrar.
      halfWidth: Math.max(
        Math.abs(box.max.x - center.x),
        Math.abs(box.min.x - center.x),
        Math.abs(box.max.z - center.z),
        Math.abs(box.min.z - center.z),
      ),
    };

    // Límites de órbita por prenda: la gorra se luce más desde arriba.
    const base = this.fitDistance(this.width / this.height);
    this.controls.target.copy(center);
    this.controls.minDistance = base * 0.45;
    this.controls.maxDistance = base * 1.6;
    this.controls.minPolarAngle = garment === "cap" || garment === "taza" ? Math.PI * 0.1 : Math.PI * 0.26;
    this.controls.maxPolarAngle = garment === "cap" ? Math.PI * 0.6 : Math.PI * 0.62;

    this.shadows.configure(center, box.min.y - 0.002, model.shadow);
    this.lights.fit(center, sphere.radius);

    this.decals.forEach((d) => (d.dirty = true));
    this.selectionDirty = true;
    this.setView(this.view, true);
  }

  /**
   * Distancia para que la prenda llene el cuadro en cualquier vista: se usa el
   * mayor ancho (X o Z) para que el zoom no salte al girar.
   */
  private fitDistance(aspect: number, margin = 1.18) {
    if (!this.current) return 2;
    const { halfHeight, halfWidth } = this.current;
    const vTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const hTan = vTan * aspect;
    return (Math.max(halfHeight / vTan, halfWidth / hTan) + halfWidth * 0.5) * margin;
  }

  private viewSpherical(view: MockupView, aspect = this.width / this.height, margin?: number) {
    const elevation = this.current?.model.viewElevation ?? 0.08;
    const radius = this.fitDistance(aspect, margin);
    return { theta: VIEW_AZIMUTH[view], phi: Math.PI / 2 - elevation, radius };
  }

  private placeCamera(s: { theta: number; phi: number; radius: number }, updateControls = true) {
    const target = this.current?.center ?? this.controls.target;
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(s.radius, s.phi, s.theta));
    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);
    if (updateControls) {
      this.controls.target.copy(target);
      this.controls.update();
    }
  }

  // -------------------------------------------------------------------------
  // Capas / decals
  // -------------------------------------------------------------------------

  /** Acabado de los diseños: sólo el termo ya montado se graba con láser. */
  private finishFor(layer: MockupConfig["layers"][number]): DecalFinish {
    const config = this.config;
    if (!config || !this.current || this.current.garment !== config.garment || !isLaserEngraved(config.garment)) {
      return PRINT_FINISH;
    }
    return { kind: "laser", settings: laserSettings(layer.engrave), onSteel: isRawSteel(config.colors.body) };
  }

  private syncLayers() {
    const layers = this.config?.layers ?? [];
    const seen = new Set<string>();
    let engraved = 0;
    layers.forEach((layer, index) => {
      seen.add(layer.id);
      let decal = this.decals.get(layer.id);
      if (!decal) {
        decal = new DesignDecal(layer, this.anisotropy, () => this.invalidate());
        this.decals.set(layer.id, decal);
        this.decalGroup.add(decal.mesh);
      } else {
        decal.setLayer(layer);
      }
      decal.setFinish(this.finishFor(layer));
      if (decal.finishKind === "laser") engraved++;
      decal.mesh.renderOrder = 10 + index;
      if (decal.dirty && layer.id === this.selectedId) this.selectionDirty = true;
    });
    for (const [id, decal] of this.decals) {
      if (seen.has(id)) continue;
      this.decalGroup.remove(decal.mesh);
      decal.dispose();
      this.decals.delete(id);
      if (id === this.selectedId) this.selectionDirty = true;
    }
    // Para pruebas y depuración: cuántos diseños se dibujan como grabado.
    this.container.dataset.garment = this.current?.garment ?? "";
    this.container.dataset.engravedLayers = String(engraved);
  }

  private toWorld(p: Vec3, n: Vec3) {
    const root = this.current!.model.root;
    const position = root.localToWorld(new THREE.Vector3(...p));
    const normal = new THREE.Vector3(...n).transformDirection(root.matrixWorld);
    if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
    return { position, normal: normal.normalize() };
  }

  /** Proyector plano de las prendas, o la geometría propia del modelo (termo/taza). */
  private decalGeometry(position: THREE.Vector3, normal: THREE.Vector3, rotation: number, size: THREE.Vector3) {
    const model = this.current!.model;
    if (model.decalGeometry) {
      // Los modelos trabajan en su espacio local (la raíz no tiene transformación).
      const root = model.root;
      return model.decalGeometry(root.worldToLocal(position.clone()), normal, rotation, size);
    }
    return buildDecalGeometry(this.current!.soup, position, normal, rotation, size);
  }

  private rebuildDirtyDecals(): boolean {
    if (!this.current) return false;
    let changed = false;
    const depthFor = this.current.model.decalDepth;
    for (const decal of this.decals.values()) {
      if (!decal.dirty) continue;
      decal.dirty = false;
      changed = true;
      const { placement } = decal.layer;
      const { position, normal } = this.toWorld(placement.position, placement.normal);
      const geo = this.decalGeometry(position, normal, placement.rotation, decal.size(depthFor(placement.scale)));
      decal.mesh.geometry.dispose();
      decal.mesh.geometry = geo ?? new THREE.BufferGeometry();
      if (decal.layer.id === this.selectedId) this.selectionDirty = true;
    }
    if (this.selectionDirty) {
      this.selectionDirty = false;
      changed = true;
      const decal = this.selectedId ? this.decals.get(this.selectedId) : undefined;
      this.selection.geometry.dispose();
      this.selection.geometry = new THREE.BufferGeometry();
      this.selection.visible = false;
      if (decal) {
        const { placement } = decal.layer;
        const { position, normal } = this.toWorld(placement.position, placement.normal);
        const size = decal.size(depthFor(placement.scale));
        // Un poco más grande que el diseño, con margen mínimo para logos chicos.
        const margin = Math.max(placement.scale * 0.06, 0.006);
        size.x += margin * 2;
        size.y += margin * 2;
        const geo = this.decalGeometry(position, normal, placement.rotation, size);
        if (geo) {
          this.selection.geometry = geo;
          this.selection.visible = true;
        }
      }
    }
    return changed;
  }

  // -------------------------------------------------------------------------
  // Puntero: seleccionar y arrastrar diseños
  // -------------------------------------------------------------------------

  private setRay(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** Posición en pantalla (px de cliente) de un punto del mundo. */
  private toScreen(p: THREE.Vector3) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = p.clone().project(this.camera);
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  private hitDecal(): { id: string; distance: number } | null {
    const meshes = [...this.decals.values()].map((d) => d.mesh).filter((m) => m.material.visible);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    // Con diseños encimados gana el que se dibuja arriba (renderOrder mayor).
    const nearest = hits[0].distance;
    const top = hits
      .filter((h) => h.distance - nearest < 0.004)
      .sort((a, b) => b.object.renderOrder - a.object.renderOrder)[0];
    return { id: top.object.userData.layerId as string, distance: top.distance };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    this.setRay(e.clientX, e.clientY);
    const garmentHit = this.raycaster.intersectObject(this.current.model.root, true)[0];
    const decalHit = this.hitDecal();
    const onDecal = decalHit && (!garmentHit || decalHit.distance <= garmentHit.distance + 0.01);
    this.press = { x: e.clientX, y: e.clientY, onGarment: Boolean(garmentHit || decalHit) };
    if (!onDecal || !decalHit) return;

    const id = decalHit.id;
    if (id !== this.selectedId) {
      this.setSelected(id);
      this.callbacks().onSelectLayer(id);
    }
    const layer = this.decals.get(id)?.layer;
    if (!layer) return;
    const center = this.toScreen(this.toWorld(layer.placement.position, layer.placement.normal).position);
    this.drag = {
      layerId: id,
      pointerId: e.pointerId,
      offsetX: center.x - e.clientX,
      offsetY: center.y - e.clientY,
      pending: null,
    };
    // Que OrbitControls no gire la cámara mientras se arrastra el diseño.
    this.controls.enabled = false;
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* puntero ya liberado */
    }
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    // Sólo se guarda; el raycast y el aviso van una vez por frame (tick).
    this.drag.pending = { x: e.clientX + this.drag.offsetX, y: e.clientY + this.drag.offsetY };
    this.invalidate();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.pointerId) {
      this.processDrag();
      try {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* nada */
      }
      this.drag = null;
      this.controls.enabled = true;
    } else if (this.press && !this.press.onGarment) {
      // Clic en el fondo (sin arrastrar): deselecciona.
      const moved = Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y);
      if (moved < CLICK_SLOP_PX && this.selectedId) {
        this.setSelected(null);
        this.callbacks().onSelectLayer(null);
      }
    }
    this.press = null;
  };

  private processDrag() {
    const drag = this.drag;
    if (!drag?.pending || !this.current) return;
    const { x, y } = drag.pending;
    drag.pending = null;
    const decal = this.decals.get(drag.layerId);
    if (!decal) return;
    this.setRay(x, y);
    const hit = this.raycaster.intersectObjects(this.current.model.decalTargets, false)[0];
    if (!hit) return;
    const root = this.current.model.root;
    const local = root.worldToLocal(hit.point.clone());
    // Normal interpolada (más suave que la de la cara) en mundo y luego a local.
    const n = (hit.normal ?? hit.face?.normal ?? new THREE.Vector3(0, 0, 1)).clone();
    n.transformDirection(hit.object.matrixWorld);
    if (n.dot(this.raycaster.ray.direction) > 0) n.negate();
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    n.transformDirection(inv).normalize();

    const placement: DesignPlacement = {
      ...decal.layer.placement,
      position: [round(local.x), round(local.y), round(local.z)],
      normal: [round(n.x), round(n.y), round(n.z)],
    };
    // Vista previa inmediata; el estudio recibe el mismo valor y no hay doble rebuild.
    decal.setLayer({ ...decal.layer, placement });
    this.callbacks().onPlacementChange(drag.layerId, placement);
  }

  // -------------------------------------------------------------------------
  // Cámara
  // -------------------------------------------------------------------------

  private onControlsStart = () => {
    this.userOrbiting = true;
    this.camAnim = null;
  };

  private onControlsEnd = () => {
    this.userOrbiting = false;
  };

  private onControlsChange = () => {
    this.invalidate();
    if (!this.userOrbiting || this.viewFree) return;
    const target = this.viewSpherical(this.view);
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    const dTheta = Math.abs(Math.atan2(Math.sin(s.theta - target.theta), Math.cos(s.theta - target.theta)));
    if (dTheta > 0.06 || Math.abs(s.phi - target.phi) > 0.06) {
      this.viewFree = true;
      this.callbacks().onViewChange?.(null);
    }
  };

  private animateCamera(delta: number): boolean {
    if (!this.camAnim || !this.current) return false;
    const target = this.controls.target;
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(target));
    const k = 1 - Math.exp(-6 * delta);
    const dTheta = Math.atan2(Math.sin(this.camAnim.theta - s.theta), Math.cos(this.camAnim.theta - s.theta));
    s.theta += dTheta * k;
    s.phi += (this.camAnim.phi - s.phi) * k;
    s.radius += (this.camAnim.radius - s.radius) * k;
    const done =
      Math.abs(dTheta) < 1e-3 && Math.abs(this.camAnim.phi - s.phi) < 1e-3 && Math.abs(this.camAnim.radius - s.radius) < 1e-4;
    if (done) {
      s.set(this.camAnim.radius, this.camAnim.phi, this.camAnim.theta);
      this.camAnim = null;
    }
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));
    this.camera.lookAt(target);
    return true;
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private invalidate(frames = 2) {
    this.renderFrames = Math.max(this.renderFrames, frames);
  }

  private resize() {
    const w = Math.max(1, Math.floor(this.container.clientWidth));
    const h = Math.max(1, Math.floor(this.container.clientHeight));
    if (w === this.width && h === this.height) return;
    const oldBase = this.current ? this.fitDistance(this.width / this.height) : 0;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.current) {
      // Conserva el zoom relativo del usuario al cambiar el tamaño.
      const newBase = this.fitDistance(w / h);
      this.controls.minDistance = newBase * 0.45;
      this.controls.maxDistance = newBase * 1.6;
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.multiplyScalar(oldBase > 0 ? newBase / oldBase : 1);
      this.camera.position.copy(this.controls.target).add(offset);
      if (this.camAnim) this.camAnim.radius = this.viewSpherical(this.view).radius;
    }
    this.invalidate();
  }

  private tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);
    const delta = Math.min((now - (this.lastTime || now)) / 1000, 0.1);
    this.lastTime = now;
    if (this.disposed || document.visibilityState === "hidden") return;

    if (this.drag?.pending) this.processDrag();
    let active = this.animateCamera(delta);
    if (this.controls.update()) active = true;
    if (this.current?.model.update(delta)) active = true;
    if (this.rebuildDirtyDecals()) active = true;

    if (active) this.invalidate(1);
    if (this.renderFrames <= 0 || !this.current) return;
    this.renderFrames--;
    this.shadows.update(this.renderer, this.scene);
    this.lights.follow(this.camera);
    this.renderer.render(this.scene, this.camera);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks().onStatus?.("error");
  };
}
