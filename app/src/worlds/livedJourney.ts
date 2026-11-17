import type {Journey, JourneyScene, JourneyWorldId} from './types';

type Presentation = NonNullable<JourneyScene['presentation']>;
const p=(prop:Presentation['prop'],incident:string,kind:Presentation['kind']='decision'):Presentation=>({kind,prop,incident});
/** Authored interaction surfaces, never inferred from a keyword or a number of answers. */
const surfaces:Record<JourneyWorldId,Record<string,Presentation>>={
 w01:{encounter_1:p('object','Esteban prépare son sac.'),encounter_2:p('phone','La courtière propose une simulation contre vos habitudes.'),encounter_3:p('document','Le formulaire veut placer Esteban à ta charge.'),home:p('document','Le comptoir ferme avec ta clé.','intent'),papers:p('document','Votre mois est déjà payé.','event'),market:p('document','Deux accès coûtent plus que ta réserve.'),desk:p('document','Le contrat doit porter les noms de ceux qui pourront entrer.'),crossing:p('object','La borne attend le contrat.'),tomasz_exposed:p('document','Tomasz a vu son nom sur les écrans.'),tomasz_receipt:p('document','Tomasz te demande ce qu’est devenu le reçu.'),tomasz_none:p('document','Tomasz vous rattrape avec sa boîte.')},
 w02:{welcome:p('object','La valise de Soraya est déjà prête.','intent'),garden:p('document','Le résumé ne contient pas son refus.'),studio:p('document','Rester ici demande un accompagnement cette semaine.'),request:p('document','L’Oracle attend votre demande.'),party:p('phone','Soraya attend ta réponse.')},
 w03:{meal:p('object','L’assemblée envisage de réaffecter votre atelier.','intent'),square:p('tool','La roue de Noor frotte encore.'),bench:p('tool','L’établi est disponible, le temps est limité.'),farm:p('document','Le nécessaire est assuré. L’usage de cet atelier vous appartient.'),meeting:p('document','Les habitants vont décider de garder ou transformer le lieu.')},
 w04:{arrival:p('object','Iris renverse la tasse qu’elle voulait t’offrir.','intent'),annex:p('tool','Le mode généraliste empêche l’autorisation.'),document:p('document','La commission demande une limite vérifiable.'),market:p('tool','Les deux pièces n’offrent pas les mêmes garanties.'),wall:p('document','L’essai peut être autorisé, différé ou lancé hors cadre.'),trial:p('object','Iris tient la tasse. Le cycle limité s’arrête.','event')},
 w05:{cafe:p('tool','Les voisins arrivent au café avec leurs couvertures.','intent'),bridge:p('tool','Il manque une rambarde au pont.'),office:p('document','Les mesures d’Hubert ne prouvent pas une intention.'),water:p('tool','Coupure de courant. Une seule batterie est disponible.'),fountain:p('object','Agathe apporte des couvertures. Le jour baisse.'),open:p('object','Brigitte attend avec la clé du café.')},
 w06:{hall:p('document','Le dispensaire prépare une évacuation faute d’eau.','intent'),pumps:p('tool','Mina trouve une pièce rompue.'),organise:p('document','La demande doit nommer les adresses à réparer.'),gate:p('document','La Cuve facture son calcul.'),result:p('document','Le plan existe. Son droit d’usage reste à obtenir.'),repair:p('tool','Mina attend un plan qu’elle a le droit d’utiliser.')},
 w08:{school:p('object','L’élève robot part ce soir. La capsule attend.','intent'),memory:p('document','Aurèle retrouve une erreur dans son cahier.'),workshop:p('tool','Le mécanisme peut être réparé de plusieurs façons.'),garden:p('document','L’élève demande le droit de changer ce qu’il reçoit.'),lesson:p('object','Il est temps de lui remettre ce que vous avez préparé.')},
 w09:{prairie:p('object','Le programme de consolation commence ce soir.','intent'),home:p('object','La photographie originale n’a pas encore été numérisée.'),stage:p('object','Un spectacle est proposé ; Anouk connaît un retrait possible.'),glass:p('object','Un rideau peut soustraire un espace aux capteurs.'),moment:p('object','Le programme appelle Gisèle.')},
 w11:{home:p('tool','La nuit approche. Votre foyer chauffe mal.','intent'),ration:p('object','Il faut garder assez de forces pour réparer.'),forge:p('tool','Le joint du foyer laisse passer l’air.'),pylons:p('document','Inès connaît un réglage que le village juge suspect.'),assembly:p('document','Le village doit décider si ce geste peut être transmis.'),night:p('object','Il faut passer la nuit avec ce qui a été obtenu.')},
};

/** New runs keep the material decisions; older optional conversations remain replayable by their exact IDs. */
export function withLivedJourney(journey:Journey):Journey {
 const legacyTarget=(s:JourneyScene):string|undefined=>s.id.startsWith('aftermath_')?s.id.slice('aftermath_'.length):s.id.startsWith('handoff_')?s.id.slice('handoff_'.length):s.id.startsWith('encounter_')&&journey.id!=='w01'?s.interludeFor:undefined;
 const bypass=new Map(journey.scenes.flatMap(s=>{const target=legacyTarget(s);return target?[[s.id,target] as const]:[]}));
 const destination=(id:string):string=>{let target=id;for(let n=0;n<8&&bypass.has(target);n++)target=bypass.get(target)!;return target;};
 return {...journey,start:destination(journey.start),scenes:journey.scenes.map(scene=>{
  const legacyBefore=bypass.get(scene.id);
  const presentation=surfaces[journey.id][scene.id];
  return {...scene,...(legacyBefore?{legacyBefore}:{}),...(presentation?{presentation}:{}),options:scene.options.map(option=>({...option,next:destination(option.next),...(option.nextIf?{nextIf:option.nextIf.map(route=>({...route,next:destination(route.next)}))}:{})}))};
 })};
}
