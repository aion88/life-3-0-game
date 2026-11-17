/**
 * Bloc dossier de w10 : noms donnés, réponse à l'audition, lignes de relecture, mentions [plan 03 T10 ; GDD 06 §3.10 ; bible w10 §7.6, §8.2 bis ; R-03.16].
 * Pur : rien que la lecture des actes, des données du monde et du rejeu `replay` du moteur 02b (aucune logique de rue réécrite). Aucun texte :
 * des clés. Le monde sans bloc `bilan.dossier` (ou sans rue) rend `null`.
 */
import { flaggedLines, relectureLineOf } from '../engine/moments/bilan';
import { replay, type ReplayResult } from '../engine/moments/replay';
import { toDayState } from '../engine/moments/state';
import type { StreetContext } from '../engine/moments/types';
import type { BilanWorldData } from '../data/schema/bilan';
import type { WorldData } from '../data/schema/world';
import type { BilanInput, DossierBlock, DossierMention, FileLine, NameLine } from '../shared/types/bilan';
import type { ActRecord, DayIndex } from '../shared/types/street';

/** Ce que le bloc lit du contexte du bilan : le monde vécu (ses données) et le contexte de rue qui sert au rejeu. */
export interface DossierContext { readonly lived: WorldData | null; readonly street: StreetContext | null }

const RELECTURE_ID = /^relecture\.j([1-7])$/;
/** Entrée de relevé qui désigne un nom donné [w10.json : `integrity.entries`, compteur `names`]. */
const NAME_ENTRY = 'offer.named';
const ARRESTED = new Set(['arrested', 'arrestedAudition']);

function dossierData(lived: WorldData | null): BilanWorldData['dossier'] | null {
  const b = lived?.bilan as Partial<BilanWorldData> | undefined;
  return b?.dossier ?? null;
}

const isChoice = (a: ActRecord, id: string, option?: string): boolean => a.kind === 'choice' && a.id === id && (option === undefined || a.option === option);

/** Fin du rejeu : `arrested` si la semaine s'est arrêtée avant l'audition, sinon l'issue du dernier relevé ; `null` si aucune fin n'est posée. */
function endIdOf(r: ReplayResult): string | null {
  return r.state.ended?.endId ?? null;
}

/** Les actes qui donnent un nom : un choix dont l'option écrit `offer.named` au relevé (donnée du monde). */
function nameActsOf(acts: readonly ActRecord[], ctx: StreetContext): ActRecord[] {
  const naming = new Set<string>();
  for (const c of ctx.street.choices) for (const o of c.options) if (o.entries?.includes(NAME_ENTRY)) naming.add(`${c.id}/${o.id}`);
  return acts.filter((a) => a.kind === 'choice' && a.option !== null && naming.has(`${a.id}/${a.option}`));
}

function readingsOf(acts: readonly ActRecord[], r: ReplayResult, ctx: StreetContext): readonly FileLine[] {
  const out: FileLine[] = [];
  const seen = new Set<number>();
  for (const a of acts) {
    const m = a.kind === 'choice' ? RELECTURE_ID.exec(a.id) : null;
    if (m === null) continue;
    const day = Number(m[1]) as DayIndex;
    if (seen.has(day)) continue;
    const ledger = r.state.ledgers[day - 1] ?? (day === r.state.day ? toDayState(r.state, r.week, ctx).ledger : undefined);
    if (ledger === undefined) continue;
    const lineKey = relectureLineOf(day, ledger, ctx.street);
    if (lineKey === null) continue;
    seen.add(day);
    out.push({ lineKey, day, outcome: a.option === 'flag' ? 'flagged' : 'dismissed' });
  }
  return out.sort((x, y) => x.day - y.day);
}

/**
 * Le dossier du monde vécu, ou `null` hors d'un monde à dossier. `savedByName` : le rejeu SANS l'acte du nom ne finit pas libre alors que la
 * partie réelle, elle, n'est pas arrêtée [R-03.16, D86] ; `declaredLeaver` : un permis demandé, jamais accordé (le moteur n'en accorde aucun) ;
 * `radioFromInside` : un acte du J6 existe (le J6 a été vécu, poste cliqué ou non).
 */
export function buildDossier(input: BilanInput, ctx: DossierContext): DossierBlock | null {
  const data = dossierData(ctx.lived);
  const sctx = ctx.street;
  if (data === null || sctx === null) return null;
  const acts = input.acts;
  const real = replay(acts, sctx);

  const names: NameLine[] = [];
  for (const o of data.names) {
    const a = acts.find((x) => isChoice(x, o.choiceId, o.nameOption));
    if (a !== undefined) names.push({ personKey: o.personKey, day: a.day });
  }
  names.sort((x, y) => x.day - y.day);

  const auditionAct = acts.find((a) => isChoice(a, data.audition.choiceId));
  const answer = auditionAct !== undefined && auditionAct.option !== null && auditionAct.option in data.audition.keys
    ? (auditionAct.option as 'all' | 'none' | 'silence') : null;

  const realEnd = endIdOf(real);
  const arrested = realEnd !== null && ARRESTED.has(realEnd);
  const given = nameActsOf(acts, sctx);
  const savedByName = !arrested && realEnd !== null && data.names.some((o) => {
    const n = acts.find((x) => isChoice(x, o.choiceId, o.nameOption));
    if (n === undefined) return false;
    const cf = replay(acts.map((x) => (x === n ? { ...x, option: o.refuseOption } : x)), sctx);   // le refus remplace le nom, il ne le retire pas [R-03.26]
    if (cf.rejected.some((r) => r.reason !== 'ended') || cf.state.ended === null) return false;   // invalide : jamais vrai par défaut ; les actes rejetés `ended` suivent l'arrestation, c'est le cas « sauvé » [R-03.26 amendé]
    return ARRESTED.has(cf.state.ended.endId);
  });
  const mentionOn: Readonly<Record<DossierMention, boolean>> = {
    savedByName,
    twoNamesThenArrested: given.length >= 2 && arrested,
    declaredLeaver: real.state.flags.permitRequested === true,
    radioFromInside: acts.some((a) => a.day === 6),
  };
  const mentions = (Object.keys(data.mentionKeys) as DossierMention[]).filter((k) => mentionOn[k]);

  return { names, answer, files: readingsOf(acts, real, sctx), flaggedCount: flaggedLines(acts), mentions };
}
