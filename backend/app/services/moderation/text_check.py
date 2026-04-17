from __future__ import annotations

import re

SLUR_PATTERNS: list[str] = [
    r"\bn[i1!|][g9][g9][e3][r]?\b",
    r"\bf[a@][g9][g9]?[o0]?[t7]?\b",
    r"\bk[i1][k][e3]\b",
    r"\bsp[i1][c][k]?\b",
    r"\bch[i1]nk\b",
    r"\bw[e3]tb[a@]ck\b",
    r"\br[e3]t[a@]rd\b",
]

COMPILED_SLURS = [re.compile(p, re.IGNORECASE) for p in SLUR_PATTERNS]


def check_text(plate_text: str, caption: str | None) -> tuple[bool, str | None]:
    """Returns (is_clean, reason_if_dirty)."""
    combined = plate_text
    if caption:
        combined = f"{plate_text} {caption}"

    for pattern in COMPILED_SLURS:
        if pattern.search(combined):
            return False, "Text contains offensive language"

    return True, None
