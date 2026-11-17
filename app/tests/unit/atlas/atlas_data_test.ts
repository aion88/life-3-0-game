/** Atlas des futurs : le contenu de data.json tient les règles de vérité du plan (faits sourcés, chiffres signés, lectures étiquetées). */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import raw from '../../../src/atlas/data.json';
import { parseAtlas } from '../../../src/atlas/schema';
import { anneeDe, auteurCourt, counts, jaugeLisible } from '../../../src/atlas/model';

const data = parseAtlas(raw);
const ledger = JSON.parse(readFileSync('../research/atlas/ledger.json', 'utf8')) as Record<string, unknown>[];

const canon = (v: unknown): string => Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v !== null && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
    : JSON.stringify(v);
const HASHED = ['stade', 'date_stade', 'phrase_autorisee', 'citation', 'url', 'url_suivi'];
const sha = (e: Record<string, unknown>): string => {
  const d: Record<string, unknown> = {};
  for (const k of HASHED) d[k] = e[k] ?? null;
  if (e['type'] === 'chiffre') d['valeur'] = e['valeur'] ?? null;
  return createHash('sha256').update(canon(d), 'utf8').digest('hex');
};

/** Tournures refusées dans NOS phrases (jamais dans les citations de sources, affichées mot pour mot). */
export const REFUSEES = /(?<!\p{L})preuves?(?!\p{L})|mène à|inévitable|va conduire|probabilit[ée]s?(?!\p{L})|—|[\u{1F300}-\u{1FAFF}☀-➿]/iu;
const DUDH_EN_VIGUEUR = /(DUDH|Déclaration universelle des droits de l.homme)[^.]{0,60}en vigueur|en vigueur[^.]{0,60}(DUDH|Déclaration universelle des droits de l.homme)/i;

describe('atlas data : faits', () => {
  it('test_each_law_has_https_url_as_of_limit_verdict', () => {
    expect(data.lois.length).toBe(50);
    for (const l of data.lois) {
      expect(l.url, l.id).toMatch(/^https:\/\//);
      for (const u of [l.url_suivi, ...l.urls_secondes]) if (u) expect(u, l.id).toMatch(/^https:\/\//);
      expect(l.as_of, l.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.limite.trim().length, l.id).toBeGreaterThan(0);
      expect(['vérifié', 'corrigé'], l.id).toContain(l.verdict);
    }
  });
  it('test_fingerprints_match_the_ledger_and_blocked_entries_are_absent', () => {
    const byId = new Map(ledger.map((e) => [e['id'] as string, e]));
    for (const e of [...data.lois, ...data.chiffres]) {
      const src = byId.get(e.id);
      expect(src, e.id).toBeDefined();
      expect(sha(src as Record<string, unknown>), e.id).toBe(e.sha256);
      expect((src as Record<string, unknown>)['sha256'], e.id).toBe(e.sha256);
    }
    const shown = new Set([...data.lois, ...data.chiffres].map((e) => e.id));
    const blocked = ledger.filter((e) => e['verdict'] === 'bloqué').map((e) => e['id'] as string);
    expect(blocked.length).toBe(data.ecartees);
    for (const id of blocked) expect(shown.has(id), id).toBe(false);
    for (const m of data.mondes) expect(blocked).not.toContain(m.futur.id);
  });
  it('test_world_sentences_are_fli_summaries_labelled_sourced', () => {
    for (const m of data.mondes) {
      expect(m.futur.etiquette).toBe('Sourcé');
      expect(m.futur.auteur).toMatch(/Ariel Conn/);
      expect(m.futur.date_publication).toBe('2017-08-28');
      expect(m.futur.url).toBe('https://futureoflife.org/ai/ai-aftermath-scenarios/');
    }
    for (const m of data.mondes) expect(`${m.futur.citation_en} ${m.futur.traduction_fr}`).not.toMatch(/selon Tegmark/i);
  });
  it('test_stages_are_in_the_closed_list_and_states_have_a_date', () => {
    for (const l of data.lois) expect(l.date_stade.length, l.id).toBeGreaterThan(0);
    expect(data.lois.find((l) => l.id === 'int-06')?.date_stade).toBe('date non établie');
  });
});

describe('atlas data : chiffres', () => {
  it('test_no_number_without_author_date_question_limit_url', () => {
    expect(data.chiffres.length).toBe(14);
    for (const c of data.chiffres) {
      for (const f of [c.auteur, c.date_publication, c.question, c.limite, c.phrase]) expect(f.trim().length, c.id).toBeGreaterThan(0);
      expect(c.url, c.id).toMatch(/^https:\/\//);
    }
  });
  it('test_any_percentage_in_a_phrase_comes_from_a_signed_figure', () => {
    const signed = data.chiffres.map((c) => c.phrase).join(' ');
    for (const l of data.lois) for (const t of [l.phrase ?? '', ...l.liens.map((k) => k.mecanisme)]) expect(t, l.id).not.toMatch(/\d\s?%/);
    expect(signed).toMatch(/%/);
  });
});

describe('atlas data : accents, auteurs courts, futur hors droit', () => {
  const FIELDS = ['question_fr', 'population', 'unite', 'phrase', 'limite', 'terrain'] as const;
  it('test_our_figure_texts_carry_their_french_accents', () => {
    const bad = /(?<![\p{L}'])(publie|publiee|mediane|repondants?|reponses?|echantillons?|annee|annees|francais|ecart|enquete|securite|probabilites?|resultats?|developpement|americains?|methode|region|biometriques?|interroges|interrogees|opposes|controle|controles|apres|etait|etaient|ete|etre|meme|memes)(?![\p{L}])/iu;
    for (const c of [...data.chiffres, ...data.horsdroit]) {
      for (const f of FIELDS) expect(c[f] ?? '', `${c.id} ${f}`).not.toMatch(bad);
      expect(String(c.valeur), c.id).not.toMatch(/ a | opposes/);
    }
  });
  it('test_gauge_readable_values', () => {
    const lisible = new Map(data.horsdroit.map((c) => [c.id, jaugeLisible(c)]));
    expect(lisible.get('w12-01')).toBe('1,09 °C');
    expect(lisible.get('w12-06')).toBe('49 505 sur 175 909');
    expect(lisible.get('w12-11')).toBe('7 sur 9');
    expect(lisible.get('w12-08')).toBeNull();
    for (const c of data.chiffres) expect(jaugeLisible(c), c.id).toBeNull();
    for (const c of data.horsdroit) if (c.jauge) expect(c.jauge.valeur).toBeLessThanOrEqual(c.jauge.max);
  });
  it('test_short_authors_and_years_are_short', () => {
    for (const c of [...data.chiffres, ...data.horsdroit]) {
      expect(auteurCourt(c.auteur).length, c.id).toBeGreaterThan(1);
      expect(auteurCourt(c.auteur).length, `${c.id} ${auteurCourt(c.auteur)}`).toBeLessThanOrEqual(40);
      expect(anneeDe(c.date_publication), c.id).toMatch(/^(19|20)\d{2}$/);
    }
  });
  it('test_out_of_law_figures_match_their_register_and_blocked_or_marker_entries_are_absent', () => {
    const hd = JSON.parse(readFileSync('../research/atlas/ledger-horsdroit.json', 'utf8')) as Record<string, unknown>[];
    const byId = new Map(hd.map((e) => [e['id'] as string, e]));
    for (const c of data.horsdroit) {
      const src = byId.get(c.id);
      expect(src, c.id).toBeDefined();
      expect(sha(src as Record<string, unknown>), c.id).toBe(c.sha256);
      expect(['vérifié', 'corrigé']).toContain(c.verdict);
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.limite.trim().length).toBeGreaterThan(0);
    }
    const shown = new Set(data.horsdroit.map((c) => c.id));
    for (const e of hd) if (e['verdict'] === 'bloqué' || e['type'] !== 'chiffre') expect(shown.has(e['id'] as string), e['id'] as string).toBe(false);
  });
});

describe('atlas data : lectures du jeu', () => {
  it('test_no_link_without_mechanism_limit_and_existing_citation', () => {
    const ids = new Set(data.lois.map((l) => l.id));
    let n = 0;
    for (const l of data.lois) for (const k of l.liens) {
      n += 1;
      expect(k.mecanisme.trim().length, l.id).toBeGreaterThan(0);
      expect(k.limite.trim().length, l.id).toBeGreaterThan(0);
      expect(ids.has(k.citation_id), l.id).toBe(true);
      expect(data.lois.find((x) => x.id === k.citation_id)?.citation.length, l.id).toBeGreaterThan(0);
    }
    expect(n).toBe(31);
  });
  it('test_counts_match_the_validated_page', () => {
    const c = counts(data);
    expect(c.textes).toBe(50);
    expect(c.touchent10).toBe(27);
    expect(c.freins10).toBe(14);
    expect([...c.mondesSansLevier].sort()).toEqual(['w05', 'w08', 'w09', 'w12']);
  });
  it('test_refused_phrasings_absent_from_our_sentences', () => {
    // Nos phrases : titres courts, lectures de la matrice. Les textes des registres (phrase, limite, citation, traduction) sont des
    // contenus de sources contrôlées, affichés tels quels, hors de ce balayage (comme dans la page de relecture validée).
    const ours: string[] = [];
    for (const l of data.lois) {
      ours.push(l.titre_court, ...l.liens.flatMap((k) => [k.mecanisme, k.limite]));
      if (l.sans_lien) ours.push(l.sans_lien);
      if (l.raison_sans_levier) ours.push(l.raison_sans_levier);
    }
    for (const m of data.mondes) if (m.note_aucun) ours.push(m.note_aucun);
    for (const t of ours) { expect(t).not.toMatch(REFUSEES); expect(t).not.toMatch(DUDH_EN_VIGUEUR); }
  });
  it('test_refusal_pattern_bites', () => {
    for (const s of ['la preuve que', 'cela mène à', 'inévitable', 'va conduire', 'une probabilité', 'a — b']) expect(REFUSEES.test(s)).toBe(true);
    expect(DUDH_EN_VIGUEUR.test('la DUDH est en vigueur')).toBe(true);
  });
  it('test_forbidden_content_of_int_entries_is_absent', () => {
    expect(JSON.stringify(data)).not.toMatch(/Bosni|78[\s\u202f]?6\d\d|2026-03-27|22\/10\/2025|Chat Act/);
  });
});
