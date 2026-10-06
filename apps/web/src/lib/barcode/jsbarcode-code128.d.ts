/**
 * Tipos mínimos del codificador Code 128 de `jsbarcode` (import profundo:
 * sólo el codificador, sin renderizadores ni DOM). `encode().data` es la
 * secuencia de módulos: "1" = barra, "0" = espacio.
 */
declare module "jsbarcode/bin/barcodes/CODE128" {
  export class CODE128 {
    constructor(data: string, options: Record<string, unknown>);
    valid(): boolean;
    encode(): { data: string; text: string };
  }
}
