import { defineConfig } from 'vitest/config'

/*
 * Config propia y mínima, sin importar vite.config.ts: los tests son de
 * funciones puras (economy, reputation), corren en node y no necesitan ni
 * el plugin de React ni el code splitting del build.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
