/**
 * French copy for the local, embodied 1984 control-station slice.
 *
 * Fiction contract:
 * - The State/Registre is human-led; automated identification applies its rules.
 * - A previous automated association does not establish the player's attendance.
 * - A mother's informed agreement grants this journey, not unrestricted mobility.
 * - Her name is recorded as guarantor; no additional sanction is implied.
 * - End copy describes the passage/return actually played, never an unseen meal.
 *
 * Content only: no timers, branching logic, save mutations or renderer state.
 */
export const CONTROL_STATION_CONTENT = {
  arrival: {
    world: '1984',
    title: 'Un dimanche ordinaire',
    role: 'Tu habites ici. Le Registre contrôle les trajets avec l’IA.',
    goal: 'Rejoindre tes parents pour déjeuner.',
    speaker: 'Maman · message',
    line: '« Le poulet est au four. On t’attend pour une heure. »',
    action: 'Aller au métro',
  },
  approach: {
    speaker: 'Lecteur · Registre',
    line: 'Vérification du trajet.',
    status: 'Lecture du titre…',
  },
  refused: {
    speaker: 'Lecteur · Registre',
    status: 'Passage refusé',
    reason: 'L’IA a associé votre visage à un rassemblement surveillé.',
    detail: 'Ce signalement ne prouve pas que tu étais présent.',
  },
  decision: {
    prompt: 'Une garantie familiale permet de passer.',
    guarantor: {
      label: 'Demander à maman',
      cost: 'Elle doit accepter. Son nom sera lié à ton dossier.',
    },
    return: {
      label: 'Rentrer chez moi',
      cost: 'Déjeuner manqué. Aucun proche ajouté au dossier.',
    },
  },
  requesting: {
    status: 'Demande envoyée',
    speaker: 'Ton téléphone',
    line: 'Demande de garantie transmise à maman.',
  },
  accepted: {
    speaker: 'Maman · message',
    line: '« D’accord, je me porte garante. On t’attend. »',
    status: 'Garantie acceptée',
    receipt: 'Maman · garante enregistrée pour ce trajet.',
    action: 'Continuer vers le métro',
  },
  crossing: {
    status: 'Passage autorisé',
    speaker: 'Vers le métro',
    line: 'Autorisation valable pour ce trajet uniquement.',
  },
  returning: {
    status: 'Retour vers la rue',
    speaker: 'Ton message à tes parents',
    line: '« Je suis bloqué au contrôle. Ne m’attendez pas. »',
  },
  passed: {
    title: 'Tu peux poursuivre vers tes parents.',
    line: 'Trajet autorisé. La garantie reste dans ton dossier.',
    trace: 'Garantie familiale enregistrée.',
    speaker: 'Maman · message conservé',
    reply: '« On t’attend. »',
    summary: [
      { label: 'Ton trajet', value: 'Passage accordé.' },
      { label: 'Ton dossier', value: 'Une garante ajoutée : maman.' },
      { label: 'La restriction', value: 'Toujours en place ; ce trajet fait exception.' },
    ],
  },
  returned: {
    title: 'Tu repars sans garantie.',
    line: 'Trajet abandonné. La restriction reste en place.',
    trace: 'Aucun proche ajouté au dossier.',
    speaker: 'Maman · message',
    reply: '« On te garde une part. Appelle quand tu veux. »',
    summary: [
      { label: 'Ton trajet', value: 'Retour vers la rue.' },
      { label: 'Tes proches', value: 'Personne n’a été lié à ton dossier.' },
      { label: 'La restriction', value: 'Toujours en place.' },
    ],
  },
  ledger: {
    budget: 20,
    dossier: 60,
    intro: 'Ta parole est comptée ·',
    wordsUnit: 'mots',
    today: 'aujourd’hui.',
    dossierLabel: 'dossier',
    guarantor: { label: 'Garante enregistrée : maman', delta: 2 },
    abandoned: { label: 'Trajet abandonné', delta: -2 },
    summaryWords: 'Tes mots',
    summaryDossier: 'Dossier du Registre',
    left: 'restants sur',
    freeCost: '0 mot',
  },
  record: {
    prompt: 'Ton bracelet dit vrai. Touche la ligne du lecteur qui le contredit :',
    readerLabel: 'Le lecteur affiche',
    lines: [
      'Titre : valide · trajet hors secteur',
      'Identité : habitant du 9-D',
      'Samedi, 14:10 · rassemblement surveillé, place Nord',
      'Correspondance du visage : 61 %',
    ],
    ownLabel: 'Ton bracelet, samedi',
    own: '13:40 à 15:30 · au 9-D · 4 mots dits',
    rule: { cost: 6, falseIndex: 2, penalty: -3, penaltyLabel: 'Contestation infondée' },
    founded: 'Contestation enregistrée. Délai de traitement : non communiqué. Restriction maintenue.',
    unfounded: 'Contestation rejetée. Cette ligne est exacte.',
    optional: 'Contester est facultatif.',
  },
  error: {
    title: 'La scène n’a pas pu démarrer.',
    line: 'Le chargement a échoué. Tu peux réessayer.',
    action: 'Réessayer',
  },
  shared: {
    place: 'Le contrôle · avant la station',
    reader: 'Lecteur · Registre',
    phone: 'Ton téléphone',
    loading: 'Préparation de la scène…',
    pause: 'Pause',
    resume: 'Reprendre',
    skip: 'Passer l’animation',
    replay: 'Rejouer ce passage',
    leave: 'Revenir au jeu',
    bilan: 'Voir les conséquences',
    fiction: 'Situation fictive · aperçu local',
    scope: 'Aperçu du contrôle, pas encore un épisode complet.',
  },
} as const;
