/** Mouvements de l'interface C, durées et courbes lues de `timing.json` ; forme réduite (I-9) [spec C §4, plan UI-C T3]. */
import type { MotionId, Theme, Timing } from '../data/schema/ui';
import { prefersReducedMotion } from './backdrop';

export interface MotionSpec { readonly keyframes: readonly Keyframe[]; readonly options: KeyframeAnimationOptions }

/** Grandeurs (nombres) et références de jetons (chaînes `var(--c-…)`), données de `timing.motion.<id>.v.params` surchargées par l'appelant. */
export type MotionParams = Readonly<Record<string, number | string>>;

/** Mouvements sans équivalent en mouvement réduit : pièce, confetti, obturateur, et le saut du nombre du bracelet (§4, « saute directement »). */
const SUPPRESSED_WHEN_REDUCED: ReadonlySet<MotionId> = new Set<MotionId>(['coin', 'confetti', 'shutter', 'braceletSettle']);

/**
 * Identifiants dont la cible est l'ÉLÉMENT lui-même (l'option, le bouton) : jamais d'opacité 0 en forme réduite.
 * Le changement d'état (fond, liseré, largeur) passe alors par le CSS, lisible sans mouvement ; l'animation reste un fondu 1 → 1.
 */
const STATE_ON_ELEMENT: ReadonlySet<MotionId> = new Set<MotionId>(['designate', 'undesignate', 'confirmPress', 'confirmRelease']);

/** Fondus de la forme réduite : `[début, fin]` d'opacité. */
function reducedFade(id: MotionId, p: MotionParams): [number, number] {
  if (STATE_ON_ELEMENT.has(id)) return [1, 1];
  if (id === 'bubbleOut') return [1, 0];
  if (id === 'fadeOthers') return [1, num(p, 'opacity', 1)];
  return [0, 1];
}

function num(p: MotionParams, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' ? v : d;
}
function str(p: MotionParams, k: string): string | undefined {
  const v = p[k];
  return typeof v === 'string' ? v : undefined;
}
const px = (v: number): string => `${v}px`;

/** Keyframes du mouvement plein. `scale` : arrivée pour `designate`, DÉPART pour `bubbleIn`, `message`, `cardIn`. */
function fullKeyframes(id: MotionId, p: MotionParams): Keyframe[] {
  const scale = num(p, 'scale', 1);
  const rot = num(p, 'rotateDeg', 0);
  const dy = num(p, 'dy', 0);
  const dx = num(p, 'dx', 0);
  switch (id) {
    case 'designate':
    case 'undesignate': {
      const rest: Keyframe = { transform: 'scale(1) rotate(0deg)' };
      const on: Keyframe = { transform: `scale(${scale}) rotate(${rot}deg)` };
      if (typeof p.toWidth === 'number') { rest.width = px(num(p, 'fromWidth', 0)); on.width = px(p.toWidth); }
      const restBg = str(p, 'restBg');
      const onBg = str(p, 'designatedBg');
      if (restBg && onBg) { rest.backgroundColor = restBg; on.backgroundColor = onBg; }
      return id === 'designate' ? [rest, on] : [on, rest];
    }
    case 'confirmPress':
    case 'confirmRelease': {
      const shadowColor = str(p, 'shadowColor');
      const frame = (y: number, shadowPx: number): Keyframe => ({ transform: `translateY(${px(y)})`, ...(shadowColor ? { boxShadow: `0 ${px(shadowPx)} 0 ${shadowColor}` } : {}) });
      const from = num(p, 'shadowFromPx', 0);
      const to = num(p, 'shadowToPx', 0);
      return id === 'confirmPress' ? [frame(0, from), frame(dy, to)] : [frame(dy, from), frame(0, to)];
    }
    case 'fadeOthers': return [{ opacity: 1 }, { opacity: num(p, 'opacity', 1) }];
    case 'costReveal':
    case 'priceReveal': return [{ opacity: 0, transform: `translateY(${px(dy)})` }, { opacity: 1, transform: 'translateY(0px)' }];
    case 'bubbleIn': return [{ opacity: 0, transform: `translateY(${px(dy)}) scale(${scale})` }, { opacity: 1, transform: 'translateY(0px) scale(1)' }];
    case 'bubbleOut': return [{ opacity: 1 }, { opacity: 0 }];
    case 'optionsIn': return [{ opacity: 0, transform: `translateX(${px(dx)})` }, { opacity: 1, transform: 'translateX(0px)' }];
    case 'coin': {
      const mid = typeof p.arcDy === 'number' ? [{ transform: `translate(${px(dx / 2)}, ${px(p.arcDy)})`, offset: 0.5 }] : [];
      return [{ transform: 'translate(0px, 0px)' }, ...mid, { transform: `translate(${px(dx)}, ${px(dy)})` }];
    }
    case 'shutter': return [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)', offset: 0.5 }, { transform: 'scaleY(1)' }];
    case 'braceletSettle': return [{ transform: `scale(${num(p, 'from', 1)})` }, { transform: 'scale(1)' }];
    case 'confetti': return [
      { opacity: 1, transform: 'translate(0px, 0px) rotate(0deg)' },
      { opacity: 0, transform: `translate(${px(dx)}, ${px(dy)}) rotate(${num(p, 'rotDeg', 0)}deg)` },
    ];
    case 'message': return [{ opacity: 0, transform: `scale(${scale}) rotate(${num(p, 'fromDeg', 0)}deg)` }, { opacity: 1, transform: `scale(1) rotate(${rot}deg)` }];
    case 'refusalShake': {
      const s = num(p, 'shakePx', 0);
      const shakes = Math.max(1, Math.round(num(p, 'shakes', 1)));
      const xs = [0];
      for (let i = 0; i < shakes; i++) xs.push(-s, s);
      xs.push(0);
      return xs.map((x) => ({ transform: `translateX(${px(x)})` }));
    }
    case 'pageChange': return [{ opacity: 0, transform: `translateX(${px(dx)})` }, { opacity: 1, transform: 'translateX(0px)' }];
    case 'cardIn': return [{ opacity: 0, transform: `scale(${scale})` }, { opacity: 1, transform: 'scale(1)' }];
  }
}

/** Paramètres de désignation tirés du thème : échelle (questionnaire) ou largeur (rue), rotation, fond de repos propre à l'écran (blanc / crème) → rose, par jetons. */
export function designateParams(theme: Theme, variant: 'questionnaire' | 'street'): MotionParams {
  // Repos : options du questionnaire blanches [spec C §3.1], options de rue crème [§3.3] ; désignée : rose.
  if (variant === 'questionnaire') {
    const q = theme.questionnaire;
    return { scale: q.designatedScale.v, rotateDeg: q.designatedRotationDeg.v, restBg: 'var(--c-blanc)', designatedBg: 'var(--c-rose)' };
  }
  const bg = { restBg: 'var(--c-creme)', designatedBg: 'var(--c-rose)' };
  const s = theme.street;
  return { fromWidth: s.optionRestWidthPx.v, toWidth: s.optionDesignatedWidthPx.v, rotateDeg: s.designatedRotationDeg.v, ...bg };
}

/**
 * Mouvement d'un événement d'interface, ou `null` s'il est supprimé en mouvement réduit.
 * Les grandeurs du §4 viennent de `timing.motion.<id>.v.params` ; `params` les surcharge et porte ce qui dépend de l'écran ou de l'exécution
 * (cible de la pièce `dx`/`dy`, `designateParams(theme, …)`, `shadowColor: 'var(--sh-…)'`). `index` décale `optionsIn` et `coin` de `staggerMs` par rang.
 * Forme réduite : fondu de 120 ms au plus, sans délai ; pour designate, undesignate, confirmPress, confirmRelease le fondu est 1 → 1
 * (l'élément ne devient jamais invisible, l'état se lit par le CSS) ; `priceReveal` y perd son délai de 150 ms (décision, non écrite dans la spec).
 */
export function motionFor(id: MotionId, reduced: boolean, timing: Timing, params: MotionParams = {}): MotionSpec | null {
  const m = timing.motion[id].v;
  const easing = timing.easings[m.easing].v;
  const merged: MotionParams = { ...m.params, ...params };
  if (reduced) {
    if (SUPPRESSED_WHEN_REDUCED.has(id)) return null;
    const [from, to] = reducedFade(id, merged);
    return { keyframes: [{ opacity: from }, { opacity: to }], options: { duration: Math.min(m.ms, timing.juice.reducedMaxMs.v), easing, delay: 0, fill: 'both' } };
  }
  return {
    keyframes: fullKeyframes(id, merged),
    options: { duration: m.ms, easing, delay: m.delayMs + num(merged, 'index', 0) * m.staggerMs, fill: 'both' },
  };
}

export interface Animator { play(el: Element, spec: MotionSpec): Promise<void> }

/** Animateur réel : Web Animations API, résolu à la fin de l'animation. */
export const webAnimator: Animator = {
  async play(el, spec) {
    try {
      await el.animate([...spec.keyframes], spec.options).finished;
    } catch (e) {
      if (!(e instanceof Error) || e.name !== 'AbortError') throw e; // animation annulée : fin normale
    }
  },
};

/** Animateur de test : enregistre et résout aussitôt, sans horloge. */
export function createInstantAnimator(): Animator & { played(): readonly { el: Element; spec: MotionSpec }[] } {
  const log: { el: Element; spec: MotionSpec }[] = [];
  return {
    play(el, spec) {
      log.push({ el, spec });
      return Promise.resolve();
    },
    played: () => [...log],
  };
}

/** Le drapeau explicite l'emporte ; à défaut, `prefers-reduced-motion` du navigateur. */
export function reducedMotionOf(flag: boolean | undefined): boolean {
  return flag ?? prefersReducedMotion();
}
