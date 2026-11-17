import type {JourneyScene,JourneyState,JourneyWorldId} from './types';
import { shortSceneText } from './shortForm';
/** Only facts established on this route may appear as accomplished in a conversation. */
export function narrativeScene(world:JourneyWorldId,scene:JourneyScene,state:JourneyState):JourneyScene {
 const shortText=shortSceneText(world,scene,state);if(shortText!==null)return {...scene,text:shortText};
 const has=(item:string):boolean=>state.inventory.includes(item);
 let text=scene.text;let speaker=scene.speaker;
 if(world==='w11'&&scene.id==='temporary'&&has('Joint réparé')&&has('Geste appris'))text=has('Savoir partagé')?'Le foyer est réparé et le village connaît le geste. Tu brûles le fagot pour cette nuit, sans organiser ici l’accueil collectif. Le combustible s’épuise ; il faudra en retrouver demain.':'Le foyer est réparé : le joint tient et tu connais le réglage. Lucien et toi vous réchauffez avec le fagot. Le village n’a pas obtenu de transmission du geste ni de foyer commun ; les voisins cherchent un autre accueil.';
 // Results describe only what this route obtained; a programme cannot erase a retained original.
 if(world==='w09'&&scene.id==='moment')text=has('Photo confiée')
  ? `Tu as gardé l’original${has('Rideau déplacé')?', et le rideau est tiré':', mais aucun rideau ne l’abrite'}. Gisèle doit rejoindre sa séance. « Mon original est toujours hors des capteurs ? »`
  : 'La photo est déjà chez le Gardien : le rideau ne retire pas cette copie. Gisèle doit rejoindre sa séance. « Tu proposes quoi, maintenant ? »';
 if(world==='w09'&&scene.id==='show')text=has('Photo confiée')
  ? 'Sur scène, le programme propose un souvenir apaisant. Gisèle paraît soulagée un moment. Tu gardes pourtant l’original hors des capteurs : cette séance ne l’a pas effacé. Vous ne l’avez pas regardé ensemble à l’abri.'
  : 'Le programme montre Gisèle et sa sœur souriantes. La copie transmise au Gardien alimente cette version apaisante ; vous ne disposez pas d’un original protégé du programme. Gisèle se calme, mais la dispute disparaît du récit présenté.';
 if(world==='w09'&&scene.id==='empty')text=has('Rideau déplacé')
  ? 'Le rideau reste tiré. Gisèle choisit le silence ; aucun programme n’est lancé. Tu as cédé ton espace et suspendu ton confort personnalisé. Ce retrait existe, même si vous n’y avez pas retrouvé ensemble la photographie originale.'
  : 'Aucun programme n’est lancé. Gisèle garde le silence et peut encore te parler. Vous n’avez pas créé d’espace à l’abri des capteurs ; le Gardien continue d’organiser le confort du pavillon.';
 if(world==='w02'&&scene.id==='party'&&has('Transfert annulé'))text='Le véhicule a été décommandé : le refus signé et ton accompagnement ont fait annuler le transfert. Soraya attend près de sa valise. « Quand commence la première visite de soins ici ? »';
 if(world==='w06'&&scene.id==='dry')text=`Le dispensaire est évacué ; Octave part avec sa mère. ${has('Eau provisoire')?'Les seaux ont aidé les logements ce soir, pas la conduite. ':''}${has('Plan de réparation')?'La Cuve a produit un plan, sans droit de l’utiliser.':'Aucune réparation n’a été obtenue.'} Il te reste ${state.resource} bon${state.resource===1?'':'s'} de calcul.`;

 if(world==='w03'&&scene.id==='encounter_3')text=has('Remorque réparée')
  ? 'Noor arrive au vote avec la roue que vous avez réparée. « Elle roule. Mais ne promets pas que je pourrai rendre visite à tout le monde chaque jour. » Rémy baisse son carnet : il avait préparé un discours plus ambitieux. Qui présentera le travail à l’assemblée ?'
  : 'Noor arrive au vote en tirant sa remorque : la roue frotte encore. « Vous pouvez défendre un autre projet. Mais pas dire que vous avez réparé ma roue. » Rémy referme son carnet. Qui expliquera à l’assemblée ce que vous avez réellement fait ?';
 if(world==='w09'&&scene.id==='encounter_3')text=has('Photo confiée')
  ? 'Gisèle reprend un instant la photographie que tu as gardée. Au dos, sa sœur a écrit une phrase blessante. « Je veux la conserver. Pas être obligée de la regarder chaque matin. » Une enveloppe suffit à la cacher à ses yeux ; pour la soustraire au Gardien, il faut aussi l’espace privé.'
  : 'Gisèle te montre la copie que tu as transmise au Gardien. « Tu lui as déjà donné la photo ? Alors une enveloppe ne suffira plus. » Tu peux encore écouter ce qu’elle veut préserver, mais tu n’as pas l’original confié hors capteurs pour obtenir la fin privée.';
 if(world==='w11'&&scene.id.startsWith('encounter_3')) {
  if(has('Inès dénoncée')){speaker='AUGUSTIN';text=scene.id==='encounter_3'
   ? 'Le voisin demande à voir Inès. Augustin la retient à cause de ton signalement. Lucien te regarde : « On ne peut pas lui demander de nous aider comme si tu n’avais rien dit. » Tu peux proposer de lui demander son accord ou organiser une transmission plus tard. Aucun de ces gestes n’efface ta dénonciation ni ne répare le foyer ce soir.'
   : 'Tu transmets ta proposition à Augustin. Il refuse de laisser revenir Inès ce soir. Le voisin accepte d’attendre sa réponse au lieu de parler à sa place. Ton signalement reste inscrit ; il faut maintenant affronter la nuit avec le bois et les réparations réellement obtenus.';}
  else if(scene.id==='encounter_3')text='Inès vient jusqu’à la porte. Un voisin lui demande comment vous avez réparé le foyer. « Je peux montrer le geste. Mais ne dites pas que je remets les réseaux en marche. » Avant de citer son nom ou d’inviter d’autres personnes à apprendre, tu lui proposes de fixer les limites.';
 }
 return text===scene.text&&speaker===scene.speaker?scene:{...scene,text,speaker};
}
