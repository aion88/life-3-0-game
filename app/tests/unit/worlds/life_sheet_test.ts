// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { lifeSheet } from '../../../src/worlds/lifeSheet';
import { core, LINES, runLine } from '../../support/screens_ff';
it('plots the six actual arrival trajectories and preserves the authored consequences', () => {
 const run = runLine(LINES.w10);
 const before = JSON.stringify(run);
 const sheet = lifeSheet(document, run, {world:'1984',outcome:'Un délai obtenu',mission:'Protéger ton frère',arrivalStep:core.engine.steps.arrivalStep,moments:[{title:'Signer',text:'Ta sortie est retenue.'}]});
 expect(sheet.querySelectorAll('figure')).toHaveLength(6);
 const points = sheet.querySelector('[data-axis=freedom] polyline')!.getAttribute('points')!.split(' ');
 expect(points).toHaveLength(core.engine.steps.arrivalStep+1);
 expect(Number(points.at(-1)!.split(',')[1])).toBeCloseTo(80-run.trajectory.steps[core.engine.steps.arrivalStep]!.freedom/100000*72);
 expect(sheet.textContent).toContain('Ta sortie est retenue.');
 expect(sheet.textContent).toContain('pas des prévisions');
 expect(JSON.stringify(run)).toBe(before);
});
