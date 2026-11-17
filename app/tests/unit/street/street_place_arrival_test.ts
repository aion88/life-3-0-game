// @vitest-environment happy-dom
/**
 * Retour de playtest de Cynthia, 2026-11-03 : « on m'explique pas quel contrôle, où j'arrive », « on me dit juste : Nadia, le contrôle »,
 * « je marche au milieu d'un mur et on m'écrit d'un seul coup le contrôle ».
 * (1) une ligne du narrateur dit où l'on est quand un groupe s'ouvre ; (2) l'intitulé d'un groupe est une action ; (3) un choix de lieu
 * ne s'ouvre qu'à portée du lieu et en vue.
 */
import { describe, expect, it } from 'vitest';
import { choicesToPresent, inView } from '../../../src/engine/view/interactions';
import { arrivalDue, arrivalKey } from '../../../src/street/onboarding';
import { ruleFor } from '../../../src/i18n/i18n';
import type { StringMeta } from '../../../src/i18n/i18n';
import metaJson from '../../../src/data/strings/meta.json';
import { checkPlayerString } from '../../../src/validate/numbers';
import { PROVISIONAL } from '../../../src/validate/provisional';
import { ctx, FAR, INTERACT, P, posOf, S, streetAt } from '../../support/street_interactions';
import { EN, FR } from '../../support/street_ui';
import { createStreetScreen } from '../../../src/street/screen';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';

const meta = metaJson as StringMeta;
const NORTH = { x: 0, z: 1 }, SOUTH = { x: 0, z: -1 }, EAST = { x: 1, z: 0 }, WEST = { x: -1, z: 0 };   // regard : SOUTH vers -z, le checkpoint
const facing = (f: { x: number; z: number }) => ({ facing: f, keep: [] as string[] });
const REGISTRE_CHOICES = ['m4.list', 'relecture.j1', 'permit.j1'];
const forbidden: readonly string[] = [];

describe('(3) un choix de lieu s\'ouvre à portée et en vue', () => {
  it('test_checkpoint_is_closed_mid_street_and_open_at_the_barrier', () => {
    const d1 = streetAt(1, 440);
    expect(choicesToPresent(d1, { x: 0, z: -1 }, ctx, INTERACT, facing(SOUTH)), 'à mi-rue, devant l\'étal').not.toContain('checkpoint.j1');
    expect(choicesToPresent(d1, { x: 0, z: -10.4 }, ctx, INTERACT, facing(SOUTH)), 'à la barrière').toContain('checkpoint.j1');
  });

  it('test_checkpoint_opens_from_every_point_along_the_barrier', () => {   // la barrière fait toute la largeur : on n'y reste jamais bloqué
    const hw = 7, d1 = streetAt(1, 440);
    for (let x = -hw + 0.3; x <= hw - 0.3; x += 0.5) {
      expect(choicesToPresent(d1, { x, z: -11.7 }, ctx, INTERACT, facing(SOUTH)), `x ${x.toFixed(1)}`).toContain('checkpoint.j1');
    }
  });

  it('test_checkpoint_in_the_back_does_not_open_but_an_open_group_stays_when_turning', () => {
    const d1 = streetAt(1, 440), at = { x: 3, z: -6 };
    expect(choicesToPresent(d1, at, ctx, INTERACT, facing(NORTH)), 'dans le dos').not.toContain('checkpoint.j1');
    expect(choicesToPresent(d1, at, ctx, INTERACT, facing(EAST)), 'face au mur est').not.toContain('checkpoint.j1');
    expect(choicesToPresent(d1, at, ctx, INTERACT, facing(SOUTH)), 'en vue').toContain('checkpoint.j1');
    expect(choicesToPresent(d1, at, ctx, INTERACT, { facing: NORTH, keep: ['checkpoint.j1'] }), 'déjà ouvert : reste ouvert dans la zone').toContain('checkpoint.j1');
    expect(choicesToPresent(d1, { x: 0, z: 5 }, ctx, INTERACT, { facing: NORTH, keep: ['checkpoint.j1'] }), 'hors zone : se ferme').not.toContain('checkpoint.j1');
  });

  it('test_a_place_within_reach_is_in_view_whatever_the_heading', () => {
    const at = posOf('stall');
    expect(inView({ x: at.x, z: at.z + INTERACT.interact.interactRangeM.v }, NORTH, at, INTERACT)).toBe(true);
    expect(inView({ x: at.x, z: at.z + INTERACT.interact.interactRangeM.v + 0.5 }, NORTH, at, INTERACT)).toBe(false);
  });

  it('test_registre_choices_open_at_the_registre_only', () => {
    const d1 = streetAt(1, 600);
    for (const at of [FAR, P, { x: 0, z: -1 }, { x: 0, z: -11 }]) {
      const ids = choicesToPresent(d1, at, ctx, INTERACT, facing(SOUTH));
      for (const id of REGISTRE_CHOICES) expect(ids, `${id} en (${at.x}, ${at.z})`).not.toContain(id);
    }
    const inside = choicesToPresent(d1, { x: 0, z: -24 }, ctx, INTERACT, facing(SOUTH));
    for (const id of REGISTRE_CHOICES) expect(inside, `${id} au Registre`).toContain(id);
  });

  it('test_letter_opens_at_the_bench_only', () => {
    const d1 = streetAt(1, 600), bench = posOf('bench');
    expect(choicesToPresent(d1, P, ctx, INTERACT, facing(SOUTH)), 'au départ du logement').not.toContain('m3.letter');
    expect(choicesToPresent(d1, { x: bench.x + 2, z: bench.z }, ctx, INTERACT, facing(WEST)), 'devant le banc').toContain('m3.letter');
  });

  it('test_only_the_hearing_stays_without_a_place', () => {
    expect(S.choices.filter((c) => INTERACT.triggers[c.id] === undefined && c.id !== 'door.noon').map((c) => c.id)).toEqual(['audition.j7']);
  });
});

describe('(2) l\'intitulé d\'un groupe est une action', () => {
  it('test_every_group_header_is_an_action_distinct_from_its_options', () => {
    for (const c of S.choices) {
      for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
        const head = table[`w10.choice.${c.id}`]!;
        expect(head, `${lang} ${c.id} : pas un nom seul`).not.toMatch(/^(Le|La|Les|L'|The)\s|^(L')/);
        expect(head.split(/\s+/).length, `${lang} ${c.id} : un verbe et son objet`).toBeGreaterThanOrEqual(2);
        for (const o of c.options) expect(head, `${lang} ${c.id} : distinct de l'option ${o.id}`).not.toBe(table[`w10.choice.${c.id}.${o.id.replaceAll(':', '.')}`]);
      }
    }
    expect(FR['w10.choice.m2.nadia']).toBe('Parler à Nadia');
  });
});

describe('(1) une ligne du narrateur dit où l\'on est quand un groupe s\'ouvre', () => {
  it('test_arrival_key_drops_the_day_suffix', () => {
    expect(arrivalKey('checkpoint.j3')).toBe('w10.arrive.checkpoint');
    expect(arrivalKey('m2.nadia')).toBe('w10.arrive.m2.nadia');
    expect(arrivalKey('j1.phone')).toBe('w10.arrive.j1.phone');
    expect(arrivalKey('audition.j7')).toBe('w10.arrive.audition');
  });

  it('test_every_group_and_milestone_has_an_arrival_line_in_both_locales', () => {
    for (const id of [...S.choices.map((c) => c.id), ...S.jalons.map((j) => j.id)]) {
      for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
        const k = arrivalKey(id), v = table[k];
        expect(v, `${lang} ${k}`).toBeTruthy();
        expect(v, `${lang} ${k} : pas de tiret long`).not.toMatch(/—/);
        expect(checkPlayerString(v!, lang, ruleFor(meta, k), forbidden), `${lang} ${k}`).toEqual([]);
      }
    }
  });

  it('test_arrival_lines_are_provisional_for_the_writer', () => {
    expect(PROVISIONAL.find((p) => p.kind === 'strings' && p.prefix === 'w10.arrive')?.owner).toBe('writer');
    expect(meta['w10.arrive']?.policy).toBe('voice');
  });

  it('test_arrival_is_said_for_the_first_new_group_only', () => {
    const has = (k: string): boolean => k in FR;
    expect(arrivalDue([], ['checkpoint.j1'], has)).toBe('w10.arrive.checkpoint');
    expect(arrivalDue(['checkpoint.j1'], ['checkpoint.j1'], has), 'déjà ouvert : rien de neuf').toBeNull();
    expect(arrivalDue(['checkpoint.j1'], ['checkpoint.j1', 'm2.nadia'], has)).toBe('w10.arrive.m2.nadia');
    expect(arrivalDue([], ['street.sleep'], has), 'sans ligne : rien').toBeNull();
    expect(FR['w10.arrive.checkpoint']).toMatch(/^Tu arrives au point de contrôle/);
  });
});

describe('runtime : la ligne d\'arrivée va au narrateur', () => {
  it('test_runtime_opening_group_sets_the_narrator_arrival_line_and_leaving_clears_it', async () => {
    payloadCache('w10').clear();
    const host = document.body.appendChild(document.createElement('div'));
    const app = fakeApp([{ day: 1, minute: 420, kind: 'choice', id: 'j1.phone', option: 'take' }]);
    const deps = testDeps({ sink: app.save });
    const screen = createStreetScreen(app.ctx, app.payload, deps);
    await screen.mount(host);
    deps.frames.step(16);
    expect(document.body.querySelector('[data-choice="j1.component"]'), 'au logement : le composant').not.toBeNull();
    expect(document.body.querySelector('[data-ui="narration"]')!.textContent).toBe(FR['w10.arrive.j1.component']);
    expect(document.body.querySelector('[data-ui="narration"]')!.hasAttribute('data-empty')).toBe(false);
    const rt = screen.runtime() as unknown as { player(): { x: number; z: number } };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));   // on quitte le logement : le groupe se ferme, sa ligne part avec lui
    for (let i = 0; i < 400 && rt.player().z > 20; i++) deps.frames.step(50);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    deps.frames.step(16);
    expect(document.body.querySelector('[data-choice="j1.component"]'), 'hors du logement').toBeNull();
    expect(document.body.querySelector('[data-ui="narration"]')!.textContent).toBe('');
    expect(document.body.querySelector('[data-ui="narration"]')!.hasAttribute('data-empty'), 'pas de case d\'encre vide').toBe(true);
    screen.unmount(); host.remove();
  });
});
