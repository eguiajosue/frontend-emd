#!/usr/bin/env node
/**
 * Copia las banderas de `flag-icons` (MIT) a `public/flags/` y genera la
 * lista de países con su nombre en español (`src/lib/mockups/flagNames.ts`).
 *
 * Se corre a mano cuando se actualiza `flag-icons`:
 *
 *   pnpm --filter web flags:copy
 *
 * Por qué se versionan las copias en vez de copiarlas en cada build: el build
 * de Vercel/turbo, el e2e (`npx next build`) y `next dev` llegarían por
 * caminos distintos y bastaba que uno se saltara el paso para que la
 * biblioteca se quedara sin banderas. Así son archivos estáticos de siempre.
 * El service worker NO las precachea (ver `globPublicPatterns` en
 * next.config.js): sólo bajan las que se ven.
 *
 * Sólo se copian los SVG 4x3 (los que se rasterizan al agregarlos al mockup)
 * de los países ISO 3166-1 más unos pocos extra útiles para uniformes.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = dirname(require.resolve("flag-icons/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const countries = JSON.parse(readFileSync(join(pkgDir, "country.json"), "utf8"));

/** Fuera de ISO 3166-1 pero se piden en uniformes, con su nombre en español. */
const EXTRA = {
  xk: "Kosovo",
  "gb-eng": "Inglaterra",
  "gb-sct": "Escocia",
  "gb-wls": "Gales",
  "gb-nir": "Irlanda del Norte",
  eu: "Unión Europea",
  un: "Naciones Unidas",
};

const names = new Intl.DisplayNames(["es-MX"], { type: "region" });
const entries = [];
for (const c of countries) {
  if (!c.iso) continue;
  const name = names.of(c.code.toUpperCase());
  if (!name || name.toUpperCase() === c.code.toUpperCase()) throw new Error(`Sin nombre en español: ${c.code}`);
  entries.push([c.code, name]);
}
for (const [code, name] of Object.entries(EXTRA)) {
  if (!entries.some(([c]) => c === code)) entries.push([code, name]);
}
entries.sort((a, b) => a[0].localeCompare(b[0]));

const outDir = join(root, "public", "flags");
if (existsSync(outDir)) {
  for (const f of readdirSync(outDir)) if (f.endsWith(".svg")) rmSync(join(outDir, f));
}
mkdirSync(outDir, { recursive: true });
for (const [code] of entries) {
  copyFileSync(join(pkgDir, "flags", "4x3", `${code}.svg`), join(outDir, `${code}.svg`));
}

const license = readFileSync(join(pkgDir, "LICENSE"), "utf8").trim();
writeFileSync(
  join(outDir, "README.md"),
  `# Banderas de la biblioteca de mockups

- Origen: [flag-icons](https://github.com/lipis/flag-icons) v${version}, SVG 4x3 sin cambios.
- Licencia: MIT (texto abajo).
- Se generan con \`pnpm --filter web flags:copy\` (\`apps/web/scripts/copy-flags.mjs\`), que también
  escribe la lista de países con su nombre en español en \`src/lib/mockups/flagNames.ts\`.
- ${entries.length} banderas: los países ISO 3166-1 más Kosovo, Inglaterra, Escocia, Gales,
  Irlanda del Norte, Unión Europea y Naciones Unidas.

\`\`\`
${license}
\`\`\`
`,
);

const ts = `/**
 * Banderas disponibles en \`public/flags/\` con su nombre en español (México).
 * GENERADO por \`apps/web/scripts/copy-flags.mjs\` desde flag-icons v${version};
 * no editar a mano.
 */
export const FLAG_NAMES_ES: Readonly<Record<string, string>> = {
${entries.map(([code, name]) => `  ${JSON.stringify(code)}: ${JSON.stringify(name)},`).join("\n")}
};
`;
writeFileSync(join(root, "src", "lib", "mockups", "flagNames.ts"), ts);

console.log(`${entries.length} banderas copiadas a public/flags (flag-icons v${version}).`);
