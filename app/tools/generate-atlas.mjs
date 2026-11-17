/* global console, process */
/**
 * Atlas des futurs : produit `src/atlas/data.json` depuis `research/atlas/ledger.json` et `research/atlas/structure.json`.
 * Lancement, depuis `app/` : `node tools/generate-atlas.mjs` (jamais appelé par `npm run build` : Phase B isolée).
 *
 * Il REFUSE (code 1, rien n'est écrit) :
 *  - une empreinte sha256 qui diffère de celle recalculée (même canon que `build_ledger.py` : clés triées, JSON compact) ;
 *  - un lien, un thème ou un monde qui cite une entrée au verdict « bloqué » ou absente ;
 *  - une loi, un chiffre ou une phrase de monde au verdict autre que vérifié / corrigé, sans URL https, sans as_of, sans limite ;
 *  - un lien loi vers monde sans mécanisme, sans limite ou sans citation_id existant.
 * Les entrées « bloqué » du ledger sont ÉCARTÉES : elles ne sortent jamais dans data.json (le nombre est affiché).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const LEDGER = join(RACINE, 'research', 'atlas', 'ledger.json');
const STRUCT = join(RACINE, 'research', 'atlas', 'structure.json');
const HORSDROIT = join(RACINE, 'research', 'atlas', 'ledger-horsdroit.json');
const SORTIE = join(ICI, '..', 'src', 'atlas', 'data.json');

const erreurs = [];
const refuse = (msg) => erreurs.push(msg);

/** Même canon que Python : json.dumps(sort_keys, ensure_ascii=False, séparateurs compacts). */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
const HASHED = ['stade', 'date_stade', 'phrase_autorisee', 'citation', 'url', 'url_suivi'];
function empreinte(e) {
  const d = {};
  for (const k of HASHED) d[k] = e[k] ?? null;
  if (e.type === 'chiffre') d.valeur = e.valeur ?? null;
  return createHash('sha256').update(canon(d), 'utf8').digest('hex');
}

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const struct = JSON.parse(readFileSync(STRUCT, 'utf8'));
const bloques = new Set(ledger.filter((e) => e.verdict === 'bloqué').map((e) => e.id));
const gardees = ledger.filter((e) => e.verdict !== 'bloqué');
const par = new Map(gardees.map((e) => [e.id, e]));

for (const e of ledger) {
  if (empreinte(e) !== e.sha256) refuse(`${e.id} : empreinte différente (relancer build_ledger.py, relire l'entrée)`);
}
for (const e of gardees) {
  if (!['vérifié', 'corrigé'].includes(e.verdict)) refuse(`${e.id} : verdict ${e.verdict}`);
  if (typeof e.url !== 'string' || !e.url.startsWith('https://')) refuse(`${e.id} : URL non https`);
  if (e.url_suivi && !e.url_suivi.startsWith('https://')) refuse(`${e.id} : url_suivi non https`);
  if (!e.as_of) refuse(`${e.id} : as_of absent`);
  if (!e.limite || !String(e.limite).trim()) refuse(`${e.id} : limite vide`);
}

const MOIS_ISO = /^\d{4}-\d{2}-\d{2}$/;
const nettoie = (s) => (typeof s === 'string' && s.trim() ? s : null);

function stadeAffiche(e) {
  const brut = e.stade_affiche ?? e.stade;
  const m = /^(.+?)\s*\((.+)\)$/.exec(brut);
  if (m && m[1] === e.stade) return { label: e.stade, note: m[2] };
  return { label: brut, note: null };
}

const lois = [];
for (const e of gardees.filter((x) => x.type === 'loi')) {
  const { label, note } = stadeAffiche(e);
  const liens = (e.liens ?? []).map((k) => {
    if (!k.mecanisme || !k.limite || !par.has(k.citation_id)) refuse(`${e.id} : lien vers ${k.monde} sans mécanisme, limite ou citation_id existant`);
    return { monde: k.monde, sens: k.sens, force: k.force, mecanisme: k.mecanisme, limite: k.limite, citation_id: k.citation_id };
  });
  const secondes = (e.url_seconde_source ?? '').split(/\s*;\s*/).map((u) => u.trim().split(/\s+/)[0]).filter((u) => u.startsWith('https://'));
  const exp = typeof e.experimentation_jusqu_au === 'string' && !e.experimentation_jusqu_au.startsWith('non prouvé') ? e.experimentation_jusqu_au : null;
  lois.push({
    id: e.id,
    juridiction: e.juridiction,
    titre: e.titre,
    titre_court: e.titre_court,
    theme: e.theme,
    nature: nettoie(e.nature),
    stade: e.stade,
    stade_label: label,
    stade_note: note,
    date_stade: e.date_stade,
    date_jour: MOIS_ISO.test(e.date_stade ?? '') ? e.date_stade : null,
    censure_partielle: e.censure_partielle ?? null,
    experimentation: exp,
    procedure: nettoie(e.procedure),
    entree_en_vigueur: nettoie(e.entree_en_vigueur),
    application: nettoie(e.application),
    citation: e.citation,
    citation_ajoutee: nettoie(e.citation_ajoutee),
    phrase: nettoie(e.phrase_autorisee),
    limite: e.limite,
    verification: nettoie(e.verification),
    url: e.url,
    url_suivi: nettoie(e.url_suivi),
    urls_secondes: secondes,
    verdict: e.verdict,
    as_of: e.as_of,
    sha256: e.sha256,
    liens,
    levier: e.levier ?? null,
    raison_sans_levier: nettoie(e.raison_sans_levier),
    sans_lien: nettoie(e.sans_lien),
  });
}

for (const t of struct.themes) for (const id of t.lois) if (!par.has(id)) refuse(`thème ${t.id} cite ${id}, ${bloques.has(id) ? 'bloqué' : 'absent'}`);
const idsLois = new Set(lois.map((l) => l.id));
for (const l of lois) if (!struct.themes.some((t) => t.id === l.theme && t.lois.includes(l.id))) refuse(`${l.id} : thème ${l.theme} ne le liste pas`);
for (const t of struct.themes) for (const id of t.lois) if (!idsLois.has(id)) refuse(`thème ${t.id} : ${id} n'est pas une loi affichée`);

const mondes = struct.mondes.map((m) => {
  const t = par.get(m.teg);
  if (!t || t.type !== 'tegmark') refuse(`monde ${m.id} : phrase ${m.teg} absente ou bloquée`);
  return {
    id: m.id,
    nom: m.nom,
    extinction: m.extinction,
    leviers: m.leviers.map((id) => ({ id, pole: m.poles[id] ?? null })),
    aucun_levier: m.aucun,
    note_aucun: nettoie(m.note_aucun),
    futur: t && {
      id: t.id,
      titre_en: t.titre,
      citation_en: t.citation,
      traduction_fr: t.traduction_fr,
      etiquette: t.etiquette ?? 'Sourcé',
      auteur: t.auteur,
      date_publication: t.date_publication,
      url: t.url,
      glose: nettoie(t.glose),
      limite: t.limite,
      verdict: t.verdict,
    },
  };
});

/** Jauge d'un chiffre du futur hors droit : null si absente ; n'invente jamais une échelle (valeur et max numériques, max > 0, valeur dans [0, max]). */
function versJauge(c) {
  const j = c.jauge;
  if (j === undefined || j === null) return null;
  if (typeof j.valeur !== 'number' || typeof j.max !== 'number' || !(j.max > 0) || j.valeur < 0 || j.valeur > j.max) {
    refuse(`${c.id} : jauge incohérente (valeur ${j.valeur}, max ${j.max})`);
    return null;
  }
  const seuils = (j.seuils ?? []).map((s) => {
    if (typeof s.valeur !== 'number' || !nettoie(s.libelle)) refuse(`${c.id} : seuil sans valeur ou sans libellé`);
    return { valeur: s.valeur, libelle: s.libelle, ...(typeof s.source_url === 'string' && s.source_url.startsWith('https://') ? { source_url: s.source_url } : {}) };
  });
  return {
    valeur: j.valeur,
    max: j.max,
    seuils,
    unite: j.unite,
    ...(j.calcule_par_nous === true ? { calcule_par_nous: true } : {}),
    ...(nettoie(j.note) ? { note: j.note } : {}),
  };
}

function versChiffre(c) {
  for (const k of ['auteur', 'date_publication', 'question', 'phrase_autorisee']) if (!nettoie(c[k])) refuse(`${c.id} : ${k} absent`);
  const qfr = nettoie(c.question_fr);
  return {
    id: c.id,
    ...(nettoie(c.titre) ? { titre: c.titre } : {}),
    ...(nettoie(c.titre_court) ? { titre_court: c.titre_court } : {}),
    ...(nettoie(c.libelle_court) ? { libelle_court: c.libelle_court } : {}),
    ...(nettoie(c.valeur_affichee) || (Array.isArray(c.valeur_affichee) && c.valeur_affichee.length > 0) ? { valeur_affichee: c.valeur_affichee } : {}),
    ...(c.jauge !== undefined ? { jauge: versJauge(c) } : {}),
    valeur: c.valeur,
    unite: c.unite,
    question: c.question,
    question_fr: qfr && !/^sans objet/i.test(qfr) && qfr !== c.question ? qfr : null,
    population: nettoie(c.population),
    effectif: c.effectif === undefined || c.effectif === null ? null : String(c.effectif),
    terrain: nettoie(c.terrain),
    auteur: c.auteur,
    date_publication: c.date_publication,
    phrase: c.phrase_autorisee,
    limite: c.limite,
    url: c.url,
    calcule_par_nous: c.calcule_par_nous === true,
    verdict: c.verdict,
    as_of: c.as_of,
    sha256: c.sha256,
  };
}

const chiffres = gardees.filter((x) => x.type === 'chiffre').sort((a, b) => a.id.localeCompare(b.id)).map(versChiffre);

// Futur hors droit de l'IA (w12) : registre à part, mêmes refus, seules les entrées vérifié / corrigé de type chiffre sortent.
const horsdroitBrut = existsSync(HORSDROIT) ? JSON.parse(readFileSync(HORSDROIT, 'utf8')) : [];
let horsdroitEcartees = 0;
const horsdroit = [];
const reperes = [];
for (const e of horsdroitBrut) {
  if (empreinte(e) !== e.sha256) refuse(`${e.id} (hors droit) : empreinte différente (relancer build_ledger.py)`);
  if (e.type === 'repère' && ['vérifié', 'corrigé'].includes(e.verdict) && typeof e.url === 'string' && e.url.startsWith('https://') && nettoie(e.titre)) {
    reperes.push({ id: e.id, titre: e.titre, url: e.url }); // sert à nommer les traits de seuil des jauges, jamais affiché comme chiffre
    horsdroitEcartees += 1;
    continue;
  }
  if (e.verdict === 'bloqué' || e.type !== 'chiffre') { horsdroitEcartees += 1; continue; }
  if (!['vérifié', 'corrigé'].includes(e.verdict)) refuse(`${e.id} : verdict ${e.verdict}`);
  if (typeof e.url !== 'string' || !e.url.startsWith('https://')) refuse(`${e.id} : URL non https`);
  if (!e.as_of) refuse(`${e.id} : as_of absent`);
  if (!e.limite || !String(e.limite).trim()) refuse(`${e.id} : limite vide`);
  horsdroit.push(versChiffre(e));
}
horsdroit.sort((a, b) => a.id.localeCompare(b.id));

const asOf = gardees.map((e) => e.as_of).sort().at(-1);
const data = { as_of: asOf, ecartees: bloques.size, leviers: struct.leviers, themes: struct.themes, mondes, lois, chiffres, horsdroit, reperes };

if (erreurs.length) {
  console.error(`REFUS : ${erreurs.length} écart(s), data.json non écrit.\n  ${erreurs.join('\n  ')}`);
  process.exit(1);
}
writeFileSync(SORTIE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`data.json : ${lois.length} lois, ${chiffres.length} chiffres, ${horsdroit.length} chiffres hors droit (${horsdroitEcartees} écartés ou non affichés), ${mondes.length} mondes, ${bloques.size} entrées écartées (bloqué), as_of ${asOf}`);
