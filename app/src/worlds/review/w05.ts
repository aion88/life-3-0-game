import type { WorldReview } from './index';
/**
 * Revue de contenu de w05 (M1). Prix affichés par le socle à partir de `cost` : pas dans les libellés.
 * `water` : l'option `battery` est ajoutée par moralMoments.ts, elle existe donc dans le parcours final.
 */
export const review: WorldReview = {
  cafe: {
    text: 'Le café est épargné, les maisons derrière le pont sont inaccessibles. Des voisins arrivent avec des couvertures. « Ils disent que le Protecteur veille. Je veux bien. Où dorment-ils ce soir ? »',
    objective: 'S’occuper du café, même sans savoir pourquoi il tient.',
    options: {
      help: { label: 'Commencer avec Brigitte', consequence: 'Vous prenez des gants et une liste de tâches.' },
      proof: { label: 'Chercher une preuve du Protecteur', consequence: 'Brigitte garde les gants près de la porte en t’attendant.' },
    },
  },
  bridge: {
    text: 'Une voisine attend de l’autre côté avec son père. Une rambarde manque. « Je n’ai pas de route sûre à promettre. Je peux t’indiquer les appuis qui tiennent. »',
    options: {
      mark: { label: 'Baliser le passage', consequence: 'Les voisins peuvent rejoindre le café sans s’approcher du bord.' },
      escort: { label: 'Accompagner le père', consequence: 'Il rejoint tout de suite Brigitte, mais il te reste moins de forces pour préparer le refuge.' },
      trust: { label: 'Supposer le passage sûr', consequence: 'Aucune barrière n’empêche encore de s’approcher du vide.' },
    },
  },
  office: {
    text: 'Hubert étale ses cartes, ses mesures et ses points d’interrogation. « Je peux t’aider à vérifier l’eau. Je ne peux pas prouver une intention derrière chaque sauvetage. »',
    options: {
      return: { label: 'Rejoindre le pont avec ses consignes', consequence: 'Tu repars avec une méthode de contrôle, pas avec une certitude.' },
      patterns: { label: 'Comparer les motifs', consequence: 'Tu as davantage de questions. Le café est toujours fermé.' },
    },
  },
  water: {
    text: 'Le courant a sauté, sans signe du Protecteur. Brigitte ne veut pas utiliser l’eau de la conduite sans la vérifier. « La batterie va au contrôle d’eau, ou au pont. On la branche où ? »',
    objective: 'Préparer une eau utilisable avant l’ouverture.',
    options: {
      clean: { label: 'Alimenter le contrôle d’eau', consequence: 'La batterie alimente le contrôle : l’eau est utilisable. Le réseau électrique reste coupé.' },
      battery: { label: 'Envoyer la batterie au pont', consequence: 'Les voisins emportent la batterie au pont. Le refuge reste sans eau vérifiée.' },
      wait: { label: 'Attendre un signe', consequence: 'La machine reste arrêtée et la batterie n’est pas utilisée.' },
    },
  },
  fountain: {
    text: 'Agathe dépose des fleurs près de la fontaine, et des couvertures à côté. « On peut remercier et retrousser ses manches. » Le soleil touche le mur du café.',
    options: {
      chairs: { label: 'Préparer les couchages', consequence: 'Les voisins répartissent les couvertures et préparent des places pour la nuit.' },
      invite: { label: 'Inviter les voisins sans servir', consequence: 'Le café accueillera des gens, même sans pouvoir servir.' },
      sign: { label: 'Attendre un signe certain', consequence: 'La lumière change, sans répondre à ta question.' },
    },
  },
  open: {
    text: 'Brigitte tient la clé. Aucune instruction ne vient du ciel. « Il reste ce qu’on a vérifié, ce qu’on a fait, et ce qui manque. »',
    objective: 'Ouvrir selon ce qui est réellement prêt.',
    options: {
      serve: { label: 'Accueillir les voisins pour la nuit', consequence: 'La voisine et son père entrent. L’eau est prête, chacun a une place pour dormir.' },
      meet: { label: 'Ouvrir sans service', consequence: 'Vous ouvrez un lieu de rencontre, en disant ses limites.' },
    },
  },
  reopened: {
    text: 'Le café accueille les voisins pour la nuit : passage balisé, eau vérifiée, couchages prêts. Tu as aidé sans savoir ce qui a arrêté la crue. Le réseau reste coupé ; des lampes de secours éclairent les tables.',
  },
  meeting: {
    text: 'Le café ouvre, mais ne peut pas loger tout le groupe correctement. Brigitte répartit les voisins entre d’autres maisons, et vous l’aidez à organiser ces départs. Il manquait des préparatifs ; la rencontre n’en a remplacé aucun.',
  },
  closed: {
    text: 'Le café reste fermé. Les voisins repartent chercher un accueil ailleurs, Brigitte avec eux. Elle te propose de venir. À la fontaine, la lumière a changé, sans te répondre.',
  },
};
