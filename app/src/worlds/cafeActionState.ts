/** Isolated playtest; deliberately independent of the real save and journey. */
export type CafeAction='radio'|'reply'|'light'|'rescue'|'restart';
export interface CafeActionState { phase:'discover'|'prepare'|'choose'|'ending'; power:'off'|'light'|'radio'; sheltered:number; father:'bridge'|'shelter' }
export const newCafeAction=():CafeActionState=>({phase:'discover',power:'off',sheltered:0,father:'bridge'});
export function cafeAction(state:CafeActionState,action:CafeAction):CafeActionState {
 if(action==='restart')return newCafeAction();
 if(state.phase==='discover'&&action==='radio')return {...state,phase:'prepare'};
 if(state.phase==='prepare'&&action==='reply')return {...state,phase:'choose'};
 if(state.phase==='choose'&&action==='light')return {...state,phase:'ending',power:'light',sheltered:6};
 if(state.phase==='choose'&&action==='rescue')return {...state,phase:'ending',power:'radio',sheltered:3,father:'shelter'};
 return state;
}
