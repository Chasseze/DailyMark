import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("work/local-status.json", "utf8"));
export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://localhost:5174", trace: "retain-on-failure" },
  workers: 1,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: config.API_URL,
      VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
    },
  },
});
