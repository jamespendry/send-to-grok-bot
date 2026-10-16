import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
        }
      }
    })
  ],
  test: {
    include: ["test/**/*.test.js"],
    exclude: ["**/node_modules/**", "test/node/**"],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
