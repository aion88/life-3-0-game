/**
 * Atlas des futurs : forme de `data.json`, produit par `tools/generate-atlas.mjs` depuis `research/atlas/ledger.json`.
 * Trois natures d'information, jamais mélangées : le FAIT (loi, stade, date, étiquette Sourcé), le CHIFFRE (valeur avec auteur,
 * date, question, limite) et la LECTURE DU JEU (`liens`, `levier` : étiquette Extrapolé, mécanisme et limite obligatoires).
 */
import { z } from 'zod';

export const STADES = ['en vigueur', 'adoptée', 'en débat', 'déposée', 'annoncée', 'censurée ou rejetée', 'expirée'] as const;
export type Stade = (typeof STADES)[number];

const https = z.string().regex(/^https:\/\//, 'URL https obligatoire');
const texte = z.string().trim().min(1);
const monde = z.string().regex(/^w(0[1-9]|1[0-2])$/);
const sha = z.string().regex(/^[0-9a-f]{64}$/);

/** Traduction optionnelle d'une entrée : tout champ absent retombe sur le français. */
const tr = <S extends z.ZodRawShape>(shape: S) => z.strictObject(shape).partial().optional();

export const lienSchema = z.strictObject({
  monde,
  sens: z.enum(['vers', 'frein']),
  force: z.enum(['direct', 'indirect']),
  mecanisme: texte,
  limite: texte,
  citation_id: texte,
  en: tr({ mecanisme: texte, limite: texte }),
});

export const loiSchema = z.strictObject({
  id: texte,
  juridiction: z.enum(['FR', 'UE', 'INT']),
  titre: texte,
  titre_court: texte,
  theme: texte,
  nature: texte.nullable(),
  stade: z.enum(STADES),
  stade_label: texte,
  stade_note: texte.nullable(),
  date_stade: texte,
  /** Date ISO au jour près, seule admise sur la frise ; `null` sinon. */
  date_jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  censure_partielle: z.boolean().nullable(),
  experimentation: texte.nullable(),
  procedure: texte.nullable(),
  entree_en_vigueur: texte.nullable(),
  application: texte.nullable(),
  citation: texte,
  citation_ajoutee: texte.nullable(),
  phrase: texte.nullable(),
  limite: texte,
  /** Notes de vérification (comment on a lu le texte, ce qui n'a pas été ouvert) : hors empreinte, affichées dans un repli fermé de la fiche. */
  verification: texte.nullable(),
  url: https,
  url_suivi: https.nullable(),
  urls_secondes: z.array(https),
  verdict: z.enum(['vérifié', 'corrigé']),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sha256: sha,
  liens: z.array(lienSchema),
  levier: z.strictObject({ id: texte, sens: texte, mots: texte }).nullable(),
  raison_sans_levier: texte.nullable(),
  sans_lien: texte.nullable(),
  en: tr({ titre: texte, titre_court: texte, stade_label: texte, stade_note: texte, date_stade: texte, nature: texte, procedure: texte, experimentation: texte, entree_en_vigueur: texte, application: texte, levier_mots: texte, phrase: texte, limite: texte, verification: texte, raison_sans_levier: texte, sans_lien: texte }),
});

export const futurSchema = z.strictObject({
  id: texte,
  titre_en: texte,
  citation_en: texte,
  traduction_fr: texte,
  etiquette: z.literal('Sourcé'),
  auteur: texte,
  date_publication: texte,
  url: https,
  /** Définition d'un mot de la phrase du futur (« téléversés »), hors citation et hors empreinte ; jamais un fait. */
  glose: texte.nullable(),
  limite: texte,
  verdict: z.enum(['vérifié', 'corrigé']),
});

export const mondeSchema = z.strictObject({
  id: monde,
  nom: texte,
  extinction: z.boolean(),
  leviers: z.array(z.strictObject({ id: texte, pole: texte.nullable() })),
  aucun_levier: z.boolean(),
  note_aucun: texte.nullable(),
  futur: futurSchema,
  en: tr({ nom: texte, note_aucun: texte, futur_limite: texte, futur_glose: texte }),
});

/** Jauge d'un chiffre : valeur lue sur une échelle 0 à max, avec des traits de seuil ; jamais une échelle inventée. */
export const jaugeSchema = z.strictObject({
  valeur: z.number().min(0),
  max: z.number().positive(),
  seuils: z.array(z.strictObject({ valeur: z.number(), libelle: texte, source_url: https.optional() })),
  unite: texte,
  calcule_par_nous: z.boolean().optional(),
  note: texte.optional(),
}).refine((j) => j.valeur <= j.max, 'valeur au-dessus du max');

export const chiffreSchema = z.strictObject({
  id: texte,
  titre: texte.optional(),
  titre_court: texte.optional(),
  /** Libellé court de la tuile et valeur déjà lisible (« 48 % / 51 % ») : lectures d'affichage du registre, facultatives. */
  libelle_court: texte.optional(),
  /** Soit un texte déjà lisible, soit une liste de nombres avec leur mot (« 48 favorables », « 51 opposés ») : chaque nombre porte son « % ». */
  valeur_affichee: z.union([texte, z.array(z.strictObject({ valeur: z.number(), libelle: texte })).min(1)]).optional(),
  jauge: jaugeSchema.nullable().optional(),
  valeur: z.union([z.number(), z.string()]),
  unite: texte,
  question: texte,
  question_fr: texte.nullable(),
  population: texte.nullable(),
  effectif: texte.nullable(),
  terrain: texte.nullable(),
  auteur: texte,
  date_publication: texte,
  phrase: texte,
  limite: texte,
  url: https,
  calcule_par_nous: z.boolean(),
  verdict: z.enum(['vérifié', 'corrigé']),
  as_of: texte,
  sha256: sha,
  en: z.strictObject({
    titre: texte, titre_court: texte, libelle_court: texte, valeur_affichee: texte, libelles_affichees: z.array(texte), valeur: texte, unite: texte, auteur: texte, phrase: texte, limite: texte, question_fr: texte,
    /** Traduction de `question` quand elle est écrite en français ; `question` reste l'original. */
    question_tr: texte, population: texte, effectif: texte, terrain: texte, date_publication: texte,
    jauge: z.strictObject({ unite: texte, seuils: z.array(texte), note: texte }).partial(),
  }).partial().optional(),
});

export const atlasSchema = z.strictObject({
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ecartees: z.number().int().min(0),
  leviers: z.array(z.strictObject({ id: texte, nom: texte, question: texte, en: tr({ nom: texte, question: texte }) })),
  themes: z.array(z.strictObject({ id: texte, titre: texte, lois: z.array(texte), en: tr({ titre: texte }) })),
  mondes: z.array(mondeSchema).length(12),
  lois: z.array(loiSchema),
  chiffres: z.array(chiffreSchema),
  /** Mesures du futur hors droit de l'IA (w12) : même forme que les chiffres, vide tant que leur registre n'est pas contrôlé. */
  horsdroit: z.array(chiffreSchema).default([]),
  /** Repères sourcés (ex. l'Accord de Paris) qui nomment les traits de seuil des jauges. */
  reperes: z.array(z.strictObject({ id: texte, titre: texte, url: https, en: tr({ titre: texte }) })).default([]),
});

export type Lien = z.infer<typeof lienSchema>;
export type Loi = z.infer<typeof loiSchema>;
export type Monde = z.infer<typeof mondeSchema>;
export type Chiffre = z.infer<typeof chiffreSchema>;
export type Jauge = z.infer<typeof jaugeSchema>;
export type AtlasData = z.infer<typeof atlasSchema>;
export type MondeId = Monde['id'];

/** Valide et rend les données ; lève une erreur lisible si la forme dérive. */
export function parseAtlas(raw: unknown): AtlasData {
  return atlasSchema.parse(raw);
}
