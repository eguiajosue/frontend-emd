"use client";

import { motion } from "framer-motion";
import type { LedMode } from "@/lib/arrival3d";

/**
 * Impresora térmica plana (SVG) de la llegada 2D: carcasa oscura, tapa
 * clara, ranura con barra de corte dentada, cuchilla, LED de estado del color
 * de la prioridad, botón de avance y logo. La ranura está a ≈18 % del alto
 * (ahí apoyan los tickets). Colores fijos: no depende del tema.
 */
export function PrinterFlat({
  color,
  led,
  ledHz,
  cutting,
  awake,
}: {
  color: string;
  led: LedMode;
  ledHz: number;
  cutting: boolean;
  awake: boolean;
}) {
  const ledAnim =
    !awake
      ? { opacity: 0.3 }
      : led === "blink"
        ? { opacity: [1, 1, 0.15, 0.15], transition: { duration: 1 / Math.max(ledHz, 0.1), repeat: Infinity, times: [0, 0.6, 0.6, 1] } }
        : led === "breathe"
          ? { opacity: [0.35, 1, 0.35], transition: { duration: 1 / Math.max(ledHz, 0.1), repeat: Infinity, ease: "easeInOut" as const } }
          : { opacity: 1 };
  return (
    <svg viewBox="0 0 240 110" className="relative block w-full" aria-hidden>
      {/* Tapa del rollo (atrás) y su junta. */}
      <rect x="28" y="2" width="184" height="22" rx="9" fill="#d5d9df" />
      <rect x="28" y="20" width="184" height="3" fill="#0b0c0e" opacity="0.6" />
      {/* Cuerpo. */}
      <rect x="6" y="18" width="228" height="86" rx="14" fill="#23272e" />
      <rect x="6" y="18" width="228" height="10" rx="5" fill="#2e333b" />
      {/* Ranura y barra de corte dentada. */}
      <rect x="34" y="17" width="172" height="5" rx="1.5" fill="#050608" />
      <rect x="30" y="22" width="180" height="4" rx="2" fill="#c7ccd4" />
      <path
        d={Array.from({ length: 30 }, (_, i) => `M${32 + i * 6} 22 l3 -3 l3 3`).join(" ")}
        fill="#c7ccd4"
      />
      {/* Cuchilla: cruza la boca al cortar. */}
      <motion.rect
        y="16"
        width="36"
        height="3"
        rx="1"
        fill="#e5e7eb"
        initial={{ x: 0, opacity: 0 }}
        animate={cutting ? { x: [0, 204, 0], opacity: [1, 1, 0] } : { x: 0, opacity: 0 }}
        transition={{ duration: 0.25, times: [0, 0.35, 1] }}
      />
      {/* Frente: LED, botón, logo. */}
      <motion.circle cx="34" cy="64" r="5" fill={color} initial={{ opacity: 0.3 }} animate={ledAnim} />
      <circle cx="34" cy="64" r="9" fill={color} opacity="0.18" />
      <rect x="50" y="59" width="26" height="10" rx="4" fill="#3b414b" />
      <text x="196" y="69" textAnchor="middle" fontSize="15" fontWeight="800" fill="#e2e8f0" opacity="0.85" fontFamily="ui-sans-serif, system-ui">
        EMD
      </text>
      <rect x="12" y="100" width="216" height="6" rx="3" fill="#101215" />
    </svg>
  );
}
