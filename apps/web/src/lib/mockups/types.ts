/**
 * Contrato compartido del creador de mockups 3D (ver docs/plans/mockups-3d.md).
 *
 * El estudio (panel de controles), el lienzo 3D y el guardado en el pedido
 * hablan sólo a través de estos tipos. Las coordenadas de `placement` están en
 * el espacio local de la prenda (el mismo que usan los presets de cada modelo).
 */

export type Garment = "tshirt" | "cap";

export type Vec3 = [number, number, number];

/** Dónde y cómo va un diseño sobre la prenda. */
export interface DesignPlacement {
  /** Punto sobre la superficie de la prenda. */
  position: Vec3;
  /** Normal de la superficie en ese punto (hacia afuera). */
  normal: Vec3;
  /** Ancho del diseño en unidades de la escena; el alto sale de `aspect`. */
  scale: number;
  /** Giro del diseño sobre la superficie, en radianes. */
  rotation: number;
}

/** Un diseño (logo/arte del cliente) colocado sobre la prenda. */
export interface DesignLayer {
  id: string;
  name: string;
  /** PNG ya reducido a ≤ MAX_DESIGN_PX por su lado mayor (decisión R1). */
  dataUrl: string;
  /** Ancho / alto de la imagen. */
  aspect: number;
  placement: DesignPlacement;
}

/** Colores de la prenda. La gorra trucker pinta frente, malla y visera aparte. */
export interface GarmentColors {
  body: string;
  mesh?: string;
  visor?: string;
}

export interface MockupConfig {
  garment: Garment;
  colors: GarmentColors;
  layers: DesignLayer[];
}

/** Vistas fijas de cámara (botones del estudio y láminas de exportación). */
export type MockupView = "front" | "back" | "left" | "right";

/** Posición predeterminada para colocar un diseño con un botón. */
export interface PlacementPreset {
  id: string;
  label: string;
  placement: Omit<DesignPlacement, "rotation"> & { rotation?: number };
  /** Vista a la que conviene girar la cámara al aplicar el preset. */
  view: MockupView;
}

/** Lado mayor máximo de un diseño importado (R1). */
export const MAX_DESIGN_PX = 1024;

/** Tope del cuerpo que acepta el backend para un mockup (R1). */
export const MAX_MOCKUP_BYTES = 8 * 1024 * 1024;

export const DEFAULT_COLORS: Record<Garment, GarmentColors> = {
  tshirt: { body: "#ffffff" },
  cap: { body: "#1f2937", mesh: "#ffffff", visor: "#1f2937" },
};

export const GARMENT_LABELS: Record<Garment, string> = {
  tshirt: "Playera",
  cap: "Gorra",
};

/** Resultado de exportar: lámina PNG lista para descargar o adjuntar. */
export interface MockupExport {
  /** `data:image/png;base64,...` */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * API imperativa que expone el lienzo 3D al estudio (vía ref).
 * `exportSheet` renderiza las vistas Frente / Espalda / Lado en una lámina.
 */
export interface MockupCanvasHandle {
  exportSheet: () => Promise<MockupExport>;
  setView: (view: MockupView) => void;
}

/** Lo que el backend guarda por mockup (respuesta de GET /orders/:id/mockups). */
export interface OrderMockupSummary {
  id: number;
  orderId: number;
  garment: Garment;
  createdAt: string;
  createdBy?: { id: number; name: string } | null;
}

export interface OrderMockupDetail extends OrderMockupSummary {
  /** `data:image/png;base64,...` */
  dataUrl: string;
  config: MockupConfig;
}

/** Cuerpo de POST /orders/:id/mockups. */
export interface CreateOrderMockupPayload {
  garment: Garment;
  imageDataUrl: string;
  config: MockupConfig;
}

/**
 * Props de `components/mockups/MockupCanvas.tsx` (se carga con next/dynamic,
 * ssr:false, desde `components/mockups/MockupCanvasLazy.tsx`). El ref expone
 * `MockupCanvasHandle`.
 */
export interface MockupCanvasProps {
  config: MockupConfig;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  /** Al arrastrar un diseño sobre la prenda (una vez por frame como mucho). */
  onPlacementChange: (id: string, placement: DesignPlacement) => void;
  view: MockupView;
  /** Avisa cuando el usuario gira la prenda con el mouse/dedo (vista libre). */
  onViewChange?: (view: MockupView | null) => void;
  className?: string;
}
