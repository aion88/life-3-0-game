import { expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { parseHeadlines } from '../../../src/data/schema/headlines';
import headlines from '../../../src/data/headlines.json';
import { runFastForward } from '../../../src/fastforward/run';
import { SHORT_WORLDS } from '../../../src/worlds/routing';
import { ans } from '../../support/answers';
import { CANONICAL_LINES } from '../../fixtures/canonical-lines';
it('canonical questionnaires still lead to their own worlds in short mode', () => {
 const core=loadCore(), h=parseHeadlines(headlines);
 for (const [id,line] of CANONICAL_LINES) {
  const result=runFastForward(core,h,ans(line),false,SHORT_WORLDS).outcome;
  expect(result.kind==='arrival'?result.livedWorld:result.world).toBe(id);
 }
 let found='';
 for (const a of 'ABC') for(const b of 'ABC') for(const c of 'ABC') for(const d of 'ABC') {
  const line=`D${a}${b}ACBB${c}C${d}C`;
  const r=runFastForward(core,h,ans(line),false,SHORT_WORLDS).outcome;
  if(r.kind==='arrival'&&r.livedWorld==='w09') found=line;
 }
 expect(found).not.toBe('');
});
