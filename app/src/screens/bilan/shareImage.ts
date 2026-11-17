/**
 * Image partageable du bilan [GDD 06 §3.3, B-V9 ; plan 03 T12 ; R-03.5]. Canvas 2D, PNG par `toBlob`, téléchargement par `<a download>`.
 * Aucun appel réseau. Noms désactivés par défaut. Le texte vient de clés `bilan.*` et `world.*` : aucun chiffre hors le nom du monde (une date).
 * Pas d'image pour l'extinction [GDD 06 §3.11] : l'appelant ne l'offre pas, et `shareLines` refuse.
 * `toBlob` : le rappel reçoit `null` si l'image ne peut pas être créée (MDN, Context7 le 2026-11-02) ; on l'échoue franchement.
 */
import { layoutShare } from '../../bilan/share';
import { otherLineText } from '../../bilan/others';
import type { I18n } from '../../i18n/i18n';
import type { BilanData } from '../../shared/types/bilan';
import { loadUi } from '../../data/ui/load';

export interface ShareOptions { readonly width: number; readonly height: number; readonly names: boolean }
export interface ShareLines { readonly title: string; readonly world: string; readonly names: readonly string[]; readonly others: readonly string[]; readonly locked: string | null }

/** Les textes de l'image, dans l'ordre de la mise en page. */
export function shareLines(data: BilanData, i18n: I18n, names: boolean): ShareLines {
  if (data.entry === 'extinction' || data.curve.lifeWorld === null) throw new Error('shareLines : pas d\'image partageable pour une extinction');
  const others = data.others.lines.slice(0, 4).map((l) => otherLineText(i18n, l));
  return {
    title: i18n.t('bilan.sheet.world'),
    world: i18n.t(`world.${data.curve.lifeWorld}.name`),
    names: names && data.dossier !== null ? data.dossier.names.map((n) => i18n.t(n.personKey)) : [],
    others,
    locked: others.length === 0 ? i18n.t('bilan.others.locked') : null,
  };
}

/** Dessine l'image dans `canvas` (un neuf par défaut) et le rend. */
export function renderShare(data: BilanData, i18n: I18n, opts: ShareOptions, canvas: HTMLCanvasElement = document.createElement('canvas')): HTMLCanvasElement {
  const lines = shareLines(data, i18n, opts.names);
  canvas.width = opts.width;
  canvas.height = opts.height;
  const g = canvas.getContext('2d');
  if (g === null) throw new Error('renderShare : contexte 2D indisponible');
  const { colors, fontUi } = loadUi().theme;
  const layout = layoutShare(lines.others.length, opts.width, opts.height);
  g.fillStyle = colors.base;
  g.fillRect(0, 0, opts.width, opts.height);
  g.textBaseline = 'middle';
  const text = (id: string, s: string, color: string, scale: number): void => {
    const b = layout.blocks.find((k) => k.id === id);
    if (b === undefined) return;
    g.fillStyle = color;
    g.font = `${Math.max(1, Math.floor(b.h * scale))}px ${fontUi}`;
    g.fillText(s, b.x, b.y + Math.floor(b.h / 2), b.w);
  };
  text('title', lines.title, colors.light, 0.4);
  text('world', [lines.world, ...lines.names].join(' · '), colors.sodium, 0.35);
  lines.others.forEach((s, i) => text(`other-${i}`, s, colors.panelText, 0.3));
  if (lines.locked !== null) text('locked', lines.locked, colors.panelText, 0.3);
  return canvas;
}

/** Rend l'image, en fait un PNG et déclenche le téléchargement ; échoue si le navigateur ne rend pas de blob. */
export async function shareImage(data: BilanData, i18n: I18n, opts: ShareOptions, canvas?: HTMLCanvasElement): Promise<void> {
  const c = renderShare(data, i18n, opts, canvas);
  const blob = await new Promise<Blob>((resolve, reject) => {
    c.toBlob((b) => { if (b === null) reject(new Error('shareImage : toBlob n\'a rendu aucune image')); else resolve(b); }, 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-aftermath.png';
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); }, 0);
}
