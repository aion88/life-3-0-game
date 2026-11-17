import { applyPlayerOutfit } from '../street/render/characters/playerOutfit';
import { buildCafePont } from './cafePont';
import { buildOraclePrecinct, ORACLE_APPROACH } from './oraclePrecinct';
import { buildLandscape } from './landscape';
import { buildInteriorArt } from './interiorArt';
import { buildExteriorArt } from './exteriorArt';
import { buildSorayaRoom } from './sorayaRoom';
import { createPhotographicFinish } from './photographic';
/** World-specific architecture and real human rigs; no dependency on the 1984 street or week engine. */
import { ACESFilmicToneMapping, AnimationMixer, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight, RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderer, type AnimationAction, type Quaternion, type BufferGeometry, type Material, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Journey } from './types';
import visuals from './visuals.json';
export interface JourneyView {
    /** Reflect a saved material consequence without modifying narrative state. */
    setConsequence?(effect: import('./consequences').StoryConsequence | null): void;
    show(location: string, inventory: readonly string[]): void;
    /** Play a short skippable arrival, resolving when the tableau is ready. */
    perform(location: string, inventory: readonly string[], onLocation?: () => void): Promise<void>;
    /** Freeze movement and animation without resolving a pending journey. */
    pause?(paused: boolean): void;
    /** Finish the active arrival immediately; safe when nothing is playing. */
    skip(): void;
    /** Display a qualitative mood above the actual animated player head. */
    setEmotion(label: string, tone: string, detail: string): void;
    setSpeaker?(speaker: string): void;
    react?(): void;
    moveTo?(x:number,y:number):void;
    setVisitors?(count:number):void;
    setPhotographic?(enabled: boolean): void;
    setFraming?(shot: 'wide' | 'portrait' | 'counter' | 'blankets'): void;
    dispose(): void;
}
type V3 = readonly [
    number,
    number,
    number
];
/** Mount nine distinct deterministic environments, with room shots and fully disposed resources. */
export async function createJourneyView(host: HTMLElement, journey: Journey): Promise<JourneyView> {
    const doc = host.ownerDocument, p = visuals[journey.id];
    const box = doc.createElement('div');
    box.className = 'journey-view';
    box.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    host.prepend(box);
    const status = doc.createElement('p');
    status.setAttribute('role', 'status');
    status.style.cssText = 'position:absolute;top:30%;right:12%;padding:16px;color:white;background:#172635;z-index:2';
    status.textContent = 'Ouverture du quartier…';
    box.append(status);
    let renderer: WebGLRenderer;
    try {
        renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    }
    catch (error) {
        status.textContent = 'Le rendu 3D est indisponible. Réactive l’accélération graphique puis recharge le jeu.';
        throw error;
    }
    renderer.setPixelRatio(Math.min(doc.defaultView?.devicePixelRatio ?? 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = p.lighting.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', `Environnement : ${journey.title}`);
    box.append(renderer.domElement);
    const scene = new Scene();
    scene.background = new Color(p.sky);
    scene.fog = new Fog(p.sky, 38, 95);
    const camera = new PerspectiveCamera(38, 1, 0.1, 120);
    const ambient = new HemisphereLight(p.sky, p.ground, p.lighting.ambient + .12); scene.add(ambient);
    const sun = new DirectionalLight(p.sun, p.lighting.sunPower);
    sun.position.set(p.lighting.sunPosition[0]!, p.lighting.sunPosition[1]!, p.lighting.sunPosition[2]!);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 });
    sun.shadow.normalBias = .035;
    scene.add(sun);
    const fill = new DirectionalLight(p.sky, p.lighting.fill + .18);
    fill.position.set(12, 7, 8);
    scene.add(fill);
    // A broad frontal bounce keeps faces and dark clothes readable under the architectural shadows.
    const actorFill = new DirectionalLight('#e2e9e6', 1.35);
    actorFill.position.set(8, 6, 12); actorFill.target.position.set(4.4, 1.2, 4.5);
    scene.add(actorFill, actorFill.target);
    let photo: ReturnType<typeof createPhotographicFinish> | null = null;
    let sorayaRoom: ReturnType<typeof buildSorayaRoom> | null = null;
    const artSets: { dispose(): void }[] = [];
    let photographic = true;
    let framing: 'wide' | 'portrait' | 'counter' | 'blankets' = 'wide';
    let environment = new Group();
    const locationGroups = new Map<string, Group>();
    const people = new Group();
    scene.add(people);
    const headAnchor = doc.createElement('div');
    headAnchor.className = 'journey-head-anchor'; headAnchor.hidden = true;
    headAnchor.style.cssText = 'position:absolute;left:0;top:0;z-index:4;pointer-events:none;transform:translate(-50%,-100%);will-change:left,top';
    box.append(headAnchor);
    const emotion = doc.createElement('aside'); emotion.className = 'journey-emotion';
    emotion.setAttribute('aria-label', 'État émotionnel'); emotion.setAttribute('role', 'status'); emotion.setAttribute('aria-live', 'polite');
    emotion.style.cssText = 'position:static;display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 9px;width:max-content;max-width:160px;min-width:76px;border:1px solid #d0e5e444;border-radius:7px;background:#10232be8;box-shadow:0 3px 12px #0005;pointer-events:none;box-sizing:border-box';
    const moodLabel = doc.createElement('strong'); moodLabel.style.cssText = 'display:block;font:500 12px/1.2 Inter,Helvetica,Arial,sans-serif;color:#f7f8f2;text-align:center';
    const moodBar = doc.createElement('div'); moodBar.className = 'journey-emotion-bar'; moodBar.setAttribute('aria-hidden', 'true');
    moodBar.style.cssText = 'width:100%;height:5px;border-radius:4px;background:#8fc8e0';
    emotion.append(moodLabel, moodBar); headAnchor.append(emotion);
    let emotionSet = false;
    let viewportWidth = 1, viewportHeight = 1;

    const geos = new Set<BufferGeometry>(), mats = new Set<Material>(), textures = new Set<Texture>();
    const canvas = doc.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#ddd';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2400; i++) {
        c.fillStyle = i % 3 ? '#c9c9c9' : '#ededed';
        c.fillRect(i * 47 % 128, (i * 79 + Math.floor(i / 128) * 13) % 128, 1, 1);
    }
    const grain = new CanvasTexture(canvas);
    grain.wrapS = grain.wrapT = RepeatWrapping;
    grain.repeat.set(4, 4);
    // Height data stays linear; it adds surface relief without tinting the palette.
    grain.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.add(grain);
    const mat = (color: string, metalness = 0, roughness = .75): MeshStandardMaterial => { const m = new MeshStandardMaterial({ color, metalness, roughness, map: null }); mats.add(m); return m; };
    const wall = mat(p.wall), floor = mat(p.ground), dark = mat('#273944'), trim = mat(p.accent, .3, .38), wood = mat('#93704f'), leaves = mat(p.leaf), water = mat('#4d929d', .05, .26);
    // Large stone flags and fine joints; no enlarged noise pasted over the ground.
    const pavingCanvas = doc.createElement('canvas'); pavingCanvas.width = pavingCanvas.height = 512;
    const paving = pavingCanvas.getContext('2d')!;
    paving.fillStyle = '#777b79'; paving.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 8; col++) {
        const tone = 177 + (row * 13 + col * 7 + 100) % 14;
        paving.fillStyle = `rgb(${tone},${tone + 2},${tone})`;
        paving.fillRect(col * 80 + row % 2 * 40 + 1, row * 64 + 1, 78, 62);
    }
    // Fine mineral flecks break up large flags without changing their overall colour.
    for (let i = 0; i < 18000; i++) {
        paving.fillStyle = i % 3 ? '#ffffff0b' : '#18252a0e';
        paving.fillRect((i * 179 + Math.floor(i / 512) * 31) % 512, (i * 283 + Math.floor(i / 512) * 17) % 512, 1, 1);
    }
    const pavingMap = new CanvasTexture(pavingCanvas); pavingMap.colorSpace = SRGBColorSpace; pavingMap.wrapS = pavingMap.wrapT = RepeatWrapping; pavingMap.repeat.set(18, 18); textures.add(pavingMap); floor.map = pavingMap; floor.bumpMap = pavingMap; floor.bumpScale = .035; pavingMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const timberCanvas = doc.createElement('canvas'); timberCanvas.width = timberCanvas.height = 256;
    const timber = timberCanvas.getContext('2d')!; timber.fillStyle = '#c4a783'; timber.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 32; i++) { timber.fillStyle = i % 3 ? '#bda17d' : '#d0b38f'; timber.fillRect(0, i * 8, 256, 2); }
    for (let i = 0; i < 4; i++) { timber.fillStyle = '#806f59'; timber.fillRect(0, i * 64, 256, 1); timber.fillRect((i % 2) * 128, i * 64, 1, 64); }
    // Fine, curved growth lines and small knots rather than flat printed stripes.
    for (let i = 0; i < 95; i++) {
        timber.strokeStyle = i % 3 ? '#523b241c' : '#fff1d326'; timber.lineWidth = .6;
        timber.beginPath();
        for (let x = 0; x <= 256; x += 4) {
            const y = i * 2.7 + Math.sin(x / 35 + i * .7) * 1.3;
            if (!x) timber.moveTo(x, y); else timber.lineTo(x, y);
        }
        timber.stroke();
    }
    for (const [x, y] of [[63, 43], [185, 174]]) for (let ring = 1; ring < 6; ring++) {
        timber.strokeStyle = '#62432a24'; timber.beginPath(); timber.ellipse(x!, y!, ring * 3, ring * .8, 0, 0, Math.PI * 2); timber.stroke();
    }
    const woodMap = new CanvasTexture(timberCanvas); woodMap.colorSpace = SRGBColorSpace; woodMap.wrapS = woodMap.wrapT = RepeatWrapping; woodMap.repeat.set(3, 3); textures.add(woodMap); wood.map = woodMap; wood.bumpMap = woodMap; wood.bumpScale = .012; woodMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const glazing = mat('#273e49', .6, .19), frameMaterial = mat('#56676b', .6, .4);
    const glass = new MeshStandardMaterial({ color: '#a9d4d4', transparent: true, opacity: .16, roughness: .12, metalness: .15, depthWrite: false });
    mats.add(glass);
    const glow = new MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: .8, roughness: .3 });
    mats.add(glow);
    const cube = new BoxGeometry(1, 1, 1), sphere = new SphereGeometry(1, 18, 12), cyl = new CylinderGeometry(1, 1, 1, 24);
    [cube, sphere, cyl].forEach(g => geos.add(g));
    const mesh = (geo: BufferGeometry, m: Material, at: V3, size: V3): Mesh => { const o = new Mesh(geo, m); o.position.set(...at); o.scale.set(...size); o.castShadow = o.receiveShadow = true; environment.add(o); return o; };
    const block = (at: V3, size: V3, m: Material = wall): Mesh => mesh(cube, m, at, size);
    const column = (at: V3, r: number, h: number, m: Material = wall): Mesh => mesh(cyl, m, at, [r, h, r]);
    const plant = (x: number, z: number, h = 3): void => {
        // Keep the right-front dialogue sightline clear.
        if (x > 7 && z > 1) { x += 2; z -= 4; }
        column([x, .16, z], .5, .32, wall);
        column([x, h * .38, z], .055, h * .76, wood);
        for (let branch = 0; branch < 9; branch++) {
            const angle = branch * 2.399, height = h * (.58 + branch % 3 * .12);
            const reach = .55 + branch % 2 * .24;
            const end = new Vector3(x + Math.cos(angle) * reach, height + .25, z + Math.sin(angle) * reach);
            const from = new Vector3(x, height - .35, z), direction = end.clone().sub(from);
            const twig = column([0, 0, 0], .018, direction.length(), wood);
            twig.position.copy(from.clone().add(end).multiplyScalar(.5)); twig.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
            for (let leaf = 0; leaf < 11; leaf++) {
                const phase = leaf * 2.4 + branch, radial = .1 + (leaf % 4) * .12;
                const b = mesh(sphere, leaves, [end.x + Math.cos(phase) * radial, end.y + Math.sin(phase * 1.7) * .27, end.z + Math.sin(phase) * radial], [.18, .025, .085]);
                b.rotation.set(Math.sin(phase) * .7, phase, Math.cos(phase) * .6);
            }
        }
    };
    const bench = (x: number, z: number): void => { block([x, .42, z], [2.4, .1, .65], wood); for (const dx of [-.9, .9])
        block([x + dx, .21, z], [.12, .42, .55], dark); block([x, .76, z - .25], [2.4, .58, .1], wood); };
    const table = (x: number, z: number): void => { block([x, .715, z], [2.2, .09, 1.1], wood); for (const dx of [-.9, .9])
        for (const dz of [-.4, .4])
            block([x + dx, .335, z + dz], [.07, .67, .07], dark); };
    const building = (x: number, z: number, w: number, h: number, d: number, glazed = false): void => {
        block([x, h / 2, z], [w, h, d]);
        const front = z + d / 2;
        block([x, .24, front + .1], [w + .1, .48, .2], dark);
        for (let y = 1.55; y < h - .5; y += 2.6) {
            block([x, y + 1.05, front + .09], [w + .12, .09, .25], wall);
            for (let dx = -w / 2 + .85; dx < w / 2 - .45; dx += 1.65) {
                block([x + dx, y, front + .025], [1.08, 1.65, .045], glazing);
                for (const side of [-.58, .58]) block([x + dx + side, y, front + .11], [.09, 1.83, .24], wall);
                for (const dy of [-.88, .88]) block([x + dx, y + dy, front + .13], [1.25, .09, .3], wall);
                block([x + dx, y, front + .09], [.035, 1.65, .09], frameMaterial);
                block([x + dx, y + .15, front + .09], [1.08, .035, .09], frameMaterial);
                if (!glazed && y < 2) block([x + dx, y + 1.02, front + .45], [1.4, .055, .8], trim);
            }
        }
        block([x, h + .08, z], [w + .24, .16, d + .24], wall);
        block([x, h + .24, z], [w - .12, .16, d - .12], dark);
        for (const dx of [-w / 2 + .1, w / 2 - .1]) block([x + dx, h / 2, front + .06], [.18, h, .14], wall);
    };
    const arch = (x: number, z: number, r: number, m: Material = wall): void => { const g = new TorusGeometry(r, .15, 8, 48, Math.PI); geos.add(g); mesh(g, m, [x, 3.2, z], [1, 1, 1]); for (const dx of [-r, r])
        block([x + dx, 1.6, z], [.3, 3.2, .3], m); };
    const lamp = (x: number, z: number): void => { block([x, 2, z], [.07, 4, .07], dark); block([x, 4, z], [.4, .15, .4], glow); const l = new PointLight(p.accent, 12, 10, 2); l.position.set(x, 3.8, z); environment.add(l); };
    const outdoor = (publicSpace: boolean): void => {
        block([0, -.12, 0], [80, .2, 80], floor);
        // Extend the visible district beyond the playable foreground, with world-specific density.
        if (p.layout !== 'oracle' || publicSpace) {
            const urban = ['terraces','wall','vault'].includes(p.layout);
            const heights = urban ? [12,19,14,23,16] : p.layout === 'hamlet' ? [3,4,3,5,3] : [5,8,6,9,5];
            for (let i=0;i<5;i++) building(-27+i*14,-31,urban?9:8,heights[i]!,6,p.layout==='terraces');
            for (const x of [-23,25]) {
                building(x,-12,7,urban?9:4.5,12,p.layout==='conservatory');
                block([x > 0 ? x-4.5 : x+4.5,.02,0],[2,.04,32],wall);
                for(let z=-19;z<8;z+=9) lamp(x > 0 ? x-5 : x+5,z);
            }
        }
        if (publicSpace) {
            // Public locations have different spatial programmes from the world's final landmark.
            switch (p.layout) {
                case 'terraces':
                    for (const x of [-5, 0, 7]) {
                        table(x, -2); for (const dx of [-1.4, 1.4]) block([x + dx, 1.8, -2], [.09, 3.6, .09], dark);
                        block([x, 3.6, -2], [3.2, .08, 3], trim);
                        for (let i = 0; i < 5; i++) block([x - .8 + i * .4, .96, -2], [.3, .4, .5], i % 2 ? dark : wall);
                    }
                    for (let i = 0; i < 4; i++) building(-12 + i * 8, -17, 5, 14 + i * 3, 5, true);
                    break;
                case 'oracle':
                    for (const x of [-4, 10]) for (const z of [-8, -2, 4]) plant(x, z, 3.5);
                    for (let i = 0; i < 5; i++) { block([3, .05, -10 + i * 3], [7, .1, .6], wall); column([3, .2, -10 + i * 3], .3, .4, trim); }
                    block([3, -.03, -3], [3, .08, 22], trim); bench(-1, 0); bench(8, 0);
                    break;
                case 'commons':
                    for (const x of [-7, 7]) building(x, -10, 8, 5, 4);
                    for (let i = 0; i < 5; i++) block([-3 + i * 2.2, 4.2, -1], [.15, .2, 11], wood);
                    for (const x of [-3, 6]) block([x, 2.1, -1], [.18, 4.2, .18], wood);
                    table(1, -1); table(6, -1); bench(3, 1); plant(-6, -1, 3.5); plant(10, -3, 4);
                    break;
                case 'wall':
                    for (const x of [-3, 5]) { table(x, -2); block([x, 2.9, -2], [4, .12, 3], trim); for (const dx of [-1.8, 1.8]) block([x + dx, 1.4, -2], [.09, 2.8, .09], dark); for (let i = 0; i < 7; i++) column([x - 1 + i * .3, .885, -2], .12, .25, i % 2 ? trim : wall); }
                    building(-9, -12, 6, 3, 4); building(7, -12, 10, 4, 4); lamp(10, 1);
                    break;
                case 'garden':
                    // Flooded river and damaged bridge: water replaces the shared town square.
                    block([3, -.02, -7], [75, .08, 14], water);
                    block([3, .12, -4], [5, .2, 14], wall);
                    for (const x of [.4, 5.6]) { for (let z = -10; z < 3; z += 2) block([x, .8, z], [.12, 1.5, .12], trim); block([x, 1.5, -4], [.12, .1, 13], trim); }
                    block([3, .24, -7], [5.2, .3, 1.7], dark).rotation.y = .1;
                    for (let x = -13; x < 20; x += 7) building(x, -20, 5, 5, 5);
                    for (let i = 0; i < 6; i++) block([-4 + i * 1.2, .1, -2], [1.6, .2, .3], wood).rotation.y = i;
                    break;
                case 'vault':
                    for (const x of [-4, 2, 8]) { column([x, .25, -3], 1.8, .5, wall); column([x, 1.7, -3], .45, 3, dark); block([x, 3.2, -3], [1.8, .2, .4], trim); const pipe = column([x, 1, -2.3], .13, 1.4, trim); pipe.rotation.x = Math.PI / 2; }
                    block([3, .05, -3], [16, .1, 3], water); building(-9, -13, 7, 5, 5); building(10, -13, 9, 6, 5); lamp(10, 2);
                    break;
                case 'school':
                    for (const x of [-6, 10]) for (const z of [-8, -2, 4]) plant(x, z, 4);
                    for (let i = 0; i < 4; i++) { block([-2 + i * 3, .35, -4], [2.5, .7, 3], wood); plant(-2 + i * 3, -4, 1.8); }
                    bench(1, 0); bench(7, 0); arch(3, -10, 3, trim);
                    break;
                case 'conservatory':
                    block([0, -.05, 0], [80, .1, 80], leaves);
                    for (let i = 0; i < 16; i++) { const x = -22 + i * 3; plant(x, -15 - i % 3 * 3, 4 + i % 3); }
                    block([3, .03, -4], [3, .12, 28], wood);
                    for (const x of [-4, 9]) for (const z of [-9, -4]) { column([x, .2, z], 2, .4, wall); plant(x, z, 2.5); }
                    bench(7, 1); break;
                default:
                    for (const x of [-8, 9]) { building(x, -10, 5, 3, 5); block([x, 3.2, -10], [6, .25, 6], wood).rotation.z = .16; }
                    table(3, -1); bench(3, 1);
                    for (let x = 1.8; x < 4.5; x += .5) { column([x, .86, -1], .18, .2, wall); block([x, 1.085, -1], [.25, .25, .3], trim); }
                    for (const x of [-2, 7]) block([x, .6, -4], [2, 1.2, 1.5], wood);
                    break;
            }
            return;
        }
        if (p.layout === 'commons') {
            // The old server farm is a service shed, not a second copy of the communal square.
            block([3, 3.5, -8], [22, 7, 7], dark);
            for (let x = -6; x < 13; x += 2.5) { block([x, 2, -4.4], [1.7, 4, .2], wall); for (let y = .4; y < 3.7; y += .45) block([x, y, -4.25], [1.4, .06, .05], trim); }
            for (const x of [-9, 15]) plant(x, -3, 4); table(2, -1); return;
        }
        switch (p.layout) {
            case 'terraces':
                for (let i = 0; i < 5; i++) {
                    building(-12 + i * 5.5, -12 - i * 1.2, 4.4, 10 + i * 2.5, 4, true);
                    block([-12 + i * 5.5, .1, -5], [4.4, .2, 7], dark);
                }
                block([4, .2, 2], [14, .35, 6]);
                for (let i = 0; i < 4; i++)
                    block([2 + i * 2, 1, -1], [.08, 2, .08], trim);
                bench(7, 5);
                plant(12, 0);
                lamp(2, -1);
                break;
            case 'oracle': {
                const precinct = buildOraclePrecinct(); environment.add(precinct.group); artSets.push(precinct);
                bench(9, 6); plant(-5, 6); break;
            }
            case 'commons':
                building(-8, -7, 6, 4, 4);
                building(7, -8, 9, 4, 4);
                building(-12, 3, 4, 4, 9);
                for (let i = 0; i < 5; i++)
                    block([1 + i * 2.1, 3.7, -3], [.12, .15, 10], wood);
                for (const x of [0, 10])
                    block([x, 1.8, 0], [.14, 3.6, .14], wood);
                table(4, 1);
                bench(4, 3);
                plant(9, 4);
                plant(-2, -2);
                block([3, .2, -5], [7, .4, 2], wood);
                break;
            case 'wall':
                block([2, 7, -11], [45, 14, 2], dark);
                for (let x = -20; x < 24; x += 3)
                    block([x, 7, -9.9], [.12, 14, .1]);
                block([4, 3, -9.7], [6, 6, .25], trim);
                block([4, 3, -9.5], [5.6, 5.6, .1], dark);
                for (const x of [-6, 12]) {
                    building(x, -3, 3, 2.8, 4);
                    lamp(x, 1);
                }
                block([4, .05, 1], [3, .1, 15]);
                break;
            case 'garden':
                column([4, .3, -2], 3.4, .6);
                column([4, .62, -2], 3, .07, water);
                column([4, 1.4, -2], .4, 1.6);
                for (let i = 0; i < 9; i++) {
                    const a = i * .7;
                    plant(4 + Math.cos(a) * 10, -2 + Math.sin(a) * 9, 3.5);
                }
                bench(8, 4);
                building(-10, -13, 10, 3.7, 4);
                arch(4, -8, 4, wood);
                break;
            case 'vault':
                block([4, 5, -10], [18, 10, 6], dark);
                block([4, 4, -6.9], [7, 8, .1]);
                {
                    const g = new CylinderGeometry(3, 3, .3, 48);
                    geos.add(g);
                    mesh(g, trim, [4, 4, -6.6], [1, 1, 1]).rotation.x = Math.PI / 2;
                }
                for (const x of [-8, 16]) {
                    block([x, 3, -3], [1, 6, 1], dark);
                    block([x, 6, -3], [2, .2, 2], trim);
                }
                for (let i = 0; i < 6; i++)
                    block([-12, .9, -6 + i * 2], [3, 1.8, 1.5]);
                lamp(10, 2);
                block([4, .05, 0], [4, .1, 10], trim);
                break;
            case 'school':
                building(3, -9, 19, 4.6, 5);
                for (let i = 0; i < 8; i++)
                    block([-5 + i * 2, 2, -6.4], [1.4, 3, .05], glass);
                arch(10, 0, 2, trim);
                bench(2, 4);
                bench(7, 4);
                for (let i = 0; i < 5; i++)
                    column([-7 + i * .8, .06, 2], .3, .1, trim);
                plant(14, -1, 4);
                break;
            case 'conservatory':
                for (let z = -10; z <= 8; z += 3)
                    arch(4, z, 8);
                block([4, 5, -10], [16, 10, .08], glass);
                for (const x of [-4, 12])
                    block([x, 4, -1], [.08, 8, 18], glass);
                for (let z = -7; z <= 5; z += 4) {
                    plant(-1, z, 3.3);
                    plant(9, z, 4.1);
                }
                block([4, .04, 0], [3, .08, 20]);
                bench(6, 4);
                break;
            default:
                for (const x of [-9, 8]) {
                    building(x, -8, 5, 3, 4);
                    block([x, 3.2, -8], [6, .25, 5], wood).rotation.z = .13;
                }
                for (const x of [-8, 12]) {
                    for (const dx of [-.8, .8])
                        block([x + dx, 7, -18], [.12, 14, .12], dark);
                    for (const y of [4, 8, 12])
                        block([x, y, -18], [4, .15, .15], dark);
                }
                table(4, 0);
                for (let i = 0; i < 8; i++)
                    column([9, .25 + Math.floor(i / 4) * .45, 2 + i % 4 * .45], .22, 2, wood).rotation.z = Math.PI / 2;
                plant(-3, 1, 2.5);
        }
        };
    /** Each home's architecture has its own silhouette; work spaces change its use and composition. */
    const interior = (work: boolean): void => {
        if (journey.id === 'w05' && !work) { const cafe = buildCafePont(); environment.add(cafe.group); artSets.push(cafe); return; }
        if (journey.id === 'w02' && !work) { sorayaRoom = buildSorayaRoom(); environment.add(sorayaRoom.group); return; }
        const red = mat('#a74735'), cream = mat('#e8d8b4'), ink = mat('#203943');
        const roomFloor = p.layout === 'hamlet' || p.layout === 'commons' || p.layout === 'school' ? wood : floor;
        // Continuous ground: the cutaway room must not look like a floating game board.
        const continuousFloor = roomFloor.clone(); mats.add(continuousFloor);
        if (roomFloor.map) {
            const groundMap = roomFloor.map.clone(); groundMap.repeat.multiplyScalar(120 / 19);
            textures.add(groundMap); continuousFloor.map = groundMap;
        }
        if (p.layout === 'garden') {
            block([3, -.16, 21], [120, .3, 54], continuousFloor);
            block([3, -.16, -53], [120, .3, 58], continuousFloor);
            block([3, -.26, -15], [120, .3, 18], water);
        } else block([3, -.16, 0], [120, .3, 120], continuousFloor);
        const windowWall = (color: Material, height = 5): void => {
            block([3, height / 2, -5], [16, height, .35], color);
        };
        const shelves = (x: number, z: number, count = 5): void => {
            for (let level = 0; level < 4; level++) {
                block([x, .5 + level * .75, z], [3.8, .09, .55], wood);
                for (let j = 0; j < count; j++) block([x - 1.5 + j * .55, .76 + level * .75, z], [.22 + j % 2 * .12, .43, .3], [trim, wall, dark][j % 3]!);
            }
        };
        const pendant = (x: number, y: number, z: number): void => {
            block([x, y + .6, z], [.025, 1.2, .025], dark); column([x, y, z], .42, .14, glow);
        };
        // Workplaces have their own building plan, not the home's shell with swapped props.
        if (work && p.layout !== 'oracle') {
            switch (p.layout) {
                case 'garden': {
                    // Hubert's compact survey office: enclosed room, map wall, side light, no café awning.
                    block([2.5,1.8,-5],[13,3.6,.3],mat('#526e73'));
                    block([-4,1.8,-.5],[.25,3.6,9],cream);
                    for(const z of [-3.8,-.3,3.2]){block([-3.84,2.1,z],[.06,1.8,2.2],glazing);block([-3.73,2.1,z],[.07,1.8,.05],wood);}
                    for(const x of [-3,1,5,9])block([x,3.6,-.5],[.16,.18,9],wood);
                    block([1,2.1,-4.77],[5.4,2.2,.08],cream);
                    // River survey: blue route, contour lines, flagged measurement sites.
                    for(let i=0;i<10;i++){
                        const x=-1.2+i*.47,y=2.1+Math.sin(i*.8)*.45;
                        block([x,y,-4.7],[.5,.06,.025],water).rotation.z=Math.cos(i*.8)*.3;
                        block([x,1.2,-4.69],[.025,.18,.025],red);
                    }
                    for(const y of [1.4,1.65,2.65,2.9])block([1,y,-4.68],[4.8,.012,.012],trim);
                    table(1,-1.5);block([1,.78,-1.5],[1.5,.02,.7],cream);shelves(7,-4.4,5);
                    for(const x of [5.7,6.5,7.3])block([x,.8,-2],[.6,1.6,.75],wood);
                    pendant(1,2.7,-1.5);
                    break;
                }
                case 'vault': {
                    // Allocation hall: a deep civic nave with a distant counter and overhead gallery.
                    block([3,5,-16],[21,10,.5],mat('#536d68'));
                    for(const x of [-7,13])block([x,4,-5],[.5,8,22],wall);
                    for(const z of [-13,-8,-3,2]){
                        for(const x of [-5,11]){column([x,3.5,z],.32,7);block([x,6.6,z],[1.1,.2,1.1],trim);}
                        block([3,7,z],[17,.4,.35],trim);
                    }
                    for(let i=0;i<5;i++){
                        const x=-3+i*3;
                        block([x,.55,-11],[2.5,1.1,1.2],dark);block([x,1.14,-11],[2.65,.08,1.4],wood);
                        block([x,2,-11.4],[.06,1.8,.06],trim);
                        block([x,2.7,-11.4],[1.5,.45,.05],glow);
                    }
                    block([3,4.1,-14],[19,.2,3],dark);
                    for(let x=-6;x<13;x++)block([x,4.6,-12.45],[.04,1,.04],trim);
                    for(const z of [-7,-3]){bench(-2,z);bench(8,z);}
                    for(const x of [1.5,5.5])for(const z of [-7,-4,-1]){column([x,.5,z],.045,1,trim);}
                    for(const x of [-2,3,8])pendant(x,5.3,-5);
                    break;
                }
                case 'commons': {
                    // Repair shed: longitudinal work bays under a sawtooth timber roof.
                    block([3,3,-13],[18,6,.3],wall);block([-6,3,-4],[.3,6,18],trim);
                    for(const z of [-11,-6,-1,4]){
                        block([3,5.2,z],[18,.22,.22],wood);
                        block([-.8,6,z],[10,.18,.2],wood).rotation.z=.16;
                        block([8,6,z],[8,.18,.2],wood).rotation.z=-.2;
                    }
                    for(const z of [-9,-4]){table(-2,z);table(8,z);shelves(-2,z-1.3,6);}
                    const wheelGeo=new TorusGeometry(.55,.065,8,32);geos.add(wheelGeo);
                    mesh(wheelGeo,dark,[6,1.15,-3],[1,1,1]);
                    block([6,.65,-3],[2,.12,1],wood);for(const x of [5.5,6.5])column([x,.4,-3],.07,.8,dark);
                    pendant(3,4,-6);break;
                }
                case 'wall': {
                    // Research annexe: a long secure equipment aisle, not a sleeping bunker.
                    block([3,3.2,-16],[15,6.4,.4],wall);
                    for(const x of [-3,9])for(const z of [-12,-8,-4]){
                        block([x,1.8,z],[2.4,3.6,2.3],ink);
                        for(let y=.5;y<3.5;y+=.5)block([x,y,z+1.17],[2,.08,.04],trim);
                        block([x,2.6,z+1.2],[1.4,.6,.04],glow);
                    }
                    for(const z of [-13,-7,-1]){block([3,5,z],[14,.25,.3],dark);block([3,4.8,z],[4,.08,.2],glow);}
                    table(3,-10);block([3,1.1,-10],[1.6,.7,.08],glazing);break;
                }
                case 'terraces': {
                    // Private exchange: double-height glazed transaction chamber.
                    block([3,4.2,-9],[16,8.4,.25],ink);block([-5,4.2,-1],[.2,8.4,16],glass);
                    for(const x of [-4,0,4,8,12]){block([x,4,-8.7],[.18,8,.15],trim);}
                    block([3,.6,-4],[11,1.2,1.4],dark);block([3,1.25,-4],[11.3,.1,1.6],trim);
                    for(const x of [-1,3,7]){block([x,2,-4],[.07,1.5,.1],trim);block([x,1.65,-4],[1.5,.8,.08],glazing);}
                    for(const z of [-5,1,5]){column([-4,3.8,z],.18,7.6,trim);}
                    block([3,6,-6],[12,.2,4],wall);pendant(3,4.2,0);break;
                }
                case 'school': {
                    // Clémence's studio: compact bright room with drawing benches and drying racks.
                    block([3,2.2,-7],[15,4.4,.25],cream);
                    for(const x of [-2,3,8]){block([x,2.6,-6.8],[3.2,2.6,.06],glazing);block([x,2.6,-6.7],[.05,2.6,.05],trim);}
                    for(const x of [-2,7]){table(x,-2);block([x,.8,-2],[1.7,.04,.8],cream);}
                    for(let i=0;i<8;i++)block([-2,.4+i*.28,-5],[3,.04,1.3],wood);
                    for(const x of [3,5,7]){block([x,1.2,-4.4],[1.4,1.8,.08],wood);block([x,1.4,-4.32],[1.15,1.3,.02],cream);}
                    pendant(3,3.5,-1);break;
                }
                case 'conservatory': {
                    // Theatre: an auditorium facing a framed stage, no greenhouse arches.
                    block([3,4.5,-13],[20,9,.4],ink);
                    for(const x of [-7,13]) {
                        block([x,3.5,-3],[.3,7,20],mat('#3f5750'));
                        for(const z of [-10,-6,-2,2,6])block([x+(x<0?.18:-.18),3,z],[.1,5,.5],wood);
                    }
                    block([3,.35,-8],[13,.7,7],wood);
                    for(const x of [-4,10]){block([x,3.4,-7],[1.2,6.8,1.5],trim);}
                    block([3,6.8,-7],[15,.5,1.5],trim);
                    for(const x of [-2.9,8.9])for(let i=0;i<6;i++)column([x+i*.16,3.2,-9],.15,6.4,mat('#516a54'));
                    for(const z of [-3,0])for(const x of [-3,8])bench(x,z);
                    for(const x of [-2,3,8]){pendant(x,5.7,-8);}
                    break;
                }
                default: {
                    // Lucien's forge: open industrial bay, furnace and chimney rather than a domestic hearth.
                    block([-5,2.5,-5],[.6,5,17],dark);block([3,2.5,-13],[17,5,.5],wall);
                    block([-1,1.2,-7],[3,2.4,3],dark);block([-1,1.1,-5.45],[1.8,1.3,.06],glow);
                    block([-1,5.3,-7],[1.3,6,1.3],dark);
                    for(const z of [-11,-5,1]){block([3,5,z],[17,.25,.3],wood);}
                    block([5,.4,-2],[.9,.8,.8],wood);block([5,.9,-2],[1.5,.3,.6],dark);
                    shelves(8,-10,6);for(let x=1;x<8;x+=1.2)block([x,2.8,-12.6],[.08,1.8,.08],trim);
                    lamp(8,-4);break;
                }
            }
            const taskLight=new PointLight(work && p.layout==='garden' ? '#c9e4e7' : p.sun,28,20,2);
            taskLight.position.set(3,4,-2);environment.add(taskLight);
            const entryLight = new PointLight('#e6dcc9',32,16,2);entryLight.position.set(4,3.5,6);environment.add(entryLight);
            return;
        }
        switch (p.layout) {
            case 'terraces': {
                // Elevated concession: a compressed living deck beneath stacked private terraces.
                for (let i = 0; i < 6; i++) building(-15 + i * 6, -19 - i % 2 * 4, 4.6, 12 + i % 3 * 6, 4, true);
                block([-4.5, 2.8, 0], [.4, 5.6, 10], dark);
                for (let z = -4; z < 5; z += 1.4) block([-4, 2.8, z], [.2, 5.6, .18], trim);
                block([3, 1, -5], [15, .08, .08], trim);
                for (let x = -4; x < 11; x += 1.5) block([x, .5, -5], [.04, 1, .05], dark);
                for (let x = -3; x < 11; x += 1.5) block([x, 5.5, -1], [.15, .2, 9], dark);
                block([-.8, .08, -.5], [5, .1, 5], red);
                if (work) { for (const x of [-1, 3, 7]) { table(x, -2); block([x, 1.06, -2], [1.05, .6, .08], dark); } }
                else { block([-1, .23, -1], [3, .46, .9], cream); block([-1, .68, -1.4], [3, .55, .16], trim); table(5, -2); }
                pendant(3, 4.2, -.5); break;
            }
            case 'oracle': {
                // Radial sanctuary: round plinths, freestanding columns and a suspended halo.
                column([3, -.02, -1], 8, .2, cream);
                for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; column([3 + Math.cos(a) * 7, 3.2, -1 - Math.sin(a) * 7], .28, 6.4); }
                for (const z of [-5, -2]) arch(3, z, 6, cream);
                column([3, .3, -3], work ? 3.2 : 2.3, .6, wall);
                const ring = new TorusGeometry(work ? 2 : 3.6, .12, 10, 64); geos.add(ring);
                mesh(ring, trim, [3, 5, -3], [1, 1, 1]);
                if (work) { column([3, 1.1, -3], 1, 1, trim); for (const x of [-1, 7]) bench(x, 0); }
                else { for (const x of [-1, 6]) { column([x, .4, -.5], 1.4, .8, wall); column([x, .83, -.5], 1.3, .08, trim); } }
                block([3, -.08, -15], [40, .12, 12], water); break;
            }
            case 'commons': {
                // Terracotta communal kitchen or repair hall; timber slats cast afternoon stripes.
                windowWall(wall, 5.8); block([-4.8, 2.9, -.8], [.3, 5.8, 8.5], trim);
                for (const x of [-2, 3, 8]) { block([x, 2.9, -4.75], [2.3, 3.7, .12], dark); block([x, 2.9, -4.65], [1.7, 3.3, .1], glass); }
                for (let x = -4; x < 12; x += 1) block([x, 5.8, -.5], [.18, .2, 9], wood);
                if (work) { table(0, -1); table(6, -1); shelves(-1, -4.3); for (let x = 4; x < 8; x += .5) block([x, .86, -1], [.25, .2, .5], trim); }
                else { block([-2, .425, -2], [3.5, .85, .72], trim); table(4, -.8); bench(4, 1); for (let x = 3; x < 6; x++) column([x, .78, -.8], .14, .04, cream); }
                plant(9, -3, 2.8); pendant(4, 3.4, -.8); break;
            }
            case 'wall': {
                // Low concrete bunker, clerestory slit and amber service doorway.
                windowWall(dark, 5); block([-4.5, 2.5, -.5], [.5, 5, 9], wall);
                block([3, 3.65, -4.76], [10, .8, .06], glow);
                for (let x = -2; x < 9; x += .7) block([x, 3.65, -4.6], [.08, 1, .2], dark);
                for (let z = -4; z < 4; z += 2) block([3, 5, z], [15, .65, .4], wall);
                block([8, 1.5, -4.6], [2.4, 3, .12], trim); block([8, 1.5, -4.45], [2, 2.7, .1], ink);
                if (work) for (const x of [-2, 1, 4]) { block([x, 1.5, -3.5], [2, 3, 1], wall); for (let y = .4; y < 2.9; y += .5) block([x, y, -2.94], [1.5, .06, .04], glow); }
                else { block([-1, .2, -2], [2.2, .4, 1.1], wall); block([-1, .49, -2], [2.1, .18, 1.05], dark); block([-1.65, .66, -2], [.5, .16, .85], trim); }
                table(6, 0); break;
            }
            case 'garden': {
                // Riverside café, striped awning and a wide water opening; office has service counters.
                // The continuous canal below meets both banks without a strip of sky between them.
                for (let x = -15; x < 19; x += 5) building(x, -25, 4, 4 + (x + 15) % 3, 4);
                block([-4, 2.8, -1], [.3, 5.6, 9], red);
                for (const x of [-3, 3, 9]) block([x, 2.8, -5], [.18, 5.6, .18], trim);
                for (let x = -4; x < 11; x++) block([x, 5.3, -1], [1, .08, 9], x % 2 ? cream : red).rotation.z = -.04;
                for (const x of [-1, 4, 8]) { column([x, .365, -2], .07, .73, dark); column([x, .765, -2], .62, .07, cream); }
                if (work) { block([2, .5, -3], [10, 1, 1.4], wall); block([2, 1.035, -3], [10.3, .07, 1.6], trim); }
                else { bench(0, 0); bench(7, 0); block([-2, 2.2, -4.5], [2, 2.2, .08], dark); }
                plant(9, -4, 2.5); break;
            }
            case 'vault': {
                windowWall(mat('#8b7d68'),3.2);block([-4.6,1.6,-1],[.3,3.2,8],wall);
                for(const z of [-4,0,4])block([3,3.2,z],[15,.18,.2],wood);
                for(const x of [-1.8,1.3]) {
                    for(const y of [.35,1.55]){block([x,y,-2],[2.3,.12,1.05],dark);block([x,y+.13,-2],[2.2,.14,1],cream);block([x+.65,y+.23,-2],[.5,.1,.8],trim);}
                    for(const dx of [-1.15,1.15])block([x+dx,1,-2],[.06,2,.06],trim);
                }
                for(const x of [5.5,6.3,7.1]){block([x,.9,-4],[.7,1.8,.65],mat('#64766c'));block([x+.2,1,-3.65],[.035,.18,.04],trim);}
                table(7,0);pendant(6,2.5,0);break;
            }
            case 'school': {
                // A split-level learning house, rose plaster and blue reading alcoves.
                windowWall(wall, 6); block([-4.5, 3, -.7], [.3, 6, 8.5], trim);
                for (let i = 0; i < 6; i++) block([-3 + i * .65, i * .35, -2.7], [.65, .7 + i * .7, 3], cream);
                shelves(4.5, -4.6, 6); shelves(8.7, -4.6, 6);
                block([4, 4.8, -4.5], [6, 1.2, .07], glass);
                for (const x of [2, 6, 10]) block([x, 5.8, -.5], [.15, .22, 9], wood);
                if (work) { for (const x of [1, 5, 9]) table(x, -.5); block([3, 2.4, -4.2], [4.5, 1.8, .1], dark); }
                else { block([5, .23, -1.7], [5, .46, .8], trim); table(5, .3); }
                pendant(4, 4, -.5); break;
            }
            case 'conservatory': {
                // Glass pavilion entirely surrounded by living foliage; no masonry room box.
                for (const z of [-7, -4, -1, 2]) arch(3, z, 7, trim);
                block([3, 4, -7], [14, 8, .07], glass); block([-4, 3.5, -1], [.07, 7, 12], glass);
                for (const x of [-4, 10]) for (const z of [-7, -3, 1]) plant(x, z, 4 + (z + 7) % 3);
                block([3, -.05, -1], [3, .12, 14], cream);
                if (work) { for (let i = 0; i < 3; i++) block([3, i * .22, -4.2 - i * .7], [9, .3, 2.5], wood); for (const x of [-1, 7]) bench(x, 0); }
                else { column([1, .23, -2], 1.1, .46, cream); column([7, .23, -2], 1.1, .46, cream); table(4, 0); }
                break;
            }
            default: {
                // Heavy stone hearth and timber roof frame; forge opens into a rough workshop.
                windowWall(wall, 4.4); block([-4.5, 2.2, -.5], [.5, 4.4, 9], wall);
                for (let row = 0; row < 8; row++) for (let x = -4; x < 11; x += 2) block([x + row % 2 * .65, .3 + row * .52, -4.74], [1.85, .47, .12], row % 3 ? wall : floor);
                for (const z of [-4, -.5, 3]) { block([-.8, 5.2, z], [8.5, .3, .2], wood).rotation.z = .3; block([7, 5.2, z], [8.5, .3, .2], wood).rotation.z = -.3; }
                block([-1, 1.5, -3.6], [3.3, 3, 1.8], dark); block([-1, .7, -2.65], [2.3, 1.3, .08], ink);
                block([-1, .4, -2.56], [1.8, .25, .1], work ? glow : dark); block([-1, 3.6, -3.6], [1.3, 2, 1.3], dark);
                if (work) { block([5, .35, -1], [.8, .7, .6], wood); block([5, .8, -1], [1.1, .2, .5], dark); shelves(8, -4.2, 3); }
                else { table(5, -.5); bench(5, 1); block([8, 1.8, -4.65], [1.2, 1.8, .1], glow); }
                break;
            }
        }
        const practical = new PointLight(p.sun, p.layout === 'wall' || p.layout === 'vault' ? 45 : 22, 16, 2);
        practical.position.set(p.layout === 'hamlet' ? (work ? -1 : 8) : 4, p.layout === 'hamlet' ? (work ? 1.3 : 3) : 3.5, p.layout === 'hamlet' ? -1.5 : 1);
        environment.add(practical);
        };
    const mixers: AnimationMixer[] = [], bodies: Object3D[] = [];
    const actions: Map<string, AnimationAction>[] = [];
    const play = (person: number, clip: string): void => {
        const own = actions[person]; if (!own) return;
        const next = own.get(clip); if (!next) return;
        for (const action of own.values()) if (action !== next) action.fadeOut(.18);
        next.reset().fadeIn(.18).play();
    };
    interface Arrival {
        elapsed: number; duration: number; finish: () => void;
        from: Vector3; to: Vector3; fromRotation: Quaternion; toRotation: Quaternion;
        bodyFrom: Vector3; bodyTo: Vector3; yaw: number;
    }
    let arrival: Arrival | null = null;
    let shotCount = 0;
    const finishArrival = (): void => {
        const pending = arrival; if (!pending) return;
        arrival = null;
        camera.position.copy(pending.to); camera.quaternion.copy(pending.toRotation);
        bodies[0]!.position.copy(pending.bodyTo); bodies[0]!.rotation.y = pending.yaw;
        play(0, 'idle'); play(1, 'talk'); box.dataset['performing'] = 'false';
        projectHead();
        pending.finish();
    };
    let disposed = false, raf = 0, last = 0, current = '';
    const cleanup = (): void => { photo?.dispose(); sorayaRoom?.dispose(); artSets.forEach(set => set.dispose()); for (const g of geos)
        g.dispose(); for (const m of mats)
        m.dispose(); for (const t of textures)
        t.dispose(); renderer.dispose(); };
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), base = import.meta.env.BASE_URL.replace(/\/$/, '');
    try {
        const gltfs = await Promise.all(['player', p.body].map(id => loader.loadAsync(`${base}/worlds/w10/characters/char.${id}.glb`)));
        for (let i = 0; i < gltfs.length; i++) {
            const gltf = gltfs[i]!, body = gltf.scene;
            if (i === 0) applyPlayerOutfit(body);
            bodies.push(body);
            people.add(body);
            body.position.set(3.6 + i * 1.7, 0, 2);
            body.rotation.y = i === 0 ? Math.PI / 2 : -Math.PI / 2;
            body.traverse(o => { if (o instanceof Mesh) {
                o.castShadow = o.receiveShadow = true;
                geos.add(o.geometry);
                for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
                    mats.add(m);
                    for (const v of Object.values(m))
                        if (v && typeof v === 'object' && 'isTexture' in v)
                            textures.add(v as Texture);
                }
            } });
            const mixer = new AnimationMixer(body);
            const own = new Map(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
            actions.push(own); mixers.push(mixer); play(i, i ? 'talk' : 'idle');
        }
    }
    catch (error) {
        status.textContent = 'Les personnages n’ont pas pu être chargés. Recharge le quartier pour réessayer.';
        box.dataset['error'] = 'characters';
        cleanup();
        throw error;
    }
    const head = bodies[0]!.getObjectByName('head');
    const projectedHead = new Vector3(), cameraHead = new Vector3();
    const projectHead = (): void => {
        if (!emotionSet || !head || disposed) { headAnchor.hidden = true; return; }
        people.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        head.getWorldPosition(projectedHead);
        // MPFB's head bone is at the skull base: lift to its crown, then leave a small pixel gap.
        projectedHead.y += .25;
        cameraHead.copy(projectedHead).applyMatrix4(camera.matrixWorldInverse);
        projectedHead.project(camera);
        const visible = cameraHead.z < -camera.near && projectedHead.z >= -1 && projectedHead.z <= 1 && Math.abs(projectedHead.x) <= 1 && Math.abs(projectedHead.y) <= 1;
        headAnchor.hidden = !visible;
        if (!visible) return;
        headAnchor.style.left = `${(projectedHead.x * .5 + .5) * viewportWidth}px`;
        headAnchor.style.top = `${(-projectedHead.y * .5 + .5) * viewportHeight - 8}px`;
    };
    const setEmotion = (label: string, tone: string, detail: string): void => {
        if (disposed) return;
        const colors: Record<string, string> = { calm: '#80d2ae', hope: '#80d2ae', success: '#80d2ae', tense: '#f1bd70', stress: '#f1bd70', warning: '#f1bd70', danger: '#ed817a', failure: '#ed817a', neutral: '#8fc8e0', curious: '#8fc8e0' };
        moodLabel.textContent = label; moodBar.style.background = colors[tone] ?? '#8fc8e0';
        emotion.dataset['tone'] = tone; emotion.title = detail;
        emotion.setAttribute('aria-description', detail);
        emotionSet = label.trim().length > 0; projectHead();
    };
    const frameCamera = (kind: Journey['locations'][number]['kind']): void => {
        const inside = kind === 'home' || kind === 'work';
        if (kind === 'landmark') {
            camera.position.set(11, 5.2, 10);
            camera.lookAt(.5, 1.7, -4);
            people.position.set(0, 0, -4);
        }
        else if (kind === 'work') {
            camera.position.set(p.camera[0]! + 1, p.camera[1]! + .6, p.camera[2]! - 1);
            camera.lookAt(.2, -.5, 1);
            people.position.set(0, 0, 2.7);
        }
        else {
            camera.position.set(p.camera[0]!, p.camera[1]! + (inside ? 0 : 1.2), p.camera[2]! + (inside ? 0 : 2));
            camera.lookAt(inside ? .2 : -.5, -.35, inside ? 1.5 : 1);
            people.position.set(0, 0, inside ? 2.7 : 3);
        }
        if (kind === 'landmark' && p.layout === 'garden') {
            people.position.set(0, 0, .7); camera.position.set(11, 4.4, 12); camera.lookAt(3, .6, -1.2);
        }
        if (kind === 'landmark' && p.layout === 'oracle') {
            people.position.set(0,0,ORACLE_APPROACH.groupZ);
            camera.position.set(...ORACLE_APPROACH.camera); camera.lookAt(...ORACLE_APPROACH.focus);
        }
        // Domestic shots give the people and crafted surfaces the frame, rather than empty floor.
        if (inside && journey.id !== 'w02') {
            camera.position.set(p.camera[0]! * .8, p.camera[1]! * .85, p.camera[2]! * .9);
            camera.lookAt(3.4, .45, 1.6);
        }
        if (kind === 'work' && p.layout !== 'oracle') {
            const deep = ['vault','wall','conservatory','commons','hamlet'].includes(p.layout);
            camera.position.set(deep?13:12,deep?5.2:4.8,14);
            camera.lookAt(0,.9,deep?-2:-1);
        }
        if (framing === 'portrait' && !(journey.id === 'w02' && current === 'home')) {
            const subject = new Vector3(4.45, 1.1, 2 + people.position.z);
            camera.position.lerp(subject, .18); camera.lookAt(subject);
        }
        if (journey.id === 'w05' && current === 'cafe') {
            people.position.set(0,0,1);
            camera.position.set(12,5.6,14); camera.lookAt(1.4,1,-1.2);
            if (framing === 'portrait') { camera.position.set(9,3.1,10); camera.lookAt(3.5,1,1.7); }
        }
        // Portrait screens keep both people above the dialogue panel.
        if (camera.aspect < 0.85) camera.lookAt(4.45, 0.35, 2 + people.position.z);
        if (journey.id === 'w05' && current === 'cafe' && (framing === 'counter' || framing === 'blankets')) {
            if (framing === 'counter') { camera.position.set(1,2.3,2); camera.lookAt(-2,1.1,-1.7); }
            else { camera.position.set(10.2,2.4,8.2); camera.lookAt(8,.7,4.8); }
            if (camera.aspect < .85) { camera.position.add(new Vector3(1,1,2)); }
        }
        if (journey.id === 'w02' && current === 'home') {
            people.position.set(0, 0, 2.7);
            camera.position.set(9, 3.6, 13); camera.lookAt(3.8, .4, 1.5);
            if (framing === 'portrait') { camera.position.set(7.9, 2.6, 10); camera.lookAt(4.3, .9, 3.8); }
            if (camera.aspect < .85) { camera.position.set(7.2, framing === 'portrait' ? 2.9 : 3.5, framing === 'portrait' ? 12.5 : 15.5); camera.lookAt(4.4, framing === 'portrait' ? .55 : .25, 3.7); }
        }
    };
    const resize = (): void => { const w = host.clientWidth || doc.defaultView?.innerWidth || 1280, h = host.clientHeight || doc.defaultView?.innerHeight || 720; viewportWidth = w; viewportHeight = h; renderer.setPixelRatio(Math.min(doc.defaultView?.devicePixelRatio ?? 1, 2, Math.sqrt(4_000_000 / (w * h)))); renderer.setSize(w, h); photo?.resize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); const loc = journey.locations.find(l => l.id === current); if (loc) frameCamera(loc.kind); projectHead(); };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const renderScene = (): void => { if (photographic && photo) photo.render(); else renderer.render(scene, camera); };
    const frame = (now: number): void => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        const dt = Math.min((now - last) / 1000, .05); last = now;
        if (doc.hidden) return;
        if (arrival) {
            arrival.elapsed += dt;
            const t = Math.min(1, arrival.elapsed / arrival.duration);
            const smooth = t * t * (3 - 2 * t);
            camera.position.lerpVectors(arrival.from, arrival.to, smooth);
            camera.quaternion.slerpQuaternions(arrival.fromRotation, arrival.toRotation, smooth);
            // A controlled entrance in front of the set avoids walking through its furniture.
            bodies[0]!.position.lerpVectors(arrival.bodyFrom, arrival.bodyTo, Math.min(1, t / .82));
            if (t >= 1) finishArrival();
        }
        for (const mixer of mixers) mixer.update(dt);
        projectHead();
        renderScene();
    };
    const show = (id: string, inventory: readonly string[]): void => {
        finishArrival();
        const loc = journey.locations.find(l => l.id === id);
        if (!loc)
            throw new Error(`Lieu inconnu : ${journey.id}/${id}`);
        box.dataset['world'] = journey.id;
        box.dataset['location'] = id;
        box.dataset['inventory'] = String(inventory.length);
        if (id === current)
            return;
        current = id; framing = 'wide';
        const inside = loc.kind === 'home' || loc.kind === 'work';
        ambient.intensity = (p.lighting.ambient + .12) * (inside ? .85 : 1);
        fill.intensity = (p.lighting.fill + .18) * (inside ? .8 : 1);
        sun.intensity = p.lighting.sunPower * (inside && (p.layout === 'wall' || p.layout === 'vault') ? .45 : 1);
        // Keep each world's lighting palette; the shared finish only gives it a restrained film response.
        const grades: Record<string, { shadows: readonly number[]; highlights: readonly number[] }> = {
            terraces: { shadows: [.006,-.006,.012], highlights: [.019,.003,-.012] },
            wall: { shadows: [-.01,.002,.018], highlights: [.008,.004,-.004] },
            vault: { shadows: [-.008,.012,.009], highlights: [.018,.009,-.012] },
            school: { shadows: [.009,-.004,.012], highlights: [.016,.008,-.005] },
            conservatory: { shadows: [-.006,.012,.002], highlights: [.012,.014,-.008] },
            hamlet: { shadows: [-.004,.002,.009], highlights: [.02,.006,-.014] },
        };
        if (!photo) { photo = createPhotographicFinish(renderer, scene, camera, grades[p.layout]); photo.resize(viewportWidth, viewportHeight); }
        const prototype = journey.id === 'w02' && id === 'home';
        if (prototype) {
            sun.position.set(-8, 8, -10); sun.intensity = 3.8;
            Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .015;
            sun.color.set('#ffdfb0'); ambient.intensity = .65; actorFill.intensity = 1.05;
            fill.intensity = .68; fill.color.set('#b8d9dd'); renderer.toneMappingExposure = 1.05;
        } else {
            sun.position.set(p.lighting.sunPosition[0]!, p.lighting.sunPosition[1]!, p.lighting.sunPosition[2]!);
            Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .035;
            sun.color.set(p.sun); fill.color.set(p.sky); actorFill.intensity = 1.35; renderer.toneMappingExposure = p.lighting.exposure;
        }
        box.dataset['photographic'] = String(photographic);
        box.dataset['architecture'] = `${p.layout}-${loc.kind}`;
        for (const group of locationGroups.values())
            group.visible = false;
        const cached = locationGroups.get(id);
        if (cached) {
            environment = cached;
            environment.visible = true;
        }
        else {
            environment = new Group();
            environment.name = `${journey.id}.${id}`;
            locationGroups.set(id, environment);
            scene.add(environment);
            if (inside) {
                interior(loc.kind === 'work');
                if (!(journey.id === 'w05' && loc.id === 'cafe') && !prototype && (loc.kind !== 'work' || p.layout === 'oracle')) { const art = buildInteriorArt(p.layout, loc.kind === 'work'); environment.add(art.group); artSets.push(art); }
            } else {
                outdoor(loc.kind === 'public');
                const art = buildExteriorArt(p.layout, loc.kind === 'public'); environment.add(art.group); artSets.push(art);
                const landscape = buildLandscape(p.layout, loc.kind === 'public'); environment.add(landscape.group); artSets.push(landscape);
            }
        }
        // Material relief on opaque architectural surfaces, never characters, glass or signs.
        environment.traverse(node => {
            if (!(node instanceof Mesh) || node.geometry instanceof PlaneGeometry) return;
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
                if (!(material instanceof MeshStandardMaterial) || material.transparent || material.metalness > .35 || material.emissiveIntensity > 1 || material.bumpMap || material.normalMap) continue;
                material.bumpMap = grain; material.bumpScale = material.roughness > .65 ? .022 : .008; material.needsUpdate = true;
            }
        });
        frameCamera(loc.kind);
        status.remove();
        projectHead();
        renderScene();
    };
    const perform = (id: string, inventory: readonly string[]): Promise<void> => {
        if (disposed) return Promise.resolve();
        finishArrival(); show(id, inventory);
        const location = journey.locations.find(loc => loc.id === id)!;
        frameCamera(location.kind);
        const reduced = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
        if (reduced) { renderScene(); return Promise.resolve(); }
        const wide = camera.position.clone(); const wideRotation = camera.quaternion.clone();
        const person = bodies[0]!;
        const bodyTo = person.position.clone();
        const subject = new Vector3(4.45, 1.25, people.position.z + 2);
        const cafe = journey.id === 'w05' && id === 'cafe';
        const oracle = p.layout === 'oracle' && location.kind === 'landmark';
        const mode = oracle || cafe ? 0 : shotCount++ % 3;
        // Wide arrival, closer two-shot, then a gentle lateral detail angle; no orbit through walls.
        if (mode !== 0 && camera.aspect >= .85) {
            camera.position.lerp(subject, mode === 1 ? .14 : .24);
            if (mode === 2) camera.position.x += .45;
            camera.lookAt(subject.x - 3.5, subject.y, subject.z - .6);
        }
        const to = camera.position.clone(), toRotation = camera.quaternion.clone();
        const from = oracle ? new Vector3(19,10,26) : cafe ? new Vector3(17,8,21) : wide.clone().add(new Vector3(mode === 2 ? -1.8 : 2.2, .65, 3.5));
        if (oracle) { camera.position.copy(from); camera.lookAt(3,2,-8); wideRotation.copy(camera.quaternion); }
        camera.position.copy(from); camera.quaternion.copy(wideRotation);
        const bodyFrom = bodyTo.clone().add(oracle ? new Vector3(...ORACLE_APPROACH.from) : new Vector3(-1.25, 0, .45));
        person.position.copy(bodyFrom); const yaw = person.rotation.y;
        person.rotation.y = Math.atan2(bodyTo.x - bodyFrom.x, bodyTo.z - bodyFrom.z);
        play(0, 'walk'); play(1, 'idle'); box.dataset['performing'] = 'true';
        return new Promise<void>(resolve => {
            arrival = { elapsed: 0, duration: oracle || cafe ? 4.5 : 3.2, finish: resolve, from, to, fromRotation: wideRotation, toRotation, bodyFrom, bodyTo, yaw };
        });
    };
    show(journey.scenes.find(s => s.id === journey.start)!.location, []);
    raf = requestAnimationFrame(frame);
    return { show, perform, skip: finishArrival, setEmotion,
        setPhotographic(enabled) { photographic = enabled; box.dataset['photographic'] = String(enabled); renderScene(); },
        setFraming(shot) { finishArrival(); framing = shot; box.dataset['shot'] = shot; const loc = journey.locations.find(l => l.id === current); if (loc) frameCamera(loc.kind); projectHead(); renderScene(); },
        dispose() { if (disposed)
            return; finishArrival(); disposed = true; cancelAnimationFrame(raf); observer.disconnect(); for (let i = 0; i < mixers.length; i++) {
            mixers[i]!.stopAllAction();
            mixers[i]!.uncacheRoot(bodies[i]!);
        } cleanup(); box.remove(); } };
}
