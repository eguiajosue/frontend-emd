/**
 * Lo mínimo de la llegada 3D que se puede importar sin cargar three.js: ¿hay
 * WebGL?, la carga diferida de la escena (chunk aparte) y su liberación al
 * salir del Modo TV.
 */

type SceneModule = typeof import("./ArrivalScene");

let modulePromise: Promise<SceneModule> | null = null;
let webgl: boolean | null = null;
let software = false;

/** ¿El navegador puede crear un contexto WebGL? (se prueba una vez). */
export function canUseWebGL(): boolean {
  if (webgl != null) return webgl;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webgl = Boolean(ctx);
    const info = ctx?.getExtension("WEBGL_debug_renderer_info");
    const name = info && ctx ? String(ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    software = /swiftshader|llvmpipe|softpipe|software/i.test(name);
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** WebGL por software (sin GPU): la escena baja la calidad para no trabarse. */
export function isSoftwareWebGL(): boolean {
  canUseWebGL();
  return software;
}

/** Carga (una sola vez) el módulo de la escena. */
export function loadArrivalScene(): Promise<SceneModule> {
  if (!modulePromise) {
    modulePromise = import("./ArrivalScene").catch((err) => {
      modulePromise = null;
      throw err;
    });
  }
  return modulePromise;
}

/** Libera el renderer compartido si llegó a crearse. */
export function disposeArrival3D() {
  modulePromise?.then((m) => m.disposeSharedRenderer()).catch(() => {});
}
