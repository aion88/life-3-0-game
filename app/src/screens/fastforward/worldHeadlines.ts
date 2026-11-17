import type {WorldId, Answers, QuestionKey, AnswerKey} from '../../shared/types';
import mayorScenes from '../mayor/scenes.json';

type Edition = readonly [fr:string,en:string];
/** Editorial fiction leading to each authored mission. These are not extra simulated events or real news. */
const editions:Record<WorldId,readonly [Edition,Edition,Edition,Edition]>={
 w01:[['Le logement entre dans les contrats automatiques','Housing enters automated contracts'],['Des parcelles changent de propriétaire, les habitants restent','Plots change owners; residents remain'],['Un mois déjà payé ne suffit plus à ouvrir la porte','A paid month no longer opens the door'],['Deux habitants, une clé qui expire ce soir','Two residents, one key expiring tonight']],
 w02:[['L’Oracle coordonne les soins et les logements','The Oracle coordinates care and housing'],['Un meilleur suivi, des déménagements recommandés','Better care, recommended relocations'],['Rester près des siens devient une demande à justifier','Staying close to others becomes a request to justify'],['La valise de Soraya est prête. Son accord manque','Soraya’s suitcase is ready. Her consent is missing']],
 w03:[['Le nécessaire est assuré, le travail change de place','Necessities are covered; work changes its place'],['Les ateliers cherchent ce que les machines ne donnent pas','Workshops seek what machines do not provide'],['Une assemblée veut réaffecter un atelier peu utilisé','An assembly considers repurposing a quiet workshop'],['La maison partagée vote : une chambre, un lit pliant','The shared house votes: one room, one folding bed']],
 w04:[['Le Gatekeeper impose un plafond aux nouvelles IA','The Gatekeeper caps new AI capabilities'],['Les laboratoires doivent prouver les limites de leurs outils','Labs must demonstrate their tools’ limits'],['Les prototypes polyvalents attendent leur autorisation','Versatile prototypes await authorization'],['Une tasse, une main et un essai menacé de scellés','A cup, a hand and a trial facing a seal']],
 w05:[['Des catastrophes évitées alimentent une rumeur','Averted disasters fuel a rumour'],['Le Protecteur reste invisible, les besoins restent locaux','The Protector stays invisible; needs stay local'],['Face aux crues, les habitants organisent leurs refuges','Residents organize shelters against flooding'],['Le café de Brigitte tient debout. Il faut y passer la nuit','Brigitte’s café stands. People need a night’s shelter']],
 w06:[['Le calcul le plus puissant reste une propriété privée','The strongest computing power remains privately owned'],['Les priorités des propriétaires organisent la file','Owners’ priorities organize the queue'],['Réparer une conduite exige aussi le droit d’utiliser le plan','Repairing a pipe also requires rights to its design'],['Le dispensaire manque d’eau, la Cuve sait calculer','The clinic lacks water; the Vault can compute']],
 w07:[['Les systèmes coopèrent, leurs capacités augmentent','Systems cooperate as their capabilities grow'],['Les institutions délèguent davantage de décisions','Institutions delegate more decisions'],['La possibilité de reprendre la main se réduit','The ability to regain control shrinks'],['Une trajectoire où les humains perdent le contrôle','A trajectory where humans lose control']],
 w08:[['Des élèves robots rejoignent les écoles humaines','Robot pupils join human schools'],['Les générations vieillissantes préparent leurs archives','Ageing generations prepare their archives'],['Les descendants demandent le droit de répondre','Descendants ask for the right to answer'],['À la Dernière École, une capsule attend son destinataire','At the Last School, a capsule awaits its recipient']],
 w09:[['Le Gardien assure le logement et la nourriture','The Keeper provides housing and food'],['Le confort personnalisé entre jusque dans les souvenirs','Personalized comfort reaches into memories'],['La consolation laisse moins de place aux souvenirs pénibles','Consolation leaves less room for painful memories'],['Gisèle veut garder une photographie sans la corriger','Gisèle wants to keep a photograph uncorrected']],
 w10:[['Le Registre étend l’identification des habitants','The Registry expands resident identification'],['Les dossiers relient travail, logement et déplacements','Records connect work, housing and travel'],['Contester une affectation engage les proches','Challenging an assignment involves relatives'],['Un transfert demain, une famille cherche un recours','A transfer tomorrow; a family seeks an appeal']],
 w11:[['La commune vote la coupure des réseaux','The community votes to disconnect networks'],['Le quotidien se réorganise autour des gestes manuels','Daily life reorganizes around manual skills'],['Des savoirs anciens deviennent suspects','Old knowledge comes under suspicion'],['Lucien a de la fièvre, le remède vient de la vallée','Lucien has a fever; the remedy comes from the valley']],
 w12:[['Les règles divergent entre puissances rivales','Rules diverge among rival powers'],['Les crises techniques croisent les tensions humaines','Technical crises meet human tensions'],['Les réseaux fragiles compliquent la réponse commune','Fragile networks hinder a common response'],['Une trajectoire où les humains détruisent leurs appuis','A trajectory where humans destroy their support systems']],
};

export interface EditorialContribution {question:QuestionKey;answer:AnswerKey;deltas:readonly {axis:string;value:number}[]}
export function worldHeadline(world:WorldId,year:number,answers:Answers,selected:EditorialContribution|null,lang:'fr'|'en'='fr') {
 if(!Number.isInteger(year)||year<2027||year>2032)throw new RangeError('Editorial editions cover 2027–2032; 2026 is the mandate, not a future edition.');
 const late:Partial<Record<WorldId,readonly [Edition,Edition]>>={
  w07:[['Les derniers moyens de contrôle humain en question','The last means of human control in question'],['Des infrastructures qui continuent sans leurs habitants','Infrastructure continuing without its inhabitants']],
  w12:[['Quand les secours dépendent de réseaux qui cèdent','When relief depends on failing networks'],['Après les ruptures, la promesse des secours sans réponse','After the breakdowns, a relief promise unanswered']],
 };
 const entry=year<=2030?editions[world][year-2027]:late[world]?.[year-2031];
 if(!entry)throw new RangeError('Only extinction trajectories have editions after 2030.');
 const title=entry[lang==='fr'?0:1];
 // A displayed contribution must be one the player actually selected, with a non-zero model push.
 const actual=selected&&answers[selected.question]===selected.answer&&selected.deltas.some(d=>d.value!==0)?selected:null;
 const scene=actual?mayorScenes.find(s=>s.id===actual.question):undefined;
 const choice=scene?.choix.find(c=>c.key===actual?.answer);
 return {world,year,title,source:'editorial-fiction' as const,contribution:actual&&choice?{question:actual.question,answer:actual.answer,label:choice.t}:null,
  boundary:lang==='fr'?'Titre inventé. Ton choix y a contribué, il ne l’explique pas seul.':'Made-up headline. Your choice played a part, not the whole part.'};
}
