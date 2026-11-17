// Produit tests/fixtures/rng-golden.json en EXÉCUTANT le générateur de la v1 (legacy/html-prototype/js/worldstate.js),
// jamais à la main [GDD 03 T-1c : au moins 100 000 sorties par graine].
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import process from 'node:process';
import { URL } from 'node:url';
import { foldUint32 } from './fold.mjs';

const SEEDS = [0, 1, 9000, 9001, 9007, -1, 2147483647, 123456789, 3000000000, 4294967295];
const COUNT = 100_000;

const src = readFileSync(new URL('../../../legacy/html-prototype/js/worldstate.js', import.meta.url), 'utf8');
const ctx = { window: { AFTERMATH: {} } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const A = ctx.window.AFTERMATH;
if (typeof A.makeRng !== 'function') {
  throw new Error('A.makeRng introuvable : legacy/html-prototype/js/worldstate.js ne s\'attache pas à window.AFTERMATH');
}

const seeds = SEEDS.map((seed) => {
  const next = A.makeRng(seed);
  let h = 0x811c9dc5;
  const first8 = [];
  for (let i = 0; i < COUNT; i++) {
    const x = next() * 4294967296; // exact : la v1 divise par 2^32
    if (i < 8) first8.push(x);
    h = foldUint32(h, x);
  }
  return { seed, first8, checksum: h >>> 0 };
});

const out = new URL('../../tests/fixtures/rng-golden.json', import.meta.url);
mkdirSync(new URL('../../tests/fixtures/', import.meta.url), { recursive: true });
writeFileSync(out, JSON.stringify({ count: COUNT, seeds }, null, 2) + '\n');
process.stdout.write(`rng-golden.json écrit : ${seeds.length} entrées\n`);
