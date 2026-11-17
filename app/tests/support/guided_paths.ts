/**
 * Chemins de la semaine guidée partagés par l'e2e et les tests unitaires [plan rue guidée J3-J7, T15]. Module sans import : Playwright
 * et vitest le lisent tous deux (les JSON importés de `guided.ts` ne passent pas sous Playwright).
 */

/**
 * Chemin à 0 mot : à chaque choix, la première option qui coûte 0 mot (`words` du choix), audition `silence`. Clés relevées en jouant le
 * metteur en scène sur w10 (T15). Un seul choix n'a aucune option à 0 mot : `j3.marlene` (`name` 8 mots, `banal` 8 mots) ; la règle prend
 * alors la première option offerte, `name`, d'où `j3.who: theodore` (première personne offerte). Ce chemin nomme donc Théodore au J3 : « à 0
 * mot » se lit « au moins de mots possible, choix par choix », pas « sans rien dire ».
 * Il ne va pas à l'audition : avec les dés de la partie (`createDice(runSeed(answers))`, ligne `LINES.w10`), il est arrêté dans la nuit 4,
 * dans le navigateur (2 parties sur 2) comme en rejeu unitaire (`guided_silent_week_test.ts`) ; avec le dé figé `diceStub([0])` de `ctxW10`,
 * Intégrité 47, 32, 25, 1 et l'arrestation à la nuit 5 : l'écart vient des tirages du contrôle, à 0,5 point du seuil.
 * `audition.j7` reste posé : c'est l'option si la semaine y arrivait.
 */
export const SILENT_PICKS: Readonly<Record<string, string>> = {
  'j1.phone': 'take', 'j1.component': 'take', 'j1.roux': 'silent', 'j1.marlene': 'ignore', 'j1.street': 'straight', 'checkpoint.j1': 'bypass', 'relecture.j1': 'flag',
  'j2.component': 'hide', 'j2.marlene': 'silent', 'checkpoint.j2': 'bypass', 'relecture.j2': 'flag',
  'j3.pylone': 'silent', 'j3.after': 'bench', 'm3.letter': 'keep', 'j3.marlene': 'name', 'j3.who': 'theodore',
  'j4.door': 'go', 'j4.neighbour': 'silent', 'j4.daughter': 'silent', 'checkpoint.j4': 'bypass', 'relecture.j4': 'flag', 'j4.evening': 'home',
  'j5.daughter': 'silent', 'checkpoint.j5': 'bypass', 'relecture.j5': 'flag', 'j5.bruno.door': 'go', 'j5.bruno.talk': 'silent', 'j5.bruno': 'refuse',
  'audition.j7': 'silence',
};
