import type { WorldReview } from './index';
/**
 * Revue de contenu de w06 (M2). Prix affichés par le socle à partir de `cost` : pas dans les libellés.
 * Ordre d'un texte : le raconté d'abord, puis une seule réplique entre guillemets (ce qui est DIT).
 * `result` : le texte posé par moralMoments.ts (voix du moment moral) est remplacé ici, la revue passe après.
 * `repair` : les trois options sont masquées quand elles sont bloquées, car elles ne font que rappeler un choix
 * fait plus tôt ; la scène n'a alors qu'un bouton et le socle l'applique seule.
 * `dry` : le texte réellement affiché est celui de narrative.ts ; celui-ci sert de repli.
 */
export const review: WorldReview = {
  hall: {
    text: 'Octave cherche un véhicule pour sa mère. Mina te donne ses trois bons. « On peut réparer avant le départ, mais pas payer deux fois. »',
    objective: 'Trouver la panne avant de dépenser un bon.',
    options: {
      inspect: { label: 'Examiner les pompes', consequence: 'Mina prend ses outils et te conduit aux pompes.' },
      queue: { label: 'Demander du calcul à la Cuve', consequence: 'Ta demande porte sur ton immeuble seul, sans diagnostic ni mandat du dispensaire.' },
    },
  },
  pumps: {
    text: 'Mina a trouvé la pièce rompue et une fuite secondaire. Sans son diagnostic, la Cuve facture une analyse générale, plus chère. Octave porte des seaux aux logements. « Ça ne suffit pas pour ce soir. »',
    objective: 'Préparer une demande précise.',
    options: {
      diagnose: { label: 'Aider Mina à diagnostiquer', consequence: 'Mina note la pièce rompue : le calcul peut viser cette seule pièce.' },
      carry: { label: 'Porter les seaux avec Octave', consequence: 'Les logements ont de l’eau pour ce soir ; la conduite reste cassée.' },
    },
  },
  organise: {
    text: 'Une demande commune peut faire précédent ; une faveur répare peut-être plus vite ta seule conduite. « Je propose d’inscrire tous les immeubles concernés. »',
    objective: 'Choisir qui la réparation couvre.',
    options: {
      all: { label: 'Signer la demande commune', consequence: 'Tous les immeubles concernés sont inscrits sur une seule demande.' },
      mine: { label: 'Demander une faveur pour ton immeuble', consequence: 'La demande ne porte que sur ton adresse.' },
    },
  },
  gate: {
    text: 'Le résultat appartient à celui qui commande : sans copie utilisable, les habitants ne peuvent pas s’en servir. « Deux bons pour un calcul ciblé, trois pour une analyse générale. »',
    objective: 'Acheter un calcul utile sans céder le résultat.',
    options: {
      target: { label: 'Commander le calcul ciblé', consequence: 'La Cuve calcule un plan pour la pièce diagnostiquée.' },
      general: { label: 'Commander l’analyse générale', consequence: 'Le plan est prêt ; tu n’as plus aucun bon.' },
      favour: { label: 'Signer l’exclusivité de ton immeuble', consequence: 'Le calcul est gratuit pour ta seule adresse ; la demande commune sort du contrat.' },
      leave: { label: 'Repartir sans commander', consequence: 'Tu ne commandes rien. La Cuve reste réservée à ceux qui détiennent les droits.' },
    },
  },
  result: {
    text: 'Le propriétaire propose d’exécuter lui-même la réparation, et lui seul peut ensuite réparer. Mina te montre le plan. « La Cuve a trouvé la pièce. Une copie commune coûte un bon. »',
    objective: 'Choisir qui pourra utiliser la solution.',
    options: {
      commons: { label: 'Prendre la copie commune', consequence: 'Le plan peut être exécuté et partagé dans le quartier.' },
      exclusive: { label: 'Laisser le propriétaire intervenir', consequence: 'Le propriétaire garde le plan et fixe les tarifs suivants.' },
    },
  },
  repair: {
    speaker: 'MINA',
    text: 'Les habitants se rassemblent autour de la pompe. Mina lit le papier que tu rapportes avant de sortir ses outils. « Voyons ce que ce papier nous autorise. »',
    objective: 'Appliquer ce que tu as obtenu.',
    options: {
      share: { label: 'Réparer avec Mina et les voisins', consequence: 'Mina explique la réparation à Octave pendant que l’eau revient.', hideWhenBlocked: true },
      contract: { label: 'Faire intervenir le propriétaire', consequence: 'L’eau revient aux logements et au dispensaire, sous contrat exclusif.', hideWhenBlocked: true },
      contract_private: { label: 'Faire réparer ton immeuble seul', consequence: 'Ta conduite fonctionne ; le dispensaire n’est pas dans le contrat.', hideWhenBlocked: true },
    },
  },
  common: {
    text: 'Le diagnostic ciblé a laissé un bon pour la licence commune. Mina répare avec les voisins et transmet le plan. Tu as obtenu un usage commun, pas le contrôle de la Cuve. Elle reste aux mêmes propriétaires.',
  },
  owned: {
    text: 'L’évacuation est annulée et la mère d’Octave reste près de lui. Le propriétaire garde le plan, les interventions et les tarifs à venir. Les voisins qui n’ont pas signé paient aussi ce contrat.',
  },
  owned_private: {
    text: 'L’eau revient dans ton immeuble sous contrat privé. Le dispensaire n’était pas couvert : Octave accompagne sa mère vers un autre secteur. Tu as obtenu une réparation personnelle, pas le secours collectif demandé.',
  },
  dry: {
    text: 'Le dispensaire est évacué vers un autre secteur. Octave accompagne sa mère et laisse son logement fermé. Aucune réparation n’a été obtenue ; la Cuve n’a pas servi à éviter ce départ.',
  },
};
