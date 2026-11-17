/** Cast identities are independent of the location and stay stable across encounters. */
export interface CastMember { id:string; body:string }
const member=(id:string,body:string):CastMember=>({id,body});
const casts:Record<string,Record<string,CastMember>>={
 w01:{ESTEBAN:member('esteban','npc.bruno'),TOMASZ:member('tomasz','npc.yusuf'),SABINE:member('sabine','npc.nadia'),'UNE COURTIÈRE':member('courtiere','npc.berenice')},
 w02:{SORAYA:member('soraya','npc.berenice'),ANATOL:member('anatol','npc.bruno'),DOROTHÉE:member('dorothee','crowd_b')},
 w03:{RÉMY:member('remy','npc.bruno'),NOOR:member('noor','npc.nadia'),MAËLLE:member('maelle','crowd_b'),ANSELME:member('anselme','npc.yusuf')},
 w04:{IRIS:member('iris','npc.berenice'),SALOMÉ:member('salome','npc.nadia'),LAZARE:member('lazare','npc.yusuf'),ARMAND:member('armand','npc.bruno')},
 w05:{BRIGITTE:member('brigitte','npc.marlene'),HUBERT:member('hubert','npc.bruno'),AGATHE:member('agathe','crowd_b'),'LA VOISINE':member('voisine','npc.nadia')},
 w06:{MINA:member('mina','npc.berenice'),OCTAVE:member('octave','npc.bruno'),THAÏS:member('thais','npc.nadia'),IBRAHIM:member('ibrahim','npc.yusuf')},
 w08:{'L’ÉLÈVE':member('eleve','robot.student'),AURÈLE:member('aurele','npc.bruno'),CLÉMENCE:member('clemence','npc.berenice'),AWA:member('awa','crowd_b')},
 w09:{GISÈLE:member('gisele','npc.marlene'),ARSÈNE:member('arsene','npc.bruno'),ANOUK:member('anouk','npc.nadia')},
 w10:{MARLÈNE:member('marlene','npc.marlene'),'TA MÈRE':member('marlene','npc.marlene'),NADIA:member('nadia','npc.nadia'),'L’AGENTE':member('agente','npc.berenice')},
 w11:{LUCIEN:member('lucien','npc.bruno'),MIREILLE:member('mireille','npc.marlene'),INÈS:member('ines','npc.nadia'),AUGUSTIN:member('augustin','npc.yusuf')},
};
/** Screens, recordings and narration do not acquire a human body by default. */
export function castMember(world:string,speaker:string):CastMember|null {return casts[world]?.[speaker]??null;}
export function castBodies(world:string):string[]{return [...new Set(Object.values(casts[world]??{}).map(c=>c.body))];}

export function castMembers(world:string):CastMember[]{return [...new Map(Object.values(casts[world]??{}).map(c=>[c.id,c])).values()];}
