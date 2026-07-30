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
  build: {
    // Keep the markdown stack out of the initial login chunk so first paint
    // stays lean; authenticated note routes pull it in on demand.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-markdown") || id.includes("node_modules/remark-")) {
            return "markdown";
          }
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
