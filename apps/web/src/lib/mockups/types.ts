import type { SizeBreakdown } from "@/lib/garmentSizes";
import type { LaserEngraveSettings } from "./laserEngrave";

/**
 * Contrato compartido del creador de mockups 3D (ver docs/plans/mockups-3d.md).
 *
 * El estudio (panel de controles), el lienzo 3D y el guardado en el pedido
 * hablan sólo a través de estos tipos. Las coordenadas de `placement` están en
 * el espacio local de la prenda (el mismo que usan los presets de cada modelo).
 */

/**
 * Prendas del estudio. "hoodie" y "dress-shirt" ya existen en el contrato
 * (plantillas, registro de prendas, generador de patrones) pero todavía no
 * tienen modelo 3D: la UI sólo ofrece las de `ENABLED_GARMENTS`
 * (`lib/mockups/garments.ts`). "termo", "taza" y "mousepad" no son prendas sino
 * productos promocionales, pero viven en el mismo registro y contrato.
 *
 * "car", "minivan", "pickup", "trailer" y "bicycle" son las ROTULACIONES
 * (vinil sobre vehículos): sin tallas. Carro, minivan, pickup y
 * camión ("trailer") son GLB; la bicicleta es procedural.
 */
export type Garment =
  | "tshirt"
  | "cap"
  | "hoodie"
  | "dress-shirt"
  | "termo"
  | "taza"
  | "mousepad"
  | "car"
  | "minivan"
  | "pickup"
  | "trailer"
  | "bicycle";

/** Parte del tráiler que se rotula: completo, sólo la cabina o sólo la caja. */
export type VehiclePart = "full" | "cab" | "box";

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
  /**
   * Termo: ajustes del grabado láser (umbral, invertir, difuminado). El
   * `dataUrl` siempre es el original; la máscara se calcula al dibujar
   * (`lib/mockups/laserEngrave.ts`). Sin este campo se usan los valores por
   * defecto, así que las configs viejas siguen siendo válidas.
   */
  engrave?: LaserEngraveSettings;
}

/** Colores de la prenda. La gorra trucker pinta frente, malla y visera aparte. */
export interface GarmentColors {
  body: string;
  mesh?: string;
  visor?: string;
}

/** Tipo de tela: lisa, a rayas o a cuadros (camisa de vestir). */
export type FabricPatternKind = "plain" | "stripes" | "plaid";

/** Patrón de la tela. Ver `lib/mockups/fabricPattern.ts`. */
export interface FabricPatternConfig {
  kind: FabricPatternKind;
  /** El primero es el fondo; los demás, las rayas (se repiten en orden). */
  colors: string[];
  /** Grosor de cada raya, en px de la textura. */
  stripeWidth?: number;
  /** Separación entre rayas, en px de la textura. */
  spacing?: number;
  direction?: "vertical" | "horizontal";
}

/**
 * Ajustes propios de algunas prendas (todos opcionales: un mockup de playera o
 * gorra no los lleva y las configs viejas siguen siendo válidas).
 */
export interface GarmentOptions {
  /** Sudadera: con bolsa canguro. */
  pocket?: boolean;
  /** Camisa de vestir: manga larga o corta. */
  sleeve?: "long" | "short";
  /** Camisa de vestir: lisa / rayas / cuadros. */
  pattern?: FabricPatternConfig;
  /** Camisa de vestir: color de los botones (`#rrggbb`). */
  buttonColor?: string;
}

export interface MockupConfig {
  garment: Garment;
  colors: GarmentColors;
  layers: DesignLayer[];
  options?: GarmentOptions;
  /** Desglose de tallas (panel "Tallas"); se imprime como tabla en la lámina. Opcional: mockups viejos no lo traen. */
  sizes?: SizeBreakdown | null;
  /** Tráiler: qué parte se rotula ("full" por defecto). Sólo la lleva el tráiler. */
  vehiclePart?: VehiclePart;
}

/**
 * Vistas fijas de cámara (botones del estudio y láminas de exportación).
 * "top" (arriba) sólo existe para vehículos.
 */
export type MockupView = "front" | "back" | "left" | "right" | "top";

/** Posición predeterminada para colocar un diseño con un botón. */
export interface PlacementPreset {
  id: string;
  label: string;
  placement: Omit<DesignPlacement, "rotation"> & { rotation?: number };
  /** Vista a la que conviene girar la cámara al aplicar el preset. */
  view: MockupView;
  /** Tráiler: en qué partes ("full", "cab", "box") tiene sentido. Sin esto, en todas. */
  parts?: VehiclePart[];
}

/** Lado mayor máximo de un diseño importado (R1). */
export const MAX_DESIGN_PX = 1024;

/** Tope del cuerpo que acepta el backend para un mockup (R1). */
export const MAX_MOCKUP_BYTES = 8 * 1024 * 1024;

export const DEFAULT_COLORS: Record<Garment, GarmentColors> = {
  tshirt: { body: "#ffffff" },
  cap: { body: "#1f2937", mesh: "#ffffff", visor: "#1f2937" },
  hoodie: { body: "#b9bcc0" },
  "dress-shirt": { body: "#ffffff" },
  termo: { body: "#2b2e34" },
  taza: { body: "#ffffff" },
  mousepad: { body: "#1f2937" },
  // Rotulaciones: vehículos blancos (el vinil resalta) salvo la cabina del
  // camión (`body`), que va en azul marino; su caja (`mesh`) es blanca.
  car: { body: "#f4f4f5" },
  minivan: { body: "#f4f4f5" },
  pickup: { body: "#f4f4f5" },
  trailer: { body: "#1f2a44", mesh: "#ffffff" },
  bicycle: { body: "#f4f4f5" },
};

/**
 * Termo sin pintura (acero inoxidable natural). Es un color más del cuerpo
 * para el contrato, pero el 3D lo dibuja metálico y el grabado sale oscuro.
 */
export const RAW_STEEL_HEX = "#c3c7cc";

export function isRawSteel(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === RAW_STEEL_HEX;
}

export const GARMENT_LABELS: Record<Garment, string> = {
  tshirt: "Playera",
  cap: "Gorra",
  hoodie: "Sudadera",
  "dress-shirt": "Camisa de vestir",
  termo: "Termo",
  taza: "Taza",
  mousepad: "Mousepad",
  car: "Carro",
  minivan: "Minivan",
  pickup: "Pickup",
  trailer: "Tráiler",
  bicycle: "Bicicleta",
};

/** Resultado de exportar: lámina PNG lista para descargar o adjuntar. */
export interface MockupExport {
  /** `data:image/png;base64,...` */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Qué descargar: la lámina con todas las vistas o una sola. "side" es el lado
 * de las prendas (el que tenga diseños); "left", "right" y "top" son de los
 * vehículos.
 */
export type DownloadViewKey = "all" | "front" | "back" | "side" | "left" | "right" | "top";

/**
 * API imperativa que expone el lienzo 3D al estudio (vía ref).
 * `exportSheet` renderiza las vistas Frente / Espalda / Lado en una lámina.
 */
export interface MockupCanvasHandle {
  /**
   * `sizes`: desglose de tallas a imprimir como tabla al pie (opcional).
   * `only`: "all" (por defecto) = lámina con las tres vistas; "front" | "back" |
   * "side" = una sola vista.
   */
  exportSheet: (sizes?: SizeBreakdown | null, only?: DownloadViewKey) => Promise<MockupExport>;
  /**
   * Miniatura chica (≈ 400 × 400, sólo la vista de frente, JPEG) para las
   * plantillas: pesa muy poco (≤ MAX_TEMPLATE_THUMBNAIL_BYTES, 96 KB).
   */
  exportThumbnail: () => Promise<MockupExport>;
  setView: (view: MockupView) => void;
}

/* ------------------------------ Mis colores ------------------------------ */

/**
 * Colores propios del usuario en el estudio (preferencia por usuario,
 * `PATCH /users/me/preferences { mockupColors }`). Hex `#rrggbb`.
 */
export interface MockupColorsPreference {
  favorites: string[];
  custom: string[];
}

/** Tope por lista que acepta el backend. */
export const MAX_MY_COLORS = 48;

/* ------------------------------- Plantillas ------------------------------- */

/** Plantilla compartida por la empresa (`GET /mockup-templates`). */
export interface MockupTemplateSummary {
  id: number;
  name: string;
  garment: Garment;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string } | null;
  /** Miniatura (`data:image/...`). */
  thumbnailUrl: string;
}

export interface MockupTemplateDetail extends MockupTemplateSummary {
  config: MockupConfig;
}

/** Cuerpo de `POST /mockup-templates`. */
export interface CreateMockupTemplatePayload {
  name: string;
  garment: Garment;
  config: MockupConfig;
  thumbnailDataUrl: string;
}

/** La miniatura de una plantilla no puede pasar de esto (backend, decisión R6). */
export const MAX_TEMPLATE_THUMBNAIL_BYTES = 96 * 1024;

/* --------------------------------- Logos --------------------------------- */

/** Logo de la biblioteca de la empresa (`GET /mockup-logos`, sin imagen). */
export interface MockupLogoSummary {
  id: number;
  name: string;
  createdAt: string;
  createdBy: { id: number; name: string } | null;
  useCount: number;
  lastUsedAt: string | null;
}

/** Tope de la imagen de un logo (PNG). */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Miniatura del logo para la cuadrícula (R7): PNG de ≤ 160 px y ≤ 24 KB. */
export const LOGO_THUMBNAIL_PX = 160;
export const MAX_LOGO_THUMBNAIL_BYTES = 24 * 1024;

/** Lo que el backend guarda por mockup (respuesta de GET /orders/:id/mockups). */
export interface OrderMockupSummary {
  id: number;
  orderId: number;
  garment: Garment;
  createdAt: string;
  createdBy?: { id: number; name: string } | null;
  /** Empleado de la sucursal que lo armó (sólo mockups de sucursal). */
  branchEmployee?: { id: number; name: string };
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
  /** Empleado de la sucursal que lo armó (opcional; sólo cuenta de sucursal). */
  branchEmployeeId?: number;
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
