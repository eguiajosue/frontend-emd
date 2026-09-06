"use client";

/**
 * Punto de entrada público del acento 3D de la intro de Ayuda. Igual que
 * LoginAmbientScene: carga perezosa, sólo cliente, para que Three.js no
 * entre al bundle de /dashboard/ayuda (ni de ninguna otra ruta) por defecto.
 */
import dynamic from "next/dynamic";

const AyudaAmbientScene = dynamic(() => import("./AyudaAmbientSceneImpl"), {
  ssr: false,
});

export default AyudaAmbientScene;
