import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    // Forward API calls to the Express server during development.
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY ?? "http://localhost:4000", changeOrigin: true },
    },
  },
});
