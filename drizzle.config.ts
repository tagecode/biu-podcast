import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/infra/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite'
})
