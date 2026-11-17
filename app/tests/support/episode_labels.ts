import { story } from '../../src/street/episode/story';
/** Visible label of an option of the 1984 episode, read from the story itself so a rewording cannot silently stale a test. */
export function episodeLabel(scene: string, option: string): string {
  const found = story[scene]?.options.find(o => o.id === option);
  if (!found) throw new Error(`episode option ${scene}/${option} does not exist`);
  return found.label;
}
export const L = episodeLabel;
