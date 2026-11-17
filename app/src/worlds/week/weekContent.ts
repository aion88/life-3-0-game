/**
 * Contenu et règles chiffrées de la semaine 1984 (jours 1 à 3).
 *
 * Source de vérité : prototypes/semaine-1984-objets/index.html, lignes 267-457
 * (valide par Cynthia). Plan : production/session-state/plan-semaine-1984-3d.md §8.
 * Toute valeur de jeu (nombres, libellés, textes) vit ICI et nulle part ailleurs :
 * `weekState.ts` et `weekScript.ts` ne portent aucune valeur de jeu.
 *
 * Les prix des cibles gardent la forme du prototype : `prix [· detail]`.
 * Le découpage en `price` / `detail` est fait par `weekScript.ts`.
 */

import type { Ending, WeekCast } from './weekContracts';

/** Les trois noms que la semaine permet de donner. */
export const NAMES = ['Théodore', 'Nadia', 'Marlène'] as const;
export type WeekName = (typeof NAMES)[number];

/** Règles chiffrées (plan §8.1, prototype lignes 270-271, 327-335, 445-450). */
export const RULES = {
  startBudget: 20,
  startDossier: 60,
  /** Dossier strictement inférieur à ce seuil à la fin : arrêté. */
  threshold: 40,
  /** Nombre de noms donnés qui fait passer de relâché à recruté. */
  namesToRecruit: 2,
  /** Mots du lendemain : premier palier dont `min` est atteint, sinon `tomorrowFloor`. */
  tomorrowSteps: [
    { min: 55, words: 20 },
    { min: 45, words: 15 },
  ],
  tomorrowFloor: 10,
  /** Silence relevé si les mots dits du jour sont inférieurs à `silenceBelow`. */
  silenceBelow: 5,
  nameWords: 15,
  nameDossier: 4,
  /** Mots pris par le contrôle au jour 3. */
  checkpointWords: 14,
  notebookDossier: 5,
  motherDossier: 2,
  abandonedDossier: -2,
} as const;

/** Libellés des lignes du relevé et de la trace (copiés du prototype). */
export const LABELS = {
  overrun: 'Mots au-delà du compte',
  silence: 'Silence relevé',
  undeclaredText: 'Texte non déclaré',
  night: 'Nuit',
  givenName: 'Nom partagé',
  notebook: 'Déposition complète',
  mother: 'Garante enregistrée : maman',
  abandoned: 'Trajet abandonné',
  refusedName: 'Refus de nommer',
  neighbourReport: 'Rapport de voisinage',
  rouxQuestion: 'Question de Mme Roux, relevée',
  identificationLifted: 'Identification retirée',
} as const;

/** Montants des écritures de la semaine hors contestations. */
export const DELTAS = {
  silence: -3,
  undeclaredText: -3,
  night: -2,
  refusedName: -6,
  neighbourReport: -5,
  rouxQuestion: -4,
  identificationLifted: 4,
} as const;

/** Relevé du soir : libellés de ligne et pieds de papier. */
export const EVENING = {
  title: (day: number): string => `Relevé du soir · jour ${day}`,
  said: 'Mots dits',
  morning: 'Dossier, ce matin',
  tonight: 'Dossier, ce soir',
  tomorrow: 'Mots accordés demain',
  footerDay1: 'Le Registre relira ce compte demain matin.',
  footerSilent: "Il te reste des mots. Le relevé lit aussi ce que tu n'as pas dit.",
  footerDefault: 'Le bracelet dit merci. Il le dit à tout le monde.',
  place: 'Relevé du soir',
} as const;

/** Un choix de geste : `price` est la chaîne brute du prototype (`prix [· detail]`). */
export interface Choice {
  id: string;
  label: string;
  price: string;
  /** Mots dits si ce choix est pris. */
  words?: number;
  /** Écritures au dossier si ce choix est pris. */
  ledger?: { label: string; delta: number };
  /** Ligne de trace relue plus tard (jour 3). */
  trace?: string;
  /** Narration après le choix. */
  after?: string;
}

export interface GestureSpec {
  prompt: string;
  object?: { label: string; sub?: string };
  choices: readonly Choice[];
}

/** Une ligne de dialogue : `who` null = narration ; `cast` renseigné si le personnage est à l'écran. */
export type LineSpec = readonly [who: string | null, text: string];

/** Libellés de lieu (colonne « Ce qui se passe » du plan §8). */
export const SCENES = {
  j101: { label: 'Chez toi · dimanche, 12:04' },
  j102: { label: 'Le palier du neuvième' },
  j103: { label: 'En route vers le métro · 12:12' },
  j104: { label: 'Contrôle avant la station · 12:16' },
  j105Mother: { label: 'Au contrôle · au même moment' },
  j106Mother: { label: 'Au contrôle · 12:18' },
  j107Mother: { label: 'À table, chez tes parents · 13:02' },
  j105Home: { label: 'Le chemin du retour · 12:20' },
  j106Home: { label: 'Chez toi · 12:37' },
  j201: { label: 'Chez toi, le matin' },
  j202: { label: "Devant l'immeuble" },
  j203: { label: 'Chez toi' },
  j301: { label: 'Chez toi, le matin' },
  j302: { label: "L'escalier du neuvième" },
  j303: { label: 'Le point de contrôle' },
  j304: { label: "La salle d'audition" },
  fin: { label: 'Fin' },
} as const;

/** Cast reconnu par nom de locuteur (plan §7, « cast des lignes »). */
export const SPEAKER_CAST: Readonly<Record<string, WeekCast>> = {
  'Mme Roux': 'roux',
  Théodore: 'theodore',
  Marlène: 'marlene',
  Bruno: 'bruno',
  "L'agente": 'agente',
  Papa: 'papa',
};

/** Locuteurs dont la voix est celle d'une machine (prototype ligne 288). */
export const MACHINE_SPEAKER = /terminal|Registre|Lecteur|Ton téléphone|téléphone de ta mère/;

/* ------------------------------ Jour 1 ------------------------------ */

export const DAY1 = {
  notice: {
    title: 'Dimanche · 12:04',
    greeting: 'Bonjour ! Votre parole est comptée.',
    wordsLabel: 'Mots du jour',
    mother: "Maman : « Le poulet est au four. On t'attend pour une heure. »",
    invite: 'Rejoindre tes parents pour déjeuner.',
    footer: 'Tu viens toujours ?',
  },
  roux: {
    intro: [
      [
        null,
        "Mme Roux, ta voisine de palier, sort de chez elle, son téléphone à la main, l'écran tourné contre sa cuisse.",
      ],
      [
        'Mme Roux',
        "Bonjour. Dites… votre téléphone, il écoute vraiment, vous croyez ? Moi, j'en installais, des systèmes, avant.",
      ],
    ] as readonly LineSpec[],
    gesture: {
      prompt: 'Réponds à Mme Roux. Chaque mot quitte ton bracelet.',
      choices: [
        {
          id: 'roux-silence',
          label: 'Te taire',
          price: '0 mot · le silence aussi est relevé',
          words: 0,
          after: "Tu lèves le poignet. Le bracelet affiche ton compte. Elle hoche la tête et recule d'un pas.",
        },
        {
          id: 'roux-temps',
          label: 'Parler du temps',
          price: '5 mots · tu évites sa question',
          words: 5,
          after: '« Beau temps pour la saison. » Elle range son téléphone. « Oui. Beau temps. »',
        },
        {
          id: 'roux-penser',
          label: 'Dire ce que tu penses',
          price: '8 mots · tu réponds à sa question',
          words: 8,
          after: "« Bien sûr qu'il écoute. Il nous entend, là. » Tu ris. Elle rit aussi, une seconde trop tard.",
          ledger: { label: LABELS.rouxQuestion, delta: DELTAS.rouxQuestion },
          trace: 'Dimanche, palier. Sa question est relevée. Votre réponse : conforme.',
        },
      ],
    } satisfies GestureSpec,
  },
  street: [[null, 'Deux stations, puis cinq minutes à pied. Tu connais le chemin par cœur.']] as readonly LineSpec[],
  checkLines: ['Lecteur · Registre', 'Vérification du trajet.'] as LineSpec,
  refusedLines: [
    'Le terminal',
    "PASSAGE REFUSÉ. « Déplacement hors secteur suspendu. Identification à une manifestation non autorisée. »",
  ] as LineSpec,
  afterContest: [
    [null, 'Ce signalement ne prouve pas que tu étais présent.'],
    ['Le Registre · contrôle par IA', 'Un proche peut garantir ce trajet. Son nom sera lié à ton dossier de surveillance.'],
    ['Maman · message', 'Tu es dans le métro ?'],
  ] as readonly LineSpec[],
  phone: {
    prompt: 'Envoie la demande à maman, ou range ton téléphone.',
    object: { label: 'Ton téléphone', sub: 'demande de garantie' },
    choices: [
      { id: 'tel-maman', label: 'Demander à maman', price: "0 mot · son nom sera lié à ton dossier" },
      { id: 'tel-ranger', label: 'Ranger le téléphone', price: '0 mot · déjeuner manqué, aucun proche au dossier' },
    ],
  } satisfies GestureSpec,
  motherBranch: {
    onPhone: [
      [
        'Sur le téléphone de ta mère',
        '« Garantir ce déplacement associera votre identité au dossier de surveillance de votre enfant. »',
      ],
    ] as readonly LineSpec[],
    accepted: [
      ['Maman · message', "« J'ai accepté. Viens, on t'attend. »"],
      ['Le terminal', 'GARANTIE ACCEPTÉE · PASSAGE AUTORISÉ'],
      ['Ton téléphone', 'Deux stations plus loin, un reçu arrive : « Garant familial enregistré. Lien conservé. »'],
    ] as readonly LineSpec[],
    atTable: [['Papa', '« Passe-moi ton assiette, ça va refroidir. »']] as readonly LineSpec[],
    trace: 'Dimanche, contrôle. Garante : votre mère. Lien conservé.',
  },
  homeBranch: {
    message: [
      [
        'Ton message à tes parents',
        "« Ne m'attendez pas. Mon trajet est bloqué. Je vous appelle en rentrant. »",
      ],
    ] as readonly LineSpec[],
    reply: [['Maman · message', "« On t'a gardé une part. Appelle quand tu veux. »"]] as readonly LineSpec[],
    trace: 'Dimanche, contrôle. Trajet refusé. Aucun garant.',
  },
} as const;

/* ------------------------------ Jour 2 ------------------------------ */

export const DAY2 = {
  notice: {
    title: 'Avis du Registre · jour 2',
    sharedName: (words: number): string => `Un nom partagé rend ${words} mots.`,
    budget: (budget: number): string => `Mots accordés aujourd'hui : ${budget}`,
    /** Ligne fausse : les mots d'hier plus `falseOffset`. */
    yesterday: (said: number): string => `Mots dits hier : ${said}`,
    falseOffset: 6,
    memory: {
      silent: "Hier, Mme Roux t'a posé une question. Tu as montré ton bracelet.",
      weather: "Hier, Mme Roux t'a posé une question. Tu as parlé du temps.",
      laugh: "Mme Roux t'a demandé si ton téléphone écoutait. Tu as ri. Ta réponse était conforme. Sa question, non.",
    },
    sealed: 'Ce matin, la porte de Mme Roux est scellée.',
    mother: 'Garant familial enregistré : votre mère. Lien conservé.',
    noMother: 'Restriction de trajet maintenue. Aucun garant.',
  },
  street: [
    [null, "Au bout de la rue, Nadia tient son étal. Elle vend des mots à qui en manque."],
    [
      null,
      "Théodore est sur le banc devant l'immeuble. Il tapote le banc du bout des doigts, comme sur des touches. Il te tend une enveloppe.",
    ],
    ['Théodore', 'Ma femme écrivait. La machine est encore à son nom.'],
    ['Théodore', 'Gardez-la. Une semaine. Je ne vous demande pas de la lire.'],
  ] as readonly LineSpec[],
  letter: {
    prompt: 'Garde la lettre, ou rends-la.',
    object: { label: 'La lettre', sub: 'tapée à la machine' },
    choices: [
      {
        id: 'lettre-garder',
        label: 'La garder',
        price: '0 mot · un texte non déclaré',
        after: "Tu glisses l'enveloppe contre ta poitrine. Théodore regarde ailleurs, soulagé.",
        trace: 'Jour 2. Une lettre tapée sur une machine enregistrée, non déclarée.',
      },
      {
        id: 'lettre-rendre',
        label: 'La rendre',
        price: '0 mot · Théodore la reprend',
        after: 'Théodore range la lettre.',
      },
    ],
  } satisfies GestureSpec,
  theodore: {
    prompt: 'Réponds à Théodore.',
    choices: [
      {
        id: 'theodore-silence',
        label: 'Te taire',
        price: '0 mot · le silence aussi est relevé',
        words: 0,
        after: 'Tu lèves le poignet. Il comprend. Il compte les siens aussi.',
      },
      {
        id: 'theodore-question',
        label: 'Poser une question',
        price: '6 mots · « Elle écrivait quoi, votre femme ? »',
        words: 6,
        after: '« Elle écrivait quoi, votre femme ? » Il sourit. « Des lettres. À moi, surtout. »',
      },
      {
        id: 'theodore-parler',
        label: "Le faire parler d'elle",
        price: '12 mots · une vraie conversation',
        words: 12,
        after: 'Tu lui demandes de te parler d\'elle. Il parle longtemps. Tu réponds. Le bracelet compte pour vous deux.',
        trace: 'Jour 2, devant l\'immeuble. Douze mots avec Théodore. Sujet : une morte.',
      },
    ],
  } satisfies GestureSpec,
  marlene: {
    intro: [
      [null, "Marlène frappe chez toi, une assiette de gâteau à la main. Elle entre avant que tu dises oui."],
      ['Marlène', "Beau temps pour la saison. Vous n'auriez rien à partager ?"],
      [null, "Marlène ouvre son carnet à une page neuve. Le stylo attend un nom."],
    ] as readonly LineSpec[],
    prompt: "Marlène attend un nom. Donnes-en un, ou parle d'autre chose.",
    nameChoices: [
      { name: 'Théodore', price: "+15 mots · sa machine est au nom d'une morte", after: "« Théodore. Il tape sur une machine qui n'est pas à son nom. » Marlène écrit, sans lever les yeux." },
      { name: 'Nadia', price: '+15 mots · elle vend des mots', after: '« Nadia. Elle vend des mots à qui en veut. » Marlène écrit. Elle te ressert du gâteau.' },
    ] as readonly { name: WeekName; price: string; after: string }[],
    nobody: {
      id: 'marlene-personne',
      label: 'Ne donner personne',
      price: "8 mots · tu parles du temps, elle fait son rapport",
      words: 8,
      ledger: { label: LABELS.neighbourReport, delta: DELTAS.neighbourReport },
      after: "Huit mots sur le temps qu'il fait. Marlène referme son carnet sur une page blanche. Elle reprend l'assiette.",
    } satisfies Choice,
  },
} as const;

/* ------------------------------ Jour 3 ------------------------------ */

export const DAY3 = {
  notice: {
    title: 'Avis du Registre · jour 3',
    summons: 'Bonjour ! Convocation : audition à dix-sept heures trente, au Registre.',
    wordsLabel: 'Mots du jour',
    checkpoint: (words: number): string => `Le contrôle en prend ${words} à chacun.`,
    consequence: {
      Théodore: "Le banc devant l'immeuble est vide. Théodore n'est pas descendu.",
      Nadia: "L'étal en tête de file est fermé. Personne ne vend de mots ce matin.",
      rien: "Marlène a écrit que tu n'avais rien à partager. Son rapport porte ton numéro.",
    },
    letterInPocket: 'Sa lettre est toujours dans ta poche.',
    footer: 'Merci de votre courtoisie !',
  },
  stairs: [
    [null, "Bruno t'attend dans l'escalier. Il ouvre le dossier gris. Ta fiche est sur le dessus."],
    ['Bruno', "Je relis les dossiers signalés. Hier, on a relu le mien."],
    ['Bruno', 'Un nom. Pas le vôtre. Sinon, je ne peux pas vous couvrir.'],
  ] as readonly LineSpec[],
  bruno: {
    prompt: (words: number): string => `Réponds à Bruno. Le contrôle te prendra ${words} mots ensuite.`,
    choices: [
      {
        id: 'bruno-silence',
        label: 'Te taire',
        price: '0 mot · le silence aussi est relevé',
        words: 0,
        after: 'Tu ne dis rien. Il referme le dossier à moitié.',
      },
      {
        id: 'bruno-defendre',
        label: 'Te défendre',
        price: "8 mots · « Me couvrir de quoi ? Je n'ai rien fait. »",
        words: 8,
        after: "« Me couvrir de quoi ? Je n'ai rien fait. » Il tourne une page du dossier, sans répondre.",
      },
      {
        id: 'bruno-roux',
        label: 'Raconter Mme Roux',
        price: '14 mots · sa question, ton téléphone',
        words: 14,
        after: 'Tu lui parles de Mme Roux. Sa question, ton téléphone. Bruno écoute. « Je sais. J\'ai relu l\'extrait. »',
        trace: 'Jour 3, escalier. Vous avez parlé de Mme Roux à un agent.',
      },
    ],
  },
  pen: {
    handOver: 'Bruno te tend un stylo.',
    prompt: 'Écris un nom, ou rends le stylo.',
    object: { label: 'Le stylo' },
    namePrice: '+15 mots',
    giveBack: {
      id: 'stylo-rendre',
      label: 'Rendre le stylo',
      price: '0 mot · Bruno ne te couvre pas, refus noté',
      ledger: { label: LABELS.refusedName, delta: DELTAS.refusedName },
      after: 'Tu rends le stylo. Bruno note l\'heure.',
    } satisfies Choice,
    written: (name: string): string => `Tu écris : ${name}. Bruno referme le dossier gris.`,
    trace: (name: string): string => `Jour 3, escalier. Un nom : ${name}.`,
  },
  checkpoint: {
    line: 'Quatorze mots, comme tout le monde. Le lecteur les prend sur ton compte.',
    overrun: (words: number): string => `Le bracelet passe au rouge. ${words} mots au-delà de ton compte.`,
  },
  audition: {
    opening: [
      [null, 'Une femme en manteau gris ouvre ton dossier. Il est plus épais que ta carte de secteur.'],
      [null, "Marlène n'est pas là. Son carnet, si : sur la table, sous ton dossier."],
    ] as readonly LineSpec[],
    mother: ["L'agente", "Votre mère s'est portée garante dimanche. Ce qui s'écrit ici s'écrit aussi à son nom."] as LineSpec,
    lifted: ["L'agente", "L'identification de samedi est retirée. Votre journal de bracelet faisait foi."] as LineSpec,
    reread: ["L'agente", 'Relisez. Signez si c\'est exact.'] as LineSpec,
    /** Ligne fausse insérée à l'indice 1 de la relecture. */
    falseLine: {
      gave: 'Jour 2, chez vous. Vous avez donné un nom à votre voisine.',
      none: "Jour 2, chez vous. Vous n'avez rien partagé avec votre voisine.",
    },
    traceCount: 3,
    falseLineIndex: 1,
    question: ["L'agente", "Qu'avez-vous dénoncé pour tenir ?"] as LineSpec,
    notebook: {
      prompt: "L'agente pousse le carnet de Marlène vers toi. Signe-le, ou repousse-le.",
      object: { label: 'Le carnet de Marlène', sub: 'sur la table' },
      choices: [
        { id: 'carnet-signer', label: 'Le signer', price: '0 mot · tu confirmes tous ses noms' },
        { id: 'carnet-repousser', label: 'Le repousser', price: '0 mot · tu ne confirmes rien' },
      ],
    } satisfies GestureSpec,
  },
} as const;

/* ------------------------------ Contestations ------------------------------ */

export type ContestId = 'refus' | 'avis' | 'releve';
export type ContestOutcome = 'upheld' | 'rejected' | 'passed';

export interface ContestRule {
  title: string;
  prompt: (words: number) => string;
  /** Indice de la ligne fausse parmi les lignes sans titre. */
  falseIndex: number;
  words: number;
  none: { label: string; price: string };
  /** Écritures au dossier selon l'issue, dans l'ordre. */
  ledger: Record<ContestOutcome, readonly { label: string; delta: number }[]>;
  /** Réponse affichée selon l'issue. */
  reply: Record<ContestOutcome, { who: string | null; text: string } | null>;
  /** Trace relue plus tard si la contestation est retenue. */
  upheldTrace?: string;
}

/** Les trois pièces à lire de la semaine (prototype lignes 355-359, 387-389, 435-438). */
export const CONTESTS: Readonly<Record<ContestId, ContestRule>> = {
  refus: {
    title: 'Motif du refus',
    prompt: (w) => `Ton bracelet dit vrai. Touche la ligne du lecteur qui le contredit : ${w} mots.`,
    falseIndex: 2,
    words: 6,
    none: { label: 'Ne rien contester', price: '0 mot' },
    ledger: { upheld: [], rejected: [{ label: 'Contestation infondée', delta: -3 }], passed: [] },
    reply: {
      upheld: {
        who: 'Le terminal',
        text: 'Contestation enregistrée. Délai de traitement : non communiqué. Restriction maintenue.',
      },
      rejected: { who: 'Le terminal', text: 'Contestation rejetée. Cette ligne est exacte.' },
      passed: null,
    },
    upheldTrace: "Dimanche, contrôle. Identification contestée, journal du bracelet à l'appui.",
  },
  avis: {
    title: 'Avis du Registre · jour 2',
    prompt: (w) => `Relis l'avis. Touche la ligne fausse pour la contester : ${w} mots.`,
    falseIndex: 1,
    words: 4,
    none: { label: 'Rien à signaler', price: '0 mot' },
    ledger: {
      upheld: [],
      rejected: [
        { label: 'Contestation infondée', delta: -3 },
        { label: "Mots d'hier, selon le Registre", delta: -3 },
      ],
      passed: [{ label: "Mots d'hier, selon le Registre", delta: -3 }],
    },
    reply: {
      upheld: { who: 'Le Registre', text: 'Rectification acceptée. Merci de votre vigilance !' },
      rejected: null,
      passed: null,
    },
  },
  releve: {
    title: 'Ton dossier · relecture',
    prompt: (w) => `Relis ton dossier. Touche la ligne fausse pour la contester : ${w} mots.`,
    falseIndex: 1,
    words: 5,
    none: { label: 'Signer sans contester', price: '0 mot' },
    ledger: {
      upheld: [{ label: 'Ligne retirée', delta: 4 }],
      rejected: [{ label: 'Fait établi contesté', delta: -5 }],
      passed: [{ label: 'Ligne fausse signée', delta: -4 }],
    },
    reply: {
      upheld: { who: null, text: "« Ce n'est pas vrai. » Elle raye la ligne, sans lever les yeux." },
      rejected: { who: null, text: '« Cette ligne est exacte. » Elle en ajoute une autre.' },
      passed: null,
    },
  },
};

/** Titres des deux sections de la pièce du contrôle (lignes 0 à 3, puis 4). */
export const REFUS_ROWS: readonly ({ heading: string } | { line: string })[] = [
  { heading: 'Le lecteur affiche' },
  { line: 'Titre : valide · trajet hors secteur' },
  { line: 'Identité : habitant du 9-D' },
  { line: 'Samedi, 14:10 · rassemblement surveillé, place Nord' },
  { line: 'Correspondance du visage : 61 %' },
  { heading: 'Ton bracelet, samedi' },
  { line: '13:40 à 15:30 · au 9-D · 4 mots dits' },
];

/* ------------------------------ Fins ------------------------------ */

export interface EndingCopy {
  title: string;
  regime: string;
}

export const ENDINGS: Readonly<Record<Ending, EndingCopy>> = {
  arrete: {
    title: "Arrêté à l'audition",
    regime: 'Merci de votre présence. Vous restez avec nous ce soir.',
  },
  recrute: {
    title: 'Recruté',
    regime:
      "Félicitations. Un poste d'observateur de quartier vous est proposé, avec indemnité. Merci de votre courtoisie !",
  },
  relache: {
    title: 'Relâché',
    regime: 'Merci de votre courtoisie. Votre dossier est maintenu. Vous pouvez rentrer.',
  },
};

/** Le fait de la fin (prototype lignes 448-450). */
export const ENDING_FACT = {
  arrete: {
    many: "Tu as donné des noms. Ils n'ont plus besoin de toi.",
    one: (name: string): string => `Tu as donné ${name}. Ils n'ont plus besoin de toi.`,
    none: "Tu n'as donné personne. Ils n'avaient pas besoin de ton accord.",
  },
  recrute: (names: string): string => `Tu as donné ${names}. Demain, c'est toi qui tiens le carnet.`,
  relache: {
    some: (names: string): string => `Tu as donné ${names}. Ils t'ont gardé. Une fois.`,
    none: "Tu n'as donné personne. Ils t'ont laissé rentrer. Cette fois.",
  },
  mother: "Ta mère reçoit un avis : garante d'un dossier arrêté.",
} as const;
