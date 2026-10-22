import { defineConfig } from "vitest/config"

/**
 * Characterization tests for `@pindou/core`'s pure grid logic.
 *
 * Plain Node — nothing here touches the DOM, PixiJS, React, or the network.
 * These tests lock the *current* behaviour of `src/editor.ts` so the class
 * refactor (REFACTOR.md S1–S4) can be proven behaviour-preserving.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
})
