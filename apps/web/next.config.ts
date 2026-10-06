// @ts-check
const { execSync } = require("child_process");
const { version: appVersion } = require("./package.json");

/**
 * Hash corto del commit actual, para mostrarlo en el login y poder verificar
 * de un vistazo que el deploy corresponde a la última versión pusheada.
 * Vercel expone VERCEL_GIT_COMMIT_SHA en cada build; fuera de Vercel (local,
 * u otro proveedor) se resuelve con git directamente. Si ninguno funciona
 * (ej. build sin .git), no debe romper el build.
 */
function resolveGitCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

/**
 * Cabeceras de seguridad conservadoras.
 *
 * La CSP es deliberadamente permisiva en scripts (`'unsafe-inline'` y
 * `'unsafe-eval'`): Next.js inyecta scripts inline sin nonce y Tailwind/Recharts
 * usan estilos inline, así que una CSP estricta rompería la app. `connect-src`
 * se limita al backend del ambiente (ver `resolveConnectSrc`). Para endurecerla habría que migrar a nonces por request
 * (middleware) y fijar el host del backend por ambiente.
 */
/**
 * `connect-src`: sólo el propio origen y el del backend (NEXT_PUBLIC_BACKEND_URL,
 * más su variante ws/wss). Antes quedaba abierto a cualquier `https:`/`http:`,
 * lo que dejaba a un XSS exfiltrar el token de la sesión a cualquier host. Si
 * la variable falta o es inválida se conserva el comportamiento anterior para
 * no romper el build.
 */
function resolveConnectSrc() {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL;
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

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  resolveConnectSrc(),
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Paquetes del monorepo (código compartido con la futura app Mobile):
  // son TypeScript sin build propio, Next los transpila igual que su código.
  transpilePackages: ["@emd/types", "@emd/business", "@emd/api-client"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GIT_COMMIT: resolveGitCommit(),
  },
  /**
   * Rutas viejas que se fusionaron en pantallas unificadas. Se redirigen aquí
   * (antes del render) para no romper favoritos ni links compartidos, sin
   * mantener una página por cada una.
   */
  async redirects() {
    return [
      { source: "/dashboard/clients", destination: "/dashboard/clientes?tab=clientes", permanent: true },
      { source: "/dashboard/companies", destination: "/dashboard/clientes?tab=empresas", permanent: true },
      { source: "/dashboard/users", destination: "/dashboard/usuarios?tab=usuarios", permanent: true },
      { source: "/dashboard/roles", destination: "/dashboard/usuarios?tab=roles", permanent: true },
      { source: "/dashboard/mi-trabajo", destination: "/dashboard/orders", permanent: true },
      { source: "/dashboard/estatus-pedidos", destination: "/dashboard/orders", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  // Todo `public/` se precachea salvo las banderas (≈ 250 SVG, ver
  // public/flags/README.md) y los modelos 3D de mockups: sólo los usa
  // Recepción, así que se cachean al pedirse (CacheFirst en src/app/sw.ts,
  // decisión R9 de docs/plans/sidebar-y-mockups-v2.md).
  globPublicPatterns: ["*", "!(flags|models)/**/*"],
});

module.exports = withSerwist(nextConfig);
