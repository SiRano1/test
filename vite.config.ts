import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2022',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
