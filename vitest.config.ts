import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Keep jsdom workers bounded: unrestricted CPU-based fan-out makes the
    // integration-style component specs contend during module transforms.
    maxWorkers: 4,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
