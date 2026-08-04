import { defineConfig } from "vitest/config";
import path from "node:path";

const criticalSources = [
  "lib/absences/absence-sections.ts",
  "lib/auth/session.ts",
  "lib/calendar/dates.ts",
  "lib/calendar/links.ts",
  "lib/requests/request-filters.ts",
  "lib/employees/org-service.ts",
  "lib/users/password-generator.ts",
  "lib/users/passwords-csv.ts",
  "lib/users/user-validation.ts",
  "components/common/generated-avatar.tsx",
];

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
      reporter: ["text", "html", "lcov"],
      include: criticalSources,
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
});
