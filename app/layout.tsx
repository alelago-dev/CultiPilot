import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  weight: ["400", "500", "600", "700", "800"]
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["500", "600"]
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["500", "700", "800"]
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "PlantCare Calendar",
  description: "Calendario PWA para seguimiento de cultivos horticolas legales.",
  applicationName: "PlantCare Calendar",
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
    title: "PlantCare"
  }
};

export const viewport: Viewport = {
  themeColor: "#1F5C3F",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${publicSans.variable} ${plexMono.variable} ${bricolage.variable}`} lang="es">
      <body className={publicSans.className}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
