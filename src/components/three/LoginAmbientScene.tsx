"use client";

/**
 * Punto de entrada público de la escena ambiental del login. Carga
 * `LoginAmbientSceneImpl` (y con ella Three.js / @react-three/fiber) de
 * forma perezosa y sólo en el cliente: WebGL no existe en SSR, y así
 * Three.js nunca entra al bundle compartido ni al de rutas que no son
 * /login.
 */
import dynamic from "next/dynamic";

const LoginAmbientScene = dynamic(() => import("./LoginAmbientSceneImpl"), {
  ssr: false,
});

export default LoginAmbientScene;
