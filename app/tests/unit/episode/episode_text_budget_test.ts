import { describe, expect, it } from 'vitest';
import { choose, ending, episodeText, freshEpisode, optionsFor, story, type EpisodeState } from '../../../src/street/episode/story';
import { autoSteps } from '../../../src/street/episode/report';

/** Budget de texte de l'épisode court w10 : ce que le joueur lit par écran, tel que le runtime l'assemble. */
const words = (text: string): number => text.split(/\s+/).filter(token => /[\p{L}\p{N}]/u.test(token)).length;

/** Chaque écran atteignable : les lignes dites sans appui (scènes à option unique), puis la scène posée. */
function screens(): { id: string; text: string; state: EpisodeState }[] {
  const out: { id: string; text: string; state: EpisodeState }[] = [];
  const seen = new Set<string>();
  const key = (s: EpisodeState): string => `${s.scene}|${s.trust}|${s.exposure}|${[...s.memories].sort().join(',')}|${[...s.history].sort().join(',')}`;
  const visit = (raw: EpisodeState): void => {
    const auto = autoSteps(raw);
    const state = auto.state;
    if (seen.has(key(state))) return;
    seen.add(key(state));
    if (state.scene === 'end') return;
    const told = auto.steps.map(step => {
      const taken = optionsFor(step.before).find(o => o.id === step.option)!;
      return `${episodeText(step.before)} ${taken.memory ?? taken.memories?.join(' ') ?? ''}`.trim();
    });
    out.push({ id: state.scene, text: [...told, episodeText(state)].join(' '), state });
    for (const option of optionsFor(state)) visit(choose(state, option.id));
  };
  visit(freshEpisode());
  return out;
}
const finals = (): EpisodeState[] => {
  const found: EpisodeState[] = []; const seen = new Set<string>();
  const visit = (raw: EpisodeState): void => {
    const state = autoSteps(raw).state;
    const k = `${state.scene}|${state.trust}|${state.exposure}|${[...state.memories].sort().join(',')}|${[...state.history].sort().join(',')}`;
    if (seen.has(k)) return; seen.add(k);
    if (state.scene === 'end') { found.push(state); return; }
    for (const option of optionsFor(state)) visit(choose(state, option.id));
  };
  visit(freshEpisode()); return found;
};

describe('budget de texte de l’épisode court w10', () => {
  it('parcourt tous les écrans (garde contre un parcours vide)', () => {
    expect(screens().length).toBeGreaterThan(25);
    expect(finals().length).toBeGreaterThan(10);
  });
  it('au plus 40 mots par écran atteignable, lignes dites et effet de geste compris', () => {
    // Le dîner est rendu par la vue du dîner (dinnerView), qui n'affiche ni les lignes dites ni `episodeText` : son texte est borné seul.
    for (const s of screens().filter(screen => screen.id !== 'dinner')) expect(words(s.text), `${s.id} : ${s.text}`).toBeLessThanOrEqual(40);
    expect(words(story.dinner!.text)).toBeLessThanOrEqual(40);
  });
  it('une réplique entre « » tient en 90 caractères, et le raconté vient avant', () => {
    for (const s of screens()) {
      for (const [, said] of s.text.matchAll(/«\s*([^»]*?)\s*»/g)) expect(said!.length, `${s.id} : ${said}`).toBeLessThanOrEqual(90);
    }
    for (const scene of Object.values(story)) for (const [, said] of scene.text.matchAll(/«\s*([^»]*?)\s*»/g)) expect(said!.length).toBeLessThanOrEqual(90);
  });
  it('un libellé d’option est un geste de 6 mots au plus, sans prix dedans', () => {
    const labels = new Set<string>();
    for (const s of screens()) for (const o of optionsFor(s.state)) labels.add(o.label);
    for (const label of labels) {
      expect(words(label), label).toBeLessThanOrEqual(6);
      expect(label, label).not.toMatch(/exposition|confiance|prix|gain|\d/i);
    }
  });
  it('chaque fin tient en 40 mots', () => {
    for (const s of finals()) expect(words(ending(s)), ending(s)).toBeLessThanOrEqual(40);
  });
  it('pas de tiret cadratin, pas de « du coup », aucun nombre ajouté', () => {
    const texts = [...screens().map(s => s.text), ...finals().map(ending), ...Object.values(story).map(s => s.text)];
    for (const text of texts) {
      expect(text).not.toContain('—');
      expect(text.toLowerCase()).not.toContain('du coup');
      expect(text.replace(/48 heures/g, '')).not.toMatch(/\d/);
    }
  });
});
