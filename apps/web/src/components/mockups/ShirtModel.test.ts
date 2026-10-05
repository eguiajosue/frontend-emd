import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

/**
 * El GLB de la playera se cachea por sesión y se comparte entre lienzos.
 * Cada WebGLRenderer que dibuja su geometría/texturas les cuelga un listener
 * de "dispose" que sólo se quita al disparar ese evento: si el modelo no lo
 * dispara al liberarse, cada apertura del estudio deja vivo al renderer
 * anterior (contexto perdido, canvas y estado interno).
 */

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
const normalMap = new THREE.Texture();
const aoMap = new THREE.Texture();

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  class GLTFLoader {
    register() {
      return this;
    }
    loadAsync() {
      const scene = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ normalMap, aoMap }));
      mesh.name = "T_Shirt_male";
      scene.add(mesh);
      return Promise.resolve({ scene });
    }
  }
  return { GLTFLoader };
});

const { loadShirtModel } = await import("./ShirtModel");

function disposeSpy(target: THREE.EventDispatcher<{ dispose: object }>) {
  const spy = vi.fn();
  target.addEventListener("dispose", spy);
  return spy;
}

describe("loadShirtModel · dispose", () => {
  it("libera de los renderers la geometría y las texturas compartidas del GLB", async () => {
    const model = await loadShirtModel({ body: "#ffffff" });
    const onGeometry = disposeSpy(geometry);
    const onNormal = disposeSpy(normalMap);
    const onAo = disposeSpy(aoMap);

    model.dispose();

    expect(onGeometry).toHaveBeenCalledTimes(1);
    expect(onNormal).toHaveBeenCalledTimes(1);
    expect(onAo).toHaveBeenCalledTimes(1);
  });

  it("la geometría cacheada sigue usable para el siguiente lienzo", async () => {
    const first = await loadShirtModel({ body: "#ffffff" });
    first.dispose();
    const second = await loadShirtModel({ body: "#000000" });
    const mesh = second.decalTargets[0];
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.geometry.attributes.position.count).toBe(3);
    second.dispose();
  });
});
