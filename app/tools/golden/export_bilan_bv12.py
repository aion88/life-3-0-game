"""Oracle B-V12 : cinq cas de « Les autres » (D139) sur la grille exhaustive [plan 01 Task 9 ; GDD 06 §8.2 B-V12].

Run (depuis la racine du worktree) :
    python3 -I app/tools/golden/export_bilan_bv12.py > app/tests/fixtures/bilan-bv12.oracle.json

Importe tools/plancher/d106.py et tools/plancher/repartition.py sans les modifier. Même grille que export_grid.py
(746 496 suites, ordre SEL, la dernière question varie le plus vite, monde lu sur V(48) en millièmes entiers, D111).

La règle D139 est RÉÉCRITE ici en Python, indépendamment de `others.ts` :
  - remontée : omega_i = max sur a' != a_i de d²(V(A), V(A[i->a'])) au pas 48, ω nul écarté, ω décroissant puis
    numéro de question croissant, trois au plus [GDD 06 §4 F3] ;
  - lecture : les questions de la remontée dans leur ordre, puis les autres par numéro croissant ;
    dans une question, par lettre puis par numéro de monde ;
  - on garde le premier remplacement de chaque monde neuf (ni le monde du joueur, ni un monde déjà gardé), quatre au plus.
La recherche ne porte que sur les joueurs qui survivent (leur référence de remontée est le pas 48) ; le test TS rejoue
chaque cas avec la vraie remontée, donc l'écart éventuel serait vu là-bas.

Le script AFFIRME : l'histogramme des mondes voisins [18066, 107554, ...], les 1062 suites à voisin éteint autre que le
leur, les lignes des tests de la tâche, et que chacun des cinq motifs est réalisé ; il échoue bruyamment sinon.

Forme : { "cases": [{ "id", "line", "remontee": [QuestionKey], "others": [[question, rang affiché, réponse, destination]] }] }.
"""
import itertools
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "plancher"))
import d106  # noqa: E402
import repartition  # noqa: E402

LETTERS = "ABCD"
N_EXPECTED = 746_496
T = 120
WORLD_IDS = ["w01", "w02", "w03", "w04", "w05", "w06", "w08", "w09", "w10", "w11"]
ALL_IDS = [f"w{n:02d}" for n in range(1, 13)]
QUESTIONS = [f"Q{q:02d}" for q in d106.SEL] + ["Q21"]
MAX_LINES, TRACEBACK = 4, 3
EXTINCT_BITS = (1 << ALL_IDS.index("w07")) | (1 << ALL_IDS.index("w12"))

RANK = {q["key"]: q["order"] for q in json.load(open(ROOT / "app" / "src" / "data" / "questionnaire.json"))["questions"]}
assert RANK["Q21"] == 5 and RANK["Q07"] == 11, RANK

# --- Grille (comme export_grid.py) ---
Q21 = np.array(list(repartition.Q11.values()), float)
qv = repartition.QV + [Q21]
sizes = [len(x) for x in qv]
assert len(qv) == 11 and int(np.prod(sizes)) == N_EXPECTED, sizes
strides = [int(np.prod(sizes[p + 1:])) for p in range(11)]
combos = np.array(list(itertools.product(*[range(s) for s in sizes])))
push = np.zeros((len(combos), 6))
for i, x in enumerate(qv):
    push += x[combos[:, i]]
v48, ext = d106.simulate02(push, repartition.ST, T=T)
vm = np.rint(v48 * 1000).astype(np.int64)
W = np.array(list(d106.rs.WORLDS.values()), float)
Wm = np.rint(W * 1000).astype(np.int64)
sq = ((vm[:, None, :] - Wm[None, :, :]) ** 2).sum(2)
ab = np.abs(vm[:, None, :] - Wm[None, :, :]).sum(2)
nr = np.lexsort((ab, sq), axis=-1)[:, 0]  # D111
dest_idx = np.array([ALL_IDS.index(WORLD_IDS[k]) for k in nr])
dest_idx[ext == 1] = ALL_IDS.index("w12")
dest_idx[ext == 2] = ALL_IDS.index("w07")
N = len(combos)

# --- Contrôle croisé : histogramme des mondes voisins et voisins éteints (masques de bits par suite) ---
D = dest_idx.reshape(sizes)
bits = 1 << D.astype(np.int64)
nbr = np.zeros(sizes, dtype=np.int64)
for p in range(11):
    Bp = np.moveaxis(bits, p, 0)
    Np = np.moveaxis(nbr, p, 0)
    for x in range(sizes[p]):
        for y in range(sizes[p]):
            if y != x:
                Np[x] |= Bp[y]
own_bit = bits
nbr = nbr & ~own_bit
popcount = np.zeros(sizes, dtype=np.int64)
for k in range(12):
    popcount += (nbr >> k) & 1
hist = [int((popcount == m).sum()) for m in range(8)]
assert hist == [18066, 107554, 289813, 212012, 92597, 26122, 321, 11], hist
extinct_other = int(((nbr & EXTINCT_BITS) != 0).sum())
assert extinct_other == 1062, extinct_other

# --- ω par question (suites qui survivent : référence = V(48)) ---
V = vm.reshape(sizes + [6])
omega = np.zeros((N, 11), dtype=np.int64)
for p in range(11):
    Vp = np.moveaxis(V, p, 0)
    best = np.zeros(Vp.shape[:-1], dtype=np.int64)
    for x in range(sizes[p]):
        for y in range(sizes[p]):
            if y != x:
                best[x] = np.maximum(best[x], ((Vp[x] - Vp[y]) ** 2).sum(-1))
    omega[:, p] = np.moveaxis(best, 0, p).reshape(N)
top = np.argsort(-omega, axis=1, kind="stable")[:, :TRACEBACK]  # égalité : numéro de question croissant (SEL croissant)


def line_of(i):
    return "".join(LETTERS[c] for c in combos[i])


def select(i):
    """D139 pour la suite i. Rend (remontée, lignes, événements)."""
    tb = [int(p) for p in top[i] if omega[i, p] > 0]
    order = tb + [p for p in range(11) if p not in tb]
    own = int(dest_idx[i])
    seen = {own}
    kept_from = {}
    out, events = [], set()
    pending_skip = False
    for p in order:
        d = int(combos[i, p])
        reps = sorted(((y, int(dest_idx[i + (y - d) * strides[p]])) for y in range(sizes[p]) if y != d),
                      key=lambda r: (r[0], r[1]))
        new = []
        for y, w in reps:
            if w in seen:
                if w in kept_from and kept_from[w] != p and len(out) < MAX_LINES:
                    events.add("same-world-first-kept")
                continue
            new.append((y, w))
            seen.add(w)
        # `seen` ne doit contenir que ce qui est gardé : on refait la passe avec le plafond
        for y, w in new:
            seen.discard(w)
        # quatrième place entre deux mondes neufs d'une même question, la lettre basse menant au numéro de monde
        # le plus HAUT : lettre d'abord garde la lettre basse, numéro de monde d'abord garderait l'autre
        if len(out) == MAX_LINES - 1 and len(new) >= 2 and new[0][1] > new[1][1]:
            events.add("fourth-place-split")
        kept_here = 0
        for y, w in new:
            if len(out) >= MAX_LINES:
                break
            seen.add(w)
            kept_from[w] = p
            out.append([QUESTIONS[p], RANK[QUESTIONS[p]], LETTERS[y], ALL_IDS[w]])
            kept_here += 1
            if pending_skip:
                events.add("skipped-traceback-question")
                pending_skip = False
        else:
            if p in tb and kept_here == 0 and len(out) < MAX_LINES:
                pending_skip = True
    for o in out:
        if o[0] == "Q21":
            events.add("rank-q21-is-5")
        if o[0] == "Q07":
            events.add("rank-q07-is-11")
    return [QUESTIONS[p] for p in tb], out, events


# --- Contrôles croisés sur les lignes des tests de la tâche (suites qui survivent) ---
def index_of(line):
    i = 0
    for j, c in enumerate(line):
        i = i * sizes[j] + LETTERS.index(c)
    return i


def others_of(line):
    i = index_of(line)
    assert ext[i] == 0, line
    return select(i)[1]


assert others_of("ACBACBACAAD") == [["Q11", 1, "B", "w11"]]
assert others_of("CBCCBCCABBD") == []
assert others_of("AAAAAABACCB") == [["Q21", 5, "A", "w03"], ["Q21", 5, "C", "w10"], ["Q21", 5, "D", "w11"], ["Q14", 2, "D", "w06"]]
assert ["Q21", 5, "A", "w05"] in others_of("DBCAAACBDAD")
assert ["Q07", 11, "C", "w01"] in others_of("ABACBCBCAAA")

# --- Recherche, par indice croissant, de la première suite qui réalise chaque motif ---
WANT = ["skipped-traceback-question", "same-world-first-kept", "fourth-place-split", "rank-q21-is-5", "rank-q07-is-11"]
found = {}
for i in np.flatnonzero(ext == 0):
    tb, out, events = select(int(i))
    for e in events:
        if e in WANT and e not in found:
            found[e] = {"id": e, "line": line_of(int(i)), "remontee": tb, "others": out}
    if len(found) == len(WANT):
        break
missing = [e for e in WANT if e not in found]
assert not missing, f"motifs non réalisés : {missing}"

json.dump({"cases": [found[e] for e in sorted(WANT)]}, sys.stdout, indent=1, ensure_ascii=False)
sys.stdout.write("\n")
