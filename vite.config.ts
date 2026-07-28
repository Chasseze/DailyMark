import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Pinned, and strict so a clash fails loudly instead of silently moving to
    // another port. OAuth redirect allowlists are per-origin, so a port that
    // drifts between restarts breaks Google sign-in every time.
    // (5173 is held by unrelated stale node processes on this machine.)
    port: 5174,
    strictPort: true,
  },
});
