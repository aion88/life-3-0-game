"""Oracle du fast-forward : trajectoires pas à pas en millièmes [plan 01 Task 3].

Run (depuis la racine du worktree) :
    python3 -I app/tools/golden/export_fastforward.py > app/tests/fixtures/fastforward.oracle.json

Importe tools/plancher/d106.py sans le modifier. Pour chaque cas, rejoue une boucle pas à pas (un seul
combo, flottants en points) dont l'ordre est celui de d106.simulate02, AFFIRME qu'elle rend le même V(48)
et la même extinction que simulate02 (échec bruyant sinon), puis écrit la trajectoire en millièmes :
  - sans extinction : pas 0..48 (49 vecteurs) ; atChoice = V(48) ;
  - avec extinction : pas 0..ruptureStep inclus.
Précédence : Autodestruction (w12) avant Conquérants (w07) au même pas, comme simulate02.
Forme : { "<cas>": { "push": [6 points], "steps": [{aiPower..unrest en milli}], "atChoice": {...},
                     "extinction": null | {"world", "runStartStep", "ruptureStep"} } }
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "plancher"))
import d106  # noqa: E402

VARS = ["aiPower", "order", "abundance", "freedom", "surveillance", "unrest"]
CHOICE, T, HOLD = 48, 120, 24
V0 = np.array([30, 60, 50, 65, 35, 30], float)
LETTERS = "ABCD"
SEL = d106.SEL
import repartition  # noqa: E402  (tools/plancher, Q21 = colonne Q11)

Q21 = [np.array(r, float) for r in repartition.Q11.values()]


def push_of(letters):
    total = np.zeros(6)
    for q, c in zip(SEL, letters[:10]):
        total += np.array(d106.QS[q][LETTERS.index(c)], float)
    return total + Q21[LETTERS.index(letters[10])]


def step_vec(v, t, push):
    if t in (1, 13, 25, 37):
        v = v + push / 4
    v = np.clip(v, 0, 100)
    ap, orr, ab, fr, su, un = v
    d = np.zeros(6)
    d[1] -= 1.5 * (un > 70); d[2] -= 1.5 * (orr < 30)
    d[5] += 1.0 * ((su > 70) and (fr < 40)); d[5] -= 1.0 * (ab > 85)
    return np.clip(v + d, 0, 100)


def conds(v, t):
    ap, orr, ab, fr, su, un = v
    sd = un >= 70 and orr <= 20 and ab <= 25 and ap <= 85 and t >= 13
    cq = ap >= 90 and orr <= 40 and un >= 60 and t >= 25
    return sd, cq


def milli(v):
    out = {}
    for k, x in zip(VARS, v):
        m = x * 1000
        assert abs(m - round(m)) < 1e-6, (k, x)
        out[k] = int(round(m))
    return out


def replay(push):
    """Boucle pas à pas jusqu'à T ; rend (steps, v48, ext, start, rupture)."""
    v = V0.copy(); steps = [v.copy()]
    run = {"w12": 0, "w07": 0}; start = {"w12": -1, "w07": -1}
    ext = None
    for t in range(1, T + 1):
        v = step_vec(v, t, push)
        steps.append(v.copy())
        sd, cq = conds(v, t)
        for w, on in (("w12", sd), ("w07", cq)):
            run[w] = run[w] + 1 if on else 0
            start[w] = (t if run[w] == 1 else start[w]) if on else -1
        if ext is None:
            for w in ("w12", "w07"):   # précédence de simulate02 : Autodestruction d'abord
                if run[w] >= HOLD and start[w] <= CHOICE:
                    ext = (w, start[w], t); break
    return steps, ext


def case(push):
    steps, ext = replay(push)
    v48, ref = d106.simulate02(push[None, :], V0, T=T)
    code = {None: 0, "w12": 1, "w07": 2}[ext[0] if ext else None]
    assert int(ref[0]) == code, f"extinction divergente : boucle {code}, simulate02 {ref[0]}"
    assert np.allclose(steps[CHOICE], v48[0], atol=1e-9), f"V(48) divergent : {steps[CHOICE]} vs {v48[0]}"
    # Trajectoire du port : jusqu'à la rupture si extinction, sinon 0..48 (continuation sans rupture, E12).
    last = ext[2] if ext else CHOICE
    out = {
        "push": [float(x) for x in push],
        "steps": [milli(s) for s in steps[: last + 1]],
        "atChoice": milli(steps[min(CHOICE, last)]),
        "extinction": {"world": ext[0], "runStartStep": ext[1], "ruptureStep": ext[2]} if ext else None,
    }
    return out


FORGED = {
    "forgedBroken": np.array([65, -22, 45, -5, 5, 45], float),
    "forgedGate25": np.array([260, -100, 0, 0, 0, 160], float),
}
cases = {}
for name, letters in (("w10", "ACBACBACAAD"), ("w07", "CBCCBDBACCD"), ("w12", "CBCCBDDACCD")):
    cases[name] = case(push_of(letters))
for name, pv in FORGED.items():
    cases[name] = case(pv)
json.dump(cases, sys.stdout, indent=1)
sys.stdout.write("\n")
