#!/usr/bin/env node
/* global console */
/**
 * Copie les WOFF2 latins de Montserrat et d'Inter (variables, axe wght) depuis les paquets Fontsource installés vers public/fonts/,
 * avec le LICENSE du paquet (celui dont le copyright est écrit dans la table `name` des fichiers livrés), et écrit fonts.lock.json.
 * Noms de fichiers lus dans les paquets, jamais de mémoire. Règle de la spec C §2 : une variable est livrée si elle pèse
 * 60 000 octets ou moins ; au-delà il faut ses statiques (Montserrat 500 et 600, Inter 400 et 500).
 * `licenceSource`/`licenceCommit` : OFL.txt de google/fonts lu le 2026-11-02 (OFL 1.1 confirmée) ; son nom de titulaire peut différer
 * de celui du binaire (Montserrat : « The Montserrat.Git Project Authors »), d'où le choix du LICENSE du paquet pour le texte livré.
 */
import { copyFileSync, readFileSync, statSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const OUT = 'public/fonts';
const VARIABLE_MAX = 60_000;
const NM = 'node_modules';
const FAMILIES = [
  { fam: 'montserrat', pkg: '@fontsource-variable/montserrat', licFile: 'LICENSE-Montserrat.txt', url: 'https://github.com/google/fonts/blob/main/ofl/montserrat/OFL.txt', commit: '76fca9fd0bb4ea46583f92e978660f3984ab9442' },
  { fam: 'inter', pkg: '@fontsource-variable/inter', licFile: 'LICENSE-Inter.txt', url: 'https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt', commit: 'b0928647ba26c8d55548aa19feb2f7aeba622d4a' },
];
const version = (pkg) => JSON.parse(readFileSync(join(NM, pkg, 'package.json'), 'utf8')).version;

const wanted = FAMILIES.map((f) => {
  const src = join(NM, f.pkg, 'files', `${f.fam}-latin-wght-normal.woff2`);
  if (!existsSync(src)) throw new Error(`absent du paquet : ${src}`);
  if (statSync(src).size > VARIABLE_MAX) throw new Error(`${f.fam} variable ${statSync(src).size} o > ${VARIABLE_MAX} : livrer les statiques`);
  return { ...f, src };
});

for (const n of readdirSync(OUT)) if (n.endsWith('.woff2')) unlinkSync(join(OUT, n));
const files = wanted.map(({ src, pkg, licFile, url, commit }) => {
  const file = src.split('/').pop();
  copyFileSync(src, join(OUT, file));
  copyFileSync(join(NM, pkg, 'LICENSE'), join(OUT, licFile));
  const buf = readFileSync(join(OUT, file));
  return { file, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), package: pkg, version: version(pkg), licenceSource: url, licenceCommit: commit };
});
writeFileSync(join(OUT, 'fonts.lock.json'), `${JSON.stringify({ files }, null, 2)}\n`);
console.log(`${files.length} fichiers, ${files.reduce((a, f) => a + f.bytes, 0)} octets`);
