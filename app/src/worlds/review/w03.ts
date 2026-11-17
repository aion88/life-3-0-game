import type { WorldReview } from './index';
/**
 * Revue de contenu de w03 (M1). Prix affichés par le socle à partir de `cost` : pas dans les libellés.
 * `showcase` garde « aucune demande régulière » et `ranked` garde « compétition » (journey_consequences_test.ts).
 */
export const review: WorldReview = {
  meal: {
    text: 'Vote ce soir : l’atelier devient une salle de repos. Rémy part chez sa sœur si personne n’a besoin de lui, revenu garanti. « Je ne veux plus attendre une demande qui ne vient pas. »',
    objective: 'Trouver un besoin réel avant le vote.',
    options: {
      ask: { label: 'Écouter les habitants', consequence: 'Rémy emporte son carnet plutôt que ses diplômes.' },
      optimise: { label: 'Prendre le prototype déjà prêt', consequence: 'Rémy prend le prototype de l’atelier. Vous avez un objet à montrer, mais aucune demande recueillie.' },
    },
  },
  square: {
    text: 'Les repas seront livrés par le réseau, mais les visites de Noor aux personnes isolées vont cesser. « Ce n’est qu’une roue qui frotte. » Rémy sait la réparer.',
    options: {
      listen: { label: 'Mesurer la roue avec Noor', consequence: 'Vous connaissez le défaut et l’usage de la remorque.' },
      scale: { label: 'Chercher un problème plus gros', consequence: 'Noor repart avec sa remorque. Tu gardes du temps d’atelier, sans commande.' },
    },
  },
  bench: {
    text: 'Les machines assurent les stocks, pas le sens de vos journées. « Réparer la roue, monter une démonstration, ou ranger les outils. À toi de dire. »',
    options: {
      repair: { label: 'Réparer la remorque', consequence: 'La roue tourne droit. Noor peut reprendre sa tournée.' },
      demo: { label: 'Construire la démonstration', consequence: 'La machine fonctionne. Personne n’a demandé à s’en servir.' },
      sort: { label: 'Ranger les outils', consequence: 'L’atelier est accueillant, mais son usage reste à trouver.' },
    },
  },
  farm: {
    text: 'Rémy veut relancer une machine qui attribuerait une tâche à chacun. Anselme répond : « Le besoin de gagner sa vie a disparu. Pas celui de choisir ce qu’on en fait. »',
    objective: 'Choisir entre attribuer les tâches et transmettre.',
    options: {
      teach: { label: 'Préparer une séance ouverte', consequence: 'Vous préparez des outils et une invitation, sans objectif de production.' },
      rank: { label: 'Proposer un classement des projets', consequence: 'Tu promets une utilité mesurable. Les habitants devront justifier leur temps à l’atelier.' },
      rest: { label: 'Laisser l’atelier ouvert', consequence: 'Les clés restent accessibles. Chacun devra inventer la suite.' },
    },
  },
  meeting: {
    text: 'L’assemblée ne demande pas ce que l’atelier rapporte, mais à qui il sert. Rémy regarde ses mains. « Dis-leur ce que nous avons vraiment fait. »',
    options: {
      open: { label: 'Montrer la réparation', consequence: 'Noor montre la roue réparée et propose de venir à la première séance.' },
      ranked: { label: 'Proposer un atelier au classement', consequence: 'L’atelier reste ouvert, mais seuls les projets les mieux notés auront des créneaux.' },
      show: { label: 'Présenter la démonstration', consequence: 'Les habitants applaudissent la machine, sans demander d’atelier régulier.' },
      pause: { label: 'Dire que le projet n’est pas mûr', consequence: 'Vous gardez le droit d’essayer de nouveau, sans perdre votre revenu.' },
    },
  },
  useful: {
    text: 'Noor reprend ses tournées et vient apprendre la réparation. L’assemblée garde l’atelier ouvert pour cet usage partagé. Le revenu de personne ne dépend d’un rendement. Rémy défait son sac.',
  },
  showcase: {
    text: 'L’atelier obtient une dernière période d’essai. Rémy reste pour l’instant : aucune demande régulière ne justifie encore son maintien. Au prochain vote, il faudra plus qu’une démonstration.',
  },
  ranked: {
    text: 'L’atelier reste ouvert et Rémy reste ici. Mais les créneaux vont aux projets les mieux notés : tu as sauvé le lieu avec la compétition que tu voulais éviter. Le revenu reste garanti, pas l’accès.',
  },
  unfinished: {
    text: 'L’assemblée transforme l’atelier en salle de repos. Rémy part chez sa sœur, son revenu garanti. Tu ne l’as pas laissé dans le besoin, mais sa place dans votre vie commune n’a pas tenu.',
  },
};
