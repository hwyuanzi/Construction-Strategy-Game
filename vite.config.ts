import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const drecco = mode === 'drecco'

  return {
    base: './',
    plugins: [react(), drecco && viteSingleFile()],
    build: drecco ? { outDir: 'dist/drecco', modulePreload: false } : undefined,
    test: { include: ['src/**/*.test.ts'] },
  }
})
