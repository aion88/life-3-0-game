/* global console, process */
/**
 * Atlas, version anglaise : garde `_src` de `src/atlas/data.en.json` (empreinte du français source de chaque champ traduit).
 *   node tools/atlas-en-sync.mjs            liste les champs dont le français a changé (retraduire) ou qui n'existent plus ; code 1 s'il y en a
 *   node tools/atlas-en-sync.mjs --stamp    réécrit `_src` depuis le français courant : À FAIRE SEULEMENT après avoir retraduit les champs listés
 * Node 24 lit les types TypeScript tel quel : le module importé est le même que celui du test.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, frenchFor, leafPaths, stamp } from '../src/atlas/enSource.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const FR = JSON.parse(readFileSync(join(ICI, '..', 'src', 'atlas', 'data.json'), 'utf8'));
const EN_PATH = join(ICI, '..', 'src', 'atlas', 'data.en.json');
const en = JSON.parse(readFileSync(EN_PATH, 'utf8'));

if (process.argv.includes('--stamp')) {
  en._src = stamp(FR, en);
  writeFileSync(EN_PATH, `${JSON.stringify(en, null, 1)}\n`);
  console.log(`_src : ${Object.keys(en._src).length} empreintes écrites`);
} else {
  const src = en._src ?? {};
  const problems = [];
  for (const p of leafPaths(en)) {
    const fr = frenchFor(FR, p);
    if (fr === undefined) problems.push(`${p} : le champ français n'existe plus (retirer la traduction)`);
    else if (src[p] !== fingerprint(fr)) problems.push(`${p} : le français a changé (retraduire)`);
  }
  console.log(problems.length ? problems.join('\n') : 'data.en.json à jour avec le français');
  process.exit(problems.length ? 1 : 0);
}
