import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Descarga de GLB del creador de mockups. Una sola descarga por sesión y por
 * archivo: cambiar de producto o remontar el lienzo reutiliza el GLB ya
 * parseado (cada renderer sube sus propios buffers).
 */

const cache = new Map<string, Promise<GLTF>>();

export function loadGlb(url: string): Promise<GLTF> {
  let promise = cache.get(url);
  if (!promise) {
    const loader = new GLTFLoader();
    // Las texturas embebidas del GLB se leen como blob:. El ImageBitmapLoader
    // por defecto usa fetch() y la CSP (connect-src) no permite blob:; con
    // <img> (TextureLoader) sí, porque img-src incluye blob:.
    loader.register((parser) => {
      (parser as unknown as { textureLoader: THREE.Loader }).textureLoader = new THREE.TextureLoader(
        parser.options.manager,
      );
      return { name: "EMD_img_texture_loader" };
    });
    promise = loader.loadAsync(url).catch((err) => {
      cache.delete(url); // permite reintentar
      throw err;
    });
    cache.set(url, promise);
  }
  return promise;
}
