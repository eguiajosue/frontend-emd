// Reexporta el cliente HTTP compartido; ver `@emd/api-client/src/api.ts`.
// El registro del handler de 401 se hace en `./authFetch`, importado aquí
// para garantizar que corre antes de la primera llamada.
import "./authFetch";

export * from "@emd/api-client";

// Mensajes de error unificados (catálogo en español). El export local gana
// sobre el `export *` de arriba, así los ~60 sitios que importan
// `getErrorMessage` de "@/lib/api" usan el catálogo sin cambios.
export { getErrorMessage, describeError, getErrorTitle } from "./errorMessages";
