import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { ACCENT_INIT_SCRIPT } from "@/lib/accent";

// Fuente de display bold/geométrica para títulos (H1/H2, saludo, etc).
//
// Nota de procedencia: la marca solicitó "Ezra Bold" como fuente de display.
// Se intentó localizar un archivo de fuente real (no un generador de preview)
// en freefontdl.com / fontspad.com / fontshut.com / exfont.com / freefonts.co
// y no fue posible verificar un binario válido (firma sfnt/OTTO/WOFF) desde
// ninguno de esos sitios sin pasar por generadores de "vista previa" o
// descargas bloqueadas por email/JS. Se sustituyó por Space Grotesk en peso
// bold (700), una geométrica de character similar, autoalojada vía
// next/font/google (sin request externo en runtime). Swap de una línea en
// cuanto se disponga de un archivo Ezra Bold con licencia: ver DESIGN.md.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

// Fuente de cuerpo/UI en toda la app. DM Sans y no Poppins (la anterior):
// Poppins es muy ancha y geométrica — a 14px en una interfaz densa ocupa de
// más y se lee peor, y junto a Space Grotesk dejaba dos geométricas casi
// iguales sin contraste de jerarquía. DM Sans es más compacta, con cifras
// tabulares limpias (fechas, cantidades, conteos) y comparte la familia
// "grotesca" de Space Grotesk sin confundirse con ella. Variable: sólo se
// carga un archivo para todos los pesos.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EMD HUB",
  description: "Sistema de gestión de pedidos de EMD HUB: imprenta, bordado y marketing",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    // iOS Safari usa esto para el ícono de "Agregar a inicio" y no soporta
    // SVG de forma confiable ahí (a veces muestra un ícono genérico en
    // blanco) — necesita sí o sí un PNG.
    apple: "/icons/icon-512.png",
  },
  // Instalada en iPhone: se abre como app (sin barra de Safari), con su nombre.
  appleWebApp: { capable: true, title: "EMD", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // La barra de estado toma el color del lienzo (como una app nativa) en vez
  // del magenta; `ThemeColorSync` la ajusta si el tema elegido en la app no
  // es el del sistema.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e16" },
  ],
  width: "device-width",
  initialScale: 1,
  // Sin esto, env(safe-area-inset-*) siempre vale 0 en iOS y las hojas a
  // pantalla completa quedan por debajo del notch y del home indicator.
  viewportFit: "cover",
  // Android: el teclado virtual achica el layout (no sólo el visual
  // viewport), así los footers fijos de las hojas a pantalla completa (ej.
  // "Crear pedido") quedan por encima del teclado en vez de tapados.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce de la CSP de esta request (lo genera `src/middleware.ts`). Los
  // scripts inline propios (acento, tema de next-themes) lo necesitan para
  // ejecutarse. Leer `headers()` vuelve dinámico el render de toda la app:
  // es el costo de una CSP sin `'unsafe-inline'`.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      suppressHydrationWarning
      lang="es"
      className={`${spaceGrotesk.variable} ${dmSans.variable}`}
    >
      <body className="font-sans antialiased">
        <script
          nonce={nonce}
          // El navegador oculta `nonce` del DOM tras cargar: sin esto React
          // avisaría de un mismatch al hidratar.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: ACCENT_INIT_SCRIPT }}
        />
        <Providers nonce={nonce}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
