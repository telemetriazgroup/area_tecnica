import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/inspecciones/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/inspecciones/api": {
        target: "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/inspecciones/, ""),
      },
    },
  },
});
