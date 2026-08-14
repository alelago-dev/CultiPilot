import type { Metadata, Viewport } from "next";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
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
  themeColor: "#3f8f5f",
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
