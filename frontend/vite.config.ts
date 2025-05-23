import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
