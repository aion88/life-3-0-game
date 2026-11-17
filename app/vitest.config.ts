import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*_test.ts'],
    environment: 'node',
    testTimeout: 20_000,   // les balayages d'écrans montent le DOM : 5 à 9 s sur le runner GitHub, au-dessus des 5 s par défaut
  },
});
