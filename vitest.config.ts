import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup-env.ts"],
    include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 90_000,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/utils/pagination.ts",
        "src/utils/encryption.ts",
        "src/middleware/validate.ts",
        "src/modules/public/public.service.ts",
        "src/modules/public/public.validation.ts"
      ],
      exclude: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
      thresholds: { statements: 60, branches: 50, functions: 60, lines: 60 }
    }
  }
});
