import type { WorldReview } from './index';
/**
 * Revue de contenu de w11 (M2). Prix affichés par le socle à partir de `cost` et `gain` : pas dans les libellés.
 * Ordre d'un texte : le raconté d'abord, puis une seule réplique entre guillemets (ce qui est DIT).
 * `assembly` : le texte posé par moralMoments.ts (voix du moment moral) est remplacé ici, la revue passe après.
 * `temporary` : quand le joint est réparé et le geste appris, le texte affiché vient de narrative.ts.
 * Options masquées quand elles sont bloquées, parce qu'elles ne concernent qu'un objet que tu n'as jamais pris :
 * `pylons.read` et `assembly.surrender` (toutes deux liées à la page de Mireille).
 * Les autres blocages restent visibles : ils montrent ce qu'un choix antérieur a fermé.
 */
export const review: WorldReview = {
  home: {
    text: 'Il ne reste qu’un fagot avant la nuit. Inès sait réparer le tirage, mais le village a interdit les réseaux : son savoir peut la faire exclure. « Je ne peux plus porter le bois. Ne livre pas Inès pour moi. »',
    objective: 'Trouver du bois et comprendre le défaut.',
    options: {
      ration: { label: 'Demander un fagot à la Table', consequence: 'Tu prends le carnet des rations et rejoins la Table.' },
      gather: { label: 'Ramasser du bois mort', consequence: 'Le fagot est lourd, mais tu l’as tout de suite.' },
    },
  },
  ration: {
    text: 'La page technique de Mireille n’alimente aucune machine, mais le village se méfie de tout ce qui rappelle l’ancien monde. Elle sert une soupe et vérifie le carnet. « Mange d’abord. J’ai aussi une page sur les conduits anciens. »',
    objective: 'Choisir ce que tu emportes.',
    options: {
      rest: { label: 'Prendre la soupe et le fagot', consequence: 'Tu reprends une force et emportes ta ration de bois.' },
      page: { label: 'Prendre le fagot et la page', consequence: 'La page explique comment limiter les pertes de chaleur.' },
    },
  },
  forge: {
    text: 'Le tirage s’apprend dans une page ou auprès d’Inès, près des Pylônes morts. « Ce joint est déformé. Je sais le refaire à la main. »',
    objective: 'Réparer une pièce sans épuiser tes forces.',
    options: {
      fix: { label: 'Aider à refaire le joint', consequence: 'La porte du foyer ferme correctement.' },
      burn: { label: 'Brûler davantage de bois', consequence: 'Tu économises un effort ; le joint fuit toujours.' },
    },
  },
  pylons: {
    text: 'Les pylônes ne transportent plus de courant. Augustin approche et demande ce que vous voulez remettre en marche. Inès répond. « Ce réglage du conduit ne demande aucun courant. »',
    objective: 'Distinguer un geste manuel du retour du réseau.',
    options: {
      learn: { label: 'Apprendre le geste d’Inès', consequence: 'Tu sais régler le tirage sans machine.' },
      read: { label: 'Étudier la page de Mireille', consequence: 'Le schéma confirme le réglage ; tu sais le refaire.', hideWhenBlocked: true },
      denounce: { label: 'Dénoncer Inès à Augustin', consequence: 'Augustin garde Inès à l’écart. Tu n’as pas appris le réglage.' },
    },
  },
  assembly: {
    text: 'Le village a coupé les réseaux par peur de perdre le contrôle. Il faut expliquer ce que tu as fait, sans promettre un miracle. Augustin attend. « Réparer un foyer, est-ce rallumer le système ? »',
    objective: 'Défendre un usage précis et transmissible.',
    options: {
      teach: { label: 'Défendre Inès et ouvrir ton foyer', consequence: 'Le village accepte un foyer partagé et le geste de réparation. Tu ne chauffes plus ton espace seul.' },
      surrender: { label: 'Livrer la page de Mireille', consequence: 'Le village te laisse rentrer et saisit la page ; tu ne peux plus montrer le réglage.', hideWhenBlocked: true },
      silent: { label: 'Rentrer sans rien dire', consequence: 'Tu rentres avec tes moyens, sans accord du village.' },
    },
  },
  night: {
    text: 'Le bois, le joint et le réglage servent chacun à autre chose ; aucun ne remplace les autres. Lucien attend près du foyer. « Qu’est-ce que tu rapportes pour la nuit ? »',
    objective: 'Employer ce que tu as rapporté.',
    options: {
      warm: { label: 'Accueillir Lucien et les voisins', consequence: 'Le feu tient ; les voisins savent refaire la réparation.' },
      temporary: { label: 'Brûler le fagot', consequence: 'La pièce se réchauffe quelques heures ; l’accueil collectif n’est pas préparé.' },
      admit: { label: 'Chercher refuge ailleurs', consequence: 'Vous quittez la maison avec Lucien pour ne pas rester seuls dans le froid.' },
    },
  },
  warm: {
    text: 'Le seul fagot chauffe un foyer réparé où tu accueilles Lucien et les voisins. Tu as perdu ton intimité pour la nuit et défendu Inès. Le village garde son savoir. Vous tenez sans rallumer de réseau.',
  },
  temporary: {
    text: 'Le fagot réchauffe une pièce quelques heures. Les autres cherchent encore une place ; sans le savoir partagé, la solution ne dure pas. Tu as acheté du temps avec du bois qui ne revient pas cette nuit.',
  },
  cold: {
    text: 'Lucien et toi quittez la maison pour chercher refuge ailleurs. Tu n’as pas accueilli le village cette nuit, et la mission de réparer et transmettre n’est pas accomplie. Vous frappez à une autre porte.',
  },
};
