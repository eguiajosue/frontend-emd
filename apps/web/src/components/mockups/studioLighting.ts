import * as THREE from "three";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";

/**
 * Iluminación de estudio sin descargas: el mapa de entorno sale de una escena
 * de "softboxes" (planos emisivos, como los Lightformer de drei) que se hornea
 * con PMREM. Nada de HDR externos (la CSP y la red no lo permiten).
 */

function lightformer(
  scene: THREE.Scene,
  {
    position,
    scale,
    intensity,
    color = "#ffffff",
    form = "rect",
  }: {
    position: [number, number, number];
    scale: [number, number];
    intensity: number;
    color?: string;
    form?: "rect" | "circle";
  },
) {
  const geo = form === "circle" ? new THREE.CircleGeometry(0.5, 48) : new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position);
  mesh.scale.set(scale[0], scale[1], 1);
  mesh.lookAt(0, 0, 0);
  scene.add(mesh);
}

/** Hornea el entorno de estudio. El llamador libera la textura al desmontar. */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color("#3d3f44");

  // Domo de estudio parejo: softbox grande arriba, paneles adelante y atrás,
  // tiras a los lados y un rebote cálido del piso. Las luces directas siguen
  // a la cámara, así que el entorno sólo da el "aire" y los reflejos.
  lightformer(env, { position: [0, 6, 0.5], scale: [8, 8], intensity: 2.2 });
  lightformer(env, { position: [0, 2, 6], scale: [6, 4], intensity: 1.2 });
  lightformer(env, { position: [0, 2, -6], scale: [6, 4], intensity: 1.2 });
  lightformer(env, { position: [6, 1.5, 0], scale: [1.6, 7], intensity: 1.5 });
  lightformer(env, { position: [-6, 1.5, 0], scale: [1.6, 7], intensity: 1.3 });
  lightformer(env, { position: [3, 4, 4], scale: [2.5, 2.5], intensity: 1.2, form: "circle" });
  lightformer(env, { position: [0, -5, 0], scale: [12, 12], intensity: 0.55, color: "#f1ede6" });

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  env.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  return rt.texture;
}

/**
 * Luces directas que siguen a la cámara (como un set de foto de producto):
 * cualquier vista, incluida la espalda, queda igual de bien iluminada.
 * Offsets en espacio de cámara: +X derecha, +Y arriba, +Z hacia quien mira.
 */
export class StudioLightRig {
  readonly group = new THREE.Group();
  readonly key = new THREE.DirectionalLight("#ffffff", 1.5);
  private readonly fill = new THREE.DirectionalLight("#eef1f8", 0.55);
  private readonly rim = new THREE.DirectionalLight("#ffffff", 0.7);
  private readonly offsets: [THREE.DirectionalLight, THREE.Vector3][] = [
    [this.key, new THREE.Vector3(1.4, 2.2, 2.4).normalize()],
    [this.fill, new THREE.Vector3(-2.6, 0.5, 1.6).normalize()],
    [this.rim, new THREE.Vector3(0.9, 1.8, -3).normalize()],
  ];
  private radius = 0.5;
  private readonly center = new THREE.Vector3();

  constructor() {
    this.group.name = "studio-lights";
    const { key } = this;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.002;
    key.shadow.radius = 4;
    for (const [light] of this.offsets) this.group.add(light, light.target);
    this.group.add(new THREE.HemisphereLight("#ffffff", "#d9d4cc", 0.3));
  }

  /** Ajusta la cámara de sombra de la luz principal a la prenda actual. */
  fit(center: THREE.Vector3, radius: number) {
    this.center.copy(center);
    this.radius = radius;
    const cam = this.key.shadow.camera;
    cam.left = -radius * 1.2;
    cam.right = radius * 1.2;
    cam.top = radius * 1.2;
    cam.bottom = -radius * 1.2;
    cam.near = radius * 1.5;
    cam.far = radius * 7;
    cam.updateProjectionMatrix();
  }

  /** Reubica las luces según la orientación actual de la cámara. */
  follow(camera: THREE.Camera) {
    for (const [light, offset] of this.offsets) {
      const dir = offset.clone().applyQuaternion(camera.quaternion);
      light.position.copy(this.center).addScaledVector(dir, this.radius * 4);
      light.target.position.copy(this.center);
      light.updateMatrixWorld();
      light.target.updateMatrixWorld();
    }
  }
}

/** Capa de objetos que sólo ve la cámara de la sombra de contacto. */
export const SHADOW_ONLY_LAYER = 1;

/**
 * Sombra de contacto suave bajo la prenda (port de `ContactShadows` de drei):
 * se renderiza la profundidad desde abajo con una cámara ortográfica, se
 * desenfoca dos veces y se pinta en un plano transparente.
 */
export class ContactShadows {
  readonly group = new THREE.Group();
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly rtBlur: THREE.WebGLRenderTarget;
  private readonly plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly camera: THREE.OrthographicCamera;
  private readonly depthMaterial: THREE.MeshDepthMaterial;
  private readonly hBlur: THREE.ShaderMaterial;
  private readonly vBlur: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blur = 2;
  private dirty = true;

  constructor(resolution = 512) {
    this.rt = new THREE.WebGLRenderTarget(resolution, resolution);
    this.rtBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    this.rt.texture.generateMipmaps = false;
    this.rtBlur.texture.generateMipmaps = false;

    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: this.rt.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      }),
    );
    // Plano acostado mirando hacia arriba; la textura se ve desde la cámara de abajo,
    // así que se voltea en Y para que coincida con la silueta.
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.scale.y = -1;
    this.plane.renderOrder = -1;
    this.group.add(this.plane);

    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    this.camera.rotation.x = Math.PI / 2; // mira hacia arriba
    this.camera.layers.enable(SHADOW_ONLY_LAYER);
    this.group.add(this.camera);

    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.depthTest = false;
    this.depthMaterial.depthWrite = false;
    this.depthMaterial.side = THREE.DoubleSide;
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.ucolor = { value: new THREE.Color("#000000") };
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "uniform vec3 ucolor;\nvoid main() {",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );",
      );
    };

    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.hBlur.depthTest = this.vBlur.depthTest = false;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.hBlur);
  }

  /** Coloca la sombra bajo la prenda: `floorY` es el piso; `far` lo alto que "ve". */
  configure(center: THREE.Vector3, floorY: number, opts: { size: number; far: number; blur: number; opacity: number }) {
    this.group.position.set(center.x, floorY, center.z);
    this.plane.scale.set(opts.size, -opts.size, 1);
    this.plane.material.opacity = opts.opacity;
    const half = opts.size / 2;
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.near = 0;
    this.camera.far = opts.far;
    this.camera.updateProjectionMatrix();
    this.blur = opts.blur;
    this.dirty = true;
  }

  invalidate() {
    this.dirty = true;
  }

  private blurPass(renderer: THREE.WebGLRenderer, amount: number) {
    this.quad.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.rt.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(this.rtBlur);
    renderer.render(this.quad, this.quadCamera);

    this.quad.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.rtBlur.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(this.rt);
    renderer.render(this.quad, this.quadCamera);
  }

  /** Recalcula la sombra si la prenda cambió. */
  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    if (!this.dirty) return;
    this.dirty = false;
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = scene.overrideMaterial;
    const prevBackground = scene.background;
    const prevClearAlpha = renderer.getClearAlpha();
    const prevShadowAuto = renderer.shadowMap.autoUpdate;

    this.plane.visible = false;
    scene.background = null;
    scene.overrideMaterial = this.depthMaterial;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, this.camera);
    this.blurPass(renderer, this.blur);
    this.blurPass(renderer, this.blur * 0.4);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevClearAlpha);
    renderer.shadowMap.autoUpdate = prevShadowAuto;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBackground;
    this.plane.visible = true;
  }

  dispose() {
    this.rt.dispose();
    this.rtBlur.dispose();
    this.plane.geometry.dispose();
    this.plane.material.dispose();
    this.depthMaterial.dispose();
    this.hBlur.dispose();
    this.vBlur.dispose();
    this.quad.geometry.dispose();
  }
}
