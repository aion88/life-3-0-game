/**
 * Dette de texte et de données provisoires : un avertissement par préfixe de clés ou par bloc de monde dont le contenu définitif attend un
 * propriétaire [plan 03 R-03.7, D141 (1) b]. Le registre est la constante `PROVISIONAL` ci-dessous (aucun import JSON sous `src/validate`) ; l'avertissement n'existe que si la matière est
 * présente dans l'entrée, ce qui garde les entrées synthétiques des tests sans bruit. Pur.
 */
import type { Issue } from '../shared/types/common';
import type { ContentInput } from './content';

interface StringsEntry { readonly kind: 'strings'; readonly prefix: string; readonly owner: string; readonly reason: string }
interface WorldEntry { readonly kind: 'world'; readonly world: string; readonly path: string; readonly owner: string; readonly reason: string }
export type ProvisionalEntry = StringsEntry | WorldEntry;

/** Le registre des provisoires, tel qu'écrit dans les données. */
export const PROVISIONAL: readonly ProvisionalEntry[] = [
  {
    "kind": "strings",
    "prefix": "warning",
    "owner": "writer",
    "reason": "avertissement de contenu : texte validé D102 (FR), EN et libellés à relire"
  },
  {
    "kind": "strings",
    "prefix": "q",
    "owner": "writer",
    "reason": "questionnaire : textes du canon (QUEST §2.2, GDD 01 §3.5) posés le 2026-11-03 ; reste à faire : traduction EN non validée ; libellés Q04 A, Q04 D, Q11 A, Q18 A raccourcis le 2026-11-03, à mesurer (GDD 01 U-4)"
  },
  {
    "kind": "strings",
    "prefix": "ff.ui",
    "owner": "writer",
    "reason": "interface du fast-forward : libellés à écrire"
  },
  {
    "kind": "strings",
    "prefix": "ff.une",
    "owner": "writer",
    "reason": "unes du fast-forward (Cynthia 2026-11-03) : titres d'une année sans titre déclenché, un par axe et sens du mouvement de la trajectoire, plus « rien ne bouge » ; écrits le 2026-11-03 depuis les textes cause.* et ff.* existants, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "ff.arrival",
    "owner": "writer",
    "reason": "lignes d'arrivée et décalages : textes à écrire"
  },
  {
    "kind": "strings",
    "prefix": "causes.ui",
    "owner": "writer",
    "reason": "interface de l'écran des causes : libellés à écrire"
  },
  {
    "kind": "strings",
    "prefix": "redirect",
    "owner": "narrative-director",
    "reason": "phrases de redirection D140 : texte de travail à finaliser"
  },
  {
    "kind": "strings",
    "prefix": "world",
    "owner": "writer",
    "reason": "noms EN des douze mondes à valider ; lignes en clair validées (narrative-director, 2026-10-28)"
  },
  {
    "kind": "strings",
    "prefix": "w10.day",
    "owner": "writer",
    "reason": "dates de la semaine de w10 : bible w10 §8.1, formulation à relire"
  },
  {
    "kind": "strings",
    "prefix": "bilan",
    "owner": "writer",
    "reason": "interface et pièces du bilan : textes neutres à écrire ; remontée par réponse écrite le 2026-11-03, à valider par narrative-director"
  },
  {
    "kind": "strings",
    "prefix": "w10.bilan",
    "owner": "writer",
    "reason": "dossier, fin, mentions et lignes de jour de w10 : textes neutres à écrire"
  },
  {
    "kind": "strings",
    "prefix": "sources",
    "owner": "writer",
    "reason": "SOURCES & HONESTY : textes témoins du GDD 06 §3.8 à écrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.choice",
    "owner": "writer",
    "reason": "P-4, libellés provisoires de l'exécutant"
  },
  {
    "kind": "strings",
    "prefix": "street.ui.choices",
    "owner": "writer",
    "reason": "UI-C, annonces et noms de groupe de la rue : textes provisoires de l'exécutant"
  },
  {
    "kind": "strings",
    "prefix": "street.ui.words",
    "owner": "writer",
    "reason": "P-4, texte de la spec non validé"
  },
  {
    "kind": "strings",
    "prefix": "w10.welcome",
    "owner": "writer",
    "reason": "accueil du J1 par le Service de courtoisie et ligne de la lettre (playtest 2026-11-03, §1 A) : lignes témoins du GDD posées le 2026-11-03, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.goal",
    "owner": "writer",
    "reason": "ligne d'objectif du jour, jalon de la bible §8.1 et rendez-vous fixe §8.2 (playtest 2026-11-03, §1 A et §3 A) : posée le 2026-11-03, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.arrive",
    "owner": "writer",
    "reason": "ligne d'arrivée du narrateur quand un groupe de choix s'ouvre, tirée de la bible §5.0, §8.1, §8.2 (retour de playtest 2026-11-03) : posée le 2026-11-03, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "rights.source",
    "owner": "writer",
    "reason": "texte officiel à relire contre la source ; EN à écrire"
  },
  {
    "kind": "strings",
    "prefix": "rights.quote",
    "owner": "writer",
    "reason": "texte officiel à relire contre la source ; EN à écrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.evening.scene",
    "owner": "writer",
    "reason": "relevé du soir en scène, titre et ligne du narrateur par palier (playtest 2026-11-03, §3 A) : posés le 2026-11-03, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.sources",
    "owner": "writer",
    "reason": "tableau canonique contre extrapolé de la bible w10 §1.2 : lignes témoins à écrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.scene",
    "owner": "writer",
    "reason": "lignes de scène des journées guidées J1-J2 (rue guidée T5, spec 2026-11-04 §4 à §7) et J3 (plan J3-J7 T9, conception 2026-11-05 §4.1 ; invites des scènes j3.pylone et j3.cantine écrites par l'exécutant, absentes de la conception), J4 (T10), J5 (T11, conception §4.3) et J6 (T12, conception §4.4) : posées le 2026-11-05 par l'exécutant, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.scene.j6.cut.remark",
    "owner": "writer",
    "reason": "réplique remark du J6 (la coupure) portée de 9 à 15 mots le 2026-11-08 par l'exécutant (N9, verdict P-7, neutralité du J6 sur le domaine) : texte provisoire, le compte de 15 mots est la contrainte, le ton du personnage reste à reprendre"
  },
  {
    "kind": "strings",
    "prefix": "w10.chain",
    "owner": "narrative-director",
    "reason": "structure et titres des chaînes A, B, E des journées guidées J1-J2 (rue guidée T5, spec 2026-11-04 §4 à §7) et de la chaîne C (plan J3-J7 T9, conception 2026-11-05 §3.3, maillons du J5 en T11, du J6 en T12) : posées le 2026-11-05 par l'exécutant, à réécrire ; B et E : questions 2026 provisoires"
  },
  {
    "kind": "strings",
    "prefix": "w10.recap",
    "owner": "writer",
    "reason": "lignes du relevé du soir par maillon des journées guidées J1-J2 (rue guidée T5, spec 2026-11-04 §4 à §7) J3 (A3, B3, B3w, C1, E4 et noms donnés, plan J3-J7 T9), J4 (T10), J5 (A6, E6, C3t, C3, C3w, T11) et J6 (B6, A7, C4, T12) : posées le 2026-11-05 par l'exécutant, à réécrire"
  },
  {
    "kind": "strings",
    "prefix": "w10.fact",
    "owner": "world-builder",
    "reason": "faits réels des chaînes A, B, C, E, à vérifier contre la bible §1.5 et research/ (E : precedents-10-12-collapses.md P6, statut [S] ; C : Zersetzung, precedents-10-12-collapses.md:55, [V] Wikipédia)"
  },
  {
    "kind": "strings",
    "prefix": "w10.end",
    "owner": "writer",
    "reason": "les 7 lignes de fin de l'issue (plan J3-J7, spec design/gdd/2026-11-05-rue-guidee-j3-j7.md) : écrites en l'absence de Cynthia (spec §9), à relire par le writer et le narrative-director"
  },
  {
    "kind": "strings",
    "prefix": "w10.demo",
    "owner": "writer",
    "reason": "fin de démo : clés héritées, plus lues par la rue guidée de w10 depuis le plan J3-J7 T13 (`endOfDemo` vaut `null`, le J7 finit par l'issue), journées guidées (rue guidée T5, spec 2026-11-04 §4 à §7) : posées le 2026-11-05 par l'exécutant, à réécrire"
  },
  {
    "kind": "world",
    "world": "w10",
    "path": "street.guided",
    "owner": "world-builder",
    "reason": "amendement bible §3.4, §8.1 J4, §8.4 B : Mme Roux voisine, téléphone source, la fille ; B et E : questions 2026 et faits provisoires ; J3 (T9) : Théodore en corps de foule `crowd_a` (P-5)"
  },
  {
    "kind": "world",
    "world": "w10",
    "path": "bilan.rights.carriers",
    "owner": "world-builder",
    "reason": "colonne « porté par » de la bible w10 §4.5 absente : les huit porteurs de droits sont les candidats de GDD 06 §3.7, à remplacer"
  }
];

/** Nombre de clés (par langue) sous un préfixe, frontière de segment. */
export function keysUnder(table: Readonly<Record<string, string>>, prefix: string): number {
  return Object.keys(table).filter((k) => k.startsWith(`${prefix}.`)).length;
}

/** Les avertissements `todo` des provisoires présents dans l'entrée. */
export function provisionalFlags(input: ContentInput): Issue[] {
  const out: Issue[] = [];
  for (const e of PROVISIONAL) {
    if (e.kind === 'strings') {
      const n = keysUnder(input.strings.fr, e.prefix);
      if (n === 0) continue;
      out.push({
        code: 'GDD05-todo-provisional-text', file: 'strings/fr.json', path: e.prefix, owner: e.owner,
        message: `${n} clés au texte provisoire sous « ${e.prefix} » : ${e.reason}`,
      });
    } else {
      const w = input.worlds.find((x) => x.id === e.world);
      if (!w || Object.keys(w.bilan).length === 0) continue;
      out.push({ code: 'GDD06-todo-right-carriers', file: `worlds/${e.world}.json`, path: e.path, owner: e.owner, message: e.reason });
    }
  }
  return out;
}
