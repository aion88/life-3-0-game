/** Aides de T13 : contexte de l'écran `sources` avec réponses sauvées et monde w10 chargeable ou non [plan 03 T13, R-03.25 (c)]. */
import type { AppContext } from '../../src/app/shell';
import type { WorldData } from '../../src/data/schema/world';
import { realI18n } from './street_ui';
import { ans } from './answers';
import { W10 } from './bilan_curve';
import { fakeCtx } from './screens';

export const W10_LINE = 'ACBACBACAAD'; // monde calculé w10, vécu w10
export const REDIRECT_LINE = 'AAAAAAAAAAA'; // calculé w03, vécu w10
export const EXTINCTION_LINE = 'CBCCBDBACCD'; // extinction w07

/** Contexte dont la sauvegarde porte `line` ; `withW10` rend w10 disponible dans la build. */
export function sourcesCtx(line: string, opts: { readonly withW10?: boolean; readonly softened?: boolean; readonly lang?: 'fr' | 'en' } = {}) {
  const ctx = fakeCtx({
    i18n: realI18n(opts.lang ?? 'fr'),
    worlds: {
      load: () => Promise.resolve(W10 as WorldData),
      available: () => (opts.withW10 === true ? (['w10'] as const) : []),
    } as AppContext['worlds'],
  });
  ctx.save.update({ answers: ans(line), softened: opts.softened === true });
  return ctx;
}
