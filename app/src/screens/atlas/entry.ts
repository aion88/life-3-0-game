/**
 * Écran `atlas` de la coquille : charge à la demande (import dynamique) l'écran éducatif et ses données validées, pour que le premier
 * chargement du jeu n'en porte pas le poids. Le bouton « Retour » ramène là d'où le joueur vient (accueil, fin de la rue, bilan).
 */
import type { Screen, ScreenFactory } from '../../app/shell';
import type { EnglishData } from '../../atlas/model';

export const atlasScreen: ScreenFactory<'atlas'> = (ctx, payload) => {
  let inner: Screen | null = null;
  let gone = false;
  return {
    async mount(root) {
      const lang = ctx.i18n.lang();
      const [{ createAtlasScreen }, { parseAtlas }, { buildAtlas }, { default: raw }, english] = await Promise.all([
        import('./index'), import('../../atlas/schema'), import('../../atlas/model'), import('../../atlas/data.json'),
        lang === 'en' ? import('../../atlas/data.en.json').then((m) => m.default as unknown as EnglishData) : Promise.resolve(undefined),
      ]);
      if (gone) return;
      const back = payload.back;
      const onBack = (): void => {
        if (back.id === 'lang') void ctx.navigate('lang', undefined);
        else if (back.id === 'street') void ctx.navigate('street', { run: back.run });
        else void ctx.navigate('bilan', { input: back.input });
      };
      inner = createAtlasScreen(buildAtlas(parseAtlas(raw), english), { ...(payload.arrival === undefined ? {} : { arrival: payload.arrival }), onBack, lang });
      await inner.mount(root);
    },
    unmount() { gone = true; inner?.unmount(); inner = null; },
  };
};
