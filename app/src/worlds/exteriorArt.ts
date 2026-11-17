/** Crafted public-space details, kept independent of the existing architecture and story. */
import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry, type BufferGeometry, type Material, type Texture } from 'three';
type V3 = readonly [number, number, number];
export function buildExteriorArt(layout: string, publicSpace: boolean): { group: Group; dispose(): void } {
  const group = new Group(); group.name = `art.${layout}.${publicSpace ? 'public' : 'landmark'}`;
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  const cube = new BoxGeometry(), cyl = new CylinderGeometry(1, 1, 1, 24), ball = new SphereGeometry(1, 16, 10);
  [cube, cyl, ball].forEach(g => geometries.add(g));
  const material = (color: string, metalness = 0, roughness = .8): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({color, metalness, roughness}); materials.add(m); return m;
  };
  const cream = material('#e4d5b2'), brass = material('#b29b60', .55, .36), teal = material('#315f60'), rust = material('#b96a46'), ink = material('#263d49'), timber = material('#927151'), pale = material('#9badad'), rose = material('#c88d87');
  const mesh = (g: BufferGeometry, m: Material, at: V3, scale: V3): Mesh => {
    const o = new Mesh(g, m); o.position.set(...at); o.scale.set(...scale); o.castShadow = o.receiveShadow = true; group.add(o); return o;
  };
  const box = (at: V3, scale: V3, m: Material): Mesh => mesh(cube, m, at, scale);
  const rod = (at: V3, radius: number, height: number, m: Material): Mesh => mesh(cyl, m, at, [radius, height, radius]);
  const ring = (at: V3, radius: number, tube: number, m: Material, horizontal = false): Mesh => {
    const g = new TorusGeometry(radius, tube, 6, 48); geometries.add(g); const o = mesh(g, m, at, [1,1,1]); if (horizontal) o.rotation.x = -Math.PI / 2; return o;
  };
  const globe = (x: number, z: number, h: number, m: Material): void => {
    rod([x,.08,z], .28,.16,m); rod([x,h / 2,z], .035,h,m); rod([x,h-.18,z],.17,.06,m);
    mesh(ball,cream,[x,h,z],[.22,.22,.22]);
  };
  const pot = (x:number,z:number,m:Material,base=0):void => {
    rod([x,base+.3,z],.44,.6,m); ring([x,base+.6,z],.43,.035,cream,true);
    rod([x,base+.62,z],.38,.025,ink);
    for(let i=0;i<7;i++){const a=i*2.4;const leaf=mesh(ball,teal,[x+Math.cos(a)*.23,base+.82+(i%3)*.13,z+Math.sin(a)*.23],[.08,.36,.12]);leaf.rotation.z=Math.sin(a)*.5;}
  };
  const surface = (motif:'fans'|'mosaic'|'bars'|'circles'|'chevrons',at:V3,size:readonly[number,number],colors:readonly[string,string,string]):void => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
    c.fillStyle=colors[0];c.fillRect(0,0,512,512);c.strokeStyle=colors[1];c.lineWidth=3;
    if(motif==='fans')for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const x=col*128+64,y=row*128+110;c.fillStyle=(row+col)%2?colors[1]:colors[2];
      c.beginPath();c.moveTo(x,y);c.arc(x,y,54,Math.PI,Math.PI*2);c.closePath();c.fill();
      c.strokeStyle=colors[0];for(let a=0;a<=8;a++){c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(Math.PI+a*Math.PI/8)*52,y+Math.sin(Math.PI+a*Math.PI/8)*52);c.stroke();}
    }
    if(motif==='mosaic')for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      c.fillStyle=(x+y)%3?colors[1]:colors[2];c.fillRect(x*64+3,y*64+3,58,58);
      c.fillStyle=colors[0];c.beginPath();c.moveTo(x*64+32,y*64+14);c.lineTo(x*64+50,y*64+32);c.lineTo(x*64+32,y*64+50);c.lineTo(x*64+14,y*64+32);c.closePath();c.fill();
    }
    if(motif==='bars')for(let i=0;i<16;i++){c.fillStyle=i%4?colors[1]:colors[2];c.fillRect(i*32+5,14,8,484);}
    if(motif==='circles')for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      c.fillStyle=(row+col)%2?colors[1]:colors[2];c.beginPath();c.arc(col*128+64,row*128+64,48,0,Math.PI*2);c.fill();c.fillStyle=colors[0];c.beginPath();c.arc(col*128+64,row*128+64,29,0,Math.PI*2);c.fill();
    }
    if(motif==='chevrons'){c.lineWidth=14;for(let row=-1;row<8;row++){c.strokeStyle=row%2?colors[1]:colors[2];c.beginPath();for(let x=0;x<=8;x++)c.lineTo(x*64,row*75+(x%2)*35);c.stroke();}}
    // Small aggregate flecks keep motifs embedded in stone rather than looking emissive.
    c.fillStyle='rgba(255,245,224,.12)';for(let i=0;i<2200;i++)c.fillRect(i*73%512,(i*157+Math.floor(i/73)*13)%512,1,1);
    const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;t.anisotropy=4;textures.add(t);
    const m=material('#ffffff');m.map=t;const g=new PlaneGeometry(...size);geometries.add(g);
    const o=mesh(g,m,at,[1,1,1]);o.rotation.x=-Math.PI/2;o.castShadow=false;
  };
  switch(layout){
    case 'terraces': {
      // A polished commercial district: fluted metal, precise inlays, repeated retail valances.
      if(publicSpace)for(const x of [-5,0,7])for(let i=0;i<8;i++)box([x-1.4+i*.4,3.43,-.48],[.2,.3,.035],i%2?ink:cream);
      else {
        surface('bars',[4,.382,2],[12,5],['#303b46','#a99a7b','#d07041']);
        for(const x of [-5,10]){box([x,.34,-4],[1.2,.68,1.2],ink);for(let i=0;i<8;i++)box([x-.48+i*.135,.4,-3.38],[.04,.55,.035],brass);pot(x,-4,pale,.68);}
      }
      for(const x of [-3,10]){globe(x,publicSpace?2:0,2.1,brass);}
      break;
    }
    case 'oracle': {
      // Pale ceremonial stone with radial brass sunbursts, following the route's geometry.
      for(const x of [-2.6,8.6]){
        rod([x,.12,publicSpace?3:-1],.9,.24,cream);
        for(const r of [.35,.6,.83])ring([x,.247,publicSpace?3:-1],r,.014,brass,true);
        for(let i=0;i<12;i++){const a=i*Math.PI/6;const ray=box([x+Math.cos(a)*.57,.25,(publicSpace?3:-1)+Math.sin(a)*.57],[.5,.015,.025],brass);ray.rotation.y=-a;}
      }
      if(publicSpace)for(const x of [-1,8]){globe(x,1,2.2,brass);pot(x,-1,cream);}
      else for(const x of [-7,13])for(let z=-9;z<=3;z+=6)for(const r of [.3,.37])ring([x,.3,z],r,.035,brass,true);
      break;
    }
    case 'commons': {
      if(publicSpace){
        surface('mosaic',[3,.008,3.7],[8,3],['#dbb58a','#b76647','#376c65']);
        for(let i=0;i<8;i++){const canopy=box([-2.5+i*1.15,4.05,-1],[.68,.035,8],i%3?cream:rust);canopy.rotation.z=.015*Math.sin(i);}
        for(const x of [-1,8])pot(x,-.5,rust);
        for(const x of [.5,1.3,5.5,6.3]){rod([x,.77,-1],.095,.02,cream);rod([x,.825,-1],.045,.09,teal);}
      }else{
        // Salvaged, reused hardware at the old server farm, with human-scale repairs.
        for(const x of [-7,13]){box([x,1,-3.4],[.75,2,.45],rust);for(let y=.35;y<1.9;y+=.32)box([x,y,-3.16],[.57,.035,.025],cream);}
        for(let i=0;i<5;i++)box([1.2+i*.35,.82,-1],[.25,.12,.4],i%2?teal:rust);
      }
      break;
    }
    case 'wall': {
      // Utilitarian amber warning paint and reinforced ribs, never domestic ornament.
      const z=publicSpace?1:-5;
      for(const x of [-2,8]){box([x,.35,z],[1.8,.7,.55],pale);for(let i=0;i<6;i++){const stripe=box([x-.7+i*.28,.35,z+.28],[.1,.62,.015],ink);stripe.rotation.z=-.3;}}
      if(!publicSpace)for(const x of [-.3,8.3])for(let y=.7;y<5.8;y+=.55)box([x,y,-9.31],[.15,.18,.025],rust);
      else for(const x of [-3,5])for(let i=0;i<5;i++)box([x-1.6+i*.8,2.75,-.47],[.36,.2,.035],ink);
      break;
    }
    case 'garden': {
      // Promenade ironwork and glazed tile survive beside the damaged bridge.
      if(publicSpace){
        for(const x of [.4,5.6])for(const z of [-8,-4,0]){const r=ring([x,.8,z],.37,.025,teal);r.rotation.y=Math.PI/2;}
        for(const x of [-2,8])pot(x,3,rust);
      }else{
        for(let i=0;i<24;i++){const a=i*Math.PI/12;const tile=box([4+Math.cos(a)*3.25,.61,-2+Math.sin(a)*3.25],[.48,.025,.23],i%2?teal:cream);tile.rotation.y=-a+Math.PI/2;}
        for(const x of [-2,10])globe(x,1,2.4,teal);
        surface('fans',[-1,.008,3],[3,4],['#e0c7a1','#a84d3c','#4a7774']);
      }
      break;
    }
    case 'vault': {
      // Riveted steel, valves and allocation lanes echo the institutions inside.
      for(const x of [-4,2,8])if(publicSpace){ring([x,1.5,-2.49],.32,.035,rust);for(let i=0;i<4;i++){const a=i*Math.PI/2;const spoke=box([x+Math.cos(a)*.15,1.5+Math.sin(a)*.15,-2.49],[.3,.025,.025],rust);spoke.rotation.z=a;}}
      if(!publicSpace){
        for(let i=0;i<16;i++){const a=i*Math.PI/8;mesh(ball,ink,[4+Math.cos(a)*2.65,4+Math.sin(a)*2.65,-6.41],[.065,.065,.035]);}
        for(const x of [1.1,6.9])for(let z=-4;z<4;z+=1)box([x,.115,z],[.12,.02,.55],cream);
      }
      for(const x of [-6,11]){box([x,.35,1],[1,.7,.8],ink);for(let i=0;i<5;i++)box([x-.4+i*.2,.35,1.41],[.055,.55,.025],brass);}
      break;
    }
    case 'school': {
      // Playful concentric learning tiles and colored slats, visibly softer than civic offices.
      surface('circles',[3,.012,publicSpace?3:0],[7,3.5],['#d3c5af','#7396a4','#b87b75']);
      for(const x of [publicSpace?-3:-5,publicSpace?9:11]){
        for(let i=0;i<5;i++)box([x+i*.22,1.4,-2],[.12,2.8-i*.25,.15],i%2?rose:pale);
        pot(x+.5,-1,cream);
      }
      if(!publicSpace)for(let i=0;i<8;i++)box([-5+i*2,3.65,-6.38],[1.4,.18,.09],i%2?rose:teal);
      break;
    }
    case 'conservatory': {
      // Botanical metalwork: thin stems and elliptical leaves on the pavilion framing.
      for(const x of [-3.7,11.7])for(const z of [-6,0]){
        rod([x,1.35,z],.018,2.7,brass);
        for(let i=0;i<5;i++){const leaf=ring([x+(i%2?.17:-.17),.55+i*.4,z],.18,.016,brass);leaf.scale.set(.6,1.5,1);leaf.rotation.z=i%2?-.5:.5;}
      }
      for(const x of [-2,8])pot(x,publicSpace?2:-3,cream);
      // Small inset pavers beside the existing timber/stone path.
      for(let i=0;i<8;i++){rod([publicSpace?5.1:6,.035,-7+i*1.4],.35,.05,i%2?cream:rust);}
      break;
    }
    default: {
      // Hand-repaired rural craft: wattle, stacked pots and a restrained woven market cloth.
      for(const x of [-4,10]){
        for(let z=-3;z<=1;z++)box([x,.5,z],[.07,1,.07],timber);
        for(let y=.2;y<.9;y+=.15){const rail=box([x,y,-1],[.05,.045,4.3],timber);rail.rotation.y=.02;}
      }
      const tx=publicSpace?3:4,tz=publicSpace?-1:0;
      surface('chevrons',[tx,.762,tz],[1.6,.8],['#b89266','#694e3c','#bb653f']);
      for(const x of [-1,8]){pot(x,-3,rust);rod([x+.55,.2,-2.8],.24,.4,cream);}
      break;
    }
  }
  let disposed=false;
  return {group,dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
