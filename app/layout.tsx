import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Manrope } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeScript } from "@/components/theme-script";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"]
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["500", "600"]
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  weight: ["500", "600", "700"]
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "CultiPilot",
  description: "Calendario PWA para seguimiento de cultivos horticolas legales.",
  applicationName: "CultiPilot",
  icons: {
    apple: `${basePath}/favicon.png`,
    icon: [
      {
        sizes: "512x512",
        type: "image/png",
        url: `${basePath}/favicon.png`
      }
    ],
    shortcut: `${basePath}/favicon.png`
  },
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "CultiPilot"
  }
};

export const viewport: Viewport = {
  themeColor: "#2C4A3E",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${manrope.variable} ${plexMono.variable} ${instrumentSans.variable}`} lang="es" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={manrope.className}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
