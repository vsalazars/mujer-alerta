import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import "./globals.css";

// Mantén los NOMBRES de variables que tu CSS ya espera:
// --font-geist-sans  (cuerpo)
// --font-geist-mono  (títulos)
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mujer Alerta",
  description:
    "Instrumento de percepción del entorno sobre violencias contra las mujeres",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${poppins.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
