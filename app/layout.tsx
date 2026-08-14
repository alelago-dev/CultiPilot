import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

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
  themeColor: "#4f8f38",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
