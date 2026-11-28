import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "./globals.css";

// Fuentes OFL alojadas en el proyecto: sin dependencia de Google Fonts.
// Newsreader (serif) es la voz de la conversación; Hanken Grotesk, la de la interfaz.
const serif = localFont({
  src: "./fuentes/newsreader-latin-opsz-normal.woff2",
  variable: "--font-newsreader",
  weight: "200 800",
  display: "swap",
});
const sans = localFont({
  src: "./fuentes/hanken-grotesk-latin-wght-normal.woff2",
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recepción 24/7 | Kinesio Palermo",
  description: "Recepcionista con IA por WhatsApp: reserva, mueve y cancela citas, cobra anticipos y rellena huecos con la lista de espera.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render dinámico: la CSP lleva un nonce nuevo en cada petición (ver src/proxy.ts).
  await connection();
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
