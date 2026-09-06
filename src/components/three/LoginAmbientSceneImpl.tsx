"use client";

/**
 * Implementación real de la textura ambiental del login (icosaedros
 * low-poly derivando muy lentamente detrás del título "EMD Bordados").
 *
 * Vive en un módulo aparte de `LoginAmbientScene.tsx` a propósito: ese
 * archivo la carga con `next/dynamic({ ssr: false })`, y sólo separando el
 * import de three/fiber en su propio módulo Next.js puede partirlo en un
 * chunk aparte — si todo viviera en un solo archivo, Three.js terminaría
 * igual en el bundle de /login aunque se envuelva en dynamic().
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AmbientCanvas } from "./AmbientCanvas";

function useBrandColor(fallback: string) {
  return useMemo(() => {
    if (typeof document === "undefined") return new THREE.Color(fallback);
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--brand-400")
      .trim();
    if (!raw) return new THREE.Color(fallback);
    return new THREE.Color(`hsl(${raw.replace(/\s+/g, ", ")})`);
  }, [fallback]);
}

function DriftingIcosahedron({
  position,
  scale,
  speed,
  color,
  opacity,
}: {
  position: [number, number, number];
  scale: number;
  speed: number;
  color: THREE.Color;
  opacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * speed * 0.4;
    ref.current.rotation.y += delta * speed;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function LoginScene() {
  const color = useBrandColor("#f472b6");

  return (
    <>
      <DriftingIcosahedron
        position={[-1.6, 0.8, 0]}
        scale={1.6}
        speed={0.08}
        color={color}
        opacity={0.22}
      />
      <DriftingIcosahedron
        position={[2, -1, -2]}
        scale={1.1}
        speed={-0.06}
        color={color}
        opacity={0.16}
      />
      <DriftingIcosahedron
        position={[0.6, 1.8, -3]}
        scale={0.7}
        speed={0.1}
        color={color}
        opacity={0.14}
      />
    </>
  );
}

export default function LoginAmbientSceneImpl() {
  return (
    <AmbientCanvas className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <LoginScene />
    </AmbientCanvas>
  );
}
