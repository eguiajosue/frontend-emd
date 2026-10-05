/**
 * Detección de WebGL antes de montar el lienzo 3D (decisión R3).
 *
 * three@0.169 sólo dibuja con WebGL 2, así que eso es lo que se exige. El
 * contexto de prueba se libera de inmediato para no gastar uno de los pocos
 * que permite el navegador.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    if (!("WebGL2RenderingContext" in window)) return false;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
