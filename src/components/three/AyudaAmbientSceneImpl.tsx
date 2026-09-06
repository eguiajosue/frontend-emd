"use client";

/**
 * Implementación real del elemento ambiental 3D de la sección de intro de
 * Ayuda (ver AyudaAmbientScene.tsx para por qué vive en un módulo aparte).
 *
 * Un único blob de partículas muy sutil, quieto salvo una rotación lentísima
 * — un acento discreto que complementa el parallax existente sin competir
 * con el texto de la guía.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AmbientCanvas } from "./AmbientCanvas";

const PARTICLE_COUNT = 220;

function useBrandColor(fallback: string) {
  return useMemo(() => {
    if (typeof document === "undefined") return new THREE.Color(fallback);
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--brand-500")
      .trim();
    if (!raw) return new THREE.Color(fallback);
    return new THREE.Color(`hsl(${raw.replace(/\s+/g, ", ")})`);
  }, [fallback]);
}

function ParticleBlob() {
  const ref = useRef<THREE.Points>(null);
  const color = useBrandColor("#e0447e");

  const positions = useMemo(() => {
    const points = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      // Distribución esférica suave (radio con jitter) en vez de una grilla,
      // para que el blob se vea orgánico y no como una figura geométrica.
      const radius = 1.6 + Math.random() * 0.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      points[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      points[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      points[i * 3 + 2] = radius * Math.cos(phi);
    }
    return points;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.05;
    ref.current.rotation.x += delta * 0.015;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}

export default function AyudaAmbientSceneImpl() {
  return (
    <AmbientCanvas
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      camera={{ position: [0, 0, 5], fov: 35 }}
    >
      <ParticleBlob />
    </AmbientCanvas>
  );
}
