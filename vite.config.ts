/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev proxy mirrors production, where the API itself serves this build
// same-origin from manga-tracker-api/public (no CORS in either mode).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:5150",
      "/health": "http://localhost:5150",
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./test-setup.ts"],
  },
});
