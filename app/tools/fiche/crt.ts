/** Page d'essai de la fiche machine du mur de CRT : un état figé par `?state=snow|dark|testcard`, sans interface (plan 03 T1). */
import { createCrtWall } from '../../src/ui/backdrops/crtWall';

const canvas = document.getElementById('wall') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
// reducedMotion : l'image est figée, la capture est donc reproductible.
const wall = createCrtWall(canvas, { seed: Number(params.get('seed') ?? 1984), reducedMotion: true });
const state = Math.max(0, wall.states().indexOf((params.get('state') ?? 'snow') as 'snow'));
wall.setParams({ state });
wall.start();
document.documentElement.dataset['ready'] = 'true';
