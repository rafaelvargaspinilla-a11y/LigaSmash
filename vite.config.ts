import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
const base = process.env.VITE_BASE_PATH || "/";
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "characters/*.png",
      ],
      manifest: {
        name: "Smash Tracker",
        short_name: "Smash Tracker",
        description: "Las victorias de tu grupo, siempre a mano.",
        lang: "es",
        theme_color: "#101116",
        background_color: "#101116",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base}icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,webp}"] },
    }),
  ],
});
