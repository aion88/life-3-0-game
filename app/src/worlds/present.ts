/** Dated observations, not evidence that any fictional world is inevitable.
 * Primary-source checks and scope notes: design/research/2026-11-09-present-signals.md.
 * Keep the boundary next to the fact wherever a card is rendered.
 */
export interface PresentSignal {
  id: string;
  title: string;
  place: string;
  date: string;
  fact: string;
  boundary: string;
  url: string;
  source: string;
  questions: string[];
}
export const PRESENT_CHECKED_DATE = '2026-11-10';
export const PRESENT_BOUNDARY = 'Ces faits existent déjà, à des dates et dans des lieux précis. Ils éclairent les questions du jeu ; ils ne prouvent pas que ses futurs vont se réaliser.';
export const PRESENT_SIGNALS: readonly PresentSignal[] = [
  {
    id: 'glukhin-peaceful-protest',
    title: 'Reconnu après une manifestation pacifique',
    place: 'Moscou · Russie',
    date: 'Août 2019 · arrêt de la CEDH le 4 juillet 2023',
    fact: 'Nikolay Glukhin a été identifié puis localisé par reconnaissance faciale après une manifestation solitaire dans le métro. La Cour européenne des droits de l’homme a constaté une violation de sa vie privée et de sa liberté d’expression.',
    boundary: 'Il s’agit d’une affaire documentée, pas d’un événement de 2026. Le Registre et le transfert de ton frère dans le jeu sont inventés ; cet arrêt ne décrit pas le régime fictif de 2030.',
    url: 'https://www.echr.coe.int/w/judgment-concerning-the-russian-federation-6',
    source: 'Cour européenne des droits de l’homme · Glukhin c. Russie',
    questions: ['Q11'],
  },
  {
    id: 'uk-live-facial-recognition',
    title: 'Des visages reconnus dans la rue',
    place: 'Croydon, Londres · Royaume-Uni',
    date: '19 janvier 2026',
    fact: 'La Metropolitan Police annonce plus de 100 arrestations pendant les trois premiers mois d’un pilote de reconnaissance faciale en direct, avec des caméras fixées au mobilier urbain.',
    boundary: 'C’est le bilan publié par la police, pas un décompte de condamnations. Elle décrit des déploiements avec des agents présents, pas une surveillance permanente de toute la population.',
    url: 'https://news.met.police.uk/news/100-arrests-following-new-live-facial-recognition-pilot-in-croydon-505225',
    source: 'Metropolitan Police · bilan du pilote de Croydon',
    questions: ['Q11'],
  },
  {
    id: 'utah-prescription-pilot',
    title: 'Une IA pour renouveler une ordonnance',
    place: 'Utah · États-Unis',
    date: '6 janvier 2026 · annonce du pilote',
    fact: 'L’Utah annonce un partenariat avec Doctronic pour tester le renouvellement de médicaments par IA. Le protocole porte sur des traitements déjà prescrits et prévoit une relecture médicale avant envoi en première phase.',
    boundary: 'Un essai encadré ne signifie pas que les médecins ont disparu. Cela ne démontre ni la sécurité de tous les usages médicaux de l’IA, ni que le pilote est encore actif à la date de ta partie.',
    url: 'https://commerce.utah.gov/ai/regulatory-relief-4/authorized-pilots/doctronic/',
    source: 'Utah Department of Commerce · protocole Doctronic',
    questions: ['Q21'],
  },
  {
    id: 'ilo-work-exposure',
    title: 'Le travail change, sans issue écrite',
    place: 'Monde · étude OIT–NASK',
    date: '20 mai 2025',
    fact: 'Une étude de l’OIT et du NASK estime qu’un travailleur sur quatre exerce un métier présentant une certaine exposition à l’IA générative. Elle juge la transformation des emplois plus probable que leur remplacement.',
    boundary: 'Une exposition potentielle des tâches ne mesure pas des licenciements observés. Le chômage et l’affectation forcée du frère dans le jeu sont une fiction, pas une conclusion de cette étude.',
    url: 'https://www.ilo.org/publications/generative-ai-and-jobs-2025-update',
    source: 'Organisation internationale du Travail · étude 2025',
    questions: ['Q14', 'Q20'],
  },
  {
    id: 'eu-social-scoring-prohibition',
    title: 'Des limites ont aussi été votées',
    place: 'Union européenne',
    date: '2 février 2025 · application des interdictions',
    fact: 'Les interdictions de pratiques de l’AI Act entrent en application, notamment pour certains usages de notation sociale par IA. Le droit peut donc fixer des limites aux usages, pas seulement accompagner leur déploiement.',
    boundary: 'L’interdiction vise les pratiques définies par le règlement, pas toute forme de score. Une règle ne prouve pas l’absence d’abus ; les futurs du jeu ne sont pas le droit européen décrit ici.',
    url: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
    source: 'Commission européenne · AI Act',
    questions: ['Q04', 'Q11'],
  },
];
