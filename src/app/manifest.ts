import type { MetadataRoute } from "next";

const pwaIconVersion = "official-20260910";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard/field",
    name: "TR1 Pharma",
    short_name: "TR1",
    description:
      "Exécution commerciale terrain pour les marques qui se développent en pharmacie.",
    start_url: "/dashboard/field?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f0e7",
    theme_color: "#0e1d31",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: `/pwa/icon/192?v=${pwaIconVersion}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/pwa/icon/192?v=${pwaIconVersion}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `/pwa/icon/512?v=${pwaIconVersion}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/pwa/icon/512?v=${pwaIconVersion}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
