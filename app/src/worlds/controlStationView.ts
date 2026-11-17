import {ACESFilmicToneMapping,BoxGeometry,CanvasTexture,Color,CylinderGeometry,DirectionalLight,Fog,Group,HemisphereLight,Mesh,MeshStandardMaterial,PCFSoftShadowMap,PerspectiveCamera,PlaneGeometry,PointLight,RepeatWrapping,Scene,SRGBColorSpace,Vector3,WebGLRenderer,type BufferGeometry,type Material,type Texture} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createStationActor} from './controlStationActor';
export type ControlStationEvent='ready'|'arrived'|'refused'|'phone-ready'|'opened'|'crossed'|'returned';
export interface ControlStationOptions{onEvent?:(event:ControlStationEvent)=>void}
interface Segment{duration:number;start?:()=>void;update?:(t:number)=>void;end?:()=>void}
/** Persistent actor and actual articulated props; no illustrated background. */
export async function createControlStationView(host:HTMLElement,options:ControlStationOptions={}){
 const doc=host.ownerDocument,win=doc.defaultView!;
 const renderer=new WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(win.devicePixelRatio,1.75));renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=.96;renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.style.cssText='display:block;width:100%;height:100%';canvas.setAttribute('aria-label','Ton personnage au contrôle avant la station');host.append(canvas);
 const scene=new Scene();scene.background=new Color('#8eafb1');scene.fog=new Fog('#8eafb1',25,60);
 const camera=new PerspectiveCamera(43,1,.05,85),cameraLook=new Vector3(0,1,1),cameraOffset=new Vector3(2.2,1.55,3.7);
 const geos=new Set<BufferGeometry>(),mats=new Set<Material>(),textures=new Set<Texture>();
 const material=(color:string,roughness=.82,metalness=0)=>{const m=new MeshStandardMaterial({color,roughness,metalness});mats.add(m);return m;};
 const surface=(base:string,grain:string)=>{const c=doc.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!;x.fillStyle=base;x.fillRect(0,0,256,256);let seed=19;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};x.fillStyle=grain;for(let i=0;i<12000;i++){x.globalAlpha=.05+rand()*.13;x.fillRect(rand()*256,rand()*256,1+rand()*2,1);}x.globalAlpha=1;const tex=new CanvasTexture(c);tex.colorSpace=SRGBColorSpace;tex.wrapS=tex.wrapT=RepeatWrapping;tex.repeat.set(2,2);textures.add(tex);return tex;};
 const stone=material('#a8aca3');stone.map=surface('#a4b1aa','#4e7973');const wall=material('#c7b896');wall.map=surface('#cabd9e','#765b4e');
 const deep=material('#214f50'),trim=material('#18403f',.58,.2),cream=material('#e5d4a5'),brass=material('#b99857',.38,.65),red=material('#803a40'),floor=material('#b0aaa0');floor.map=surface('#aaa99b','#42645e');
 const glass=material('#477c86',.26,.18),black=material('#182d32'),paving=material('#525e5c');
 const mesh=(g:BufferGeometry,m:Material,parent:Group|Scene=scene)=>{geos.add(g);const o=new Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:Material,parent:Group|Scene=scene)=>{const o=mesh(new BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;};
 const round=(w:number,h:number,d:number,r:number,x:number,y:number,z:number,m:Material,parent:Group|Scene=scene)=>{const o=mesh(new RoundedBoxGeometry(w,h,d,3,r),m,parent);o.position.set(x,y,z);return o;};
 const cylinder=(r:number,h:number,x:number,y:number,z:number,m:Material,parent:Group|Scene=scene)=>{const o=mesh(new CylinderGeometry(r,r,h,24),m,parent);o.position.set(x,y,z);return o;};
 const label=(text:string,width:number,height:number,color:string,bg:string)=>{const c=doc.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d')!;x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=color;x.textAlign='center';x.textBaseline='middle';x.font='500 70px sans-serif';x.fillText(text,512,130);const texture=new CanvasTexture(c);texture.colorSpace=SRGBColorSpace;textures.add(texture);const m=material('#ffffff',.8);m.map=texture;return mesh(new PlaneGeometry(width,height),m);};
 box(18,.16,36,0,-.1,-4,paving);box(7.3,.09,24,0,-.015,-2,floor);
 // Individual stone slabs, inset brass guides and edge courses.
 for(let z=-12;z<10;z+=.9)for(let x=-3.3;x<3.5;x+=.9){const dark=(Math.round((z+12)/.9)+Math.round((x+3.3)/.9))%5===0;box(.884,.012,.884,x,.04,z,dark?stone:floor);}
 for(const x of [-2.8,2.8])box(.035,.018,24,x,.055,-2,brass);
 box(.45,4.8,26,-3.8,2.4,-3,wall);box(.45,4.8,26,3.8,2.4,-3,stone);
 for(const x of [-3.55,3.55]){
  box(.10,.65,26,x,.33,-3,deep);box(.15,.07,26,x,.72,-3,brass);box(.25,.18,26,x,4.1,-3,cream);
  for(let z=-12;z<=8;z+=3){box(.28,4.15,.34,x,2.1,z,deep);for(const dz of [-.10,0,.10])box(.045,3.8,.018,x+(x<0?.15:-.15),2.1,z+dz,brass);
   const window=box(.05,2.45,2.42,x+(x<0?.05:-.05),2.28,z+1.5,glass);
   for(const y of [1.1,2.2,3.48])box(.11,.045,2.5,window.position.x,y,z+1.5,cream);
   for(const dz of [.65,1.5,2.35])box(.11,2.5,.035,window.position.x,2.25,z+dz,trim);
  }
 }
 for(let z=-10;z<=6;z+=2){box(7.7,.22,.22,0,4.35,z,deep);for(let x=-3.2;x<=3.3;x+=.75)box(.10,.09,1.8,x,4.4,z-.85,cream);}
 box(7.5,4.8,.4,0,2.4,-13.2,red);for(const x of [-2.3,0,2.3]){box(1.85,3.3,.12,x,1.85,-12.95,trim);box(1.6,2.85,.08,x,1.9,-12.86,glass);for(const dx of [-.4,.4])box(.035,2.9,.1,x+dx,1.9,-12.8,brass);}
 const stationSign=label('MÉTRO   /   LIGNE 04',3.8,.55,'#ecdfb7','#1b4949');stationSign.position.set(0,3.85,-12.87);
 for(const z of [-8,-3,4])for(const x of [-3.15,3.15]){cylinder(.055,2.7,x,1.35,z,trim);const lm=material('#ffe4ad',.4);lm.emissive.set('#ffca78');lm.emissiveIntensity=.8;round(.22,.48,.22,.035,x,2.65,z,lm);box(.32,.05,.32,x,2.92,z,black);box(.32,.05,.32,x,2.39,z,black);}
 for(const z of [-8,4.5]){for(let i=0;i<5;i++)box(.09,.07,1.7,2.65+i*.11,.48,z,red);for(const zz of [z-.65,z+.65])box(.45,.44,.055,2.85,.22,zz,trim);}
 round(.55,1.5,.45,.04,-3.05,.75,3.1,deep);const notice=label('SERVICE DU REGISTRE',1.55,.28,'#e9d6ad','#294d4c');notice.position.set(-2.75,2.2,0);notice.rotation.y=.22;
 const reader=new Group();reader.name='station.reader';scene.add(reader);reader.position.set(-1.52,0,.40);
 round(.40,1.04,.36,.045,0,.52,0,trim,reader);box(.5,.06,.48,0,.03,0,brass,reader);const readerTop=round(.40,.10,.37,.025,0,1.10,.02,black,reader);readerTop.rotation.x=-.25;
 const screenCanvas=doc.createElement('canvas');screenCanvas.width=512;screenCanvas.height=256;const sx=screenCanvas.getContext('2d')!,screenTex=new CanvasTexture(screenCanvas);screenTex.colorSpace=SRGBColorSpace;textures.add(screenTex);
 const screenMat=material('#ffffff',.45);screenMat.map=screenTex;screenMat.emissive.set('#c6ddbd');screenMat.emissiveMap=screenTex;screenMat.emissiveIntensity=.35;
 const screen=mesh(new PlaneGeometry(.30,.15),screenMat,reader);screen.position.set(0,1.16,.065);screen.rotation.x=-Math.PI/2+.25;
 const updateReader=(text:string,allowed=false)=>{sx.fillStyle='#142a2b';sx.fillRect(0,0,512,256);sx.fillStyle=allowed?'#c4e4aa':'#edbd76';sx.font='500 47px sans-serif';sx.textAlign='center';sx.fillText(text,256,140);screenTex.needsUpdate=true;host.dataset['reader']=text;};updateReader('PRÉSENTER');
 const gate=new Group();gate.name='station.barrier';scene.add(gate);gate.position.set(1.8,0,0);round(.30,1.08,.34,.04,0,.54,0,trim,gate);cylinder(.09,.13,0,1.14,0,brass,gate);
 const arm=new Group();arm.name='station.barrier.arm';arm.position.set(0,.96,0);gate.add(arm);const axle=mesh(new CylinderGeometry(.14,.14,.39,24),brass,gate);axle.rotation.x=Math.PI/2;axle.position.y=.96;
 for(let i=0;i<10;i++)round(.34,.105,.11,.012,-.17-i*.34,0,0,i%2?black:cream,arm);
 for(const x of [-3.5,2.15]){box(x<0?1.6:1.35,.07,.06,x<0?-2.7:2.8,.9,0,brass);for(let dx=-.5;dx<.6;dx+=.25)cylinder(.014,.9,(x<0?-2.7:2.8)+dx,.45,0,trim);}
 const sun=new DirectionalLight('#ffedcf',3.1);sun.position.set(-6,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:10,bottom:-10,near:.5,far:30});sun.shadow.normalBias=.022;sun.shadow.bias=-.0001;scene.add(sun);scene.add(new HemisphereLight('#c4d8e0','#555160',1.8));const bounce=new DirectionalLight('#c0dad5',.8);bounce.position.set(5,3,7);scene.add(bounce);
 for(const z of [-7,2]){const lamp=new PointLight('#ffd8a0',5,7,2);lamp.position.set(-3,2.6,z);scene.add(lamp);}
 let disposed=false,paused=false,raf=0,last=0,moving=false,started=false;let segments:Segment[]=[],segmentIndex=0,elapsed=0,complete:(()=>void)|null=null,active:Promise<void>|null=null;
 const emit=(event:ControlStationEvent)=>{if(!disposed){host.dataset['event']=event;options.onEvent?.(event);}};
 let actor:Awaited<ReturnType<typeof createStationActor>>;
 try{actor=await createStationActor();}catch(error){renderer.dispose();canvas.remove();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());throw error;}
 scene.add(actor.root);cameraLook.set(actor.root.position.x+.12,.98,actor.root.position.z-.2);let armAmount=0;
 const setArm=(t:number)=>{armAmount=t;arm.rotation.z=-Math.PI*.48*t;host.dataset['barrier']=t>=.999?'open':t<=0?'closed':'opening';};setArm(0);
 const finish=()=>{moving=false;segments=[];segmentIndex=0;started=false;elapsed=0;const done=complete;complete=null;active=null;done?.();};
 const startSegment=()=>{const s=segments[segmentIndex];if(!s){finish();return;}started=true;elapsed=0;s.start?.();s.update?.(0);};
 const skip=()=>{if(!active)return;for(;segmentIndex<segments.length;segmentIndex++){const s=segments[segmentIndex]!;if(!started)s.start?.();s.update?.(1);s.end?.();started=false;}actor.update(1/30,false);finish();};
 const run=(parts:Segment[]):Promise<void>=>{if(disposed)return Promise.resolve();if(active)return active;segments=parts;segmentIndex=0;started=false;active=new Promise(resolve=>{complete=resolve;});const promise=active;startSegment();return promise;};
 const walk=(to:Vector3,duration:number):Segment=>{const from=new Vector3();return{duration,start:()=>{from.copy(actor.root.position);moving=true;actor.setGesture('rest');},update:t=>{const p=new Vector3().lerpVectors(from,to,t);if(from.z>0&&p.z<.30&&armAmount<.95)p.z=.30;actor.root.position.copy(p);const d=to.clone().sub(from);if(d.lengthSq()>.0001)actor.setHeading(Math.atan2(d.x,d.z),.04);},end:()=>{moving=false;}};};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=camera.aspect<.9?59:43;camera.updateProjectionMatrix();renderer.render(scene,camera);};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const tick=(now:number)=>{if(disposed)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!paused&&!doc.hidden){if(active){const s=segments[segmentIndex];if(s){elapsed+=dt;const t=Math.min(1,elapsed/s.duration);s.update?.(t);if(t===1){s.end?.();segmentIndex++;started=false;startSegment();}}}actor.update(dt,moving);}const desired=new Vector3(actor.root.position.x+.12,.98,actor.root.position.z-.2);if(!paused&&!doc.hidden){cameraLook.lerp(desired,.06);const readerInsert=actor.root.userData['heldProp']==='ticket';cameraOffset.lerp(readerInsert?new Vector3(-1.8,1.65,2.7):new Vector3(2.2,1.55,3.7),1-Math.exp(-dt*5));}camera.position.copy(cameraLook).add(cameraOffset);camera.lookAt(cameraLook);renderer.render(scene,camera);host.dataset['heldProp']=String(actor.root.userData['heldProp']??'none');host.dataset['contactError']=Number(actor.root.userData['contactError']??0).toFixed(3);host.dataset['playerX']=actor.root.position.x.toFixed(3);host.dataset['playerZ']=actor.root.position.z.toFixed(3);host.dataset['segment']=active?String(segmentIndex):'idle';raf=win.requestAnimationFrame(tick);};raf=win.requestAnimationFrame(tick);emit('ready');
 return {
  approach:()=>run([walk(new Vector3(-1.10,0,.78),2.8),{duration:.4,start:()=>emit('arrived'),update:()=>actor.setHeading(Math.PI,.04)},{duration:1.5,start:()=>{actor.setGesture('ticket');updateReader('LECTURE…');}},{duration:.65,start:()=>{updateReader('REFUSÉ');emit('refused');}},{duration:1,start:()=>actor.setGesture('phone'),end:()=>emit('phone-ready')}]),
  requestGuarantee:()=>run([{duration:.75,start:()=>actor.setGesture('phone'),end:()=>{updateReader('GARANTIE',true);emit('phone-ready');}}]),
  authorize:()=>run([{duration:.8,start:()=>{actor.setGesture('phone');actor.setAccepted();updateReader('AUTORISÉ',true);}},{duration:1.3,update:t=>setArm(t),end:()=>{setArm(1);emit('opened');}},{duration:.5,start:()=>actor.setGesture('rest')},walk(new Vector3(-.55,0,-2.7),2.5),{duration:.4,start:()=>actor.setGesture('phone'),end:()=>emit('crossed')}]),
  goHome:()=>run([{duration:.65,start:()=>actor.setGesture('rest'),update:()=>actor.setHeading(0,.04)},walk(new Vector3(-.6,0,5.1),2.8),{duration:.4,start:()=>actor.setGesture('phone'),end:()=>emit('returned')}]),
  pause:(value:boolean)=>{paused=value;host.dataset['paused']=String(value);},skip,
  dispose:()=>{if(disposed)return;disposed=true;finish();win.cancelAnimationFrame(raf);observer.disconnect();actor.dispose();sun.shadow.dispose();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();},
 };
}
