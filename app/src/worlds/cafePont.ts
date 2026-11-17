/** Café du Pont: an authored, human-scale riverside refuge, not the shared room shell. */
import {BoxGeometry,CanvasTexture,CylinderGeometry,Group,InstancedMesh,LatheGeometry,Mesh,MeshStandardMaterial,PlaneGeometry,PointLight,RepeatWrapping,SphereGeometry,SRGBColorSpace,TorusGeometry,Vector2,type BufferGeometry,type Material,type Texture} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
type V3=readonly[number,number,number];
export function buildCafePont(){
 const group=new Group();group.name='cafe.pont';
 const geometries=new Set<BufferGeometry>(),materials=new Set<Material>(),textures=new Set<Texture>();
 const own=<T extends BufferGeometry>(g:T):T=>{geometries.add(g);return g;};
 const cube=own(new BoxGeometry()),cylinder=own(new CylinderGeometry(1,1,1,24)),ball=own(new SphereGeometry(1,16,10));
 const material=(color:string,roughness=.8,metalness=0)=>{const m=new MeshStandardMaterial({color,roughness,metalness});materials.add(m);return m;};
 const plaster=material('#d9c7a7'),teal=material('#315e5b'),wood=material('#754a30',.45),brass=material('#c29a59',.33,.7),cream=material('#ede2ca',.3),dark=material('#243b3c'),red=material('#a8503e'),linen=material('#c5b492',.96),stone=material('#b2aa96');
 function texture(kind:'wood'|'stone'|'cloth',m:MeshStandardMaterial){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
  c.fillStyle=kind==='stone'?'#c8c5b9':'#d9d1c3';c.fillRect(0,0,512,512);
  for(let i=0;i<18000;i++){const x=(i*173+Math.floor(i/512)*23)%512,y=(i*257+Math.floor(i/512)*47)%512;c.fillStyle=i%3?'#ffffff15':'#16221c13';c.fillRect(x,y,1,kind==='wood'?4:1);}
  if(kind==='wood')for(let i=0;i<100;i++){c.strokeStyle=i%3?'#5c42252b':'#fff5dd30';c.beginPath();for(let y=0;y<=512;y+=8){const x=i*5.2+Math.sin(y/67+i)*2.4;if(y===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
  if(kind==='cloth'){c.strokeStyle='#66543d35';for(let i=0;i<512;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,512);c.moveTo(0,i);c.lineTo(512,i);c.stroke();}}
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.wrapS=map.wrapT=RepeatWrapping;map.anisotropy=8;textures.add(map);m.map=map;
  const bump=map.clone();bump.colorSpace='';textures.add(bump);m.bumpMap=bump;m.bumpScale=kind==='cloth'?.008:.015;
 }
 texture('wood',wood);texture('stone',stone);texture('cloth',linen);
 const mesh=(name:string,g:BufferGeometry,m:Material,at:V3,size:V3=[1,1,1])=>{const o=new Mesh(g,m);o.name=name;o.position.set(...at);o.scale.set(...size);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
 const box=(name:string,at:V3,size:V3,m:Material)=>mesh(name,cube,m,at,size);
 const round=(name:string,at:V3,size:V3,m:Material,r=.03)=>mesh(name,own(new RoundedBoxGeometry(...size,2,r)),m,at);
 const rod=(name:string,at:V3,r:number,h:number,m:Material)=>mesh(name,cylinder,m,at,[r,h,r]);
 const sign=(text:string,at:V3,w:number,h:number,bg='#264643',fg='#eed9aa')=>{
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.strokeStyle=fg;ctx.lineWidth=3;ctx.strokeRect(16,16,992,224);ctx.fillStyle=fg;ctx.font='500 65px Arial';ctx.textAlign='center';ctx.fillText(text,512,151);
  const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;textures.add(t);const m=material('#ffffff');m.map=t;mesh(`cafe.sign.${text}`,own(new PlaneGeometry(w,h)),m,at);
 };
 // Continuous quay, river, opposite embankment, and occupied neighbouring façades.
 box('quay',[3,-.12,3],[65,.2,18],stone);
 const water=material('#537e82',.22,.25);box('river',[3,-.4,-12],[65,.12,12],water);
 box('opposite-bank',[3,-.1,-22],[65,.4,8],stone);
 for(let i=0;i<7;i++){
  const x=-20+i*7,h=5+(i%3)*1.3,m=material(['#c6ae87','#a4765a','#708c84'][i%3]!);
  box('river.house',[x,h/2,-24],[5.8,h,4],m);box('river.house.cornice',[x,h,-24],[6.1,.2,4.3],cream);
  for(let row=0;row<2;row++)for(const dx of [-1.5,1.5]){box('river.house.window',[x+dx,1.6+row*2.5,-21.96],[1.1,1.5,.06],dark);box('river.house.sill',[x+dx,.8+row*2.5,-21.88],[1.3,.1,.18],cream);}
 }
 // Cutaway front/right; the rear window bays are actual openings onto the river.
 box('cafe.floor',[3,-.035,0],[16,.07,14],stone);
 for(let z=-6;z<7;z+=.8)for(let x=-4.6;x<11;x+=.8){const edge=x< -3.5||x>9.5||z< -4.5;box('cafe.tile',[x,.006,z],[.78,.012,.78],edge?teal:((Math.round(x/.8)+Math.round(z/.8))%2?stone:plaster));}
 box('cafe.left-wall',[-5,2,0],[.24,4,14],plaster);
 box('cafe.rear-base',[3,.48,-5.5],[16,.96,.28],teal);
 box('cafe.rear-lintel',[3,3.65,-5.5],[16,.7,.28],plaster);
 for(const x of [-5,-1,3,7,11]){
  box('cafe.window.pier',[x,2.1,-5.5],[.28,2.5,.3],teal);
  for(const y of [1,3.3])box('cafe.window.rail',[x+1.85,y,-5.42],[3.5,.05,.08],brass);
  box('cafe.window.mullion',[x+1.85,2.16,-5.43],[.045,2.3,.08],brass);
 }
 for(const z of [-5.4,-2,1.4,4.8])box('cafe.left-moulding',[-4.85,1.1,z],[.05,.06,3.1],wood);
 box('cafe.left-dado',[-4.84,.55,0],[.035,1,13.5],teal);
 // Partial ceiling at the bar; front cutaway retains long blind/awning shadows.
 for(const x of [-4,0,4,8])box('cafe.ceiling-beam',[x,4,-3.8],[.14,.2,3.3],wood);
 for(let i=0;i<15;i++)box('cafe.awning',[ -4.5+i,3.8,-6.6],[.96,.05,2.5],i%2?linen:red).rotation.x=.09;
 for(const x of [-4.7,10.7])rod('cafe.awning-post',[x,1.85,-7.4],.035,3.7,brass);
 // A readable rear service door opens into a pantry instead of an empty wall.
 box('cafe.pantry.side',[-4.65,1.7,-4.25],[.2,3.4,2.5],teal);box('cafe.pantry.back',[-2,1.7,-5.3],[5.3,3.4,.2],plaster);
 for(let y=.7;y<3;y+=.65){box('cafe.pantry.shelf',[-2,y,-5.1],[5.1,.04,.3],wood);for(let x=-4;x<.5;x+=.6)rod('cafe.pantry.jar',[x,y+.16,-5.1],.1,.28,cream);}
 // Art Deco bar: 1.05 m service top, inset panels, foot rail, rounded stone edge.
 round('cafe.counter.base',[-2, .49,-1.8],[4.5,.98,1.2],teal,.045);
 round('cafe.counter.top',[-2,1.025,-1.8],[4.65,.09,1.35],stone,.035);
 for(const x of [-3.6,-2,-.4]){round('cafe.counter.panel',[x,.52,-1.188],[1.35,.7,.025],wood,.015);box('cafe.counter.inlay',[x,.52,-1.168],[1.12,.015,.012],brass);}
 const rail=rod('cafe.bar-footrail',[-2,.22,-.94],.025,4.2,brass);rail.rotation.z=Math.PI/2;
 for(const x of [-3.7,-.3])box('cafe.rail-bracket',[x,.15,-1.02],[.04,.3,.2],brass);
 round('cafe.coffee-machine',[-2.6,1.29,-2],[.65,.45,.4],brass,.045);box('cafe.coffee-drip',[-2.6,1.07,-1.72],[.7,.04,.25],dark);
 for(const x of [-2.8,-2.4])rod('cafe.coffee-knob',[x,1.3,-1.77],.035,.08,dark).rotation.x=Math.PI/2;
 const gauge=rod('cafe.coffee-gauge',[-2.6,1.4,-1.782],.065,.015,cream);gauge.rotation.x=Math.PI/2;
 const rim=own(new TorusGeometry(.067,.008,8,32));mesh('cafe.gauge-rim',rim,brass,[-2.6,1.4,-1.796]);
 box('cafe.gauge-needle',[-2.59,1.414,-1.807],[.007,.065,.006],dark).rotation.z=-.45;
 for(const x of [-2.8,-2.4]){rod('cafe.spout',[x,1.17,-1.7],.018,.12,brass);rod('cafe.portafilter',[x,1.22,-1.68],.035,.07,brass);box('cafe.portafilter-handle',[x,1.22,-1.59],[.035,.035,.17],dark);}
 rod('cafe.steam-wand',[-2.22,1.2,-1.76],.01,.23,brass);
 for(let slot=0;slot<10;slot++)box('cafe.drip-grid',[-2.9+slot*.065,1.098,-1.62],[.025,.005,.18],brass);

 sign('CAFÉ DU PONT',[-2,2.7,-5.28],4.8,.85);
 // Bentwood chairs and bistro tables use actual ergonomic dimensions.
 const backGeo=own(new TorusGeometry(.23,.018,8,32,Math.PI));
 const chair=(x:number,z:number,angle:number)=>{
  const seat=rod('cafe.chair.seat',[x,.46,z],.235,.055,wood);
  const frame=new Group();frame.position.set(x,0,z);frame.rotation.y=angle;group.add(frame);
  const back=new Mesh(backGeo,wood);back.name='cafe.chair.back';back.position.set(0,.8,-.2);frame.add(back);
  for(const sx of [-.19,.19])for(const sz of [-.17,.17]){const leg=new Mesh(cylinder,wood);leg.position.set(sx,.23,sz);leg.scale.set(.018,.46,.018);frame.add(leg);}
  for(const sx of [-.23,.23]){const post=new Mesh(cylinder,wood);post.position.set(sx,.63,-.2);post.scale.set(.018,.34,.018);frame.add(post);}
  seat.castShadow=true;
 };
 const dish=own(new LatheGeometry([[0,.002],[.08,.002],[.13,.015],[.14,.023],[.135,.028],[.1,.015],[0,.012]].map(([x,y])=>new Vector2(x,y)),48));
 const cupGeo=own(new LatheGeometry([[.035,0],[.04,.07],[.038,.075],[.032,.07],[.029,.008]].map(([x,y])=>new Vector2(x,y)),32));
 for(const x of [-2.8,-2.4])mesh('cafe.espresso-cup',cupGeo,cream,[x,1.1,-1.62]);
 for(const [x,z] of [[6,-2],[9,1],[-2,4.2]] as const){
  rod('cafe.table.base',[x,.035,z],.32,.07,dark);rod('cafe.table.stem',[x,.38,z],.045,.7,brass);rod('cafe.table.top',[x,.765,z],.56,.06,stone);
  chair(x-.85,z,Math.PI/2);chair(x+.85,z,-Math.PI/2);
  for(const dx of [-.24,.24]){mesh('cafe.plate',dish,cream,[x+dx,.8,z]);mesh('cafe.cup',cupGeo,cream,[x+dx,.8,z-.25]);box('cafe.cutlery',[x+dx+.17,.809,z],[.012,.008,.18],brass);}
 }
 // Folded refuge textiles, bags and water bottles are meaningful narrative details.
 box('cafe.refuge.bench',[8,.43,4.8],[2.6,.08,.7],wood);
 for(const x of [7,9])box('cafe.refuge.leg',[x,.2,4.8],[.08,.4,.5],dark);
 for(let stack=0;stack<3;stack++)for(let fold=0;fold<3;fold++)round('cafe.refuge.blanket',[7.2+stack*.75,.53+fold*.09,4.8],[.68,.09,.5],stack%2?linen:red,.025);
 sign('ACCUEIL', [8,1.15,4.5],1.7,.32);
 for(const x of [7.3,7.55,7.8]){rod('cafe.water-bottle',[x,.22,5.5],.08,.42,teal);rod('cafe.bottle-cap',[x,.45,5.5],.035,.04,brass);}
 // Quayside balustrade and planting frame the water without blocking the characters.
 for(let x=-12;x<20;x+=2)box('quay.post',[x,.5,-8],[.06,1,.06],dark);
 box('quay.rail',[3,1,-8],[32,.04,.04],dark);
 for(const [x,z] of [[-4,5.5],[10,-4]] as const){rod('cafe.planter',[x,.3,z],.3,.6,red);for(let i=0;i<10;i++){const a=i*2.4;const leaf=mesh('cafe.leaf',ball,teal,[x+Math.cos(a)*.2,.7+(i%3)*.12,z+Math.sin(a)*.2],[.08,.3,.13]);leaf.rotation.z=Math.sin(a)*.6;}}
 for(const [x,z] of [[-2,-1.8],[6,-2]] as const){rod('cafe.pendant.cable',[x,3.4,z],.008,1,brass);rod('cafe.pendant.shade',[x,2.87,z],.22,.15,cream);const l=new PointLight('#ffcb91',9,6,2);l.position.set(x,2.7,z);group.add(l);}
 const fill=new PointLight('#bcd9e0',22,13,2);fill.position.set(6,3,4);group.add(fill);
 // Batch the hundreds of floor flags into three draws; preserve their shared material relief.
 const tileBatches=new Map<Material,Mesh[]>();
 for(const child of [...group.children])if(child instanceof Mesh && child.name==='cafe.tile'){
  const m=child.material as Material;const batch=tileBatches.get(m)??[];batch.push(child);tileBatches.set(m,batch);
 }
 const instances:InstancedMesh[]=[];
 for(const [m,tiles] of tileBatches){const batch=new InstancedMesh(cube,m,tiles.length);batch.name='cafe.floor.tiles';tiles.forEach((tile,i)=>{tile.updateMatrix();batch.setMatrixAt(i,tile.matrix);group.remove(tile);});batch.castShadow=batch.receiveShadow=true;batch.computeBoundingSphere();group.add(batch);instances.push(batch);}
 return {group,dispose(){instances.forEach(i=>i.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();}};
}
