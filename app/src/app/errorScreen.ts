/**
 * Écran d'erreur de chargement [plan 00 « Coquille » ; PHASE V M4, m17].
 * Compte les échecs par cible : le premier propose de réessayer, le second échec de la même cible
 * propose de recharger la page, parce qu'un chunk renommé par un redéploiement ne reviendra jamais
 * à la même URL. Ne touche jamais la sauvegarde.
 */
import type { ScreenFactory, ScreenId } from './shell';

/** Fabrique de l'écran d'erreur, avec son propre compteur d'échecs par cible. */
export function createErrorFactory(): ScreenFactory<'error'> {
  const failures = new Map<ScreenId, number>();
  return (ctx, payload) => ({
    mount(root) {
      const target = payload.retry.id;
      const count = (failures.get(target) ?? 0) + 1;
      failures.set(target, count);
      const box = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = ctx.i18n.t('app.error.load');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset['testid'] = 'error-action';
      if (count >= 2) {
        b.textContent = ctx.i18n.t('app.error.reload');
        b.addEventListener('click', () => { location.reload(); });
      } else {
        b.textContent = ctx.i18n.t('app.error.retry');
        b.addEventListener('click', () => {
          void ctx.navigate(target, payload.retry.payload as never).then(() => {
            if (failures.get(target) === count) failures.delete(target); // aucun nouvel échec : cible réparée
          });
        });
      }
      box.append(p, b);
      root.append(box);
    },
    unmount() { /* la coquille vide la racine */ },
  });
}
