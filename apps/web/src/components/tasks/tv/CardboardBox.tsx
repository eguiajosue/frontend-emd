"use client";

import { useId } from "react";
import { motion } from "framer-motion";

/**
 * Caja de cartón en perspectiva 3/4, dibujada en SVG (sin imágenes). Va en dos
 * capas para que la hoja salga DE ADENTRO: `back` (interior, lado y solapa de
 * atrás) se pinta debajo de la hoja y `front` (cara frontal, solapa de
 * adelante y cinta) encima. Las dos usan el mismo viewBox y se apilan.
 *
 * Las solapas se abren con `scaleY` alrededor de su bisagra: sólo transform,
 * nada de recalcular el path en cada frame.
 */

export const BOX_VIEWBOX = "0 0 240 210";

// Geometría (viewBox 240×210): cara frontal 20..160 × 90..200, profundidad
// hacia arriba-derecha de 60×30.
const FRONT = "20,90 160,90 160,200 20,200";
const SIDE = "160,90 220,60 220,170 160,200";
const OPENING = "20,90 160,90 220,60 80,60";
const FRONT_FLAP = "20,90 160,90 190,75 50,75";
const BACK_FLAP = "50,75 190,75 220,60 80,60";
const SIDE_FLAP = "160,90 220,60 228,72 168,102";

const CARDBOARD = {
  front: "#c98f55",
  frontDark: "#b27a44",
  side: "#9c6634",
  top: "#dba66c",
  interior: "#4a2e16",
  edge: "#7a4a22",
};

interface LayerProps {
  open: boolean;
  /** Color de la prioridad (cinta, etiqueta). */
  accent: string;
  reduced?: boolean;
}

const flapTransition = { type: "spring" as const, bounce: 0.35, duration: 0.55 };

export function CardboardBoxBack({ open, reduced }: LayerProps) {
  return (
    <svg viewBox={BOX_VIEWBOX} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <polygon points={SIDE} fill={CARDBOARD.side} stroke={CARDBOARD.edge} strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points={OPENING} fill={open ? CARDBOARD.interior : CARDBOARD.top} />
      {/* Solapa de atrás: bisagra en el borde trasero, se para hacia arriba. */}
      <motion.polygon
        points={BACK_FLAP}
        fill={CARDBOARD.top}
        stroke={CARDBOARD.edge}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ originX: 0.5, originY: 0 }}
        initial={false}
        animate={{ scaleY: open ? -2.2 : 1 }}
        transition={reduced ? { duration: 0 } : flapTransition}
      />
      <motion.polygon
        points={SIDE_FLAP}
        fill={CARDBOARD.side}
        stroke={CARDBOARD.edge}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ originX: 0, originY: 1 }}
        initial={false}
        animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.6 }}
        transition={reduced ? { duration: 0 } : flapTransition}
      />
    </svg>
  );
}

export function CardboardBoxFront({ open, accent, reduced, label }: LayerProps & { label?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox={BOX_VIEWBOX} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`front-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CARDBOARD.front} />
          <stop offset="1" stopColor={CARDBOARD.frontDark} />
        </linearGradient>
      </defs>
      <polygon
        points={FRONT}
        fill={`url(#front-${id})`}
        stroke={CARDBOARD.edge}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Sombra interior bajo el borde: da grosor al cartón. */}
      <rect x="20" y="90" width="140" height="6" fill="#000" opacity="0.12" />
      {/* Cinta de la prioridad, bajando por el frente. */}
      <rect x="80" y="90" width="20" height="44" fill={accent} opacity="0.92" />
      <rect x="80" y="90" width="20" height="44" fill="#fff" opacity="0.12" />
      {/* Etiqueta de envío. */}
      <rect x="32" y="146" width="96" height="40" rx="4" fill="#fdf8ef" opacity="0.95" />
      <rect x="32" y="146" width="8" height="40" rx="2" fill={accent} />
      {label ? (
        <text
          x="84"
          y="171"
          textAnchor="middle"
          fontSize={label.length > 10 ? 10 : 13}
          fontWeight="700"
          fill="#3b2410"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      ) : (
        <>
          <rect x="46" y="156" width="70" height="5" rx="2" fill="#b9a58a" />
          <rect x="46" y="167" width="48" height="5" rx="2" fill="#d4c3a8" />
        </>
      )}
      {/* Flechas "este lado arriba". */}
      <path d="M140 108 l6 -8 l6 8 M146 100 v14" stroke="#7a4a22" strokeWidth="2" fill="none" opacity="0.55" />
      {/* Solapa de adelante: bisagra en el borde frontal, cae sobre el frente. */}
      <motion.g
        style={{ originX: 0.5, originY: 1 }}
        initial={false}
        animate={{ scaleY: open ? -1.5 : 1 }}
        transition={reduced ? { duration: 0 } : flapTransition}
      >
        <polygon points={FRONT_FLAP} fill={CARDBOARD.top} stroke={CARDBOARD.edge} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Cinta sobre la junta de las solapas (se ve con la caja cerrada). */}
        <polygon points="85,75 105,75 92,82 72,82" fill={accent} opacity={open ? 0 : 0.92} />
      </motion.g>
    </svg>
  );
}
