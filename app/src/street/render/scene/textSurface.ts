/**
 * Surface de texte de la scène : un plan émissif qui affiche une ligne [plan 02a T6]. L'usine est injectable (`opts.textSurface`)
 * pour les tests ; celle par défaut dessine sur un canevas 2D quand le navigateur en offre un, sinon garde le texte seul.
 * Le texte courant est toujours lu sur `object.userData.text`, canevas ou non.
 */
import { CanvasTexture, Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three/webgpu';
import type { ResourceBag } from './resources';

/** Une surface qui affiche un texte. */
export interface TextSurface { readonly object: Object3D; setText(text: string): void }
/** Fabrique de surface : taille en mètres, ressources suivies par `bag`. */
export type TextSurfaceFactory = (o: { readonly widthM: number; readonly heightM: number; readonly bag: ResourceBag }) => TextSurface;

const PX_WIDTH = 1024;

/** Usine par défaut : canevas 2D si disponible (aucun accès à `document` sans lui), plan sombre sinon. */
export const canvasTextSurface: TextSurfaceFactory = ({ widthM, heightM, bag }) => {
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const ctx = canvas === null ? null : (canvas.getContext('2d') as CanvasRenderingContext2D | null);
  const material = bag.material(new MeshBasicNodeMaterial({ color: new Color('#101418') }));
  const mesh = new Mesh(bag.geometry(new PlaneGeometry(widthM, heightM)), material);
  let texture: CanvasTexture | null = null;
  if (canvas !== null && ctx !== null) {
    canvas.width = PX_WIDTH;
    canvas.height = Math.max(1, Math.round((PX_WIDTH * heightM) / widthM));
    texture = bag.texture(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    material.map = texture;
    material.color = new Color('#ffffff');
  }
  return {
    object: mesh,
    setText(text: string): void {
      mesh.userData['text'] = text;
      if (canvas === null || ctx === null || texture === null) return;
      ctx.fillStyle = '#101418';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(canvas.height * 0.62)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.96);
      texture.needsUpdate = true;
    },
  };
};
