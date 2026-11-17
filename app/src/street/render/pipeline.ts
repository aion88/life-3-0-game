/** Chaîne de post-process de la rue [art bible §E ; plan 02a T4]. */
import {
  ACESFilmicToneMapping, ClampToEdgeWrapping, Data3DTexture, LinearFilter, NeutralToneMapping, NoToneMapping, RenderPipeline, RGBAFormat,
  SRGBColorSpace, UnsignedByteType,
} from 'three/webgpu';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import {
  abs, dot, exp2, float, fract, mix, mrt, output, pass, renderOutput, screenUV, select, sin, texture3D, toneMapping, uniform, vec2, vec3, vec4,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
import type { GradeUniforms, LightBlend } from '../../engine/view/grade';
import type { LightState, SceneData } from '../../engine/view/sceneSchema';
import { bakeLut, LUT_SIZE, type LutParams } from './lut';

/**
 * Ordre des étapes [art bible §E] : le grain passe APRÈS la LUT et la vignette avant lui [§E.8, E.9].
 * `antialias` (FXAA) est un ajout hors §E : sur l'image d'affichage (sRGB, exigé par le nœud) après la LUT, avant vignette et grain (le grain ne se lisse pas).
 * `chromatic` n'existe que si l'aberration est activée, `letterbox` que si les bandes le sont.
 */
export function pipelineStages(o: { readonly aberration: boolean; readonly letterbox: boolean; readonly antialias?: boolean }): readonly string[] {
  return ['scene', 'dof', 'bloomMask', ...(o.aberration ? ['chromatic'] : []), 'exposure', 'toneMap', 'lut', ...(o.antialias === false ? [] : ['antialias']), 'vignette', 'grain', ...(o.letterbox ? ['letterbox'] : [])];
}

/** Demi-zone nette : la formule vit avec l'optique pure (`engine/view/dof`), re-exportée ici pour la chaîne. */
export { sharpHalfZoneM } from '../../engine/view/dof';

/** Les écrans seuls écrivent le canal de bloom : `material.mrtNode = screenBloomMrt()` [Context7, exemple de bloom sélectif]. */
export const screenBloomMrt = () => mrt({ bloomSrc: output });

/** Gamma d'affichage : un diaph de lumière vaut 2,2 diaphs d'écart en valeur sRGB, la vignette en IL s'y ramène [art bible §D.1]. */
export const DISPLAY_GAMMA = 2.2;

/**
 * Opérations arithmétiques d'une formule de chaîne, écrites UNE fois : le graphe TSL de production et le test
 * les parcourent par les mêmes fonctions (`vignetteFactor`, `liftToBlackPoint`), seule l'algèbre change.
 */
export interface Ops<T> {
  num(n: number): T;
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mul(a: T, b: T): T;
  div(a: T, b: T): T;
  exp2(a: T): T;
}

/** Algèbre des nombres, pour évaluer les formules de la chaîne en CPU (tests). */
export const NUMBER_OPS: Ops<number> = {
  num: (n) => n, add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, div: (a, b) => a / b, exp2: (a) => 2 ** a,
};

/** Algèbre des nœuds TSL, celle de la chaîne de production. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSL_OPS: Ops<any> = {
  num: (n) => float(n), add: (a, b) => a.add(b), sub: (a, b) => a.sub(b), mul: (a, b) => a.mul(b), div: (a, b) => a.div(b), exp2: (a) => exp2(a),
};

/** Facteur de la vignette en espace d'affichage : `2^(IL x r² / 2,2)`, `r²` valant 0 au centre et 1 aux coins. */
export function vignetteFactor<T>(o: Ops<T>, il: T, r2: T): T {
  return o.exp2(o.div(o.mul(il, r2), o.num(DISPLAY_GAMMA)));
}

/** Point noir en SORTIE [art bible §B.1] : le noir pur sort à `blackPoint`, le blanc reste à 1. */
export function liftToBlackPoint<T>(o: Ops<T>, c: T, blackPoint: T): T {
  return o.add(o.mul(c, o.sub(o.num(1), blackPoint)), blackPoint);
}

/** Écart-type du bruit uniforme sur [-0,5 ; 0,5] : 1/√12, ramené à 1 par le facteur √12. */
const UNIT_NOISE = Math.sqrt(12);

export interface PostOptions {
  readonly aberration: boolean;
  readonly letterbox: boolean;
  /** Faux : pas de FXAA (prise de vue qui isole une étape : `?bloom=`, `?lut=`). Absent : FXAA. */
  readonly antialias?: boolean;
  /** `dof.walk` ou `dof.observation` de la scène : portée de flou total en mètres et échelle du bokeh. */
  readonly dof: { readonly focalLengthM: number; readonly bokehScale: number };
  /** Réglages de LUT par état de lumière. */
  readonly luts: Readonly<Record<LightState, LutParams>>;
  /** Bloom, aberration et poids du grain par la luma : `scene.postfx`, tous `supposed` [R-02a.18]. */
  readonly postfx: SceneData['postfx'];
  /** Prise de vue seulement : sans LUT dans la chaîne (comparaison avec la LUT identité, plan 02a T13). Absent : la LUT est appliquée. */
  readonly bypassLut?: boolean;
  /** État de départ, pris dans la donnée : aucune valeur de conception ne vit ici. */
  readonly initial: { readonly grade: GradeUniforms; readonly blend: LightBlend; readonly focusM: number };
}

export interface PostChain {
  readonly pipeline: RenderPipeline;
  readonly stages: readonly string[];
  /** Uniformes de la chaîne, exposés pour les tests de structure du graphe. */
  readonly uniforms: { readonly blackPoint: object; readonly grain: object; readonly vignetteIL: object };
  /** Nœud final de la chaîne, avant la sortie du pipeline. */
  readonly finalNode: object;
  /** Pose les uniformes d'étalonnage et le fondu de LUT. */
  setGrade(u: GradeUniforms, blend: LightBlend): void;
  /** Distance de mise au point et demi-épaisseur de la zone nette (m). */
  setFocus(distanceM: number, halfM?: number): void;
  setDof(d: PostOptions['dof']): void;
  setAspect(aspect: number): void;
  setTime(seconds: number): void;
  render(): void;
  dispose(): void;
}

export const LETTERBOX_ASPECT = 2.39;

type Vec4Node = ReturnType<typeof vec4>;
/** Les .d.ts des nœuds d'addons les typent en classe de nœud, alors qu'à l'exécution ce sont des nœuds `vec4`. */
const asVec4 = (n: object): Vec4Node => n as unknown as Vec4Node;

function lutTexture(params: LutParams): Data3DTexture {
  const t = new Data3DTexture(bakeLut(LUT_SIZE, params), LUT_SIZE, LUT_SIZE, LUT_SIZE);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

/**
 * Monte la chaîne dans l'ordre de `pipelineStages`. Sortie sRGB faite ici : `outputColorTransform` est coupé.
 * Le point noir est la DERNIÈRE opération de couleur (après le grain, avant les bandes) : il porte sur la sortie.
 * Les opérations de vignette et de grain sont écrites en expressions, sans `Fn`, pour que le graphe soit parcourable.
 */
export function createPostChain(renderer: WebGPURenderer, scene: Scene, camera: Camera, o: PostOptions): PostChain {
  const px = o.postfx;
  const u = {
    focus: uniform(o.initial.focusM), half: uniform(0), range: uniform(o.dof.focalLengthM), bokeh: uniform(o.dof.bokehScale),
    exposure: uniform(o.initial.grade.exposure), aces: uniform(o.initial.grade.toneMap === 'aces' ? 1 : 0),
    blackPoint: uniform(o.initial.grade.blackPoint), vignetteIL: uniform(o.initial.grade.vignetteIL), grain: uniform(o.initial.grade.grain / 100),
    blend: uniform(o.initial.blend.t), aspect: uniform(16 / 9), time: uniform(0),
  };
  const luts: Record<LightState, Data3DTexture> = {
    jour: lutTexture(o.luts.jour), heureBleue: lutTexture(o.luts.heureBleue), nuit: lutTexture(o.luts.nuit),
  };
  const lutA = texture3D(luts[o.initial.blend.from]);
  const lutB = texture3D(luts[o.initial.blend.to]);

  // scene : HDR linéaire, MRT `output` + `bloomSrc` (noir par défaut, seuls les écrans l'écrivent)
  // `samples: 0` : la profondeur que `dof` échantillonne (viewZ) doit être résolue. Le backend WebGPU de r186 rend la profondeur dans une texture MSAA
  // (`msaaTextures`, WebGPUBackend.js ~l.824) et n'a aucun équivalent de `resolveDepthBuffer` : WebGPU ne sait pas résoudre une profondeur, la texture
  // échantillonnée reste vide, `dof` croit tout à la même distance et noie l'image en bleu pâle [lu dans node_modules/three r186 ; mesuré sur Chrome 156 /
  // Metal, plan 02a T13]. Sans MSAA le rendu est juste ; l'anticrénelage est refait en post par FXAA (étape `antialias`, TV-02a-render).
  const scenePass = pass(scene, camera, { samples: 0 });
  scenePass.setMRT(mrt({ output, bloomSrc: vec4(0) }));
  const sceneColor = scenePass.getTextureNode('output');
  const bloomSrc = scenePass.getTextureNode('bloomSrc');
  const viewZ = scenePass.getViewZNode();

  // zone nette : le plan net est épaissi de `half` de chaque côté (`effectiveDepth` en TSL), le nœud ne floute qu'au-delà [TV-02a-render]
  const signedDepth = viewZ.negate().sub(u.focus);
  const sharpDepth = u.focus.add(signedDepth.sign().mul(signedDepth.abs().sub(u.half).max(0))).negate();   // viewZ est négatif devant la caméra
  const blurred = asVec4(dof(sceneColor, sharpDepth, u.focus, u.range, u.bokeh));                                         // dof
  const lit = blurred.add(asVec4(bloom(bloomSrc, px.bloom.strength.v, px.bloom.radius.v, px.bloom.threshold.v)));        // bloomMask
  // centre explicite : l'addon r186 documente `null` = centre d'écran mais plante au premier rendu réel (`build` sur null) [mesuré, plan 02a T13]
  const fringed = o.aberration ? asVec4(chromaticAberration(lit, float(px.chromatic.v), vec2(0.5, 0.5))) : lit;                            // chromatic
  const exposed = fringed.mul(u.exposure);                                                                                // exposure
  const mapped = mix(                                                                                                     // toneMap, puis sortie sRGB
    toneMapping(NeutralToneMapping, float(1), exposed.rgb),
    toneMapping(ACESFilmicToneMapping, float(1), exposed.rgb),
    u.aces,
  );
  const display = renderOutput(vec4(mapped, 1), NoToneMapping, SRGBColorSpace);
  const graded = o.bypassLut === true ? asVec4(display)                                                                  // lut (absente à la prise de vue `?lut=off`)
    : mix(asVec4(lut3D(display, lutA, LUT_SIZE, float(1))), asVec4(lut3D(display, lutB, LUT_SIZE, float(1))), u.blend);   // lut

  const smoothed = o.antialias === false ? graded : asVec4(fxaa(graded));                                                                                  // antialias : FXAA sur l'image d'affichage

  const d = screenUV.sub(0.5).mul(2);                                                                                     // vignette : IL aux coins, r² du centre
  const r2 = dot(d, d).mul(0.5);
  const vignetted = vec4(smoothed.rgb.mul(vignetteFactor(TSL_OPS, u.vignetteIL, r2)), 1);

  const seed = dot(screenUV.mul(vec2(1920, 1080)).add(u.time.mul(60)), vec2(12.9898, 78.233));                            // grain : après la LUT, plus fort dans les ombres
  const noise = fract(sin(seed).mul(43758.5453)).sub(0.5).mul(UNIT_NOISE);
  const luma = dot(vignetted.rgb, vec3(0.2126, 0.7152, 0.0722));
  const weight = mix(px.grainLumaWeight.dark.v, px.grainLumaWeight.bright.v, luma);
  const grained = vec4(vignetted.rgb.add(noise.mul(u.grain).mul(weight)), 1);

  const floored = vec4(liftToBlackPoint(TSL_OPS, grained.rgb, u.blackPoint), 1);                                // point noir : dernière opération de couleur

  const finalNode = o.letterbox                                                                                           // letterbox 2.39:1
    ? select(
      abs(screenUV.y.sub(0.5)).lessThanEqual(u.aspect.div(LETTERBOX_ASPECT).min(1).mul(0.5)),
      floored,
      vec4(0, 0, 0, 1),
    )
    : floored;

  const pipeline = new RenderPipeline(renderer, finalNode);
  pipeline.outputColorTransform = false;

  return {
    pipeline,
    stages: pipelineStages(o),
    uniforms: { blackPoint: u.blackPoint, grain: u.grain, vignetteIL: u.vignetteIL },
    finalNode,
    setGrade(g, b) {
      u.exposure.value = g.exposure;
      u.aces.value = g.toneMap === 'aces' ? 1 : 0;
      u.blackPoint.value = g.blackPoint;
      u.vignetteIL.value = g.vignetteIL;
      u.grain.value = g.grain / 100;
      lutA.value = luts[b.from];
      lutB.value = luts[b.to];
      u.blend.value = b.t;
    },
    setFocus(m, halfM = 0) { u.focus.value = m; u.half.value = halfM; },
    setDof(v) { u.range.value = v.focalLengthM; u.bokeh.value = v.bokehScale; },
    setAspect(a) { u.aspect.value = a; },
    setTime(sec) { u.time.value = sec; },
    render() { pipeline.render(); },
    dispose() { pipeline.dispose(); for (const t of Object.values(luts)) t.dispose(); },
  };
}
