# Banderas de la biblioteca de mockups

- Origen: [flag-icons](https://github.com/lipis/flag-icons) v7.5.0 (`flags/4x3/*.svg`, sin cambios).
- Licencia: MIT — ver `LICENSE` en esta carpeta (Copyright (c) 2013 Panayiotis Lipiridis).
- 249 países ISO 3166-1. Los nombres en español salen de `Intl.DisplayNames("es")`.
- Se regeneran con `pnpm --filter web flags:sync` (`apps/web/scripts/sync-flags.mjs`), que también
  escribe `src/lib/mockups/flagCodes.ts`. No se importa el CSS de flag-icons.
