import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { WarehouseProvider } from "@/components/warehouse-context";
import { WarehouseShell } from "@/components/warehouse-shell";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Moyomoyo WMS", template: "%s · Moyomoyo WMS" },
  description:
    "Moyomoyo warehouse operations from receiving to shipment.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/moyomoyo-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#183f2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        <WarehouseProvider><WarehouseShell>{children}</WarehouseShell></WarehouseProvider>
      </body>
    </html>
  );
}
