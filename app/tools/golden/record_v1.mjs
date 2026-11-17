// Produit tests/fixtures/v1-differential.json en EXÉCUTANT la v1 archivée dans legacy/html-prototype/ (js/data.js, js/worldstate.js, js/map.js, worlds/*.js)
// dans node:vm, jamais à la main [GDD 03 T-1a ; plan 01 Task 12].
//   Run : node app/tools/golden/record_v1.mjs > app/tests/fixtures/v1-differential.json
// - N vecteurs par monde, tirés par A.makeRng (mulberry32 du plan 00) autour des vecteurs canoniques de catalogue.json ;
//   graine fixe ci-dessous ; les blocs `start` de la v1 ne sont JAMAIS utilisés.
// - Chaque vecteur passe par `A.ws.dailyTick` sans écho, puis avec écho ; sorties en millièmes.
// - Tout cas dont une comparaison de seuil tombe à moins de 0,05 point du seuil est écarté (le flottant de la v1 et
//   l'entier du port y divergent par nature ; T-1b mesure cette zone au décimal exact).
// - Portes : A.map.gateClosed de la v1, sur des vecteurs dont la variable de porte est tirée autour du seuil.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import process from 'node:process';
import { URL } from 'node:url';

/** Graine fixe de tout le tirage ; la graine d'un monde est cette valeur plus son numéro. */
const RECORD_SEED = 20261102;
/** Vecteurs tirés par monde [lead-programmer]. */
const N = 10_000;
/** Rayon du tirage autour du vecteur canonique, en points. */
const RADIUS = 30;
/** Cas de porte tirés par monde, et demi-largeur du tirage autour du seuil, en points. */
const N_GATES = 600;
const GATE_SPAN = 12;
/** Bande d'écart autour d'un seuil, en millièmes (0,05 point). */
const BAND = 50;
/** Seuils de comparaison de dailyTick, par variable [js/worldstate.js]. */
const THRESHOLDS = { unrest: [70], order: [30], surveillance: [70], freedom: [40], abundance: [85] };

const root = new URL('../../../', import.meta.url);
const legacyRoot = new URL('legacy/html-prototype/', root);
const ctx = { window: { AFTERMATH: {} } };
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/worldstate.js', 'js/map.js',
  ...Array.from({ length: 12 }, (_, i) => `worlds/${['w01-libertarian', 'w02-dictator', 'w03-egalitarian', 'w04-gatekeeper', 'w05-protector', 'w06-enslavedgod', 'w07-conquerors', 'w08-descendants', 'w09-zookeeper', 'w10-1984', 'w11-reversion', 'w12-selfdestruct'][i]}.js`)]) {
  if (f === 'worlds/w01-libertarian.js') ctx.window.AFTERMATH.T = {}; // js/map.js lit A.T au chargement
  vm.runInContext(readFileSync(new URL(f, legacyRoot), 'utf8'), ctx, { filename: f });
}
const A = ctx.window.AFTERMATH;
for (const k of ['makeRng', 'ws', 'map', 'WORLDS']) if (A[k] === undefined) throw new Error(`v1 : A.${k} introuvable`);

const catalogue = JSON.parse(readFileSync(new URL('app/src/data/catalogue.json', root), 'utf8'));
const VARS = A.WSVARS;
const arrivals = catalogue.entries.filter((e) => e.kind === 'arrival');
if (arrivals.length !== 10) throw new Error(`10 mondes d'arrivée attendus, ${arrivals.length} trouvés`);

const milli = (x) => {
  const m = Math.round(x * 1000);
  if (Math.abs(x * 1000 - m) > 1e-6) throw new Error(`sortie hors grille du millième : ${x}`);
  return m;
};
const clampMilli = (m) => Math.max(0, Math.min(100_000, m));
const inBand = (valueMilli, thresholdPoints) => Math.abs(valueMilli - thresholdPoints * 1000) < BAND;

/** Copie flottante de dailyTick qui rend aussi les opérandes des comparaisons ; vérifiée égale à la v1 exécutée. */
function shadow(ws, w, pending) {
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const g = { ...ws };
  const seen = [];
  for (const k in w.drift) g[k] = clamp(g[k] + w.drift[k]);
  const s = w.couplingScale != null ? w.couplingScale : 1;
  seen.push(['unrest', g.unrest]);
  if (g.unrest > 70) g.order = clamp(g.order - 1.5 * s);
  seen.push(['order', g.order]);
  if (g.order < 30) g.abundance = clamp(g.abundance - 1.5 * s);
  seen.push(['surveillance', g.surveillance], ['freedom', g.freedom]);
  if (g.surveillance > 70 && g.freedom < 40) g.unrest = clamp(g.unrest + 1.0 * s);
  seen.push(['abundance', g.abundance]);
  if (g.abundance > 85) g.unrest = clamp(g.unrest - 1.0 * s);
  for (const k in pending) g[k] = clamp(g[k] + Math.max(-1, Math.min(1, pending[k])));
  return { g, near: seen.some(([k, x]) => THRESHOLDS[k].some((t) => inBand(Math.round(x * 1000), t))) };
}

function v1Tick(startMilli, w, echoMilli) {
  const G = { w, wIdx: 0, day: 1, ws: {}, wsPending: {} };
  VARS.forEach((k, i) => { G.ws[k] = startMilli[i] / 1000; });
  VARS.forEach((k, i) => { if (echoMilli[i] !== 0) G.wsPending[k] = echoMilli[i] / 1000; });
  const pending = { ...G.wsPending };
  const before = { ...G.ws };
  A.ws.dailyTick(G);
  const sh = shadow(before, w, pending);
  for (const k of VARS) if (sh.g[k] !== G.ws[k]) throw new Error(`la copie de contrôle diverge de la v1 sur ${k} : ${sh.g[k]} contre ${G.ws[k]}`);
  return { out: VARS.map((k) => milli(G.ws[k])), near: sh.near };
}

const dailyTick = [];
const gates = [];
for (const entry of arrivals) {
  const w = A.WORLDS[entry.number - 1];
  const rng = A.makeRng(RECORD_SEED + entry.number);
  const canon = VARS.map((k) => entry.vector[k] * 1000);
  const couplingScale100 = Math.round((w.couplingScale ?? 1) * 100);
  if (Math.abs((w.couplingScale ?? 1) * 100 - couplingScale100) > 1e-9) throw new Error(`couplingScale hors grille : ${w.couplingScale}`);
  const drift = Object.fromEntries(Object.entries(w.drift ?? {}).map(([k, d]) => [k, milli(d)]));
  const cases = [];
  for (let n = 0; n < N; n++) {
    const start = canon.map((c) => clampMilli(Math.round(c + (rng() * 2 - 1) * RADIUS * 1000)));
    const echo = VARS.map(() => (rng() < 0.4 ? Math.round((rng() * 2 - 1) * 1600) : 0));
    const a = v1Tick(start, w, VARS.map(() => 0));
    const b = v1Tick(start, w, echo);
    if (a.near || b.near) continue;
    cases.push([...start, ...echo, ...a.out, ...b.out]);
  }
  dailyTick.push({ world: entry.id, drift, couplingScale100, drawn: N, discarded: N - cases.length, cases });

  // porte : closedWhen de la v1 (celle du monde, ou la porte par défaut de js/map.js)
  const built = A.map.build(w);
  const cw = built.gates[0].closedWhen;
  if (cw.above == null) throw new Error(`${entry.id} : porte sans « above »`);
  const grng = A.makeRng(RECORD_SEED + 100 + entry.number);
  const gcases = [];
  for (let n = 0; n < N_GATES; n++) {
    const ws = canon.map((c) => clampMilli(Math.round(c + (grng() * 2 - 1) * RADIUS * 1000)));
    const gi = VARS.indexOf(cw.var);
    ws[gi] = clampMilli(Math.round(cw.above * 1000 + (grng() * 2 - 1) * GATE_SPAN * 1000));
    if (inBand(ws[gi], cw.above)) continue;
    A.G = { ws: Object.fromEntries(VARS.map((k, i) => [k, ws[i] / 1000])) };
    gcases.push([...ws, A.map.gateClosed(built.gates[0]) ? 1 : 0]);
  }
  gates.push({ world: entry.id, var: cw.var, above: cw.above, cases: gcases });
}

const meta = { seed: RECORD_SEED, n: N, radiusPoints: RADIUS, bandMilli: BAND, vars: VARS,
  rowTick: 'start[6], echo[6], sansEcho[6], avecEcho[6], millièmes', rowGate: 'ws[6], fermée 0|1' };
const lines = (rows) => rows.map((r) => JSON.stringify(r)).join(',\n');
const tickJson = dailyTick.map((d) => `{"world":${JSON.stringify(d.world)},"drift":${JSON.stringify(d.drift)},"couplingScale100":${d.couplingScale100},"drawn":${d.drawn},"discarded":${d.discarded},"cases":[\n${lines(d.cases)}\n]}`).join(',\n');
const gateJson = gates.map((g) => `{"world":${JSON.stringify(g.world)},"var":${JSON.stringify(g.var)},"above":${g.above},"cases":[\n${lines(g.cases)}\n]}`).join(',\n');
process.stdout.write(`{"meta":${JSON.stringify(meta)},\n"dailyTick":[\n${tickJson}\n],\n"gates":[\n${gateJson}\n]}\n`);
