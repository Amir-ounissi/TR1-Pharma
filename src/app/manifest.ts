import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "TR1 Pharma",
    short_name: "TR1",
    description:
      "Pilotez vos pharmacies, commandes, missions et actions terrain avec TR1 Pharma.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fffdf8",
    theme_color: "#0b1e32",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/pwa/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/pwa/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
