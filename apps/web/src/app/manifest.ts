import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moyomoyo Warehouse Management",
    short_name: "Moyomoyo WMS",
    description: "Moyomoyo warehouse operations from receiving to shipment",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2e8",
    theme_color: "#183f2a",
    icons: [
      { src: "/moyomoyo-logo.png", sizes: "any", type: "image/png" },
      { src: "/wms-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
