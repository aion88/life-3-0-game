import type { WorldReview } from './index';
/**
 * Revue de contenu de w02 (M1). Le prix des gestes est affiché par le socle à partir de `cost` et `gain` :
 * les libellés ne le répètent donc pas. Texte de scène : une phrase racontée, puis ce qui est dit.
 * `party` : le socle remplace déjà le texte par `narrative.ts` quand « Transfert annulé » est porté ; voir textes-m1.md.
 */
export const review: WorldReview = {
  welcome: {
    text: 'Soraya va mieux depuis que l’Oracle organise ses soins, mais sa valise est déjà faite. « Je ne veux pas partir sans avoir choisi. Tu restes avec moi ? »',
    objective: 'Porter sa demande, ou la confier à l’Oracle.',
    options: {
      ours: { label: 'L’aider à écrire son refus', consequence: 'Soraya défait la première boucle de sa valise.' },
      delegate: { label: 'Laisser l’Oracle arranger ça', consequence: 'L’Oracle prépare une alternative et gagne du temps, sans promettre qu’elle reste.' },
    },
  },
  garden: {
    text: 'Soraya veut écrire elle-même pourquoi elle refuse, avec ses contradictions. « Moi, je peux dire qu’elle tient au quartier. Elle seule peut dire pourquoi. »',
    objective: 'Garder sa propre voix dans le dossier.',
    options: {
      listen: { label: 'Noter son refus mot pour mot', consequence: 'Soraya signe un refus explicite, sans nier que les soins lui ont fait du bien.' },
      follow: { label: 'Laisser le modèle résumer', consequence: 'Le dossier décrit ce qui devrait la rendre heureuse, pas son droit de refuser.' },
    },
  },
  studio: {
    text: 'Dorothée peut réorganiser les visites pour que les soins restent ici, si tu annules ton séjour. « Pour qu’elle reste, il faut quelqu’un cette semaine. Sinon le transfert suit son cours. »',
    objective: 'Préparer une alternative au transfert.',
    options: {
      make: { label: 'Annuler mon séjour', consequence: 'Ton séjour est annulé. Les visites de soins restent possibles dans ce quartier.' },
      print: { label: 'Garder mon séjour', consequence: 'Tu gardes ton voyage. Le transfert de Soraya reste prévu.' },
    },
  },
  request: {
    text: 'L’Oracle prévoit moins de solitude pour Soraya après le transfert. « Tu peux défendre son refus, demander un délai, ou accepter. Je déciderai ensuite. »',
    objective: 'Défendre son droit de rester, soins maintenus.',
    options: {
      claim: { label: 'Déposer son refus signé', consequence: 'Le transfert est annulé. L’Oracle maintient les soins et note ce refus précis.' },
      blend: { label: 'Demander un délai', consequence: 'Soraya gagne une semaine ici. L’Oracle réévaluera ensuite.' },
      all: { label: 'Accepter le transfert', consequence: 'Le véhicule est confirmé. Les soins et le logement de Soraya l’attendent ailleurs.' },
    },
  },
  party: {
    text: 'Le véhicule silencieux s’arrête au bord du jardin. « Qu’est-ce que l’Oracle a décidé ? Et qu’est-ce que tu m’avais promis ? »',
    objective: 'Lui dire ce que tu as vraiment obtenu.',
    options: {
      human: { label: 'Lui dire qu’elle reste', consequence: 'Soraya ramène sa valise chez elle. Tu restes pour la première visite.', hideWhenBlocked: true },
      assisted: { label: 'Lui parler du délai', consequence: 'Elle défait quelques affaires, mais garde la valise près de la porte.', hideWhenBlocked: true },
      perfect: { label: 'L’accompagner au véhicule', consequence: 'Soraya reçoit de bons soins ailleurs. Sa place près de toi reste vide.', hideWhenBlocked: true },
    },
  },
  ours: {
    text: 'Son refus signé et ton accompagnement ont fait annuler le transfert. Tu as perdu ton séjour pour que ce choix soit possible. Soraya vit toujours ici, et l’Oracle assure toujours ses soins.',
  },
  shared: {
    text: 'Le transfert est reporté. Soraya est encore ici, la valise près de la porte. À la fin du délai, l’Oracle réévaluera sa situation : rien n’est acquis.',
  },
  perfect: {
    text: 'Soraya est partie vers de meilleurs soins. Elle n’a pas été punie, mais son refus n’a pas changé la décision. Sa place près de toi est vide.',
  },
};
