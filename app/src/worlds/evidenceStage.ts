import { createEvidenceStage3d } from './evidenceStage3d';
import type { EvidenceDeskState } from './evidenceDeskState';
/** Original vector stage: a stylisation of the existing checkpoint, not a free-camera 3D scene. */
export function createEvidenceStage(doc: Document) {
 const el=doc.createElement('section');el.className='ed-scene';el.setAttribute('aria-label','Vue du quartier — entrée de l’assemblée');
 el.innerHTML=`<svg viewBox="0 0 1200 350" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Une façade bleue, une barrière fermée, un écran du quartier et toi devant l’entrée">
 <defs>
  <linearGradient id="ed-sky" x2="0" y2="1"><stop stop-color="#2849ab"/><stop offset="1" stop-color="#aaacd0"/></linearGradient>
  <linearGradient id="ed-glass" x2="1" y2="1"><stop stop-color="#5bb7bc"/><stop offset="1" stop-color="#167c8b"/></linearGradient>
  <pattern id="ed-windows" width="27" height="23" patternUnits="userSpaceOnUse"><rect width="10" height="12" fill="#aed9d4"/></pattern>
  <pattern id="ed-bars" width="36" height="12" patternUnits="userSpaceOnUse"><rect width="36" height="12" fill="#eee4b8"/><rect width="18" height="12" fill="#18334b"/></pattern>
 </defs>
 <rect width="1200" height="350" fill="url(#ed-sky)"/>
 <path d="M0 45H110V0H187V110H245V58H325V200H0Z" fill="#427f9e"/><path d="M925 0H1032V70H1090V26H1200V230H925Z" fill="#315d84"/>
 <path d="M10 55H100V220H10ZM125 12H175V208H125ZM948 12H1020V210H948ZM1100 40H1190V228H1100Z" fill="url(#ed-windows)" opacity=".6"/>
 <path d="M100 265L275 212H1060L1200 280V350H0V295Z" fill="#d6c59c"/>
 <path d="M310 243L555 243L794 350H537Z" fill="#335b79"/><path d="M1020 215L1160 257L1200 350H1071L877 242Z" fill="#244e73"/>
 <path d="M235 80L315 48H1010V250H235Z" fill="#197c83"/><path d="M235 80L315 48V245L235 270Z" fill="#14546b"/>
 <path d="M315 48H1010V76H315Z" fill="#f3dca3"/><path d="M315 76H1010V88H315Z" fill="#123a5a"/>
 <path d="M315 88H1010V114H315Z" fill="#29a294"/>
 <text x="678" y="106" text-anchor="middle" fill="#f5ebc4" font-size="13" letter-spacing="5" font-family="Arial,sans-serif">MAISON DES ASSEMBLÉES</text>
 <rect x="580" y="126" width="266" height="119" fill="#122d4d"/>
 <path d="M590 137H835V237H590Z" fill="url(#ed-glass)"/><path d="M590 137H710L645 237H590Z" fill="#8ed0c8"/>
 <path d="M710 133V244M586 190H839" stroke="#193d53" stroke-width="8"/>
 <rect x="565" y="119" width="12" height="135" fill="#e6ce94"/><rect x="848" y="119" width="12" height="135" fill="#e6ce94"/>
 <path d="M861 118L889 108V244L861 254Z" fill="#0e4c68"/>
 <g fill="#f9dfa1"><rect x="542" y="156" width="8" height="31"/><rect x="879" y="156" width="8" height="31"/></g>
 <path d="M559 254H879L898 268H544Z" fill="#f3dfb5"/><path d="M544 268H898V276H544Z" fill="#264d69"/>
 <rect x="331" y="132" width="202" height="110" rx="2" fill="#102d43" stroke="#84c7bc" stroke-width="2"/>
 <text x="346" y="151" fill="#c5dabb" font-size="9" letter-spacing="2" font-family="Arial,sans-serif">CANAL DU QUARTIER</text>
 <text class="ed-scene-message" x="346" y="178" fill="#f5d78b" font-size="15" font-family="Arial,sans-serif">Séance en cours</text>
 <text class="ed-scene-quote" x="346" y="199" fill="#dbe8cf" font-size="11" font-family="Arial,sans-serif">Paroles analysées par le Registre.</text>
 <text class="ed-scene-ids" x="346" y="222" fill="#dbe8cf" font-size="10" font-family="monospace"></text>
 <g class="ed-scene-camera"><path d="M925 122V140H908" stroke="#17334f" stroke-width="5" fill="none"/><path d="M887 131L909 125L923 135L897 146Z" fill="#ede2b7"/><circle cx="895" cy="140" r="3" fill="#eb9851"/></g>
 <path d="M917 246V278" stroke="#14354d" stroke-width="12"/><rect x="574" y="244" width="344" height="11" fill="url(#ed-bars)"/>
 <circle class="ed-scene-lamp" cx="917" cy="238" r="6" fill="#f4b441"/>
 <rect x="929" y="156" width="65" height="66" fill="#12334e"/><text class="ed-scene-access" x="961" y="182" text-anchor="middle" fill="#f8ce70" font-size="9" font-family="Arial,sans-serif">SUSPENDU</text><path d="M950 195H972" stroke="#f8ce70" stroke-width="3"/>
 <g class="ed-scene-passers" fill="#193c57"><ellipse cx="466" cy="291" rx="20" ry="4" opacity=".3"/><circle cx="468" cy="248" r="5" fill="#d9aa7b"/><path d="M461 257Q468 251 475 257L477 277H459Z" fill="#b56943"/><path d="M464 276L462 291M472 276L475 291" stroke="#18394d" stroke-width="4"/></g>
 <g class="ed-scene-player"><path d="M681 313L740 338L757 338L699 310Z" fill="#214968" opacity=".8"/><circle cx="686" cy="257" r="7" fill="#b87e57"/><path d="M680 252Q688 245 693 255" stroke="#233038" stroke-width="5" fill="none"/><path d="M676 269Q685 263 696 269L700 291H674Z" fill="#f0dfb5"/><path d="M679 291L678 313M692 291L695 313" stroke="#285480" stroke-width="7"/><path d="M674 272L668 290M698 272L705 287" stroke="#bb8964" stroke-width="4"/><path d="M672 315H682M691 315H701" stroke="#193545" stroke-width="4"/></g>
 <path d="M0 310L118 281L177 350H0Z" fill="#0c455a"/><path d="M1132 286L1200 263V350H1165Z" fill="#0d4659"/>
 </svg>`;
 const svg=el.querySelector('svg')!;
 const scene3d=createEvidenceStage3d(el);
 const media=doc.defaultView?.matchMedia('(max-width:760px)');
 const frame=()=>svg.setAttribute('viewBox',media?.matches?'260 10 820 420':'0 0 1200 350');frame();media?.addEventListener('change',frame);
 return {el,update(state:EvidenceDeskState){
  el.dataset['outcome']=state.result?.status??'waiting';scene3d?.update(state);
  el.querySelector('.ed-scene-message')!.textContent=state.result?.status==='public'?'RECTIFICATION PUBLIÉE':'Séance en cours';
  el.querySelector('.ed-scene-quote')!.textContent=state.result?.status==='public'?'« Je ne demande pas leur coupure. »':'Paroles analysées par le Registre.';
  el.querySelector('.ed-scene-ids')!.textContent=state.result?.status==='public'?(state.result.exposed.length?`Présences : ${state.result.exposed.join(' / ')}`:'Présences : masquées'):'';
  el.querySelector('.ed-scene-access')!.textContent=state.result?.status==='review'?'EN EXAMEN':'SUSPENDU';
  el.querySelector('.ed-scene-lamp')!.setAttribute('fill',state.result?.status==='review'?'#bce9a0':'#f4b441');
  svg.setAttribute('aria-label',state.result?.status==='public'?'La correction est affichée sur l’écran du quartier. La barrière reste fermée.':state.result?.status==='review'?'Le terminal indique un examen humain. La barrière reste fermée.':'Devant l’assemblée, ton accès est suspendu. La caméra et la barrière restent actives.');
 },dispose(){scene3d?.dispose();media?.removeEventListener('change',frame);el.remove();}};
}
