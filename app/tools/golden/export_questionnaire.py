"""Oracle du questionnaire : poussées v1 et sommes P des lignes canoniques [plan 01 Task 2].

Run (depuis la racine du worktree) :
    python3 -I app/tools/golden/export_questionnaire.py > app/tests/fixtures/questionnaire.oracle.json

Forme de la sortie, en POINTS entiers, ordre des variables aiPower, order, abundance, freedom, surveillance, unrest :
    { "selOrder": ["Q04", ..., "Q21"],
      "lines":  { "w10": {"letters": "ACBACBACAAD", "p": [6 points]}, "w07": {...}, "w12": {...} },
      "pushes": { "Q11": {"A": [6 points], ...}, ... } }       # 11 questions, 38 réponses
Sources, importées sans modification : tools/plancher/d106.py (QS des dix questions d'origine, CANON des
lignes sur 10 questions) et tools/plancher/repartition.py (Q11 = la colonne de Q21). Q21 D (refus) clôt chaque
ligne canonique, comme dans le plan : lettres dans l'ordre de sélection Q04 .. Q20 puis Q21.
"""
import importlib.util
import json
import sys
from pathlib import Path

PLANCHER = Path(__file__).resolve().parents[3] / "tools" / "plancher"
sys.path.insert(0, str(PLANCHER))

import d106  # noqa: E402
import repartition  # noqa: E402

SEL = d106.SEL  # [4, 5, 7, 10, 11, 14, 15, 16, 18, 20]
LETTERS = "ABCD"

pushes = {}
for n in SEL:
    pushes[f"Q{n:02d}"] = {LETTERS[i]: [int(x) for x in row] for i, row in enumerate(d106.QS[n])}
pushes["Q21"] = {LETTERS[i]: [int(x) for x in row] for i, row in enumerate(repartition.Q11.values())}

lines = {}
for w in ("w10", "w07", "w12"):
    letters = d106.CANON[w][1] + "D"
    total = [0] * 6
    for (qk, row_letter) in zip([f"Q{n:02d}" for n in SEL] + ["Q21"], letters):
        for i, x in enumerate(pushes[qk][row_letter]):
            total[i] += x
    lines[w] = {"letters": letters, "p": total}

json.dump({"selOrder": [f"Q{n:02d}" for n in SEL] + ["Q21"], "lines": lines, "pushes": pushes}, sys.stdout, indent=2)
sys.stdout.write("\n")
