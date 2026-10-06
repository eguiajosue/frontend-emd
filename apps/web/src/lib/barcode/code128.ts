/**
 * Code 128 sin DOM: el codificador de `jsbarcode` (carga diferida, sólo
 * cuando se va a dibujar una etiqueta) da la secuencia de módulos y aquí se
 * convierte en un `<path>` SVG de barras, que se ve igual en pantalla, en la
 * vista previa y en la impresora.
 */

export interface Code128Bars {
  /** "1" = barra, "0" = espacio; un carácter por módulo. */
  bits: string;
  modules: number;
}

type Encoder = (code: string) => Code128Bars;

let encoderPromise: Promise<Encoder> | null = null;

/** Carga (una vez) el codificador de jsbarcode. */
export function loadCode128(): Promise<Encoder> {
  encoderPromise ??= import("jsbarcode/bin/barcodes/CODE128").then((mod) => {
    // CommonJS: según el bundler, las clases vienen sueltas o bajo `default`.
    type Mod = typeof import("jsbarcode/bin/barcodes/CODE128");
    const CODE128 = mod.CODE128 ?? (mod as unknown as { default: Mod }).default.CODE128;
    return (code: string) => {
      const encoder = new CODE128(code, {});
      if (!encoder.valid()) throw new Error(`"${code}" no se puede codificar en Code 128`);
      const { data } = encoder.encode();
      return { bits: data, modules: data.length };
    };
  });
  return encoderPromise;
}

export async function encodeCode128(code: string): Promise<Code128Bars> {
  const encode = await loadCode128();
  return encode(code);
}

/**
 * `d` de un `<path>` con una barra por cada racha de "1", en unidades de
 * módulo (x) y `height` (y): "M0 0h2v100h-2z M3 0h1v100h-1z …".
 */
export function barsToPath(bits: string, height = 100): string {
  const parts: string[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] !== "1") {
      i++;
      continue;
    }
    let j = i;
    while (j < bits.length && bits[j] === "1") j++;
    const w = j - i;
    parts.push(`M${i} 0h${w}v${height}h-${w}z`);
    i = j;
  }
  return parts.join("");
}
