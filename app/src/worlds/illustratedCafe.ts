import { illustratedLocations, plateUrl } from './illustrationAssets';
import { AnimationMixer, Box3, CanvasTexture, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, CircleGeometry, OrthographicCamera, Plane, Raycaster, Scene, Vector2, Vector3, WebGLRenderer, type Texture, type AnimationAction, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { applyPlayerOutfit } from '../street/render/characters/playerOutfit';
import './illustratedCafe.css';

/** Isolated art/playability study; never reads or writes the player's save. */
export async function mountIllustratedCafe(root: HTMLElement): Promise<() => void> {
  const host = document.createElement('main'); host.className = 'illustrated-cafe';
  host.innerHTML = `<header><small>LIFE 3.0 · APRÈS LA CRUE</small><h1>Le Café du Pont</h1><p>Avant la nuit, offrir un refuge aux voisins.</p></header><div class="ic-layout"><aside><small id="ic-step">01 / REJOINDRE</small><h2 id="ic-title">La lumière est encore allumée.</h2><p id="ic-story">Le pont est coupé. Brigitte a ouvert le café, mais elle ne sait pas encore où les voisins dormiront. Les couvertures sont là. Il reste à décider comment les utiliser.</p><div id="ic-choices"></div><p id="ic-result" role="status" aria-live="polite"></p><p class="ic-objective">À préparer : <strong id="ic-progress">des places pour la nuit</strong></p></aside><section aria-label="Le café illustré et ses personnages"><div class="ic-frame"><div class="ic-camera"><img src="${plateUrl(illustratedLocations['w05']!['cafe']!)}" alt="Café au damier crème, lambris vert pétrole et couvertures brique, dans une lumière naturelle généreuse."><div class="ic-render"></div><span class="ic-mood">Inquiet</span></div></div><nav aria-label="Cadrage"><button id="ic-wide" aria-pressed="true">Plan d’ensemble</button><button id="ic-close" aria-pressed="false">Plus près</button><button id="ic-motion" aria-pressed="true">Mouvements activés</button></nav></section></div><footer>Étude jouable · décor illustré, personnages 3D · sans effet sur ta partie <a href="?episode=court">Retour au jeu</a></footer>`;
  root.append(host);
  const get = <T extends HTMLElement>(id: string): T => host.querySelector<T>(id)!;
  const choices = get('#ic-choices'), result = get('#ic-result'), mood = get('.ic-mood');
  const frame = get('.ic-frame'), layer = get('.ic-camera'), renderHost = get('.ic-render');
  const scene = new Scene(), camera = new OrthographicCamera(-8, 8, 4.5, -4.5, .1, 100);
  camera.position.set(0, 7, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const renderer = new WebGLRenderer({ alpha: true, antialias: true }); renderer.setClearColor(0, 0); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderHost.append(renderer.domElement);
  scene.add(new HemisphereLight(0xffeccb, 0x315047, 2)); const light = new DirectionalLight(0xffdb9e, 3); light.position.set(-4, 8, 5); scene.add(light);
  const ray = new Raycaster(), floor = new Plane(new Vector3(0, 1, 0), 0);
  const point = (x: number, y: number): Vector3 => { ray.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), camera); return ray.ray.intersectPlane(floor, new Vector3())!; };
  const resize = (): void => renderer.setSize(frame.clientWidth, frame.clientHeight);
  const observer = new ResizeObserver(resize); observer.observe(frame); resize();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const actors: Object3D[] = [], mixers: AnimationMixer[] = [], actions: Map<string, AnimationAction>[] = [];
  const shadows: Mesh[] = [], baseScales: number[] = [];
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d')!;
  const gradient = shadowContext.createRadialGradient(32, 32, 2, 32, 32, 32); gradient.addColorStop(0, 'rgba(18,30,22,.45)'); gradient.addColorStop(1, 'rgba(18,30,22,0)'); shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadowTexture = new CanvasTexture(shadowCanvas);
  let raf = 0, disposed = false;
  const dispose = (): void => { if (disposed) return; disposed = true; cancelAnimationFrame(raf); observer.disconnect(); mixers.forEach(m => m.stopAllAction()); scene.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const mat of Array.isArray(o.material) ? o.material : [o.material]) { for (const value of Object.values(mat)) if (value && typeof value === 'object' && 'isTexture' in value) (value as Texture).dispose(); mat.dispose(); } } }); renderer.dispose(); host.remove(); };
  const play = (i: number, name: string): void => { const map = actions[i]!; const next = map.get(name) ?? map.get('idle'); if (!next) return; for (const a of map.values()) if (a !== next) a.fadeOut(.2); next.reset().fadeIn(.2).play(); };
  try {
    for (const [i, id] of ['player', 'npc.marlene'].entries()) {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}worlds/w10/characters/char.${id}.glb`);
      const body = gltf.scene;
      if (i === 0) applyPlayerOutfit(body);
      const bounds = new Box3().setFromObject(body), height = bounds.max.y - bounds.min.y;
      body.scale.multiplyScalar(2.2 / height); baseScales.push(body.scale.x);
      body.position.copy(point(i ? .415 : .42, i ? .615 : .80)); body.rotation.y = i ? .6 : -2.5;
      scene.add(body); actors.push(body); const mixer = new AnimationMixer(body); mixers.push(mixer); actions.push(new Map(gltf.animations.map(c => [c.name, mixer.clipAction(c)]))); play(i, 'idle');
      const shadow = new Mesh(new CircleGeometry(.48, 32), new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 1.8, 1); scene.add(shadow); shadows.push(shadow);
    }
  } catch { result.textContent = 'Le personnage n’a pas pu être chargé. Recharge cet aperçu pour réessayer.'; observer.disconnect(); renderer.dispose(); return dispose; }
  let moving: {from: Vector3; to: Vector3; elapsed: number; done: () => void} | null = null;
  let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setMood = (text: string, color: string): void => { mood.textContent = text; mood.style.borderColor = color; };
  const walk = (x: number, y: number, done: () => void): void => { choices.querySelectorAll('button').forEach(b => b.disabled = true); const to = point(x, y), from = actors[0]!.position.clone(); actors[0]!.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); play(0, 'walk'); moving = {from, to, elapsed: 0, done}; };
  const button = (label: string, action: () => void): void => { const b = document.createElement('button'); b.textContent = label; b.onclick = action; choices.append(b); };
  const framing = (close: boolean): void => { layer.style.transition = motion ? 'transform 1800ms ease-in-out' : 'none'; layer.style.transformOrigin = '47% 67%'; layer.style.transform = close ? 'scale(1.13)' : 'scale(1)'; get('#ic-wide').setAttribute('aria-pressed', String(!close)); get('#ic-close').setAttribute('aria-pressed', String(close)); };
  get('#ic-wide').onclick = () => framing(false); get('#ic-close').onclick = () => framing(true);
  const motionButton = get('#ic-motion'); const showMotion = (): void => { motionButton.textContent = motion ? 'Mouvements activés' : 'Caméra sans transition'; motionButton.setAttribute('aria-pressed', String(motion)); };
  showMotion(); motionButton.onclick = () => { motion = !motion; layer.style.transition = 'none'; showMotion(); };
  const start = (): void => { choices.replaceChildren(); result.textContent = ''; get('#ic-step').textContent = '01 / REJOINDRE'; get('#ic-title').textContent = 'La lumière est encore allumée.'; get('#ic-story').textContent = 'Le pont est coupé. Brigitte a ouvert le café, mais elle ne sait pas encore où les voisins dormiront. Les couvertures sont là. Il reste à décider comment les utiliser.'; get('#ic-progress').textContent = 'des places pour la nuit'; actors[0]!.position.copy(point(.42, .80)); setMood('Inquiet', '#ddb771'); framing(false);
    button('Rejoindre Brigitte', () => { result.textContent = 'Tu traverses le café pour la rejoindre.'; walk(.48, .69, () => { choices.replaceChildren(); result.textContent = ''; play(1, 'talk'); framing(true); get('#ic-step').textContent = '02 / DÉCIDER'; get('#ic-title').textContent = '« On leur dit de venir ? »'; get('#ic-story').textContent = 'Brigitte regarde les couvertures. « On peut préparer les tables pour qu’ils se reposent ici. Ou donner les couvertures maintenant, à ceux qui attendent dehors. On n’en a pas assez pour faire les deux. »'; setMood('Concerné', '#ddb771');
      button('Préparer les places à l’intérieur', () => resolve(true)); button('Donner les couvertures aux voisins dehors', () => resolve(false));
    }); });
  };
  const resolve = (inside: boolean): void => { result.textContent = 'Tu rejoins la réserve de couvertures.'; walk(.52, .79, () => { choices.replaceChildren(); play(0, 'talk'); get('#ic-step').textContent = '03 / CONSÉQUENCE'; get('#ic-title').textContent = inside ? 'Il y aura une place au chaud.' : 'Ils n’attendront pas dans le froid.'; get('#ic-story').textContent = inside ? 'Tu réserves les couvertures pour les couchages. Brigitte commence à organiser les places. Les voisins dehors devront attendre leur entrée : tu lui demandes d’aller les prévenir.' : 'Tu confies les couvertures à Brigitte pour les voisins dehors. Ils pourront se réchauffer tout de suite. Pour dormir ici, il faudra trouver une autre réserve.'; get('#ic-progress').textContent = inside ? 'Couvertures réservées · eau et passage à vérifier' : 'Couvertures distribuées · couchages à compléter'; result.textContent = inside ? 'Ton choix prépare l’accueil pour la nuit.' : 'Ton choix aide immédiatement, mais laisse les couchages à préparer.'; setMood(inside ? 'Utile' : 'Solidaire', '#9ac9ac'); framing(false); button('Essayer l’autre décision', start); }); };
  let last = 0;
  const tick = (now: number): void => { if (disposed) return; const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now; mixers.forEach(m => m.update(dt));
    if (moving) { moving.elapsed += dt; const t = Math.min(1, moving.elapsed / 2.4); actors[0]!.position.lerpVectors(moving.from, moving.to, t); if (t === 1) { const done = moving.done; moving = null; play(0, 'idle'); done(); } }
    actors.forEach((a, i) => { shadows[i]!.position.set(a.position.x, .01, a.position.z); const foot = a.position.clone().project(camera); const perspective = 1 + Math.max(0, (1 - foot.y) / 2 - .615) * .9; a.scale.setScalar(baseScales[i]! * perspective); });
    const head = actors[0]!.position.clone().add(new Vector3(0, 2.4 * actors[0]!.scale.x / baseScales[0]!, 0)).project(camera); mood.style.left = `${(head.x + 1) * 50}%`; mood.style.top = `${(1 - head.y) * 50}%`;
    renderer.render(scene, camera); raf = requestAnimationFrame(tick);
  };
  start(); host.dataset['ready'] = 'true'; raf = requestAnimationFrame(tick); return dispose;
}
