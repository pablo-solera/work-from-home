import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["components/**", "lib/**", "db/**"],
      exclude: ["scripts/**"],
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 25, functions: 24, statements: 25, branches: 23 },
    },
  },
});
