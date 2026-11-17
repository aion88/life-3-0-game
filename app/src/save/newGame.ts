/** Paramètre d'adresse `?nouvelle` : efface la sauvegarde au chargement [demande Cynthia 2026-11-03]. Module pur, stockage injecté. */
import { SAVE_KEY, type StorageLike } from './save';
import { clearShortProgress } from './shortProgress';

/** Nom du paramètre d'adresse qui efface la partie. */
export const NEW_GAME_PARAM = 'nouvelle';

/**
 * Si `href` porte `?nouvelle`, efface la sauvegarde et rend l'adresse sans ce paramètre (à poser par `history.replaceState`, pour qu'un
 * rechargement n'efface pas une seconde fois) ; sinon rend `null` et ne touche à rien.
 */
export function consumeNewGameParam(href: string, storage: StorageLike | null): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(NEW_GAME_PARAM)) return null;
  clearShortProgress(storage);
  try { storage?.removeItem(SAVE_KEY); } catch { /* stockage refusé : la partie repart quand même du choix de langue au prochain écrit */ }
  // les autres paramètres restent écrits tels quels (`?webgl`, pas `?webgl=`) : on retire le seul morceau `nouvelle`
  const kept = url.search.slice(1).split('&').filter((part) => part !== '' && decodeURIComponent(part.split('=')[0]!) !== NEW_GAME_PARAM);
  url.search = kept.length === 0 ? '' : `?${kept.join('&')}`;
  return url.toString();
}
