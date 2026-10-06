/**
 * Content-Security-Policy de la app, armada por request en `src/middleware.ts`.
 *
 * Antes era una cabecera estática en next.config.ts con
 * `script-src 'self' 'unsafe-inline' 'unsafe-eval'`: cualquier XSS podía
 * ejecutar scripts inline. Ahora cada respuesta lleva un nonce nuevo y sólo
 * corren los scripts que lo traen (Next.js lo pone solo en los suyos al leer
 * la CSP de la request; los inline propios lo leen de `x-nonce` vía
 * `headers()`). `'strict-dynamic'` deja que esos scripts confiables carguen
 * los chunks dinámicos (import(), webpack) sin listar URLs.
 *
 * `'unsafe-eval'` sólo en desarrollo: el HMR / React Refresh de Next lo usa.
 * Ninguna dependencia de producción lo necesita (three, @zxing y jsbarcode
 * son JS puro, sin `eval`/`new Function` ni WebAssembly).
 *
 * Los estilos siguen con `'unsafe-inline'`: Tailwind/Radix/Recharts/framer
 * ponen `style=""` en línea, y un nonce en `style-src` anularía ese permiso.
 */

/**
 * `connect-src`: sólo el propio origen y el del backend (NEXT_PUBLIC_BACKEND_URL,
 * más su variante ws/wss). Antes quedaba abierto a cualquier `https:`/`http:`,
 * lo que dejaba a un XSS exfiltrar el token de la sesión a cualquier host. Si
 * la variable falta o es inválida se conserva el comportamiento anterior para
 * no romper la app.
 */
export function resolveConnectSrc(raw: string | undefined): string {
  try {
    if (!raw) throw new Error("missing");
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad");
    const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
    return `connect-src 'self' ${url.origin} ${ws}`;
  } catch {
    return "connect-src 'self' https: wss: http: ws:";
  }
}

export interface CspOptions {
  /**
   * Nonce de esta respuesta. Sin nonce (p. ej. el script del Service Worker,
   * que no tiene HTML ni scripts inline) se permite sólo `'self'`.
   */
  nonce?: string;
  isDev: boolean;
  backendUrl: string | undefined;
}

export function buildContentSecurityPolicy({ nonce, isDev, backendUrl }: CspOptions): string {
  const scriptSrc = [
    "script-src",
    nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'self'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    resolveConnectSrc(backendUrl),
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** Nonce aleatorio en base64 (128 bits). Usa Web Crypto: corre en el runtime edge. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
