import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Poppins } from "next/font/google";
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

// Fuente de cuerpo/UI en toda la app.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
};

export const viewport: Viewport = {
  themeColor: "#d91e7a",
  width: "device-width",
  initialScale: 1,
  // Sin esto, env(safe-area-inset-*) siempre vale 0 en iOS y las hojas a
  // pantalla completa quedan por debajo del notch y del home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang="es"
      className={`${spaceGrotesk.variable} ${poppins.variable}`}
    >
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: ACCENT_INIT_SCRIPT }} />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
