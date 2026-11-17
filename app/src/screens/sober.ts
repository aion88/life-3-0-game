/**
 * Page sobre de l'interface C pour langue, avertissement, sources et causes [plan UI-C T11 ; spec C §3.5, I-6].
 * Crème pleine page comme le bilan (les bandes 2,39:1 de la rue ne la recouvrent pas), voix sobre : ni rotation, ni transition, ni jus,
 * aucun événement de régime. Aucune couleur ni taille ici : `sober.css` lit les jetons posés par `applyTheme` sur le cadre.
 */
import type { Frame } from '../ui/frame';
import './sober.css';

/** Pose `main` en page sobre dans le cadre et masque les bandes. */
export function mountSoberPage(frame: Frame, main: HTMLElement): void {
  frame.stage.parentElement?.querySelectorAll<HTMLElement>('[data-band]').forEach((b) => { b.hidden = true; });
  main.classList.add('c-sober', 'c-sober-page');
  frame.stage.append(main);
}
