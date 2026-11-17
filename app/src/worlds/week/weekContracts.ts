import type { Group, Vector3, WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { createStationActor } from '../controlStationActor';

/** 'controle' = copie du décor du contrôle (J3) ; le J1 au contrôle utilise createControlStationView. 'parents' = arrivée chez les parents (J1, branche garantie). */
export type WeekPlace = 'chez-toi' | 'palier' | 'rue' | 'controle' | 'escalier' | 'audition' | 'parents';
/** Maman et Papa : corps empruntés, provisoires (E4). */
export type WeekCast = 'roux' | 'theodore' | 'nadia' | 'marlene' | 'bruno' | 'agente' | 'maman' | 'papa';
export type WeekProp = 'lettre' | 'stylo' | 'dossier' | 'carnet';
export type StageAct = 'enter' | 'checkpoint-pass' | 'phone-up' | 'phone-down';
export type ControlAct = 'approach' | 'requestGuarantee' | 'authorize' | 'goHome';
export type Ending = 'arrete' | 'recrute' | 'relache';

export type Voice = 'dit' | 'narr' | 'machine';
export interface Line { who: string | null; text: string; voice: Voice; cast?: WeekCast }
/** price = texte du prix du prototype AVANT le premier ' · ' (ex. '0 mot', '+15 mots') ; detail = le reste après ' · ' s'il existe ; gain = price commence par '+'. */
export interface Target { id: string; label: string; price: string; detail?: string; gain?: boolean }
export type PieceRow = { heading: string } | { line: string };
export type TicketRow = string | { label: string; value: string; total?: boolean };

export type Beat =
  | { kind: 'scene'; id: string; place: WeekPlace | 'controle-j1'; label: string; day: 1 | 2 | 3; cast: readonly WeekCast[] }
  | { kind: 'lines'; lines: readonly Line[] }
  | { kind: 'say'; words: number }
  | { kind: 'written'; label: string; delta: number }
  | { kind: 'gain'; words: number }
  | { kind: 'gesture'; prompt: string; object?: { label: string; sub?: string }; targets: readonly Target[] }
  | { kind: 'piece'; title: string; prompt: string; rows: readonly PieceRow[]; none: { label: string; price: string } }
  | { kind: 'ticket'; title: string; rows: readonly TicketRow[]; footer?: string }
  | { kind: 'control'; act: ControlAct }
  | { kind: 'stage'; act: StageAct }
  | { kind: 'prop'; id: WeekProp; visible: boolean }
  | { kind: 'ending'; ending: Ending; title: string; regime: string; fact: string; mother?: string; dossier: number; threshold: number; names: readonly string[] };

/** 'gesture' : indice de cible ; 'piece' : indice de ligne (titres exclus) ou -1 ; autres : undefined. */
export type WeekRun = Generator<Beat, void, number | undefined>;

export interface SetMarks {
  entry: Vector3; player: Vector3; playerYaw: number;
  npcs: readonly { at: Vector3; yaw: number }[];
  camera: { offset: Vector3; look: Vector3 };
  props: Partial<Record<WeekProp, Vector3>>;
}
export interface WeekSet {
  readonly root: Group;
  readonly marks: SetMarks;
  setReader?(text: string, ok: boolean): void;
  setBarrier?(t: number): void;
  dispose(): void;
}
export type BuildWeekSet = (place: WeekPlace, doc: Document) => WeekSet;

export interface WeekStageDriver {
  show(place: WeekPlace, cast: readonly WeekCast[]): Promise<void>;
  speak(who: WeekCast | 'player' | null): void;
  prop(id: WeekProp, visible: boolean): void;
  act(act: StageAct): Promise<void>;
  pause(paused: boolean): void;
  skip(): void;
  dispose(): void;
}
/** Coutures de test (happy-dom n'a pas de WebGL) ; absentes en production. */
export interface WeekStageSeams {
  createRenderer?: () => WebGLRenderer;            // test : faux objet casté
  loadGltf?: (url: string) => Promise<GLTF>;       // test : promesse différée (course dispose/chargement)
  createActor?: typeof createStationActor;
}
export interface WeekStageOptions { buildSet: BuildWeekSet; onEvent?: (event: string) => void; seams?: WeekStageSeams }
export type CreateWeekStage = (host: HTMLElement, options: WeekStageOptions) => Promise<WeekStageDriver>;
