import { defineConfig } from 'vite';

/** `APP_BASE` fixe le chemin public de déploiement (défaut `/`). */
const base = process.env['APP_BASE'] ?? '/';

export default defineConfig({
  base,
  preview: { port: Number(process.env['PREVIEW_PORT'] ?? 4173), strictPort: true },
});
