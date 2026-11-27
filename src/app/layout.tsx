import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Bricolage Grotesque (OFL), alojada en el proyecto: sin dependencia de Google Fonts.
const texto = localFont({
  src: "./fuentes/bricolage-grotesque-latin-opsz-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});
const cifras = localFont({
  src: "./fuentes/bricolage-grotesque-latin-wdth-normal.woff2",
  variable: "--font-cifras",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recepción 24/7 · Kinesio Palermo",
  description: "Recepcionista con IA por WhatsApp: reserva, mueve y cancela citas, cobra anticipos y rellena huecos con la lista de espera.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${cifras.variable}`}>
      <body>{children}</body>
    </html>
  );
}
