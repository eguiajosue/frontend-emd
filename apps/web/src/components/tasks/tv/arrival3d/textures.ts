import * as THREE from "three";

/**
 * Texturas procedurales de la llegada 3D, todas dibujadas en <canvas> (sin
 * descargas: ni la red ni la CSP las necesitan): el logo de la impresora, el
 * sprite de los brillos y el ticket del pedido copiado del DOM.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
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

/**
 * Logo en relieve del frente de la impresora: "EMD" en gris claro con una
 * sombra apenas más oscura abajo (parece estampado en el plástico).
 */
export function createLogoTexture(font: string): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const [c, ctx] = canvas(W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 84px ${font}`;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText("EMD", W / 2, H / 2 + 3);
  ctx.fillStyle = "rgba(226,232,240,0.92)";
  ctx.fillText("EMD", W / 2, H / 2);
  return toTexture(c);
}

// --- El ticket: copia del DOM a canvas ------------------------------------------

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
 * Dibuja el ticket DOM (ya renderizado, invisible) en un canvas a `scale`×:
 * fondos (también las rayitas y las barras del código, que son <span> con
 * fondo), textos con su fuente/color exactos e íconos SVG. Así el ticket 3D es
 * el mismo que después vuela como DOM y el pase entre los dos no se nota.
 */
export async function paintTicketFromDom(
  root: HTMLElement,
  scale = 3
): Promise<{ texture: THREE.CanvasTexture; width: number; height: number }> {
  const box = root.getBoundingClientRect();
  const width = box.width;
  const height = box.height;
  const [c, ctx] = canvas(Math.ceil(width * scale), Math.ceil(height * scale));
  ctx.scale(scale, scale);

  const rootStyle = getComputedStyle(root);
  ctx.save();
  roundRect(ctx, 0, 0, width, height, parseFloat(rootStyle.borderTopLeftRadius) || 0);
  ctx.fillStyle =
    rootStyle.backgroundColor && rootStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ? rootStyle.backgroundColor : "#ffffff";
  ctx.fill();
  ctx.clip();

  const ox = -box.left;
  const oy = -box.top;
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
      const spacing = s.letterSpacing === "normal" ? "0px" : s.letterSpacing;
      // Sólo lo que el DOM corta de verdad (`truncate`) se corta aquí con "…";
      // si no, la medida del canvas (un pelo distinta) no debe recortar nada.
      const clipped = parent.scrollWidth > parent.clientWidth + 1;
      const limit = clipped ? parent.getBoundingClientRect().right - r.left : Infinity;
      texts.push(() => {
        ctx.font = font;
        ctx.fillStyle = color;
        // El espaciado del DOM (`tracking-*`) también: si no, el ancho no coincide.
        if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = spacing;
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
