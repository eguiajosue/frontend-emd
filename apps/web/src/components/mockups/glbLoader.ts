import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Descarga de GLB del creador de mockups. Una sola descarga por sesión y por
 * archivo: cambiar de producto o remontar el lienzo reutiliza el GLB ya
 * parseado (cada renderer sube sus propios buffers).
 */

const cache = new Map<string, Promise<GLTF>>();

/** Avance de la descarga en curso (0–1, o null si el servidor no manda el tamaño). */
type ProgressListener = (url: string, fraction: number | null) => void;
const listeners = new Set<ProgressListener>();

export function subscribeGlbProgress(listener: ProgressListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadGlb(url: string): Promise<GLTF> {
  let promise = cache.get(url);
  if (!promise) {
    const loader = new GLTFLoader();
    // Las texturas embebidas del GLB se leen como blob:. El ImageBitmapLoader
    // por defecto usa fetch() y la CSP (connect-src) no permite blob:; con
    // <img> (TextureLoader) sí, porque img-src incluye blob:.
    loader.register((parser) => {
      (parser as unknown as { textureLoader: THREE.Loader }).textureLoader =
        new THREE.TextureLoader(parser.options.manager);
      return { name: "EMD_img_texture_loader" };
    });
    promise = loader
      .loadAsync(url, (event) => {
        const fraction =
          event.lengthComputable && event.total > 0
            ? event.loaded / event.total
            : null;
        listeners.forEach((l) => l(url, fraction));
      })
      .catch((err) => {
        cache.delete(url); // permite reintentar
        throw err;
      });
    cache.set(url, promise);
  }
  return promise;
}

/**
 * Calienta la caché (HTTP + service worker) de los modelos que se van a usar
 * después, sin parsearlos. Sólo con buena conexión: en datos móviles o con
 * "ahorro de datos" no se baja nada de más.
 */
export function prefetchGlbs(urls: string[]) {
  if (typeof window === "undefined") return;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    connection?.saveData ||
    (connection?.effectiveType && connection.effectiveType !== "4g")
  )
    return;
  const run = () => {
    for (const url of urls) {
      if (cache.has(url)) continue;
      fetch(url, { priority: "low" } as RequestInit).catch(() => undefined);
    }
  };
  const idle = (
    window as Window & { requestIdleCallback?: (cb: () => void) => void }
  ).requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 2000);
}
