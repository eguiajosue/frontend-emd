import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { ACCENT_INIT_SCRIPT } from "@/lib/accent";

// Fuente de display (títulos, cifras de KPI, saludo). Bricolage Grotesque:
// grotesca con carácter (cortes de trazo y proporciones propias) que le da voz
// a la marca sin ser decorativa; a pesos 600/700 se lee firme sobre marino y
// sobre claro, y su eje óptico la mantiene nítida tanto en un título de
// 28px como en una cifra de 14px. Sustituye a Space Grotesk, que junto al
// cuerpo se sentía "tech genérico". Autoalojada vía next/font/google.
const heading = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

// Fuente de cuerpo/UI en toda la app. DM Sans: compacta y muy legible a
// 14px en interfaces densas, con cifras tabulares limpias (fechas,
// cantidades, conteos) y un contraste claro de jerarquía frente a
// Bricolage Grotesque en los títulos (display expresivo + cuerpo neutro).
// Variable: sólo se carga un archivo para todos los pesos.
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
    { media: "(prefers-color-scheme: light)", color: "#f6f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c17" },
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
      className={`${heading.variable} ${dmSans.variable}`}
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
