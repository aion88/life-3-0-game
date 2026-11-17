"""Oracle de T-1b : 6 050 scenarios aux seuils, decisions exactes C1 a C4 a chaque pas [plan 01 Task 12].

Run (depuis la racine du worktree) :
    python3 -I app/tools/golden/export_scan_seuils.py > app/tests/fixtures/scan-seuils.oracle.json

Importe tools/port/scan_seuils.py sous contextlib.redirect_stdout (il lance main() a l'import) et reutilise
W, K et run SANS les modifier. La grille de scenarios est celle de scan_seuils.main(), rejouee ici pour emettre
chaque scenario ; le script AFFIRME lui-meme 6 050 scenarios et 79 divergences flottant/exact.

Forme : { meta, scenarios: [{ world, start: [6 entiers en milliemes, ordre K], exact: [[C1,C2,C3,C4] x 9],
floatDiverges }] }. exact = decisions de run(..., Fraction) : C1 unrest>70, C2 order<30,
C3 surveillance>70 et freedom<40, C4 abundance>85.
"""
import contextlib
import io
import json
import sys
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "port"))
with contextlib.redirect_stdout(io.StringIO()):
    import scan_seuils as ss

N_EXPECTED, DIVERGENCES_EXPECTED, STEPS = 6050, 79, 9
THRESHOLDS = [("unrest", 70), ("order", 30), ("surveillance", 70), ("freedom", 40), ("abundance", 85)]


def milli(x):
    m = x * 1000
    assert m.denominator == 1, f"hors grille du millieme : {x}"
    return int(m)


scenarios = []
for world, (drift, c) in ss.W.items():
    for var, th in THRESHOLDS:
        for i in range(-60, 61):
            x = F(th) + F(i, 10)
            if not 0 <= x <= 100:
                continue
            s = {k: F(50) for k in ss.K}
            s[var] = x
            s["unrest"] = s["unrest"] if var == "unrest" else F(75)
            if var == "freedom":
                s["surveillance"] = F(80)
            if var == "surveillance":
                s["freedom"] = F(30)
            fl = ss.run({k: float(v) for k, v in s.items()}, drift, c, STEPS, float)
            ex = ss.run(s, drift, c, STEPS, F)
            scenarios.append({
                "world": world,
                "start": [milli(s[k]) for k in ss.K],
                "exact": [[bool(b) for b in step] for step in ex],
                "floatDiverges": fl != ex,
            })

assert len(scenarios) == N_EXPECTED, len(scenarios)
n_div = sum(1 for s in scenarios if s["floatDiverges"])
assert n_div == DIVERGENCES_EXPECTED, n_div

meta = {"vars": ss.K, "steps": STEPS, "scenarios": len(scenarios), "floatDivergences": n_div}
out = ['{"meta":' + json.dumps(meta, separators=(",", ":")) + ',', '"scenarios":[']
out.append(",\n".join(json.dumps(s, separators=(",", ":")) for s in scenarios))
out.append("]}")
sys.stdout.write("\n".join(out) + "\n")
