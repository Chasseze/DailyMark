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
  // No manualChunks. The hand-rolled split used to group react-markdown and
  // remark-* into one "markdown" chunk, but their transitive deps (unified,
  // micromark, mdast-util…) stayed in the default bucket, which left the entry
  // chunk statically importing the group. The result was the exact opposite of
  // what it was written for: index.html modulepreloaded 161 kB of Markdown
  // machinery on the login screen. Rolldown's own splitting keeps that code in
  // a chunk only the note routes pull in — ~47 kB less gzip before first paint.
});
