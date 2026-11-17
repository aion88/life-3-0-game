/** Spoken openings for the existing encounters. The full authored scene remains available as context. */
const openings:Record<string,readonly string[]>={
 w01:[
  'Tu veux qu’on cherche une place ensemble ? Ou est-ce que je dois préparer un autre endroit où aller ?',
  'Pour personnaliser cette simulation de bail, il me faut l’accès à vos habitudes. Vous voulez que je la lance ?',
  'Le formulaire veut me mettre à ta charge. Ça ne nous donne aucun droit de plus. Est-ce qu’on peut garder chacun notre voix ?',
 ],
 w02:[
  'Ces soins m’ont aidée à sortir à nouveau. Je veux les garder. Mais je veux aussi pouvoir dire où je vis.',
  'Le trajet rouge conduit au véhicule. Le bleu, aux bancs familiers. Voulez-vous voir ce que le dossier dit de ce déplacement ?',
  'J’ai écrit « je veux rester ». Le résumé dit seulement que j’ai besoin d’être rassurée. Tu entends la différence ?',
 ],
 w03:[
  'Sur cette photo, on portait tous la même pièce. Maintenant, personne n’a besoin de mes bras. Tu crois qu’il me reste quelque chose à apprendre ?',
  'J’ai laissé cette chaise pour quelqu’un qui voudrait simplement regarder. Est-ce qu’il faudra produire quelque chose pour avoir le droit de rester ?',
  'Ne fais pas de ma remorque une solution parfaite. Je livre des repas, mais je ne peux pas promettre une visite chaque jour. Laisse-moi corriger ce qu’on raconte.',
 ],
 w04:[
  'La tasse, le pinceau, la clé… Avant de parler de performances, je voudrais choisir le premier geste que cette main me rendra.',
  'Cette pièce porte un numéro vérifiable. L’autre promet d’aller plus vite, mais je ne peux pas retracer son origine. Qu’est-ce qu’on explique à Iris ?',
  'Qui pourra arrêter l’essai ? L’équipe technique, ou Iris elle-même ? Préparons ça avant de lui confier le prototype.',
 ],
 w05:[
  'Douze personnes attendent un refuge. Mais ce ne sont pas seulement douze places : certaines ont besoin d’une chaise, d’autres de calme. Par où commence-t-on ?',
  'Mon père attend de l’autre côté. Une rumeur dit que le Protecteur empêchera le pont de céder. Qu’est-ce qu’on peut vérifier avant de le faire venir ?',
  'On prépare une inscription pour remercier le Protecteur. Mais les voisins n’ont pas tous la même croyance. Comment remercier sans exclure ?',
 ],
 w06:[
  'J’ai une demande d’eau et une autorisation de transport pour ma mère. Si la première échoue, il nous faut encore une façon de la protéger.',
  'Un jardin privé passe avant notre réparation d’eau. Regardez ce que cette priorité change pour les gens qui attendent ici.',
  'Cette intervention a déjà été offerte, puis facturée autrement. Avant de signer, regardons ce que le contrat ne dit pas.',
 ],
 w08:[
  'La capsule porte le nom du professeur. Et ma place à moi, où est-elle ? Je voudrais pouvoir répondre à ce qu’on me transmet.',
  'L’élève connaît des méthodes de réparation. Mais sait-il pourquoi Aurèle tient à celle-ci ? Comprendre un mécanisme et comprendre une histoire, ce n’est pas pareil.',
  'J’aimerais recevoir une réponse demain, à la même heure. Mais s’il ne peut pas me le promettre, comment garder la possibilité de se parler ?',
 ],
 w09:[
  'La musique commence dès que je pleure. Je sais que je peux l’arrêter… mais j’ai presque oublié ce que fait le silence. Tu restes avec moi ?',
  'Sur scène, les applaudissements me font du bien. Mais ça ne donne pas le droit de montrer la photographie de Gisèle sans son accord.',
  'Au dos, ma sœur avait écrit cette phrase. Le programme pourrait l’effacer avec notre dispute. Est-ce que je peux la garder sans devoir la regarder chaque matin ?',
 ],
 w11:[
  'C’est la seule pièce qu’on peut chauffer. Accueillir tout le monde, c’est aussi perdre un endroit où fermer la porte. Quelles limites veut-on garder ?',
  'Ce conduit, je le connais par mon père et par un ancien manuel. Je ne sais plus toujours où l’un s’arrête et où l’autre commence. Tu veux que je te montre ?',
  'Me citer, c’est reconnaître mon aide. C’est aussi m’exposer. Demande-moi comment raconter mon rôle avant de donner mon nom.',
 ],
};
/** A quotation is attributed only when the scene starts with direct speech; embedded quotes can belong to someone else. */
export function spokenLine(world:string,scene:string,text:string):string|null {
 const match=/^encounter_(\d+)$/.exec(scene);
 if(match)return openings[world]?.[Number(match[1])-1]??null;
 if(text.startsWith('«'))return [...text.matchAll(/«\s*([^»]+)\s*»/g)].map(m=>m[1]!.trim()).join(' ')||null;
 return null;
}
