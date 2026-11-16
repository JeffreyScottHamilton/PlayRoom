import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { libraryScopePlugin } from './scripts/vite-library-scope.mjs'

// Deployment base path. Default "/" (Vercel). GitHub Pages project sites use "/PlayRoom/".
const basePath = process.env.BASE_PATH || '/'

// Library scope: "all" (default) or "open" (drops owner-asserted games). Validated here
// so a typo fails the build instead of silently publishing the full library.
const libraryScope = process.env.VITE_LIBRARY || 'all'
if (libraryScope !== 'all' && libraryScope !== 'open') {
  throw new Error(`VITE_LIBRARY must be "all" or "open", got "${libraryScope}"`)
}

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [libraryScopePlugin({ scope: libraryScope }), react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
})
