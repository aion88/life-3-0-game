"""Oracle de la grille exhaustive : 746 496 suites, comptes figés [plan 01 Task 7].

Run (depuis la racine du worktree) :
    python3 -I app/tools/golden/export_grid.py > app/tests/fixtures/grid.oracle.json

Importe tools/plancher/d106.py et tools/plancher/repartition.py sans les modifier. Moteur : d106.simulate02
(canon GDD 02, quarts aux pas 1, 13, 25, 37, D40), grille = les dix questions d'origine puis Q21 (refus D135),
dans l'ordre de SEL_ORDER, la dernière question variant le plus vite, comme `indexOf` côté TypeScript.

Le monde se lit sur V(48) arrondi aux millièmes ENTIERS : distances, égalités et seuils se comptent en
entiers (int64), aucune comparaison de flottants. Le script AFFIRME lui-même ses comptes contre le tableau
figé du plan (brief T7) et contre rs.nearest en flottants ; il échoue bruyamment sinon.

Forme : { counts, byQ21, ties, far, ruptures, f6, patternShares, canonical, counterfactual,
          fourWorlds, witnesses }.
"""
import itertools
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "plancher"))
import d106  # noqa: E402
import repartition  # noqa: E402

VARS = ["aiPower", "order", "abundance", "freedom", "surveillance", "unrest"]
LETTERS = "ABCD"
N_EXPECTED = 746_496
CHOICE, T, HOLD = 48, 120, 24
WITNESS_STEP, WITNESS_COUNT = 373, 2000
# d106.rs.WORLDS (10 mondes vivants, dans l'ordre de la table) -> identifiants du catalogue
WORLD_IDS = ["w01", "w02", "w03", "w04", "w05", "w06", "w08", "w09", "w10", "w11"]
EXT_IDS = {1: "w12", 2: "w07"}  # d106.simulate02 : 1 = Autodestruction, 2 = Conquérants
ALL_IDS = [f"w{n:02d}" for n in range(1, 13)]
QUESTIONS = [f"Q{q:02d}" for q in d106.SEL] + ["Q21"]

# --- Comptes figés (brief T7, tolérance zéro) ---
EXPECTED_COUNTS = {"w01": 90945, "w02": 4088, "w03": 108578, "w04": 235696, "w05": 11129, "w06": 79969,
                   "w08": 5486, "w09": 814, "w10": 158635, "w11": 51095, "w12": 1, "w07": 60}
EXPECTED_BY_Q21 = {
    "A": {"w01": 20328, "w02": 95, "w03": 51456, "w04": 58942, "w05": 11092, "w06": 2806, "w08": 425, "w10": 37129, "w11": 4351},
    "B": {"w01": 33461, "w02": 2932, "w03": 26224, "w04": 70791, "w05": 24, "w06": 17241, "w07": 28, "w08": 4966, "w09": 28, "w10": 25823, "w11": 5106},
    "C": {"w01": 9378, "w02": 1011, "w03": 2367, "w04": 62246, "w05": 11, "w06": 41661, "w07": 23, "w08": 34, "w09": 786, "w10": 60767, "w11": 8340},
    "D": {"w01": 27778, "w02": 50, "w03": 28531, "w04": 43717, "w05": 2, "w06": 18261, "w07": 9, "w08": 61, "w10": 34916, "w11": 33298, "w12": 1},
}
CANONICAL = [("w01", "CBCCBCCABBD"), ("w02", "DBCAAACBDAD"), ("w03", "BAABBACBBAD"), ("w04", "ABBBACCBABD"),
             ("w05", "BBAAABBBDAA"), ("w06", "DBCAADBCCCD"), ("w07", "CBCCBDBACCD"), ("w08", "BBABBBCBDAB"),
             ("w10", "ACBACBACAAD"), ("w11", "AAABBCACBBD"), ("w12", "CBCCBDDACCD")]
PATTERNS = [("D--ACBB-C-C", "w09", (14, 81)), ("D--AAA--D-D", "w02", (3, 324)), ("D--AAA--D--", "w02", (171, 1296))]
FOUR_WORLDS = ["w10", "w02", "w01", "w11"]  # build à quatre mondes, plan T4 (design §13)

# --- Grille ---
Q21 = np.array(list(repartition.Q11.values()), float)
qv = repartition.QV + [Q21]
sizes = [len(x) for x in qv]
assert len(qv) == 11 and int(np.prod(sizes)) == N_EXPECTED, sizes
combos = np.array(list(itertools.product(*[range(s) for s in sizes])))
push = np.zeros((len(combos), 6))
for i, x in enumerate(qv):
    push += x[combos[:, i]]
v48, ext = d106.simulate02(push, repartition.ST, T=T)
vm = np.rint(v48 * 1000).astype(np.int64)
assert np.abs(v48 * 1000 - vm).max() < 1e-6, "V(48) hors millièmes entiers"

W = np.array(list(d106.rs.WORLDS.values()), float)
Wm = np.rint(W * 1000).astype(np.int64)
assert np.abs(W * 1000 - Wm).max() < 1e-6
diff = vm[:, None, :] - Wm[None, :, :]
sq = (diff ** 2).sum(2)                      # int64, millièmes²
ab = np.abs(diff).sum(2)
nr = np.lexsort((ab, sq), axis=-1)[:, 0]     # D111 : d², somme des écarts, numéro (stable)
nt = sq.argmin(1)                            # « table » : premier de la table à égalité
surv = ext == 0
assert (nr[surv] == d106.rs.nearest(v48, W, "rule")[surv]).all(), "règle D111 : entiers et flottants divergent"

dest = np.empty(len(combos), dtype=object)
dest[:] = [WORLD_IDS[k] for k in nr]
dest[ext == 1] = "w12"
dest[ext == 2] = "w07"
dest_idx = np.array([ALL_IDS.index(d) for d in dest])


def tally(mask):
    return {w: int((dest[mask] == w).sum()) for w in ALL_IDS if (dest[mask] == w).any()}


counts = tally(np.ones(len(dest), bool))
assert counts == EXPECTED_COUNTS, (counts, EXPECTED_COUNTS)
assert sum(counts.values()) == N_EXPECTED
by_q21 = {LETTERS[a]: tally(combos[:, 10] == a) for a in range(4)}
assert by_q21 == EXPECTED_BY_Q21, by_q21

# --- Égalités exactes, changements, distances ---
tie = ((sq == sq.min(1, keepdims=True)).sum(1) >= 2) & surv
chg = (nt != nr) & surv
ties = {"exactTies": int(tie.sum()), "changedVsFirstOfTable": int(chg.sum())}
assert ties == {"exactTies": 2416, "changedVsFirstOfTable": 708}, ties
dmin2 = sq.min(1)                            # millièmes²
far = {"over60": int((surv & (dmin2 > 60_000 ** 2)).sum()), "over70": int((surv & (dmin2 > 70_000 ** 2)).sum())}
assert far == {"over60": 39832, "over70": 1719}, far


# --- Ruptures : pas où la série atteint 24 (précédence de simulate02 : Autodestruction d'abord) ---
def replay_rupture(p):
    v = repartition.ST.copy(); run = {"w12": 0, "w07": 0}; start = {"w12": -1, "w07": -1}
    for t in range(1, T + 1):
        if t in (1, 13, 25, 37):
            v = v + p / 4
        v = np.clip(v, 0, 100)
        ap, orr, ab_, fr, su, un = v
        d = np.zeros(6)
        d[1] -= 1.5 * (un > 70); d[2] -= 1.5 * (orr < 30)
        d[5] += 1.0 * ((su > 70) and (fr < 40)); d[5] -= 1.0 * (ab_ > 85)
        v = np.clip(v + d, 0, 100)
        ap, orr, ab_, fr, su, un = v
        on = {"w12": un >= 70 and orr <= 20 and ab_ <= 25 and ap <= 85 and t >= 13,
              "w07": ap >= 90 and orr <= 40 and un >= 60 and t >= 25}
        for w in ("w12", "w07"):
            run[w] = run[w] + 1 if on[w] else 0
            start[w] = (t if run[w] == 1 else start[w]) if on[w] else -1
        for w in ("w12", "w07"):
            if run[w] >= HOLD and start[w] <= CHOICE:
                return w, t
    return None


ruptures = {}
for i in np.flatnonzero(ext != 0):
    w, t = replay_rupture(push[i])
    assert w == EXT_IDS[int(ext[i])], (i, w, ext[i])
    ruptures[str(t)] = ruptures.get(str(t), 0) + 1
assert ruptures == {"60": 60, "70": 1}, ruptures


# --- Motifs ---
def mask_of(pat):
    assert len(pat) == 11
    m = np.ones(len(combos), bool)
    for j, c in enumerate(pat):
        if c != "-":
            m &= combos[:, j] == LETTERS.index(c)
    return m


def index_of(line):
    i = 0
    for j, c in enumerate(line):
        i = i * sizes[j] + LETTERS.index(c)
    return i


shares = {}
for pat, world, want in PATTERNS:
    m = mask_of(pat)
    got = (int((dest[m] == world).sum()), int(m.sum()))
    assert got == want, (pat, world, got, want)
    shares[f"{pat}:{world}"] = {"hit": got[0], "of": got[1]}
canonical = {}
for world, line in CANONICAL:
    assert dest[index_of(line)] == world, (world, line, dest[index_of(line)])
    canonical[world] = dest[index_of(line)]

# --- Contrefactuel F-10 : (suite, remplacement) qui change la destination, clé = question.réponse de remplacement ---
D = dest_idx.reshape(sizes)
pairs = {}
for p, name in enumerate(QUESTIONS):
    Dp = np.moveaxis(D, p, 0)
    for x in range(sizes[p]):
        pairs[f"{name}.{LETTERS[x]}"] = int(sum((Dp[y] != Dp[x]).sum() for y in range(sizes[p]) if y != x))
assert pairs["Q18.B"] == 161699, pairs["Q18.B"]
assert all(n > 0 for n in pairs.values())

# --- Arrivée AAAAAAAAAAA et build à quatre mondes (distances² en points²) ---
assert index_of("AAAAAAAAAAA") == 0
d2 = {}
for w in FOUR_WORLDS:
    j = WORLD_IDS.index(w)
    s = int(((vm[0] - Wm[j]) ** 2).sum())
    assert s % 1_000_000 == 0, (w, s)
    d2[w] = s // 1_000_000
assert d2["w10"] == 6084 and d2["w11"] == 6764, d2     # plan T4 : « d² 6 084 contre 6 764 (w11) »
assert min(d2, key=d2.get) == "w10"

# --- 2 000 témoins, pas fixe 373 ---
assert WITNESS_STEP * (WITNESS_COUNT - 1) < N_EXPECTED
witnesses = [{"i": WITNESS_STEP * k, "destination": dest[WITNESS_STEP * k],
              "v48": {n: int(x) for n, x in zip(VARS, vm[WITNESS_STEP * k])}} for k in range(WITNESS_COUNT)]

head = {
    "counts": counts, "byQ21": by_q21, "ties": ties, "far": far, "ruptures": ruptures, "patternShares": shares,
    "canonical": canonical, "counterfactual": {"answers": len(pairs), "pairs": pairs},
    "fourWorlds": {"v48": {n: int(x) for n, x in zip(VARS, vm[0])}, "d2Points": d2},
}
body = json.dumps(head, indent=1)
sys.stdout.write(body[:-2] + ',\n "witnesses": [\n')
sys.stdout.write(",\n".join("  " + json.dumps(w) for w in witnesses))
sys.stdout.write("\n ]\n}\n")
