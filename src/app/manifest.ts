import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Encore",
    short_name: "Encore",
    description: "Conectá con músicos. Descubrí. Tocá.",
    start_url: "/es",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#4c6ef5",
    categories: ["music", "social", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    lang: "es",
    dir: "ltr",
    orientation: "portrait-primary",
    prefer_related_applications: false,
  };
}
