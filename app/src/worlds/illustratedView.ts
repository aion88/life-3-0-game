import {createConsequenceVisual} from './consequenceVisual';
import type {StoryConsequence} from './consequences';
import {castMember,castMembers} from './cast';
import {applyCastAppearance,createRobotStudent} from './castAppearance';
import {createPlateLoader} from './plateLoader';
import { ACESFilmicToneMapping, PCFSoftShadowMap, ShadowMaterial, PlaneGeometry, MeshStandardMaterial, AnimationMixer, Box3, CanvasTexture, CircleGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, OrthographicCamera, Plane, Raycaster, Scene, Vector2, Vector3, WebGLRenderer, type AnimationAction, type Object3D, type Texture } from 'three';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { applyPlayerOutfit } from '../street/render/characters/playerOutfit';
import type { JourneyView } from './view';
import type { Journey } from './types';
import visuals from './visuals.json';
import { illustratedLocations, plateStyle, plateUrl, type Plate } from './illustrationAssets';
import './illustratedView.css';

export async function createIllustratedJourneyView(host: HTMLElement, journey: Pick<Journey, 'id' | 'title' | 'locations'> | {id:'w10';title:string;locations:{id:string;name:string}[]}): Promise<JourneyView> {
  const doc = host.ownerDocument, places = illustratedLocations[journey.id]!;
  const box = doc.createElement('div'); box.className = 'journey-view illustrated-view'; box.dataset['world'] = journey.id; box.dataset['photographic']='true';
  const frame = doc.createElement('div'); frame.className = 'iv-frame';
  const motion = doc.createElement('div'); motion.className = 'iv-motion'; frame.append(motion); box.append(frame); host.prepend(box);
  const background = doc.createElement('div'); background.className = 'iv-background'; background.setAttribute('role','img'); motion.append(background);
  const headAnchor = doc.createElement('div'); headAnchor.className = 'journey-head-anchor iv-head'; headAnchor.hidden = true; motion.append(headAnchor);
  const mood = doc.createElement('aside'); mood.className = 'iv-mood'; mood.setAttribute('aria-label','État émotionnel'); headAnchor.append(mood);
  const notice = doc.createElement('p'); notice.className = 'iv-loading'; notice.textContent = 'Ouverture du lieu…'; notice.setAttribute('role','status'); box.append(notice);
  const renderer = new WebGLRenderer({alpha:true,antialias:true}); renderer.setClearColor(0,0); renderer.toneMapping=ACESFilmicToneMapping; renderer.toneMappingExposure=1.12; renderer.shadowMap.enabled=true; renderer.shadowMap.type=PCFSoftShadowMap; renderer.setPixelRatio(Math.min(devicePixelRatio,2)); motion.prepend(renderer.domElement);
  const scene = new Scene(), camera = new OrthographicCamera(-8,8,4.5,-4.5,.1,100); camera.position.set(0,7,12); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  const p = journey.id === 'w10' ? {sun:'#f2d2ad',sky:'#95b1c6',ground:'#233d4f',body:'npc.marlene'} : visuals[journey.id];
  const fill=new HemisphereLight(p.sky,p.ground,1.4); scene.add(fill); const light = new DirectionalLight(p.sun,3.1); light.position.set(-4,8,5); light.castShadow=true; light.shadow.mapSize.set(1024,1024); Object.assign(light.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40}); light.shadow.normalBias=.035; scene.add(light);
  const rim=new DirectionalLight(p.sky,.65);rim.position.set(4,5,-5);scene.add(rim);
  const receiver=new Mesh(new PlaneGeometry(60,60),new ShadowMaterial({opacity:.22,depthWrite:false}));receiver.rotation.x=-Math.PI/2;receiver.receiveShadow=true;scene.add(receiver);
  const ray = new Raycaster(), floor = new Plane(new Vector3(0,1,0),0);
  const point = (x:number,y:number):Vector3 => {ray.setFromCamera(new Vector2(x*2-1,1-y*2),camera);return ray.ray.intersectPlane(floor,new Vector3())!;};
  const heightProbe=doc.createElement('div');heightProbe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--iv-portrait-height,45dvh)';box.append(heightProbe);
  const resize = ():void => {
    const w=host.clientWidth,h=host.clientHeight,portrait=w<=760&&h>550;
    const portraitHeight=heightProbe.getBoundingClientRect().height||Math.min(h*.45,520);
    const width=portrait?Math.max(w,portraitHeight*16/9):Math.min(w,h*16/9);
    frame.style.width=`${width}px`;frame.style.height=`${width*9/16}px`;
    // Keep a 16:9 stage in portrait and crop around both actors; never stretch the plate.
    const spots=places[box.dataset['location']??'']?.actorSpots??[[.60,.80],[.74,.76]];
    const focus=(spots[0]![0]+spots[1]![0])/2;
    const shift=portrait?Math.max((w-width)/2,Math.min((width-w)/2,(.5-focus)*width)):0;
    frame.style.transform=`translateX(${shift}px)`;box.dataset['portrait']=String(portrait);renderer.setSize(width,width*9/16);
  };
  const observer = new ResizeObserver(resize); observer.observe(host);observer.observe(heightProbe);resize();
  const readingObserver=new MutationObserver(resize);const owner=host.closest('.journey,.episode');if(owner)readingObserver.observe(owner,{attributes:true,attributeFilter:['data-observing']});
  const consequenceVisual=createConsequenceVisual(box);
  let companionVisible=false;
  const castCache=new Map<string,{body:Object3D;mixer:AnimationMixer;clips:Map<string,AnimationAction>}>();
  const guestTemplates:{body:Object3D;clips:import('three').AnimationClip[]}[]=[];
  const guests:{actor:Group;mixer:AnimationMixer;from:Vector3;to:Vector3;elapsed:number;walk:AnimationAction|undefined;idle:AnimationAction|undefined}[]=[];
  const actors:Object3D[] = [], mixers:AnimationMixer[] = [], actions:Map<string,AnimationAction>[] = [], shadows:Mesh[] = [];
  const geos = new Set<import('three').BufferGeometry>(), mats = new Set<import('three').Material>(), textures = new Set<Texture>();
  const captureResources = (root:Object3D):void => root.traverse(o=>{if(o instanceof Mesh){geos.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material]){mats.add(mat);for(const t of Object.values(mat))if(t&&typeof t==='object'&&'isTexture' in t)textures.add(t as Texture);}}});
  const canvas=doc.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!,g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(15,24,19,.45)');g.addColorStop(1,'rgba(15,24,19,0)');c.fillStyle=g;c.fillRect(0,0,64,64);const shadowMap=new CanvasTexture(canvas);textures.add(shadowMap);
  let paused=false;let pausedAnimations:Animation[]=[];
  const pause=(value:boolean):void=>{if(paused===value)return;paused=value;box.dataset['paused']=String(value);if(value){pausedAnimations=(box.getAnimations?.({subtree:true})??[]).filter(a=>a.playState==='running');pausedAnimations.forEach(a=>a.pause());}else{pausedAnimations.forEach(a=>a.play());pausedAnimations=[];}};
  let disposed=false,raf=0,last=0,current='',resolveArrival:(()=>void)|null=null;
  let travel:{destination:string;phase:'departure'|'arrival';from:Vector3;to:Vector3;elapsed:number;duration:number;onLocation?:(()=>void)|undefined}|null=null;
  const travelCaption=doc.createElement('p');travelCaption.className='iv-loading';travelCaption.hidden=true;travelCaption.setAttribute('role','status');box.append(travelCaption);
  const actorSpots = (): [[number, number], [number, number]] => places[current]?.actorSpots ?? [[.60,.80],[.74,.76]];
  // Projected height as a fraction of the plate, calibrated to furniture at each actor's feet.
  const actorHeight = (i:number):number => (places[current]?.actorHeights?.[i] ?? .36) * 9 * Math.hypot(7,12) / 12;
  const fitActors = ():void => actors.forEach((actor,i)=>{actor.scale.setScalar(actorHeight(i));actor.position.copy(point(...actorSpots()[i]!));shadows[i]?.scale.set(actorHeight(i)/2.15,actorHeight(i)/2.15*1.5,1);});
  let reacting=0, anchorAt=0;
  let gestureWalk:{from:Vector3;to:Vector3;left:number}|null=null;
  let companionWalk:{from:Vector3;to:Vector3;left:number}|null=null;let companionEffect='';
  const reduced=doc.defaultView?.matchMedia('(prefers-reduced-motion:reduce)').matches??false;
  const play=(i:number,name:string):void=>{const map=actions[i];if(!map)return;const next=map.get(name)??map.get('idle');if(!next)return;for(const a of map.values())if(a!==next)a.fadeOut(.2);next.reset().fadeIn(.2).play();};
  const finish=():void=>{travel=null;gestureWalk=null;box.dataset['performing']='false';box.dataset['travelPhase']='idle';travelCaption.hidden=true;play(0,'idle');const done=resolveArrival;resolveArrival=null;done?.();};
  const dispose=():void=>{if(disposed)return;disposed=true;finish();cancelAnimationFrame(raf);observer.disconnect();readingObserver.disconnect();consequenceVisual.dispose();mixers.forEach(m=>m.stopAllAction());castCache.forEach(c=>c.mixer.stopAllAction());guests.forEach(g=>g.mixer.stopAllAction());captureResources(scene);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());light.shadow.dispose();renderer.dispose();renderer.forceContextLoss();box.remove();};
  captureResources(receiver);
  const finishMaterials=(body:Object3D):void=>body.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof MeshStandardMaterial){material.roughness=Math.max(material.roughness,.78);material.metalness=Math.min(material.metalness,.12);}}});
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const bodyLoads=new Map<string,ReturnType<GLTFLoader['loadAsync']>>();
  const loadBody=(id:string)=>{let promise=bodyLoads.get(id);if(!promise){promise=loader.loadAsync(`${import.meta.env.BASE_URL}worlds/w10/characters/char.${id}.glb`);bodyLoads.set(id,promise);}return promise;};
  const plates=createPlateLoader();let plateRequest=0;let shownPlate:Plate|undefined;let warmed=false;
  const noticeText=doc.createElement('span'),retry=doc.createElement('button');retry.type='button';retry.textContent='Réessayer le décor';retry.dataset['ui']='retry-plate';
  notice.replaceChildren(noticeText,retry);notice.style.zIndex='4';notice.style.pointerEvents='auto';retry.hidden=true;
  const renderPlate=(plate:Plate):void=>{
    shownPlate=plate;const token=++plateRequest,url=plateUrl(plate);
    const apply=():void=>{if(disposed||token!==plateRequest)return;background.style.cssText=plateStyle(plate);notice.hidden=true;box.dataset['imageState']='ready';};
    if(plates.ready(url)){apply();return;}
    background.style.cssText='background:linear-gradient(135deg,#203d43,#101e27)';notice.hidden=false;noticeText.textContent='Ouverture du lieu… ';retry.hidden=true;box.dataset['imageState']='loading';
    void plates.load(url).then(apply,()=>{if(disposed||token!==plateRequest)return;box.dataset['imageState']='fallback';noticeText.textContent='Décor indisponible. Tu peux continuer à jouer. ';retry.hidden=false;});
  };
  retry.addEventListener('click',()=>{if(shownPlate)renderPlate(shownPlate);});
  const warmNext=():void=>{if(warmed)return;warmed=true;void Promise.allSettled(Object.values(places).map(p=>plates.load(plateUrl(p))));};
  try {
    for(const [i,id] of ['player',p.body].entries()){
      const gltf=await loadBody(id);const body=cloneRig(gltf.scene);captureResources(body);if(i===0)applyPlayerOutfit(body);finishMaterials(body);captureResources(body);
      const bounds=new Box3().setFromObject(body);const normalize=1/(bounds.max.y-bounds.min.y);body.scale.multiplyScalar(normalize);body.position.y-=bounds.min.y*normalize;
      // A parent keeps placement and scale independent of the animation's root tracks.
      guestTemplates.push({body,clips:gltf.animations});
      const actor=new Group();actor.add(body);actor.rotation.y=i?-1.4:1.4;scene.add(actor);actors.push(actor);
      const mixer=new AnimationMixer(body);mixers.push(mixer);actions.push(new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)])));play(i,i?'talk':'idle');
      if(i===1)castCache.set(id,{body,mixer,clips:actions[i]!});
      const shadow=new Mesh(new CircleGeometry(.45,32),new MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=1.5;scene.add(shadow);shadows.push(shadow);
    }
    await Promise.all(castMembers(journey.id).map(async person=>{
      const gltf=person.body==='robot.student'?createRobotStudent():await loadBody(person.body);
      const body='scene' in gltf?cloneRig(gltf.scene):gltf.body;
      if(person.body!=='robot.student')applyCastAppearance(body,person);
      finishMaterials(body);captureResources(body);
      const bounds=new Box3().setFromObject(body),scale=1/(bounds.max.y-bounds.min.y);body.scale.multiplyScalar(scale);body.position.y-=bounds.min.y*scale;
      const mixer=new AnimationMixer(body),clips=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));castCache.set(person.id,{body,mixer,clips});
    }));
    castCache.delete(p.body);
  }catch(error){dispose();throw error;}
  const setSpeaker=(speaker:string):void=>{
    const person=castMember(journey.id,speaker);companionVisible=Boolean(person);
    box.dataset['speaker']=person?.id??'offscreen';box.dataset['speakerBody']=person?.body??'';
    if(person){const next=castCache.get(person.id)!;if(actors[1]!.children[0]!==next.body){mixers[1]!.stopAllAction();actors[1]!.clear();actors[1]!.add(next.body);mixers[1]=next.mixer;actions[1]=next.clips;play(1,'talk');}}
    const insert=frame.dataset['shot']==='counter'&&journey.id==='w10'&&current==='unit.9-B';actors[1]!.visible=companionVisible&&!insert;shadows[1]!.visible=companionVisible&&!insert;
  };
  const setConsequence=(effect:StoryConsequence|null):void=>{
    consequenceVisual.set(effect);
    const key=`${box.dataset['speaker']}:${current}:${effect?.companion??''}`;
    if(key===companionEffect)return;companionEffect=key;
    const actor=actors[1];if(!actor)return;
    const spot=actorSpots()[1],to=effect?.companion==='away'?point(1.18,spot[1]):point(...spot);
    if(reduced||actor.position.distanceTo(to)<.02){companionWalk=null;actor.position.copy(to);actor.rotation.y=-1.4;play(1,'talk');return;}
    companionWalk={from:actor.position.clone(),to,left:.9};actor.rotation.y=Math.atan2(to.x-actor.position.x,to.z-actor.position.z);play(1,'walk');
  };
  const setVisitors=(count:number):void=>{
    for(const guest of guests){guest.mixer.stopAllAction();scene.remove(guest.actor);}guests.length=0;
    for(let i=0;i<Math.min(6,count);i++){
      const visitorBodies=[...castCache.values()];const visitor=visitorBodies[i%visitorBodies.length]!;const body=cloneRig(visitor.body),actor=new Group();actor.add(body);actor.scale.setScalar(actorHeight(1));actor.rotation.y=-1.2;
      const spots:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[.59,.70],[.65,.69],[.71,.70],[.26,.76],[.32,.78],[.38,.74]];const to=point(...spots[i]!),from=point(1.08+i*.04,.69);actor.position.copy(reduced?to:from);scene.add(actor);
      const mixer=new AnimationMixer(body),clips=new Map([...visitor.clips].map(([name,action])=>[name,mixer.clipAction(action.getClip())]));const walk=clips.get('walk'),idle=clips.get('idle');(reduced?idle:walk??idle)?.play();
      const shadow=new Mesh(new CircleGeometry(.45,32),new MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.01;shadow.scale.y=1.5;actor.add(shadow);geos.add(shadow.geometry);mats.add(shadow.material);
      guests.push({actor,mixer,from,to,elapsed:reduced?2:0,walk,idle});
    }
  };
  const setFraming:NonNullable<JourneyView['setFraming']>=(shot)=>{
    const insert = journey.id === 'w10' && current === 'unit.9-B' && shot === 'counter';
    actors.forEach((a,i)=>{a.visible=!insert&&(i===0||companionVisible);}); shadows.forEach((a,i)=>{a.visible=!insert&&(i===0||companionVisible);}); headAnchor.style.visibility=insert?'hidden':'';
    if (current) renderPlate(insert ? places['dinner.insert']! : places[current]!);
frame.dataset['shot']=shot;motion.style.transition=reduced?'none':'transform 1600ms ease-in-out';motion.style.transformOrigin=shot==='counter'?'40% 45%':shot==='blankets'?'68% 78%':`${actorSpots()[0][0]*100}% ${actorSpots()[0][1]*100-(places[current]?.actorHeights?.[0] ?? .36)*50}%`;motion.style.transform=shot==='wide'?'scale(1)':shot==='portrait'?'scale(1.14)':'scale(1.09)';};
  const applyLocation=(location:string):void=>{const plate=places[location];if(!plate)throw new Error(`Illustration absente: ${journey.id}/${location}`);current=location;companionEffect='';companionWalk=null;fitActors();box.dataset['location']=location;box.dataset['plate']=`${plate.atlas}:${plate.tile}`;resize();background.setAttribute('aria-label',journey.locations.find(p=>p.id===location)?.name??location);setFraming('wide');warmNext();};
  const show=(location:string):void=>{if(disposed)return;finish();applyLocation(location);};
  const enterDestination=():void=>{
    if(!travel)return;
    const destination=travel.destination,onLocation=travel.onLocation;applyLocation(destination);onLocation?.();
    const spot=actorSpots()[0],to=point(...spot),from=point(Math.max(.08,spot[0]-.12),spot[1]);
    travel={destination,phase:'arrival',from,to,elapsed:0,duration:1.1};
    actors[0]!.position.copy(from);actors[0]!.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);
    box.dataset['travelPhase']='arrival';play(0,'walk');
  };
  const perform=async(location:string,_inventory:readonly string[]=[],onLocation?:()=>void):Promise<void>=>{
    void _inventory;
    if(disposed)return;
    if(!places[location])throw new Error(`Illustration absente: ${journey.id}/${location}`);
    // Staying in a room must preserve the character's actual location and framing.
    if(location===current){if(travel)finish();onLocation?.();return;}
    finish();
    if(!current||reduced){applyLocation(location);onLocation?.();return;}
    box.dataset['performing']='true';box.dataset['travelPhase']='preparing';
    travelCaption.textContent=`En route vers ${journey.locations.find(p=>p.id===location)?.name??location}`;travelCaption.hidden=false;
    // Warm the destination while the current scene remains visible; skip never waits on network.
    void plates.load(plateUrl(places[location]!)).catch(()=>undefined);
    const from=actors[0]!.position.clone(),spot=actorSpots()[0],to=point(Math.min(.94,spot[0]+.12),spot[1]);
    gestureWalk=null;reacting=0;
    travel={destination:location,phase:'departure',from,to,elapsed:0,duration:1.1,onLocation};
    actors[0]!.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);
    box.dataset['travelPhase']='departure';play(0,'walk');
    return new Promise<void>(resolve=>{resolveArrival=resolve;});
  };
  const skip=():void=>{if(travel){const destination=travel.destination,onLocation=travel.onLocation;applyLocation(destination);onLocation?.();}finish();};
  const tick=(now:number):void=>{if(disposed)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!doc.hidden&&!paused){if(reacting>0){reacting=Math.max(0,reacting-dt);if(reacting===0)play(0,'idle');}mixers.forEach(m=>m.update(dt));for(const guest of guests){guest.mixer.update(dt);if(guest.elapsed<1.2){guest.elapsed=Math.min(1.2,guest.elapsed+dt);guest.actor.position.lerpVectors(guest.from,guest.to,guest.elapsed/1.2);if(guest.elapsed===1.2){guest.walk?.fadeOut(.2);guest.idle?.reset().fadeIn(.2).play();guest.actor.rotation.y=-.7;}}}if(companionWalk){companionWalk.left=Math.max(0,companionWalk.left-dt);actors[1]!.position.lerpVectors(companionWalk.from,companionWalk.to,1-companionWalk.left/.9);if(!companionWalk.left){companionWalk=null;actors[1]!.rotation.y=-1.4;play(1,'talk');}}if(gestureWalk){gestureWalk.left=Math.max(0,gestureWalk.left-dt);actors[0]!.position.lerpVectors(gestureWalk.from,gestureWalk.to,1-gestureWalk.left/.7);if(!gestureWalk.left){gestureWalk=null;play(0,'idle');}}if(travel){travel.elapsed=Math.min(travel.duration,travel.elapsed+dt);actors[0]!.position.lerpVectors(travel.from,travel.to,travel.elapsed/travel.duration);if(travel.elapsed===travel.duration){if(travel.phase==='departure')enterDestination();else finish();}}actors.forEach((a,i)=>shadows[i]!.position.set(a.position.x,.01,a.position.z));const head=actors[0]!.position.clone().add(new Vector3(0,actors[0]!.scale.y+.16,0)).project(camera);headAnchor.style.left=`${(head.x+1)*50}%`;headAnchor.style.top=`${(1-head.y)*50}%`;if(now-anchorAt>100){anchorAt=now;const speaker=actors[1]!.position.clone().add(new Vector3(0,actorHeight(1),0)).project(camera);const rect=motion.getBoundingClientRect();const owner=host.closest<HTMLElement>('.journey,.episode');if(owner){const parent=owner.getBoundingClientRect();owner.style.setProperty('--talk-x',`${rect.left-parent.left+(speaker.x+1)*rect.width/2}px`);owner.style.setProperty('--talk-y',`${rect.top-parent.top+(1-speaker.y)*rect.height/2}px`);}}renderer.render(scene,camera);}raf=requestAnimationFrame(tick);};
  raf=requestAnimationFrame(tick);box.dataset['ready']='true';
  return {pause,setConsequence,setSpeaker,setVisitors,moveTo:(x,y)=>{if(disposed||!actors[0])return;const to=point(x,y);actors[0].scale.setScalar(actorHeight(0)*y/actorSpots()[0][1]);if(reduced){actors[0].position.copy(to);return;}gestureWalk={from:actors[0].position.clone(),to,left:.7};actors[0].rotation.y=Math.atan2(to.x-actors[0].position.x,to.z-actors[0].position.z);play(0,'walk');},react:()=>{if(!reduced){reacting=1.2;play(0,'talk');play(1,'talk');}},show:(location)=>show(location),perform,skip,setEmotion:(label,tone,detail)=>{headAnchor.hidden=!label;mood.textContent=label;mood.title=detail;mood.style.borderColor=['success','hope'].includes(tone)?'#9bc3a2':tone==='failure'?'#db8e70':'#ddbe7e';},setFraming,setPhotographic:(enabled)=>{box.dataset['photographic']=String(enabled);motion.style.filter=enabled?'':'saturate(.72) contrast(.92)';},dispose};
}
