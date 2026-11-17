/**
 * Sons de la semaine : de simples bips synthétisés (prototype semaine-1984-objets, lignes 262-267).
 * Le contexte audio naît au premier geste du joueur (règle des navigateurs) ; sans WebAudio
 * (tests, vieux navigateur), tout est silencieux et rien n'échoue.
 */

export interface WeekSound {
  /** Un mot quitte le bracelet. */
  tic(): void;
  /** Un objet est posé sur une cible, un papier est touché. */
  pose(): void;
  /** Une ligne s'imprime sur le papier. */
  line(): void;
  /** Des mots arrivent (nom donné). */
  gain(): void;
  /** Écriture au dossier : plus ou moins. */
  dossier(delta: number): void;
  /** À appeler depuis un geste du joueur : crée ou réveille le contexte audio. */
  unlock(): void;
  setEnabled(on: boolean): void;
  readonly enabled: boolean;
}

type AudioCtor = typeof AudioContext;

/** Crée la sortie sonore. `win` sert à retrouver `AudioContext` ; absent ou inconnu = silence. */
export function createWeekSound(win: Window | null | undefined): WeekSound {
  let on = true;
  let ctx: AudioContext | null = null;
  const Ctor = (win as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor } | null | undefined);
  const make = Ctor?.AudioContext ?? Ctor?.webkitAudioContext;

  const audio = (): AudioContext | null => {
    if (!on || !make) return null;
    try {
      ctx = ctx ?? new make();
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      ctx = null;
    }
    return ctx;
  };
  const bip = (f: number, d: number, type: OscillatorType = 'square', g = 0.05, f2?: number): void => {
    const a = audio();
    if (!a) return;
    try {
      const o = a.createOscillator();
      const v = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, a.currentTime);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + d);
      v.gain.setValueAtTime(g, a.currentTime);
      v.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d);
      o.connect(v).connect(a.destination);
      o.start();
      o.stop(a.currentTime + d);
    } catch {
      /* un son raté ne doit jamais casser la partie */
    }
  };

  return {
    tic: () => bip(1900, 0.02),
    pose: () => bip(140, 0.12, 'sine', 0.25, 60),
    line: () => bip(1050, 0.03, 'sawtooth', 0.03),
    gain: () => bip(660, 0.18, 'triangle', 0.08, 990),
    dossier: (delta) => bip(delta > 0 ? 520 : 180, 0.16, 'triangle', 0.07),
    unlock: () => void audio(),
    setEnabled: (value) => { on = value; },
    get enabled() { return on; },
  };
}
