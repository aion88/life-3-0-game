import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*_test.ts'],
    environment: 'node',
  },
});
