Rue 1984 (scène 3D). Propriétaire : plan 02a.

Séquences jouées (décision de Cynthia, playtest 2026-11-03) : un choix confirmé se joue 3 à 8 s (marche automatique vers une ancre, réaction d'une personne, ligne de narration, battement de la barre Dossier), puis l'acte est appliqué ; un clic, Espace, Entrée ou Échap passent la séquence. Moteur : `src/engine/view/sequence.ts` ; données : `data/w10.sequences.json` (PROVISIONAL jusqu'à `design/gdd/2026-11-03-sequences-jouees.md`) ; branchement : `runtime.ts`.

Rue guidée (spec 2026-11-04) : `guidedRuntime.ts` (montage), `guided/director.ts` (temps), `guided/actors.ts` (marche automatique des corps), données `w10.json → street.guided` ; `runtime.ts` (marche libre) n'est plus monté pour un monde guidé, suppression au plan de la semaine. Le build de capture la remonte avec `?rue=libre` (`routeOf`, `screen.ts`) pour ses suites e2e.
