/**
 * JSON canonique : clés d'objet triées, ordre des tableaux conservé, `-0` écrit `0`, propriétés `undefined`
 * ignorées. Lève un `TypeError` (avec le chemin) sur un nombre non fini, un bigint, une fonction, un symbole,
 * un `undefined` de tête ou de tableau, et tout objet qui n'est ni littéral ni à prototype nul (Map, Set, Date,
 * instance de classe) : ces valeurs s'écraseraient en silence et feraient comparer égales deux sorties
 * différentes [GDD 03 §8 : comparaison et empreinte de sorties ; plan 00 revue finale, Important 2].
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value, '$'));
}

function fail(path: string, what: string): never {
  throw new TypeError(`canonicalJson : ${what} refusé en ${path}`);
}

function sortKeys(v: unknown, path: string): unknown {
  switch (typeof v) {
    case 'number':
      if (!Number.isFinite(v)) fail(path, `nombre non fini ${String(v)}`);
      return v === 0 ? 0 : v;
    case 'string':
    case 'boolean':
      return v;
    case 'undefined': return fail(path, 'undefined');
    case 'bigint': return fail(path, 'bigint');
    case 'function': return fail(path, 'fonction');
    case 'symbol': return fail(path, 'symbole');
    default:
  }
  if (v === null) return null;
  if (Array.isArray(v)) return v.map((x, i) => sortKeys(x, `${path}.${i}`));
  const proto: unknown = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) fail(path, 'objet non littéral');
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const k of Object.keys(o).sort()) {
    if (o[k] === undefined) continue;
    out[k] = sortKeys(o[k], `${path}.${k}`);
  }
  return out;
}
