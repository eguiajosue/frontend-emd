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
 * Cabeceras de seguridad estáticas.
 *
 * La Content-Security-Policy NO va aquí: lleva un nonce distinto por request,
 * así que la arma `src/middleware.ts` (ver `src/lib/csp.ts`). Ésta es la única
 * fuente de la CSP.
 */
const securityHeaders = [
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
    // Entorno de Sentry también en el cliente (sin prefijo NEXT_PUBLIC_ no se
    // incrustaría). Vacío = el SDK usa VERCEL_ENV / NODE_ENV.
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? "",
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

/**
 * Sentry (ver docs/monitoring.md): sin `NEXT_PUBLIC_SENTRY_DSN` la config de
 * Next queda exactamente igual que sin Sentry — ni plugin de webpack, ni
 * auto-instrumentación, ni túnel. El build no necesita ninguna variable de
 * Sentry para pasar (CI, Vercel sin configurar, e2e).
 *
 * Con DSN:
 * - `tunnelRoute`: el navegador manda los eventos al propio origen y Next los
 *   reescribe al ingest de Sentry; la CSP (`connect-src`) no cambia. Debe
 *   coincidir con `SENTRY_TUNNEL_ROUTE` de src/lib/sentry.ts (el middleware y
 *   el Service Worker la excluyen de auth/CSP y de la caché).
 * - Source maps: sólo se generan y suben si además hay `SENTRY_AUTH_TOKEN`
 *   (+ `SENTRY_ORG` / `SENTRY_PROJECT`); sin token, nada de upload ni avisos.
 */
const SENTRY_TUNNEL_ROUTE = "/monitoring";
const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
const uploadSourceMaps = sentryEnabled && Boolean(process.env.SENTRY_AUTH_TOKEN);

function withSentry(config: import("next").NextConfig): import("next").NextConfig {
  if (!sentryEnabled) return config;
  const { withSentryConfig } = require("@sentry/nextjs/config");
  return withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !uploadSourceMaps,
    telemetry: false,
    tunnelRoute: SENTRY_TUNNEL_ROUTE,
    sourcemaps: { disable: !uploadSourceMaps },
    release: { create: uploadSourceMaps },
    widenClientFileUpload: uploadSourceMaps,
    webpack: {
      automaticVercelMonitors: false,
      treeshake: { removeDebugLogging: true },
    },
  });
}

module.exports = withSentry(withSerwist(nextConfig));
