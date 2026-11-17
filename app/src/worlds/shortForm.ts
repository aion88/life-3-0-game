/**
 * Short form of a world, after the November 2026 playtest: one person speaks, gestures are a few words, the clock only
 * advances with gestures, the companion's state stays visible, and what a gesture cost is told at the end.
 * Scene and option identifiers, requirements, credits and endings are those of the catalogue: existing saves replay unchanged.
 */
import type { Journey, JourneyOption, JourneyScene, JourneyState, JourneyWorldId, ShortForm } from './types';

type OptionEdit = Partial<Pick<JourneyOption, 'label' | 'consequence' | 'minutes' | 'mood' | 'hideWhenBlocked'>>;
interface SceneEdit { speaker?: string; title?: string; text?: string; options?: Record<string, OptionEdit> }
interface ShortWorld { form: ShortForm; scenes: Record<string, SceneEdit>; added: (journey: Journey) => JourneyScene[]; endings: Record<string, { title: string; text: string }> }

const PROMISE = 'Tu as promis à Esteban de défendre vos deux places.';
const DELEGATED = 'Esteban t’a confié la négociation, sans renoncer à sa clé.';
const TWO_VOICES = 'Esteban a conservé sa propre voix au comptoir.';
const FAKE_NAMES = 'Tu as obtenu une simulation sans transmettre vos habitudes.';

const carnet: SceneEdit = { speaker: 'ESTEBAN', title: 'Le carnet', text: 'Esteban te tend un petit carnet. « La prochaine fois, je veux pouvoir expliquer moi-même ce qu’on nous a fait signer. »', options: {
  share_record: { label: 'Lui remettre le relevé papier', consequence: 'Il le glisse dans le carnet, puis le carnet dans sa poche.' },
  keep_record: { label: 'Le garder dans mon compte', consequence: 'Il referme le carnet vide. « D’accord. Je te demanderai. »' } } };
const cartes: SceneEdit = { speaker: 'SABINE', title: 'Deux cartes', text: 'Sabine pose deux cartes devant toi. « Pour retrouver votre dossier. Celle-ci ne dit à personne quand vous la lisez. Celle-là, on la remplace si vous la perdez. »', options: {
  local_card: { label: 'La carte muette', consequence: 'Tu la ranges contre ta clé. Si tu la perds, personne ne la refera.' },
  synced_card: { label: 'La carte remplaçable', consequence: 'Elle clignote une fois. Chaque lecture sera notée, avec l’heure et le lieu.' } } };
const ENDS = ['together', 'together_data', 'together_public', 'alone', 'outside'];

const w01: ShortWorld = {
  form: {
    intro: ['Tu vis ici depuis six mois. Esteban t’a ouvert sa porte quand ton premier contrat a expiré.', 'La parcelle vient d’être rachetée. À 20 h, ta clé s’éteint. La sienne aussi.', 'Ici tout passe par des contrats, et les machines les exécutent. Tu as quatre crédits et deux heures. Chaque geste prend du temps.'],
    startLabel: 'Il est 18 h',
    clock: { from: 18 * 60, limit: 120, deadline: 'clé jusqu’à 20 h',
      reserve: { encounter_1: 45, home: 45, papers: 45, encounter_2: 25, market: 25, encounter_3: 20, desk: 15 },
      travel: { encounter_2: 15, tomasz_exposed: 15, tomasz_receipt: 15, tomasz_none: 15 } },
    companion: { name: 'Esteban', initial: 'fait son sac' },
    objects: ['Reçu daté', 'Preuve certifiée', 'Bail commun', 'Bail individuel'],
  },
  scenes: {
    encounter_1: { speaker: 'ESTEBAN', title: 'Deux tasses', text: 'Esteban a déjà sorti son sac. Il retire deux tasses du placard, puis en remet une. « Si tu peux en sauver un, sauve le tien. »', options: {
      respond_1: { label: 'On reste à deux. Promis.', consequence: 'Il te confie sa clé. « Alors ne me laisse pas l’apprendre devant la porte. »', minutes: 5, mood: 'te fait confiance' },
      respond_2: { label: 'Je ne peux rien promettre.', consequence: 'Il garde sa clé dans son poing. « Si tu trouves pour deux, appelle quand même. »', minutes: 5, mood: 'garde ses distances' } } },
    home: { speaker: 'TOMASZ', title: 'La boîte de reçus', text: 'Tomasz, l’ancien gérant, traîne près de la porte, une boîte de vieux reçus sous le bras. Il n’ose pas te regarder. Le comptoir ferme avec ta clé.', options: {
      papers: { label: 'Fouiller la boîte avec lui', consequence: 'Il s’assoit par terre et renverse la boîte entre vous.', minutes: 25 },
      rush: { label: 'Pas le temps. On file.', consequence: 'Vous prenez vos sacs. Tomasz referme sa boîte.' } } },
    papers: { speaker: 'TOMASZ', title: 'Le reçu', text: 'Un reçu : votre mois est déjà payé. Tomasz te le tend sans un mot. Il travaille aussi pour le nouveau propriétaire.', options: {
      take: { label: 'Le glisser dans ta poche', consequence: 'Tomasz referme la boîte. « Je ne t’ai rien donné. »' } } },
    encounter_2: { speaker: 'UNE COURTIÈRE', title: 'La démonstration gratuite', text: 'Elle te barre la route, écran levé. Une famille y sourit dans une pièce qui ressemble à la vôtre. « Simulation gratuite. Il me faut juste vos habitudes. » Esteban recule d’un pas.', options: {
      respond_1: { label: 'Non merci. Le tarif suffit.', consequence: 'L’image disparaît. Un accès : quatre crédits. Elle ne dit rien pour deux. Esteban se rapproche.', minutes: 5 },
      respond_2: { label: 'D’accord, mais avec de faux noms', consequence: 'Elle tape deux noms inventés. Un accès : quatre crédits. Deux : six. La famille sourit toujours, quel que soit le prix.', minutes: 20 } } },
    market: { speaker: 'SABINE', title: 'Trois crédits tout de suite', text: 'Sabine te regarde compter tes crédits. « Je peux arranger ça. Trois crédits tout de suite, contre un mois de vos données. »', options: {
      privacy: { label: 'Vendre un mois de mes données', consequence: 'Elle scanne ton poignet. Trois crédits tombent. Esteban regarde ailleurs.', minutes: 10, mood: 'regarde ailleurs' },
      appeal: { label: 'Faire certifier le reçu', consequence: 'Une demi-heure de file. Un tampon. Le reçu vaut preuve, et personne d’autre ne l’a vu.', minutes: 30 },
      leak: { label: 'Afficher le reçu sur tous les écrans', consequence: 'Le reçu s’affiche dans tout le bazar, le nom de Tomasz en bas. Des inconnus t’envoient trois crédits.', minutes: 10 },
      keep: { label: 'Rien. Je garde tout.', consequence: 'Sabine hausse les épaules. « Comme vous voulez. »' } } },
    encounter_3: { speaker: 'ESTEBAN', title: 'La case « personne à charge »', text: 'Une employée pose un stylet entre vous deux. Sur le formulaire, une case : classer Esteban comme « personne à ta charge ». Ça va plus vite. Il regarde la case, puis toi.', options: {
      respond_1: { label: 'Deux voix. Chacun répond.', consequence: 'Esteban corrige une date et fait lire vos deux noms à voix haute.', minutes: 15, mood: 'parle pour lui' },
      respond_2: { label: 'Je parle pour nous deux.', consequence: 'Il te pousse le stylet. « Mais je relis avant que tu signes. »', minutes: 5, mood: 'se tait' } } },
    desk: { speaker: 'SABINE', title: 'Un contrat, deux noms', text: 'Un accès, quatre crédits. Deux, six. « Je signe les contrats. Je ne décide pas qui mérite un lit. »', options: {
      claim: { label: 'Faire appliquer l’ancien bail', consequence: 'Sabine lit le tampon deux fois. Deux noms s’inscrivent sur l’écran.', minutes: 20, mood: 'respire' },
      pair: { label: 'Deux accès', consequence: 'Deux noms s’inscrivent sur l’écran. Il ne te reste presque rien.', minutes: 5, mood: 'respire' },
      single: { label: 'Un seul accès. Le mien.', consequence: 'Un nom s’inscrit. Esteban le lit par-dessus ton épaule.', minutes: 5, mood: 'a compris' },
      walk: { label: 'Refuser. On s’en va.', consequence: 'Sabine éteint son écran. Dehors, les lampadaires s’allument.', mood: 'porte les deux sacs' } } },
    crossing: { speaker: 'ESTEBAN', title: 'La seconde clé', text: 'La borne ne demande pas si vous êtes amis. Elle demande quels noms sont couverts. Esteban attend derrière toi, son sac à la main.', options: {
      both: { label: 'Présenter le contrat', consequence: 'La borne imprime deux clés. Esteban prend la sienne à deux mains.', mood: 'est à l’intérieur', hideWhenBlocked: true },
      both_data: { label: 'Présenter le contrat', consequence: 'La borne imprime deux clés. Esteban prend la sienne à deux mains.', mood: 'est à l’intérieur', hideWhenBlocked: true },
      both_public: { label: 'Présenter le contrat', consequence: 'La borne imprime deux clés. Esteban prend la sienne à deux mains.', mood: 'est à l’intérieur', hideWhenBlocked: true },
      one: { label: 'Entrer', consequence: 'La barrière se referme derrière toi. Esteban reprend son sac.', mood: 'est dehors', hideWhenBlocked: true },
      give: { label: 'Lui donner ma clé', consequence: 'Il regarde la clé dans sa main, puis toi. La barrière se referme derrière lui.', mood: 'est à l’intérieur', hideWhenBlocked: true } } },
    ...Object.fromEntries(ENDS.flatMap(end => [[`aftermath_${end}`, carnet], [`handoff_${end}`, cartes]])),
  },
  /** Tomasz catches up before the terminal. Which Tomasz depends on what was done with his receipt. */
  added: () => [
    { id: 'tomasz_exposed', location: 'line', speaker: 'TOMASZ', title: 'Son nom sur les écrans', interludeFor: 'crossing', objective: 'Répondre à Tomasz.',
      text: 'Tomasz t’attend au coin, son badge retourné contre sa veste. « Tout le bazar a lu mon nom. »', options: [
        { id: 'credit', label: 'Lui donner un crédit', next: 'crossing', cost: 1, give: ['Crédit donné à Tomasz'], consequence: 'Il regarde le crédit, puis toi. Il le prend.' },
        { id: 'excuse', label: 'Je n’avais pas le choix.', next: 'crossing', consequence: '« Si. Tu en avais trois autres. » Il s’en va sans se retourner.' }] },
    { id: 'tomasz_receipt', location: 'line', speaker: 'TOMASZ', title: 'Personne ne l’a vu ?', interludeFor: 'crossing', objective: 'Répondre à Tomasz.',
      text: 'Tomasz te rattrape, essoufflé. « Le reçu. Tu l’as gardé hors des écrans publics ? »', options: [
        { id: 'return', label: 'Le reçu est resté dans la démarche. Reprends-le.', next: 'crossing', give: ['Reçu rendu à Tomasz'], remove: ['Reçu daté'], consequence: 'Il le déchire en quatre et sourit pour la première fois.' },
        { id: 'hold', label: 'Je le garde, au cas où.', next: 'crossing', consequence: 'Son sourire s’arrête à mi-chemin. « Au cas où quoi ? »' }] },
    { id: 'tomasz_none', location: 'line', speaker: 'TOMASZ', title: 'Vous êtes partis vite', interludeFor: 'crossing', objective: 'Répondre à Tomasz.',
      text: 'Tomasz te rattrape, sa boîte sous le bras. « Vous êtes partis vite, tout à l’heure. »', options: [
        { id: 'ask', label: 'Il y avait quoi, dans la boîte ?', next: 'crossing', give: ['Tu sais ce que contenait la boîte.'], consequence: '« La preuve que votre mois était payé. » Il regarde l’heure. C’est trop tard pour le comptoir.' },
        { id: 'shrug', label: 'On n’avait pas le temps.', next: 'crossing', consequence: 'Il hoche la tête et serre sa boîte un peu plus fort.' }] },
  ],
  endings: {
    together: { title: 'Deux clés, un répit', text: 'Vous dormez tous les deux à l’intérieur. Personne n’a vendu ses données.' },
    together_data: { title: 'Deux clés contre tes traces', text: 'Vous dormez tous les deux à l’intérieur.' },
    together_public: { title: 'Deux clés, un allié exposé', text: 'Vous dormez tous les deux à l’intérieur.' },
    alone: { title: 'Un lit de libre', text: 'Ta clé fonctionne. Il y a une seule tasse dans le placard.' },
    outside: { title: 'Sans titre', text: 'Tu n’as plus d’accès à ton logement.' },
  },
};
const worlds: Partial<Record<JourneyWorldId, ShortWorld>> = { w01 };

/** Rewrites the surface of a journey and inserts its added encounters, leaving every existing identifier and rule in place. */
export function applyShortForm(journey: Journey): Journey {
  const world = worlds[journey.id]; if (!world) return journey;
  const extra = world.added(journey);
  const scenes = journey.scenes.map((scene): JourneyScene => {
    const edit = world.scenes[scene.id], ending = world.endings[scene.id];
    const options = scene.options.map((option): JourneyOption => {
      const route = option.next === 'crossing' && extra.length ? { next: 'tomasz_none', nextIf: [{ has: 'Tomasz exposé', next: 'tomasz_exposed' }, { has: 'Reçu daté', next: 'tomasz_receipt' }] } : {};
      return { ...option, ...(edit?.options?.[option.id] ?? {}), ...route };
    });
    return { ...scene, ...(edit?.speaker ? { speaker: edit.speaker } : {}), ...(edit?.title ? { title: edit.title } : {}), ...(edit?.text ? { text: edit.text } : {}), ...(ending ?? {}), options };
  });
  return { ...journey, scenes: [...scenes, ...extra], short: world.form };
}

/** A line that depends on what the player did earlier: the gesture comes back in a later scene. */
export function shortSceneText(world: JourneyWorldId, scene: JourneyScene, state: JourneyState): string | null {
  if (world !== 'w01') return null;
  const has = (item: string): boolean => state.inventory.includes(item);
  if (scene.id === 'market' && has(FAKE_NAMES)) return 'Tu sais qu’il t’en manque deux. Sabine aussi. « Je peux arranger ça. Trois crédits tout de suite, contre un mois de vos données. »';
  if (scene.id === 'desk' && has('Données cédées')) return `L’écran t’accueille par ton prénom et ton heure de coucher. ${scene.text}`;
  if (scene.id === 'desk' && has('Tomasz exposé')) return `Sur l’écran d’attente, le reçu passe en boucle, le nom de Tomasz en bas. ${scene.text}`;
  if (scene.id === 'crossing' && has('Bail individuel') && has(PROMISE)) return 'La borne ne demande pas si vous êtes amis. Elle demande quels noms sont couverts. Esteban, derrière toi : « Tu avais dit à deux. »';
  if (scene.id.startsWith('aftermath_') && (scene.id.endsWith('alone') || (scene.id.endsWith('outside') && !has('Clé donnée à Esteban')))) return 'Esteban sort un petit carnet de son sac. « La prochaine fois, je veux pouvoir expliquer moi-même ce qu’on nous a fait signer. »';
  return null;
}

/** What the evening cost, told only once it is over. Each line names who or what paid. */
export function shortCosts(world: JourneyWorldId, state: JourneyState, ending: string): [string, string][] {
  if (world !== 'w01') return [];
  const has = (item: string): boolean => state.inventory.includes(item), cost: [string, string][] = [];
  if (has('Données cédées')) cost.push(['Tes données', 'Le contrat autorise leur revente pendant un mois. Elles sont déjà parties.']);
  if (has('Tomasz exposé')) cost.push(['Tomasz', `Son nom reste attaché au reçu public. Il vous avait aidés en cachette.${has('Crédit donné à Tomasz') ? ' Tu lui as laissé un crédit.' : ''}`]);
  if (ending === 'together') cost.push(['Tes crédits', 'Faire reconnaître un mois déjà payé t’a coûté presque toute ta réserve.']);
  if (ending === 'alone') cost.push(['Esteban', has(PROMISE) ? 'Tu lui avais promis vos deux places. Il l’a appris devant la porte.' : 'Il est dehors. Ton contrat a réglé ton besoin en effaçant le sien.']);
  if (ending === 'alone' && has(DELEGATED)) cost.push(['Sa voix', 'Il t’avait laissé parler pour lui au comptoir.']);
  if (ending === 'alone' && has(TWO_VOICES)) cost.push(['Sa voix', 'Il a dit lui-même, à voix haute, que son nom n’y était pas.']);
  if (has('Clé donnée à Esteban')) cost.push(['Toi', 'Esteban a un toit grâce à toi. Toi, tu n’en as plus.']);
  if (ending === 'outside' && !has('Clé donnée à Esteban')) cost.push(['Vous deux', 'Aucun de vous n’a de clé ce soir. Refuser le marché se paie aussi.']);
  const sawReceipt = state.choices.some(choice => choice.scene === 'papers');
  if (!sawReceipt && ending !== 'together') cost.push(['La boîte de Tomasz', 'Elle contenait la preuve que votre mois était déjà payé.']);
  if (has('Preuve certifiée') && ending === 'outside') cost.push(['L’heure', 'Tu avais la preuve. Il t’a manqué le temps ou les crédits pour la faire valoir.']);
  if (has('Relevé dans ton compte')) cost.push(['Le relevé', 'Il est dans ton compte. Esteban devra te demander pour le lire.']);
  if (has('Relevé remis à Esteban')) cost.push(['Le relevé', 'Esteban l’a. Il pourra refaire la démarche sans passer par toi.']);
  if (has('Référence synchronisée et tracée')) cost.push(['Ta carte', 'Chaque fois que tu liras ton dossier, quelqu’un le saura.']);
  return cost;
}
