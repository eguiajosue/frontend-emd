#!/usr/bin/env node
/**
 * Copia las banderas de `flag-icons` (MIT, devDependency) a `public/flags/`
 * y genera la lista de códigos `src/lib/mockups/flagCodes.ts`.
 *
 *   pnpm --filter web flags:sync
 *
 * Se corre a mano al actualizar `flag-icons`, y el resultado se versiona
 * (decisión R10 de docs/plans/sidebar-y-mockups-v2.md): así no depende de un
 * paso de build que Vercel, turbo, `next dev` o el e2e podrían saltarse, y la
 * licencia queda a la vista. Nunca se importa el CSS de flag-icons.
 *
 * Sólo los 249 países ISO 3166-1 en 4x3 (lo que se rasteriza al agregarlos al
 * mockup). El service worker no los precachea: se cachean al verlos.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = dirname(require.resolve("flag-icons/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const countries = JSON.parse(readFileSync(join(pkgDir, "country.json"), "utf8"));

const codes = countries
  .filter((c) => c.iso)
  .map((c) => c.code)
  .sort();

const outDir = join(root, "public", "flags");
const svgDir = join(outDir, "4x3");
if (existsSync(svgDir)) rmSync(svgDir, { recursive: true });
mkdirSync(svgDir, { recursive: true });
for (const code of codes) {
  copyFileSync(join(pkgDir, "flags", "4x3", `${code}.svg`), join(svgDir, `${code}.svg`));
}
copyFileSync(join(pkgDir, "LICENSE"), join(outDir, "LICENSE"));

writeFileSync(
  join(outDir, "README.md"),
  `# Banderas de la biblioteca de mockups

- Origen: [flag-icons](https://github.com/lipis/flag-icons) v${version} (\`flags/4x3/*.svg\`, sin cambios).
- Licencia: MIT — ver \`LICENSE\` en esta carpeta (Copyright (c) 2013 Panayiotis Lipiridis).
- ${codes.length} países ISO 3166-1. Los nombres en español salen de \`Intl.DisplayNames("es")\`.
- Se regeneran con \`pnpm --filter web flags:sync\` (\`apps/web/scripts/sync-flags.mjs\`), que también
  escribe \`src/lib/mockups/flagCodes.ts\`. No se importa el CSS de flag-icons.
`,
);

writeFileSync(
  join(root, "src", "lib", "mockups", "flagCodes.ts"),
  `/**
 * Códigos ISO 3166-1 (minúsculas) con bandera en \`public/flags/4x3/\`.
 * GENERADO por \`apps/web/scripts/sync-flags.mjs\` desde flag-icons v${version}; no editar a mano.
 */
export const FLAG_CODES: readonly string[] = [
${codes.map((c) => `  "${c}",`).join("\n")}
];
`,
);

console.log(`${codes.length} banderas copiadas a public/flags/4x3 (flag-icons v${version}).`);
