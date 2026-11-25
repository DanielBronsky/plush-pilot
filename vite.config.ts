/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// base: './' — все пути относительные, билд работает из любой папки портала.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    reportCompressedSize: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
