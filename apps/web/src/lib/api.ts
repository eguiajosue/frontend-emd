// Reexporta el cliente HTTP compartido; ver `@emd/api-client/src/api.ts`.
// El registro del handler de 401 se hace en `./authFetch`, importado acá
// para garantizar que corre antes de la primera llamada.
import "./authFetch";

export * from "@emd/api-client";
