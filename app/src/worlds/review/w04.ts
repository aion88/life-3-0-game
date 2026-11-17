import type { WorldReview } from './index';
/**
 * Revue de contenu de w04 (M1). Prix affichés par le socle à partir de `cost` : pas dans les libellés.
 * `trial` n'a qu'une option dans le fichier : le socle l'applique seule, le texte est donc un moment raconté.
 */
export const review: WorldReview = {
  arrival: {
    text: 'Iris renverse la tasse qu’elle voulait t’offrir. À la fermeture de l’Annexe, le prototype de sa main sera mis sous scellés. « J’accepte de perdre des fonctions. Je veux seulement boire sans qu’on tienne le verre. »',
    objective: 'Examiner le prototype avant de demander une exception.',
    options: {
      inspect: { label: 'Aller à l’Annexe avec Iris', consequence: 'Iris te confie le dossier du prototype.' },
      shortcut: { label: 'Chercher une pièce hors registre', consequence: 'Vous cherchez une solution rapide sans avoir limité le système.' },
    },
  },
  annex: {
    text: 'Sur l’établi, la main tient enfin une tasse. Si le mode généraliste reste, l’interdiction reste. « Sans lui, je tiens une tasse, mais je n’apprends plus d’autres gestes. »',
    objective: 'Limiter l’usage et rendre cette limite vérifiable.',
    options: {
      limit: { label: 'Retirer le mode généraliste', consequence: 'La main stabilisera une tasse. Iris renonce à l’adaptation automatique à d’autres gestes.' },
      keep: { label: 'Garder toutes les possibilités', consequence: 'Le prototype reste polyvalent : l’interdiction garde son motif.' },
    },
  },
  document: {
    text: 'Salomé n’évalue pas ta bonne intention. « Il me faut un schéma qu’un autre atelier peut vérifier. Un dessin rassurant ne suffit pas. »',
    options: {
      write: { label: 'Documenter la limite', consequence: 'Le dossier décrit le retrait et un test reproductible.' },
      promise: { label: 'Joindre une promesse de prudence', consequence: 'La promesse est sincère, mais ce n’est pas une preuve technique.' },
    },
  },
  market: {
    text: 'Lazare pose côte à côte une pièce vérifiable et une pièce plus rapide, d’origine effacée. « Celle-ci passe au banc. Celle-là passe surtout sous la table. »',
    options: {
      known: { label: 'Prendre la pièce traçable', consequence: 'Tu as un composant que l’Annexe peut inspecter.' },
      unknown: { label: 'Prendre la pièce sans origine', consequence: 'Tu gagnes une capacité difficile à contrôler.' },
    },
  },
  wall: {
    text: 'Armand soutiendra un essai limité si le dossier et la pièce se vérifient. « Sinon, Iris peut exposer son idée sans l’activer, ou l’essayer en cachette. »',
    options: {
      trial: { label: 'Demander un essai borné', consequence: 'La commission accepte un essai local, réversible et documenté.' },
      exhibit: { label: 'Exposer sans activer', consequence: 'Le projet reste visible, mais la main ne peut pas encore servir.' },
      secret: { label: 'Laisser Iris essayer en secret', consequence: 'Iris consent à l’essai risqué. Le prototype s’adapte, puis une alerte suspend son usage.' },
    },
  },
  trial: {
    text: 'Iris pose une tasse dans la main. Elle ne tremble plus. L’essai s’arrête seul après la tâche prévue ; l’étendre demandera de revenir devant la commission. Iris rit, puis essuie ses yeux du revers de la manche.',
    options: {
      record: { label: 'Consigner l’essai', consequence: 'L’essai et ses limites deviennent consultables par d’autres ateliers.' },
    },
  },
  bounded: {
    text: 'Iris tient la tasse seule. La limite documentée et la pièce traçable ont sauvé cet usage avant les scellés, au prix des fonctions plus ambitieuses. Le Gatekeeper garde son veto sur toute extension.',
  },
  waiting: {
    text: 'Le prototype part sous scellés. Iris évite un essai non maîtrisé, mais tu tiens encore sa tasse. Le prochain examen n’a pas de date.',
  },
  unsafe: {
    text: 'Iris a tenu la tasse quelques secondes, puis l’alerte a bloqué le prototype et déclenché son retrait. Elle connaissait le risque. Ce progrès ne peut plus être reproduit.',
  },
};
