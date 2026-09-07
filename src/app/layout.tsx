import type { Metadata } from "next";
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
  title: "EMD Bordados",
  description: "Sistema de gestión de pedidos de EMD Bordados",
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
