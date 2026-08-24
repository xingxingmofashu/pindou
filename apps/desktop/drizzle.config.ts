import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/main/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DESKTOP_DB_PATH ?? "./pindou.db",
  },
})
