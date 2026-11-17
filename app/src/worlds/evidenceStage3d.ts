import { AmbientLight, BoxGeometry, CanvasTexture, DirectionalLight, Group, Mesh, MeshStandardMaterial, OrthographicCamera, PCFSoftShadowMap, PlaneGeometry, Scene, SphereGeometry, SRGBColorSpace, WebGLRenderer } from 'three';
import type { EvidenceDeskState } from './evidenceDeskState';
/** Compact original 3D set; material colours and real cast shadows carry the composition. */
export function createEvidenceStage3d(host: HTMLElement) {
 let renderer: WebGLRenderer;
 try { renderer=new WebGLRenderer({antialias:true,alpha:true}); } catch { return null; }
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFSoftShadowMap;renderer.outputColorSpace=SRGBColorSpace;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);host.dataset['renderer']='webgl';
 const scene=new Scene();const camera=new OrthographicCamera(-12,12,5,-5,.1,100);camera.position.set(7,5.8,24);camera.lookAt(0,2.8,0);
 const materials:MeshStandardMaterial[]=[],geometries:(BoxGeometry|SphereGeometry|PlaneGeometry)[]=[];
 const mat=(color:string)=>{const m=new MeshStandardMaterial({color,roughness:.92});materials.push(m);return m;};
 const teal=mat('#087e7f'),blue=mat('#164e82'),shadow=mat('#102d56'),cream=mat('#f3dfa4'),glass=mat('#38aab7'),gold=mat('#ffc659'),ground=mat('#c4aa7f'),skin=mat('#bb8968'),beige=mat('#eee0b8'),jean=mat('#315c9c');
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:MeshStandardMaterial,parent:Scene|Group=scene)=>{const g=new BoxGeometry(w,h,d);geometries.push(g);const mesh=new Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const sphere=(radius:number,x:number,y:number,z:number,m:MeshStandardMaterial,parent:Scene|Group)=>{const g=new SphereGeometry(radius,12,8);geometries.push(g);const mesh=new Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 box(100,.15,150,0,-.12,-3,ground);
 // City beyond the courtyard, with individually composed bands and windows.
 const skyline=[[-15,9,-9,blue],[-11,8,-12,teal],[-7,11,-15,blue],[7,8,-13,teal],[12,12,-12,blue],[16,9,-8,teal]] as const;
 for(const [x,h,z,m] of skyline){box(3.3,h,3.8,x,h/2,z,m);for(let y=1;y<h;y+=1.1){box(3.48,.1,3.95,x,y,z,cream);for(let dx=-1;dx<=1;dx+=1)box(.35,.55,.06,x+dx,y+.43,z+1.94,glass);}}
 // Assembly entrance: framed glass, monumental flutes, recessed public noticeboard.
 box(15,5,3.6,0,2.5,-2,teal);box(15.5,.35,4,0,5.1,-1.9,cream);box(15.6,.18,4.1,0,4.85,-1.9,shadow);
 box(15.2,.55,.3,0,4.35,.02,teal);
 box(5.1,3.2,.15,1,2.05,-.13,shadow);box(4.7,2.95,.12,1,2.08,-.01,glass);
 box(.13,3.1,.22,1,2.05,.12,shadow);box(4.9,.12,.22,1,2.05,.12,shadow);
 for(const x of [-1.65,3.65]){box(.28,3.5,.4,x,2.05,.04,cream);for(const dx of [-.08,.08])box(.03,3.4,.05,x+dx,2.05,.27,gold);}
 box(5.8,.18,1.3,1,.16,.45,cream);box(6.1,.12,1.6,1,.03,.65,blue);
 for(const x of [-2.2,4.2]){box(.18,.75,.18,x,2.55,.15,gold);box(.3,.05,.3,x,2.95,.15,shadow);}
 const textureCanvas=host.ownerDocument.createElement('canvas');textureCanvas.width=900;textureCanvas.height=430;const ctx=textureCanvas.getContext('2d')!;
 const texture=new CanvasTexture(textureCanvas);texture.colorSpace=SRGBColorSpace;
 const screenMat=new MeshStandardMaterial({map:texture,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:.5,roughness:1});materials.push(screenMat);
 box(3.9,2.2,.18,-5,2.45,.1,shadow);box(3.7,2,.02,-5,2.45,.21,screenMat);
 const signCanvas=host.ownerDocument.createElement('canvas');signCanvas.width=1400;signCanvas.height=100;const signCtx=signCanvas.getContext('2d')!;signCtx.fillStyle='#0f817e';signCtx.fillRect(0,0,1400,100);signCtx.fillStyle='#f3dfa4';signCtx.textAlign='center';signCtx.font='36px sans-serif';signCtx.fillText('M A I S O N   D E S   A S S E M B L É E S',700,64);
 const signTex=new CanvasTexture(signCanvas);signTex.colorSpace=SRGBColorSpace;const signMat=new MeshStandardMaterial({map:signTex,roughness:1});materials.push(signMat);box(13,.65,.02,0,4.35,.2,signMat);
 // Barrier stays closed in all three outcomes; appeal only starts human review.
 box(.35,1.1,.35,5.8,.55,1.8,shadow);box(8.2,.16,.16,1.85,1.05,1.8,cream);
 for(let x=-2;x<6;x+=.8)box(.4,.17,.17,x,1.05,1.8,shadow);
 const lamp=sphere(.13,5.8,1.25,1.8,gold,scene);
 box(.16,.45,.12,5.9,3.65,.22,shadow);const lens=box(.6,.22,.22,5.65,3.87,.4,cream);lens.rotation.y=-.3;
 const person=(x:number,z:number,coat:MeshStandardMaterial)=>{const g=new Group();g.position.set(x,0,z);scene.add(g);sphere(.13,0,1.46,0,skin,g);box(.4,.53,.22,0,1.06,0,coat,g);box(.13,.64,.15,-.11,.47,0,jean,g);box(.13,.64,.15,.11,.47,0,jean,g);box(.13,.49,.13,-.27,1.02,0,skin,g);box(.13,.49,.13,.27,1.02,0,skin,g);box(.17,.1,.29,-.11,.1,.06,shadow,g);box(.17,.1,.29,.11,.1,.06,shadow,g);return g;};
 person(1.1,3.4,beige);const passer=person(-5.9,2.3,mat('#bb593d'));
 const sun=new DirectionalLight('#fff3d2',3.6);sun.position.set(-8,14,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:18,bottom:-16,near:.1,far:60});sun.shadow.normalBias=.025;scene.add(sun);scene.add(new AmbientLight('#8ab3f0',1.35));
 const reduced=host.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');let disposed=false,frame=0,lastFrame=0,publicCloseup=false;
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;const width=publicCloseup?(aspect<2.5?5.5:10):(aspect<2.5?23:30);if(publicCloseup){camera.position.set(-2,4.1,18);camera.lookAt(-5,2.45,.2);}else{camera.position.set(7,5.8,24);camera.lookAt(0,2.8,0);}camera.left=-width/2;camera.right=width/2;camera.top=width/aspect/2;camera.bottom=-width/aspect/2;camera.updateProjectionMatrix();renderer.render(scene,camera);};
 const observer=new ResizeObserver(resize);observer.observe(host);
 const tick=(time:number)=>{if(disposed)return;if(time-lastFrame<33){frame=requestAnimationFrame(tick);return;}lastFrame=time;if(!reduced.matches){passer.position.x=-5.9+Math.sin(time*.00025)*.45;lens.rotation.y=-.3+Math.sin(time*.0004)*.08;}renderer.render(scene,camera);frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 const update=(state:EvidenceDeskState)=>{ctx.fillStyle='#112f48';ctx.fillRect(0,0,900,430);ctx.fillStyle='#9bd9d0';ctx.font='25px sans-serif';ctx.fillText('CANAL DU QUARTIER',45,65);ctx.fillStyle='#f5d58a';ctx.font='bold 45px sans-serif';ctx.fillText(state.result?.status==='public'?'RECTIFICATION':state.result?.status==='review'?'RECOURS REÇU':'Séance en cours',45,155);ctx.fillStyle='#ecedd7';ctx.font='30px sans-serif';ctx.fillText(state.result?.status==='public'?'« Je ne demande pas':state.result?.status==='review'?'Un examen humain est ouvert.':'Paroles analysées par le Registre.',45,230);ctx.fillText(state.result?.status==='public'?'la coupure des caméras. »':'Accès suspendu.',45,275);ctx.font='23px monospace';ctx.fillText(state.result?.status==='public'?(state.result.exposed.length?`Présences : ${state.result.exposed.join(' / ')}`:'Présences masquées'):'',45,360);texture.needsUpdate=true;publicCloseup=state.result?.status==='public';resize();lamp.material=state.result?.status==='review'?glass:gold;};
 resize();return{update,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();texture.dispose();signTex.dispose();materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();}};
}
