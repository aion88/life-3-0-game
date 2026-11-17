/**
 * Empreinte du texte français source de chaque champ traduit dans `data.en.json` (clé `_src`). Quand le registre change un texte,
 * l'empreinte ne correspond plus : le test échoue et dit quel champ retraduire. Module pur, autonome (outil `tools/atlas-en-sync.mjs` l'importe tel quel).
 */
import type { AtlasData } from './schema';

/** FNV-1a 32 bits, deux graines : 16 caractères hexadécimaux, assez pour détecter un texte qui a bougé (pas un secret). */
export function fingerprint(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

type Bag = Readonly<Record<string, unknown>>;

/** Chemins « feuilles » d'un objet de traductions, hors `_src`. Les tableaux ajoutent leur indice. */
export function leafPaths(en: Bag): string[] {
  const out: string[] = [];
  const walk = (o: unknown, path: string): void => {
    if (typeof o === 'string') out.push(path);
    else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}.${i}`));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
  };
  for (const [k, v] of Object.entries(en)) if (k !== '_src') walk(v, k);
  return out;
}

/** Le texte français que traduit le champ `path` (ex. `lois.fr-01.liens.w10.limite`), ou `undefined` si le champ n'existe plus. */
export function frenchFor(data: AtlasData, path: string): string | undefined {
  const [section, id, ...rest] = path.split('.');
  const field = rest[0];
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  if (!section || !id || !field) return undefined;
  if (section === 'lois') {
    const l = data.lois.find((x) => x.id === id);
    if (!l) return undefined;
    if (field === 'liens') {
      const key = rest[1] ?? '';
      const same = (m: string): number => l.liens.filter((x) => x.monde === m).length;
      const k = l.liens.find((x) => (same(x.monde) > 1 ? `${x.monde}:${x.sens}` : x.monde) === key);
      return k ? str((k as Bag)[rest[2] ?? '']) : undefined;
    }
    if (field === 'levier_mots') return l.levier?.mots;
    return str((l as Bag)[field]);
  }
  if (section === 'chiffres' || section === 'horsdroit') {
    const c = data[section].find((x) => x.id === id);
    if (!c) return undefined;
    if (field === 'question_tr') return c.question_fr ? undefined : c.question;
    if (field === 'jauge') {
      const j = c.jauge;
      if (!j) return undefined;
      if (rest[1] === 'seuils') return j.seuils[Number(rest[2])]?.libelle;
      return str((j as Bag)[rest[1] ?? '']);
    }
    if (field === 'libelles_affichees') {
      const v = c.valeur_affichee;
      return Array.isArray(v) ? v[Number(rest[1])]?.libelle : undefined;
    }
    return str((c as Bag)[field]);
  }
  if (section === 'mondes') {
    const m = data.mondes.find((x) => x.id === id);
    if (!m) return undefined;
    if (field === 'futur_limite') return m.futur.limite;
    if (field === 'futur_glose') return m.futur.glose ?? undefined;
    return str((m as Bag)[field]);
  }
  if (section === 'leviers' || section === 'themes' || section === 'reperes') {
    const row = (data[section] as readonly ({ id: string } & Bag)[]).find((x) => x.id === id);
    return row ? str(row[field]) : undefined;
  }
  return undefined;
}

/** Les empreintes à écrire : pour chaque champ traduit, celle du français courant. */
export function stamp(data: AtlasData, en: Bag): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of leafPaths(en)) {
    const fr = frenchFor(data, p);
    if (fr !== undefined) out[p] = fingerprint(fr);
  }
  return out;
}
