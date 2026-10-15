import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le proxy évite CORS en dev : le navigateur ne parle qu'à localhost:5173.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
