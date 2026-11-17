import type { WorldReview } from './index';
/**
 * Revue de contenu de w08 (M2). Prix affichés par le socle à partir de `cost` : pas dans les libellés.
 * Ordre d'un texte : le raconté d'abord, puis une seule réplique entre guillemets (ce qui est DIT).
 * `garden` : le texte posé par moralMoments.ts (voix du moment moral) est remplacé ici, la revue passe après.
 * Aucune option masquée : les options bloquées de w08 (`garden`, `lesson`) montrent le prix d'un choix antérieur.
 */
export const review: WorldReview = {
  school: {
    text: 'Le véhicule de l’élève robot attend la fermeture de l’école. Aurèle n’a qu’une capsule : une œuvre sans erreurs, ou une mémoire honnête mais incomplète. « Qu’est-ce qu’il emporte de moi ? »',
    objective: 'Choisir ce que la capsule doit garder.',
    options: {
      memory: { label: 'Demander une erreur à Aurèle', consequence: 'Aurèle sort un vieux cahier au lieu d’un programme.' },
      upload: { label: 'Numériser ses archives', consequence: 'Les pages sont conservées ; leur contexte reste à raconter.' },
    },
  },
  memory: {
    text: 'L’élève robot demande si une bonne note peut cacher un échec. Aurèle croyait aider un enfant en parlant à sa place. « Il a eu la bonne note. Je ne sais pas s’il a appris à me contredire. »',
    objective: 'Garder le contexte d’un souvenir.',
    options: {
      record: { label: 'Garder son aveu', consequence: 'Aurèle accepte que l’élève garde aussi le tort qu’il a causé.' },
      complete: { label: 'Enregistrer toute sa vie', consequence: 'La capsule contient plus de souvenirs ; il reste moins de temps pour essayer et répondre.' },
      rule: { label: 'Réduire le récit à une règle', consequence: 'La règle se retient facilement ; son ambiguïté a disparu.' },
    },
  },
  workshop: {
    text: 'L’élève robot connaît déjà la bonne solution. Clémence pose un mécanisme défectueux sur la table. « Laisse-le essayer une autre méthode, réversible, et expliquer ses raisons. »',
    objective: 'Laisser une marge d’essai sans danger.',
    options: {
      experiment: { label: 'Le laisser essayer', consequence: 'L’élève échoue une fois, puis décrit ce qu’il changerait.' },
      correct: { label: 'Faire appliquer la solution connue', consequence: 'Le mécanisme fonctionne tout de suite ; l’élève n’a rien essayé.' },
    },
  },
  garden: {
    text: 'Aurèle veut qu’une trace humaine reste ; l’élève robot demande s’il peut la discuter. Awa les écoute. « Ce qui me fait peur, c’est qu’on lui demande de nous ressembler toujours. »',
    objective: 'Décider ce que transmettre autorise.',
    options: {
      discuss: { label: 'Lui donner le droit de discuter', consequence: 'L’élève reçoit le droit de contester la leçon.' },
      preserve: { label: 'Exiger une copie fidèle', consequence: 'La transmission devient une obligation de fidélité.' },
    },
  },
  lesson: {
    text: 'L’élève robot te demande le droit de raconter un jour cette histoire autrement qu’Aurèle. Le véhicule annonce le départ. Aurèle t’attend. « Dis-moi ce que tu lui as promis. »',
    objective: 'Transmettre ce qui a été préparé.',
    options: {
      living: { label: 'Tout confier, droit de répondre compris', consequence: 'L’élève commence par une question qu’Aurèle n’avait pas prévue.' },
      archive: { label: 'Confier une copie documentaire', consequence: 'L’élève reçoit les documents, sans votre essai ni droit de répondre.' },
      refuse: { label: 'Ne rien confier', consequence: 'Aurèle referme le cahier sans le remettre ; rien n’est transformé.' },
    },
  },
  living: {
    text: 'L’élève part avec le récit d’Aurèle, erreurs comprises, et le droit d’y répondre. Aurèle a renoncé à contrôler son image. Le robot a promis un message, pas une copie éternelle.',
  },
  archive: {
    text: 'L’élève part avec les documents que tu as retenus. Tu as choisi la conservation plutôt qu’un accord qui réunit récit honnête, essai et droit de répondre. On peut consulter ces cahiers ; rien ne garantit qu’on se reparle.',
  },
  silent: {
    text: 'Le véhicule part sans la capsule. Aurèle garde les cahiers ; l’élève n’emporte pas sa voix. Tu as évité toute déformation, au prix de la transmission. L’occasion de transmettre est passée.',
  },
};
