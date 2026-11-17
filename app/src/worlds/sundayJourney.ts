import './sundayJourney.css';

type BeatId = 'invitation' | 'street' | 'blocked' | 'decision' | 'request' | 'accepted' | 'ride' | 'lunch' | 'return' | 'home';
interface Beat { place:string; time:string; image:string; speaker:string; line:string; objective:string; next?:BeatId; duration?:number; message?:string; terminal?:string }
export const SUNDAY_BEATS:Record<BeatId,Beat>={
 invitation:{place:'Chez toi',time:'DIMANCHE · 12:04',image:'w10-unit.9-D',speaker:'Maman · message',line:'« Le poulet est au four. On t’attend pour une heure. »',objective:'Rejoindre tes parents pour déjeuner.',message:'Tu viens toujours ?'},
 street:{place:'En route vers le métro',time:'12:12',image:'w10-street.mid',speaker:'Ton trajet',line:'Deux stations, puis cinq minutes à pied. Tu connais le chemin par cœur.',objective:'Rejoindre tes parents.',next:'blocked',duration:6500},
 blocked:{place:'Contrôle avant la station',time:'12:16',image:'w10-anchor.cp.head',speaker:'Le terminal',line:'« Déplacement hors secteur suspendu. Identification à une manifestation non autorisée. »',objective:'Passer le contrôle pour prendre le métro.',terminal:'PASSAGE REFUSÉ',next:'decision',duration:8500},
 decision:{place:'Contrôle avant la station',time:'12:16',image:'w10-anchor.cp.head',speaker:'Le Registre · contrôle par IA',line:'Un proche peut garantir ce trajet. Son nom sera lié à ton dossier de surveillance.',objective:'Tes parents t’attendent de l’autre côté de la ville.',terminal:'GARANTIE D’UN PROCHE REQUISE',message:'Maman : Tu es dans le métro ?'},
 request:{place:'Chez tes parents · au même moment',time:'12:17',image:'w10-dinner.insert',speaker:'Sur le téléphone de ta mère',line:'« Garantir ce déplacement associera votre identité au dossier de surveillance de votre enfant. »',objective:'Ta demande vient d’arriver chez tes parents.',terminal:'DEMANDE REÇUE',next:'accepted',duration:8500},
 accepted:{place:'Au contrôle',time:'12:18',image:'w10-anchor.cp.head',speaker:'Maman · message',line:'« J’ai accepté. Viens, on t’attend. »',objective:'Trajet autorisé. Ta mère est désormais inscrite dans ton dossier.',terminal:'GARANTIE ACCEPTÉE · PASSAGE AUTORISÉ',next:'ride',duration:7000},
 ride:{place:'De l’autre côté du contrôle',time:'12:24',image:'w10-street.mid',speaker:'Ton téléphone',line:'Deux stations plus loin, un reçu arrive : « Garant familial enregistré. Lien conservé. »',objective:'Tu arrives chez tes parents.',message:'Maman · garante du déplacement',next:'lunch',duration:7500},
 lunch:{place:'À table, chez tes parents',time:'13:02',image:'w10-dinner.insert',speaker:'Papa',line:'« Passe-moi ton assiette, ça va refroidir. »',objective:'Tu es arrivé. La surveillance concerne maintenant aussi ta mère.',message:'Registre : lien familial conservé.'},
 return:{place:'Le chemin du retour',time:'12:20',image:'w10-street.mid',speaker:'Ton message à tes parents',line:'« Ne m’attendez pas. Mon trajet est bloqué. Je vous appelle en rentrant. »',objective:'Tu rentres sans associer tes parents à ton dossier.',next:'home',duration:8000},
 home:{place:'Chez toi',time:'12:37',image:'w10-unit.9-D',speaker:'Maman · message',line:'« On t’a gardé une part. Appelle quand tu veux. »',objective:'Le déjeuner se fera sans toi. Aucun garant ajouté à ton dossier.',message:'Appel de maman'},
};

/** Local lived-experience study; deliberately never reads or writes a game save. */
export function mountSundayJourney(root:HTMLElement):()=>void{
 const doc=root.ownerDocument,win=doc.defaultView!;
 const host=doc.createElement('main');host.className='sunday-journey';host.setAttribute('aria-label','1984 — Le déjeuner du dimanche');root.append(host);
 let beat:BeatId='invitation',paused=win.matchMedia('(prefers-reduced-motion: reduce)').matches,disposed=false;
 let timer:ReturnType<typeof setTimeout>|undefined,remaining=0,started=0;
 const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K]=>{const n=doc.createElement(tag);n.textContent=text;n.className=className;return n;};
 const button=(label:string,run:()=>void,key:string):HTMLButtonElement=>{const b=el('button',label);b.type='button';b.dataset['action']=key;b.addEventListener('click',run);return b;};
 const cancel=():void=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
 const schedule=():void=>{cancel();if(disposed||paused||doc.hidden||!SUNDAY_BEATS[beat].next)return;started=Date.now();timer=setTimeout(()=>{timer=undefined;advance();},remaining);};
 const freeze=():void=>{if(timer!==undefined)remaining=Math.max(0,remaining-(Date.now()-started));cancel();};
 const go=(id:BeatId):void=>{cancel();beat=id;remaining=SUNDAY_BEATS[id].duration??0;draw();schedule();};
 const advance=():void=>{const next=SUNDAY_BEATS[beat].next;if(next)go(next);};
 const toggle=():void=>{freeze();paused=!paused;draw();schedule();host.querySelector<HTMLButtonElement>('[data-action=pause]')?.focus({preventScroll:true});};
 const draw=():void=>{
  const b=SUNDAY_BEATS[beat],ended=beat==='home'||beat==='lunch';
  host.replaceChildren();host.dataset['beat']=beat;host.dataset['paused']=String(paused||doc.hidden);
  const header=el('header','','sj-header');const title=el('div');title.append(el('span','LIFE 3.0 / 1984','sj-eyebrow'),el('h1','Un dimanche ordinaire'));
  const exit=el('a','Quitter');exit.href=import.meta.env.BASE_URL;header.append(title,exit);
  const scene=el('figure','','sj-scene');const picture=el('img');picture.src=`${import.meta.env.BASE_URL}illustrated/full-frame/${b.image}.jpg`;picture.alt=b.place;picture.draggable=false;scene.append(picture);
  const location=el('figcaption','','sj-location');location.append(el('span',b.time),el('h2',b.place));scene.append(location);
  if(b.terminal){const terminal=el('div','','sj-terminal');terminal.append(el('span','REGISTRE / MOBILITÉ'),el('strong',b.terminal));if(beat==='accepted')terminal.dataset['open']='true';scene.append(terminal);}
  if(b.message){const phone=el('aside','','sj-phone');phone.setAttribute('aria-label','Notification du téléphone');phone.append(el('span',ended&&beat==='lunch'?'REGISTRE':'TÉLÉPHONE'),el('p',b.message));scene.append(phone);}
  const narrative=el('section','','sj-narrative');narrative.setAttribute('aria-live','polite');narrative.setAttribute('aria-atomic','true');narrative.append(el('p',b.speaker,'sj-speaker'),el('p',b.line,'sj-line'),el('p',b.objective,'sj-objective'));
  const dock=el('footer','','sj-dock');
  if(beat==='invitation'){
   dock.append(el('p','Tu joues un habitant. Les scènes avancent seules ; tu interviens quand cela compte.','sj-help'),button('Partir chez mes parents',()=>go('street'),'depart'));
  }else if(beat==='decision'){
   const choices=el('div','','sj-choices');
   for(const [label,detail,destination,key] of [['Demander à maman de se porter garante','Son nom sera lié à mon dossier.','request','guarantor'],['Rentrer chez moi','Je manque le déjeuner ; je ne les implique pas.','return','return']] as const){const choice=button(label,()=>go(destination),key);choice.append(el('small',detail));choices.append(choice);}dock.append(choices);
  }else if(ended){
   const result=el('div','','sj-consequence');result.append(el('span',beat==='lunch'?'DÉJEUNER PARTAGÉ':'DÉJEUNER MANQUÉ'),el('strong',beat==='lunch'?'Un lien de surveillance ajouté.':'Tes parents restent hors de ce dossier.'));dock.append(result,button('Rejouer ce dimanche',()=>go('invitation'),'replay'));
  }else{
   dock.append(el('p',paused?'Lecture en pause':'La scène se déroule…','sj-help'),button(paused?'Reprendre':'Pause',toggle,'pause'),button(beat==='street'?'Passer le trajet':'Voir la suite',advance,'next'));
  }
  host.append(header,scene,narrative,dock);
 };
 const visibility=():void=>{if(doc.hidden){freeze();host.dataset['paused']='true';}else{host.dataset['paused']=String(paused);schedule();}};
 doc.addEventListener('visibilitychange',visibility);
 // Preload the small set of existing illustrations, without duplicating assets.
 for(const name of new Set(Object.values(SUNDAY_BEATS).map(b=>b.image))){const image=new Image();image.src=`${import.meta.env.BASE_URL}illustrated/full-frame/${name}.jpg`;}
 draw();return()=>{disposed=true;cancel();doc.removeEventListener('visibilitychange',visibility);host.remove();};
}
