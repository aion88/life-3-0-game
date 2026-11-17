/**
 * Fait tenir la carte du questionnaire dans la fenêtre [retour de Cynthia, 2026-11-08 : « il faut scroller pour tout voir »].
 *
 * Cause : les tailles de texte suivent la LARGEUR de la fenêtre (`clamp(18px, px * 100vw / 1920, px)`), la carte est bornée par la HAUTEUR utile
 * (largeur / 2,39, entre les bandes noires), et la hauteur du contenu dépend du texte : un titre à 76 px, une scène et trois ou quatre options dépassent
 * le cadre dès 1280x720, défilement interne compris. Aucune largeur ne garantit une hauteur. Dès 1280 de large le texte est déjà à son plancher de
 * 18 px : seuls les marges, l'œil et les écarts peuvent encore céder, puis la place elle-même.
 *
 * Deux leviers, dans cet ordre, posés sur `main` (`.c-q`) :
 *  1. `--q-fit` (1 = tailles du thème) : tailles de texte (plancher `--t-min-text-px` tenu en CSS), marges, écarts, œil ;
 *  2. `--q-bleed` (0 à 1) : la carte mord sur les bandes noires, seulement si le point 1 au plus bas facteur de marge ne suffit pas.
 * Si rien ne suffit (fenêtre minuscule), la zone défile comme avant : `syncMore` et son indicateur restent le filet.
 */

/** Plus petit facteur d'espacement avant de mordre sur les bandes : en dessous, la carte serait tassée avant d'avoir pris la place disponible. */
const SPACING_FIRST = 0.6;
/** Plus petit facteur essayé en dernier recours. */
const MIN_FIT = 0.3;
const STEPS = 9;

/** `true` si la zone défilante tient sans défiler (à 1 px près, comme `syncMore`). */
const fits = (body: HTMLElement): boolean => body.scrollHeight - body.clientHeight <= 1;

/** Plus grand `x` de `[lo, hi]` pour lequel `ok(x)` tient, `ok` étant vrai pour les petits `x` ; `null` si `lo` même ne tient pas. */
function largest(lo: number, hi: number, ok: (x: number) => boolean): number | null {
  if (ok(hi)) return hi;
  if (!ok(lo)) return null;
  let a = lo;
  let b = hi;
  for (let i = 0; i < STEPS; i++) {
    const mid = (a + b) / 2;
    if (ok(mid)) a = mid; else b = mid;
  }
  return a;
}

/**
 * Pose `--q-fit` et `--q-bleed` sur `main` pour que `body` (la zone qui défile) tienne ; rend `{ fit, bleed }`. À appeler avec le contenu le plus
 * haut possible (coût et « Continuer » montrés) pour que la carte ne bouge plus entre l'ouverture et la confirmation.
 */
export function fitQuestionCard(main: HTMLElement, body: HTMLElement): { fit: number; bleed: number } {
  const set = (fit: number, bleed: number): void => { main.style.setProperty('--q-fit', String(fit)); main.style.setProperty('--q-bleed', String(bleed)); };
  const tries = (bleed: number) => (fit: number): boolean => { set(fit, bleed); return fits(body); };
  // 1. entre les bandes : le plus grand facteur, jusqu'à SPACING_FIRST
  const inside = largest(SPACING_FIRST, 1, tries(0));
  if (inside !== null) { set(inside, 0); return { fit: inside, bleed: 0 }; }
  // 2. en mordant sur les bandes : le plus grand facteur qui tient avec toute la place, puis la plus petite morsure qui tient à ce facteur
  const full = largest(MIN_FIT, 1, tries(1));
  if (full === null) { set(MIN_FIT, 1); return { fit: MIN_FIT, bleed: 1 }; }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < STEPS; i++) {
    const mid = (lo + hi) / 2;
    set(full, mid);
    if (fits(body)) hi = mid; else lo = mid;
  }
  set(full, hi);
  return { fit: full, bleed: hi };
}
