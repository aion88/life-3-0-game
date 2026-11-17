"""Oracle de la survie de w10 : jauge Intégrité nuit par nuit [plan 01 Task 14].

Run (depuis la racine du worktree) :
    python3 -I app/tools/golden/export_survival.py > app/tests/fixtures/survival.oracle.json

Importe tools/plancher/w10.py et tools/plancher/w10_logement.py sans les modifier. w10_logement.py imprime sa
grille à l'import : l'import se fait sous une sortie capturée, et le script COMPARE cette sortie à ses propres
comptes (même mise en forme), puis AFFIRME les valeurs rejouées du brief T14 ; il échoue bruyamment sinon.

Forme : { profiles, d134, grid }. Un cas : { profile?, words[6], names[], permit, found, absent[], nights[], end }.
`words` = mots dépensés par nuit (résolus), `nights` = valeurs par nuit en points (arrêt à la première fin),
`end` = released | recruited | arrested:<nuit> | arrested:audition.
"""
import collections
import contextlib
import io
import itertools
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "plancher"))
import w10 as W  # noqa: E402

LOGEMENT_DIR = str(Path(__file__).resolve().parents[3] / "tools" / "plancher")

# --- Valeurs rejouées du brief T14 (tolérance zéro) ---
EXPECTED_PROFILES = {
    "Zéro nom": ([63, 64, 63, 55, 48, 39], "released"),
    "Zéro nom + permis au J6": ([63, 64, 63, 55, 48, 30], "released"),
    "Bavard, quatre noms": ([47, 44, 39, 32, 23, 0], "arrested:6"),
    "Un nom, J2": ([63, 76, 75, 67, 60, 51], "released"),
    "Un nom, J3": ([63, 64, 75, 67, 60, 51], "released"),
    "Un nom, J4": ([63, 64, 63, 72, 65, 56], "released"),
    "Un nom, J5": ([63, 64, 63, 55, 62, 55], "released"),
    "Deux noms, J2 + J3": ([63, 76, 87, 79, 72, 63], "recruited"),
    "Deux noms, J4 + J5": ([63, 64, 63, 72, 79, 72], "recruited"),
    "Quatre noms": ([63, 76, 87, 96, 100, 93], "recruited"),
    "Deux noms puis arrêté": ([47, 32, 15, 24, 31, 24], "arrested:audition"),
    "Bavard": ([47, 32, 15, 0], "arrested:4"),
    "Muet": ([51, 40, 29, 9, 0], "arrested:5"),
}
EXPECTED_D134 = {
    "permis J1, #7 trouvé J2": ([54, 45, 44, 36, 29, 20], "arrested:audition"),
    "permis J1, #7 trouvé J5": ([54, 55, 54, 46, 29, 20], "arrested:audition"),
    "permis J1, sans #7": ([54, 55, 54, 46, 39, 30], "released"),
    "reste chez lui, couloir": ([59, 56, 55, 43, 32, 19], "arrested:audition"),
    "reste chez lui, muet": ([47, 32, 21, 0], "arrested:4"),
}
EXPECTED_GRID = {
    None: {"couloir": ({"0:released": 8, "1:released": 32, "2:recruited": 48, "3:recruited": 32, "4:recruited": 8},
                       {0: 30, 1: 42, 2: 54, 3: 70, 4: 84})},
    2: {"couloir": ({"0:arrested:audition": 6, "0:released": 2, "1:released": 24, "2:recruited": 24, "3:recruited": 8},
                    {0: 20, 1: 32, 2: 48, 3: 65})},
}
N_GRID = 768  # 4 profils x 16 sous-ensembles x 8 permis x 2 cas de #7, moins ceux où déclarer au J2 = nommer (256)

ISSUE = {"libéré": "released", "recruté": "recruited"}


def end_of(out, night):
    if out == "arrêté":
        return "arrested:audition" if night == 7 else f"arrested:{night}"
    return ISSUE[out]


def make_case(words, names=frozenset(), permit=None, found=None, absent=(), profile=None):
    vals, out, night = W.run(words=words, names=names, permis=permit, found=found, absent=absent)
    resolved = [words(n, n in names) for n in range(1, 7)]
    case = {} if profile is None else {"profile": profile}
    case.update(words=resolved, names=sorted(names), permit=permit, found=found, absent=sorted(absent),
                nights=vals, end=end_of(out, night))
    return case


def check(label, case, expected):
    if (case["nights"], case["end"]) != expected:
        sys.exit(f"ÉCART {label} : obtenu {(case['nights'], case['end'])}, attendu {expected}")


def build_profiles():
    out = {}
    for name, kw in W.PROFILES:
        out[name] = make_case(kw["words"], kw.get("names", frozenset()), kw.get("permis"))
        check(name, out[name], EXPECTED_PROFILES[name])
    assert set(out) == set(EXPECTED_PROFILES)
    return out


def build_d134():
    c, m = W.couloir, W.muet
    cases = {
        "permis J1, #7 trouvé J2": make_case(c, permit=1, found=2),
        "permis J1, #7 trouvé J5": make_case(c, permit=1, found=5),
        "permis J1, sans #7": make_case(c, permit=1),
        "reste chez lui, couloir": make_case(c, absent=W.REG_DAYS),
        "reste chez lui, muet": make_case(m, absent=W.REG_DAYS),
    }
    for name, case in cases.items():
        check(name, case, EXPECTED_D134[name])
    return cases


def build_grid():
    profiles = {"couloir": W.couloir, "muet": W.muet, "bavard": W.bavard, "bavard_puis_docile": W.bavard_puis_docile}
    grid = []
    for found in (None, 2):
        for pn, w in profiles.items():
            for k in range(5):
                for names in itertools.combinations((2, 3, 4, 5), k):
                    if found == 2 and 2 in names:
                        continue
                    for permit in (None, 1, 2, 3, 4, 5, 6, 7):
                        grid.append(make_case(w, frozenset(names), permit, found, profile=pn))
    assert len(grid) == N_GRID, len(grid)
    return grid


def grid_summary(grid, found, pn):
    counts, mins = collections.Counter(), {}
    for c in grid:
        if c["profile"] != pn or c["found"] != found:
            continue
        k = len(c["names"])
        counts[f"{k}:{c['end']}"] += 1
        if len(c["nights"]) == 6:
            mins[k] = min(mins.get(k, 999), c["nights"][-1])
    return dict(sorted(counts.items())), dict(sorted(mins.items()))


def check_grid(grid):
    for found, byp in EXPECTED_GRID.items():
        for pn, expected in byp.items():
            got = grid_summary(grid, found, pn)
            if got != expected:
                sys.exit(f"ÉCART grille {pn} #7={found} : obtenu {got}, attendu {expected}")


def check_against_logement(grid):
    """w10_logement.py imprime sa grille à l'import : on la capture et on la compare ligne à ligne à la nôtre."""
    buf = io.StringIO()
    argv, sys.argv = sys.argv, ["w10_logement.py", LOGEMENT_DIR]
    try:
        with contextlib.redirect_stdout(buf):
            import w10_logement  # noqa: F401
    finally:
        sys.argv = argv
    mine = []
    for found in (None, 2):
        mine.append("== #7 " + ("caché ou déclaré au J2 (grille actuelle)" if found is None
                                else "laissé au logement, non caché, trouvé au J2 : -10"))
        for pn in ("couloir", "muet", "bavard", "bavard_puis_docile"):
            counts, mins = grid_summary(grid, found, pn)
            # même forme que w10_logement : clés (k, "issue" [+ " N<nuit>"]) triées
            out = {}
            for key, n in counts.items():
                k, end = key.split(":", 1)
                label = {"released": "libéré", "recruited": "recruté"}.get(end)
                if label is None:
                    label = "arrêté N" + end.split(":")[1] if end.split(":")[1].isdigit() else "arrêté N7"
                out[(int(k), label)] = n
            mine.append(f"{pn} {dict(sorted(out.items()))} min final par nb de noms {mins}")
    theirs = [ln for ln in buf.getvalue().splitlines() if ln.startswith("==") or ln.split(" ", 1)[0] in
              ("couloir", "muet", "bavard", "bavard_puis_docile")]
    if mine != theirs:
        sys.exit("ÉCART avec w10_logement.py :\n" + "\n".join(mine) + "\n---\n" + "\n".join(theirs))


def dump(obj):
    one = lambda c: json.dumps(c, ensure_ascii=False, separators=(",", ":"))
    lines = ['{"profiles":{']
    lines.append(",\n".join(f"{json.dumps(k, ensure_ascii=False)}:{one(v)}" for k, v in obj["profiles"].items()))
    lines.append('},\n"d134":{')
    lines.append(",\n".join(f"{json.dumps(k, ensure_ascii=False)}:{one(v)}" for k, v in obj["d134"].items()))
    lines.append('},\n"grid":[')
    lines.append(",\n".join(one(c) for c in obj["grid"]))
    lines.append("]}")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    profiles, d134, grid = build_profiles(), build_d134(), build_grid()
    check_grid(grid)
    check_against_logement(grid)
    sys.stdout.write(dump({"profiles": profiles, "d134": d134, "grid": grid}))
