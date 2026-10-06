import * as THREE from "three";

/**
 * Texturas procedurales de la llegada 3D, todas dibujadas en <canvas> (sin
 * descargas: ni la red ni la CSP las necesitan). Cartón kraft con fibras y
 * corrugado, la etiqueta de envío, las marcas impresas, los sprites del
 * destello y la hoja del pedido copiada del DOM.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  return [c, ctx];
}

/** Generador pseudoaleatorio con semilla: el cartón sale igual en cada llegada. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export interface CardboardMaps {
  /** Cara exterior (kraft). */
  outer: THREE.CanvasTexture;
  /** Cara interior (más oscura, sin impresión). */
  inner: THREE.CanvasTexture;
  /** Relieve del corrugado (escala de grises, sin espacio de color). */
  bump: THREE.CanvasTexture;
}

/** Cartón kraft: base con variación, motas, fibras y el corrugado apenas marcado. */
export function createCardboardMaps(size = 512): CardboardMaps {
  const paint = (base: [number, number, number], seed: number, dark: number) => {
    const [c, ctx] = canvas(size, size);
    const r = rng(seed);
    const [br, bg, bb] = base;
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, `rgb(${br + 8},${bg + 6},${bb + 4})`);
    grad.addColorStop(1, `rgb(${br - 8},${bg - 8},${bb - 6})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    // Manchas grandes y suaves (la pulpa no es pareja).
    for (let i = 0; i < 40; i++) {
      const x = r() * size;
      const y = r() * size;
      const rad = 30 + r() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const light = r() > 0.5;
      g.addColorStop(0, light ? "rgba(255,240,215,0.07)" : `rgba(60,35,10,${0.05 + dark * 0.05})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Corrugado: franjas verticales muy tenues.
    for (let x = 0; x < size; x += 6) {
      ctx.fillStyle = `rgba(70,40,15,${0.025 + (x % 12 === 0 ? 0.02 : 0)})`;
      ctx.fillRect(x, 0, 2, size);
    }
    // Fibras cortas.
    ctx.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = r() * size;
      const y = r() * size;
      const len = 3 + r() * 10;
      const a = r() * Math.PI;
      ctx.strokeStyle = r() > 0.55 ? "rgba(255,235,200,0.10)" : "rgba(55,30,8,0.12)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // Motas.
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = r() > 0.5 ? "rgba(40,22,6,0.18)" : "rgba(255,245,225,0.12)";
      ctx.fillRect(r() * size, r() * size, 1 + r() * 1.4, 1 + r() * 1.4);
    }
    return c;
  };

  const [bumpCanvas, bctx] = canvas(256, 256);
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 6) {
    const g = bctx.createLinearGradient(x, 0, x + 6, 0);
    g.addColorStop(0, "#6c6c6c");
    g.addColorStop(0.5, "#959595");
    g.addColorStop(1, "#6c6c6c");
    bctx.fillStyle = g;
    bctx.fillRect(x, 0, 6, 256);
  }
  const bump = toTexture(bumpCanvas, false);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return {
    outer: toTexture(paint([190, 146, 98], 7, 0)),
    inner: toTexture(paint([150, 108, 66], 11, 1)),
    bump,
  };
}

/** Marcas impresas de los costados: flechas "este lado arriba" y copa "frágil". */
export function createSidePrint(size = 512): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  ctx.strokeStyle = "rgba(48,30,14,0.72)";
  ctx.fillStyle = "rgba(48,30,14,0.72)";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Dos flechas arriba (esquina superior izquierda).
  for (const ox of [70, 120]) {
    ctx.beginPath();
    ctx.moveTo(ox, 175);
    ctx.lineTo(ox, 85);
    ctx.moveTo(ox - 22, 108);
    ctx.lineTo(ox, 85);
    ctx.lineTo(ox + 22, 108);
    ctx.stroke();
  }
  ctx.fillRect(40, 190, 110, 9);
  // Copa (frágil).
  ctx.beginPath();
  ctx.moveTo(380, 85);
  ctx.lineTo(450, 85);
  ctx.quadraticCurveTo(452, 150, 415, 160);
  ctx.quadraticCurveTo(378, 150, 380, 85);
  ctx.moveTo(415, 160);
  ctx.lineTo(415, 200);
  ctx.moveTo(392, 202);
  ctx.lineTo(438, 202);
  ctx.stroke();
  const tex = toTexture(c);
  return tex;
}

/** Fuente de títulos de la app (la que usa `font-heading`), para dibujar en canvas. */
export function headingFontFamily(): string {
  const probe = document.createElement("span");
  probe.className = "font-heading";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily || "ui-sans-serif, system-ui, sans-serif";
  probe.remove();
  return family;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Etiqueta de envío pegada al frente: franja del color de la prioridad,
 * número de pedido (o "N pedidos nuevos") y un código de barras.
 */
export function createShippingLabel(opts: {
  title: string;
  subtitle: string;
  color: string;
  font: string;
  stamp?: string;
}): THREE.CanvasTexture {
  const W = 640;
  const H = 400;
  const [c, ctx] = canvas(W, H);
  ctx.save();
  roundRect(ctx, 4, 4, W - 8, H - 8, 22);
  ctx.fillStyle = "#fbfaf7";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = opts.color;
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 30px ${opts.font}`;
  ctx.textBaseline = "middle";
  ctx.fillText(opts.subtitle.toUpperCase(), 30, 29);
  ctx.fillStyle = "#0f172a";
  let size = 112;
  ctx.font = `700 ${size}px ${opts.font}`;
  while (ctx.measureText(opts.title).width > W - 60 && size > 40) {
    size -= 6;
    ctx.font = `700 ${size}px ${opts.font}`;
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.title, 30, 82 + size * 0.95);
  // Código de barras (decorativo, determinista según el título).
  const r = rng([...opts.title].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 17));
  let x = 30;
  ctx.fillStyle = "#111827";
  while (x < W - 40) {
    const w = 2 + Math.floor(r() * 6);
    if (r() > 0.35) ctx.fillRect(x, H - 120, w, 84);
    x += w + 2 + Math.floor(r() * 4);
  }
  ctx.restore();
  if (opts.stamp) {
    // Sello "devuelto con cambios", en diagonal y algo gastado.
    ctx.save();
    ctx.translate(W - 170, 170);
    ctx.rotate(-0.22);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = opts.color;
    ctx.fillStyle = opts.color;
    ctx.lineWidth = 8;
    roundRect(ctx, -150, -44, 300, 88, 14);
    ctx.stroke();
    ctx.font = `800 46px ${opts.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.stamp, 0, 3);
    ctx.restore();
  }
  return toTexture(c);
}

/** Punto suave para partículas y destellos (blanco: el color lo pone el material). */
export function createGlowSprite(size = 128, hardness = 0.15): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(hardness, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

/** Anillo suave para las ondas del piso. */
export function createRingSprite(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.75, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

// --- La hoja: copia del DOM a canvas ---------------------------------------------

/** Margen (px CSS) alrededor de la hoja para el aro de color (`ring-4`). */
export const SHEET_RING_PX = 4;

function svgImage(svg: SVGElement, color: string): Promise<HTMLImageElement | null> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const rect = svg.getBoundingClientRect();
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  const markup = clone.outerHTML.replace(/currentColor/g, color);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * Dibuja la hoja DOM (ya renderizada, invisible) en un canvas a `scale`×:
 * fondos y bordes redondeados, textos con su fuente/color exactos e íconos
 * SVG. Así la hoja 3D es la misma que después vuela como DOM y el pase entre
 * las dos no se nota. Deja `SHEET_RING_PX` de margen para el aro de color.
 */
export async function paintSheetFromDom(
  root: HTMLElement,
  ringColor: string,
  scale = 3
): Promise<{ texture: THREE.CanvasTexture; width: number; height: number }> {
  const box = root.getBoundingClientRect();
  const pad = SHEET_RING_PX;
  const width = box.width + pad * 2;
  const height = box.height + pad * 2;
  const [c, ctx] = canvas(Math.ceil(width * scale), Math.ceil(height * scale));
  ctx.scale(scale, scale);

  const rootStyle = getComputedStyle(root);
  const radius = parseFloat(rootStyle.borderTopLeftRadius) || 16;
  // Aro (ring-4) y hoja.
  roundRect(ctx, 0, 0, width, height, radius + pad);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.save();
  roundRect(ctx, pad, pad, box.width, box.height, radius);
  ctx.fillStyle = rootStyle.backgroundColor && rootStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ? rootStyle.backgroundColor : "#ffffff";
  ctx.fill();
  ctx.clip();

  const ox = pad - box.left;
  const oy = pad - box.top;
  const icons: Promise<void>[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  // Fondos primero (en orden de documento), textos e íconos encima.
  const texts: (() => void)[] = [];
  for (let node = walker.currentNode as Node | null; node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el instanceof SVGElement && el.tagName.toLowerCase() === "svg") {
        const r = el.getBoundingClientRect();
        const color = getComputedStyle(el).color;
        icons.push(
          svgImage(el, color).then((img) => {
            if (img) texts.push(() => ctx.drawImage(img, r.left + ox, r.top + oy, r.width, r.height));
          })
        );
        continue;
      }
      if (el === root || !(el instanceof HTMLElement)) continue;
      const s = getComputedStyle(el);
      if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent") {
        const r = el.getBoundingClientRect();
        roundRect(ctx, r.left + ox, r.top + oy, r.width, r.height, parseFloat(s.borderTopLeftRadius) || 0);
        ctx.fillStyle = s.backgroundColor;
        ctx.fill();
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest("svg")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0) continue;
      const s = getComputedStyle(parent);
      const font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const color = s.color;
      // Sólo lo que el DOM corta de verdad (`truncate`) se corta aquí con "…";
      // si no, la medida del canvas (un pelo distinta) no debe recortar nada.
      const clipped = parent.scrollWidth > parent.clientWidth + 1;
      const limit = clipped ? parent.getBoundingClientRect().right - r.left : Infinity;
      texts.push(() => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textBaseline = "alphabetic";
        const m = ctx.measureText("Hg");
        const asc = m.fontBoundingBoxAscent ?? parseFloat(s.fontSize) * 0.8;
        const desc = m.fontBoundingBoxDescent ?? parseFloat(s.fontSize) * 0.2;
        const baseline = r.top + oy + (r.height - (asc + desc)) / 2 + asc;
        ctx.fillText(ellipsize(ctx, text, Math.max(limit, 10)), r.left + ox, baseline);
      });
    }
  }
  await Promise.all(icons);
  for (const draw of texts) draw();
  ctx.restore();

  const texture = toTexture(c);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture, width, height };
}
