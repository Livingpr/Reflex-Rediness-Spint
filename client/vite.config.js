import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the client runs on :5173 and the API on :4000 - proxy both REST
// calls and the Socket.io handshake so the browser only ever talks to one
// origin. In production there's no proxy: Express serves the built client
// and the API from the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
});
