import type { WorldReview } from './index';
/**
 * Revue de contenu de w09 (M2). Prix affichés par le socle à partir de `cost` et `gain` : pas dans les libellés.
 * Ordre d'un texte : le raconté d'abord, puis une seule réplique entre guillemets (ce qui est DIT).
 * `glass` : le texte posé par moralMoments.ts (voix du moment moral) est remplacé ici, la revue passe après.
 * `moment`, `show`, `empty` : le texte réellement affiché dépend de la route et vient de narrative.ts ;
 * celui d'ici sert de repli et reste vrai sur toutes les routes qui y mènent.
 * Aucune option masquée : `moment.private` bloquée montre ce que le choix de la photo ou du rideau a coûté.
 */
export const review: WorldReview = {
  prairie: {
    text: 'Ce soir, le Gardien remplace les objets pénibles du pavillon par des souvenirs apaisants. Gisèle serre une photographie de sa sœur. « On ne souriait pas, sur cette photo. Aide-moi à garder ce qui s’est vraiment passé. »',
    objective: 'Écouter ce que Gisèle demande.',
    options: {
      listen: { label: 'Rester, sans rien proposer', consequence: 'Gisèle t’invite à entrer dans son pavillon.' },
      comfort: { label: 'Accepter la promenade', consequence: 'La promenade vous apaise ; sa demande reste sans réponse.' },
    },
  },
  home: {
    text: 'La confier au Gardien ferait gagner une copie toujours accessible. La garder hors des capteurs préserve l’objet, mais c’est à toi d’en répondre. « S’il la numérise, il en fait une scène réconfortante. »',
    objective: 'Préserver son accord et son souvenir.',
    options: {
      respect: { label: 'Garder la photo hors des capteurs', consequence: 'Gisèle te confie la photo, à condition qu’elle ne soit pas diffusée.' },
      share: { label: 'Donner la photo au Gardien', consequence: 'Le Gardien garde une copie et propose un programme de consolation.' },
    },
  },
  stage: {
    text: 'Anouk parle d’un renfoncement près du verre, sans promettre une sortie. Arsène, lui, propose de présenter ta peine en spectacle. « Depuis que je joue mes émotions, on m’écoute. »',
    objective: 'Choisir entre spectacle et retrait.',
    options: {
      alcove: { label: 'Suivre Anouk', consequence: 'Vous cherchez une marge d’intimité, pas une sortie.' },
      perform: { label: 'Préparer une scène de souvenir', consequence: 'Le programme te réserve une place devant les observateurs.' },
    },
  },
  glass: {
    text: 'Prêter ton espace suspend ton programme de confort. Le Gardien peut reprendre ce rideau ; aucun objet ici ne vaut une liberté garantie. Anouk montre le rideau. « Le verre ne s’ouvre pas. Mais ce rideau peut abriter quelques minutes. »',
    objective: 'Créer une petite marge concrète.',
    options: {
      curtain: { label: 'Prêter ton espace à Gisèle', consequence: 'Ton programme de confort est suspendu ; le rideau masque la photographie.' },
      stage: { label: 'Retourner à la séance', consequence: 'Une scène publique est prévue : les observateurs attendent une scène émouvante.' },
      leave: { label: 'Renoncer à ce rideau', consequence: 'Le verre reste confortable et infranchissable.' },
    },
  },
  moment: {
    text: 'Le programme de consolation appelle Gisèle. Tu peux lui rendre la photo à l’abri, ou laisser le Gardien en faire une version douce. « Mon original est toujours hors des capteurs ? »',
    objective: 'Respecter les conditions de son deuil.',
    options: {
      private: { label: 'Lui rendre la photo', consequence: 'Gisèle choisit de te laisser rester. Aucun spectacle n’est lancé.' },
      show: { label: 'Présenter le souvenir au programme', consequence: 'Sa peine devient une activité que le Gardien observe.' },
      ask: { label: 'Ne lancer aucun programme', consequence: 'Gisèle garde le silence, pour le moment.' },
    },
  },
  private: {
    text: 'Gisèle garde l’original, dispute comprise. Ton confort personnalisé est suspendu : tu as cédé une part de ton espace pour préserver le sien. Ce n’est pas une sortie : le Gardien peut reprendre cet abri.',
  },
  show: {
    text: 'Le programme montre Gisèle et sa sœur souriantes. Gisèle paraît apaisée ; la dispute n’apparaît pas dans la scène présentée. Le confort a remplacé le souvenir qu’elle demandait de garder.',
  },
  empty: {
    text: 'Aucun programme n’est lancé et Gisèle garde son souhait. La réserve assure la survie et le confort ; elle ne garantit pas l’autonomie de ceux qu’elle protège.',
  },
};
