import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shamah/dynamic-qris": resolve(__dirname, "../src/index.ts"),
    },
  },
});