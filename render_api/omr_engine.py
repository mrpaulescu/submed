"""
omr_engine.py  —  suportă două tipuri de foi de grilă:
  "submed"  — foaia submed.ro, poză telefon ~1500x2000px, prag adaptiv
  "cluj"    — foaia Cluj 2024, scan 300dpi ~2481x3509px, prag fix
"""

import cv2
import numpy as np

# ── calibrare SUBMED ──────────────────────────────────────────────────────────
_S = {
    "ROW_Y_Q1":  456,
    "ROW_PITCH": 29.0,
    "COL_X": {
        1: [223, 248, 275, 302, 329],
        2: [529, 555, 583, 611, 637],
        3: [855, 881, 909, 936, 963],
    },
    "RADIUS":    10,
    "BG_XS":     [180, 420, 720, 1010],
    "BG_FACTOR": 0.60,
    "REF_W":     1500,
    "REF_H":     2000,
    "THRESHOLD": None,   # None = adaptiv per-rând
}

# ── calibrare CLUJ ────────────────────────────────────────────────────────────
_C = {
    "ROW_Y_Q1":  738,
    "ROW_PITCH": 53.16,
    "COL_X": {
        1: [247, 301, 353, 407, 459],
        2: [832, 885, 939, 992, 1045],
        3: [1410, 1464, 1519, 1573, 1626],
    },
    "RADIUS":    18,
    "BG_XS":     None,
    "BG_FACTOR": None,
    "REF_W":     2481,
    "REF_H":     3509,
    "THRESHOLD": 120,
}

CONFIGS = {"submed": _S, "cluj": _C}
OPTS    = "abcde"


# ── helpers ───────────────────────────────────────────────────────────────────

def _load(path):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Nu pot citi: {path}")
    return img


def _prep(img, cfg):
    h, w = img.shape[:2]
    sx, sy = w / cfg["REF_W"], h / cfg["REF_H"]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img.copy()
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    return gray, sx, sy


def _local_thresh(gray, y, r, bg_xs, factor):
    samples = []
    for bx in bg_xs:
        roi = gray[max(0, y-r):y+r, max(0, bx-r):bx+r]
        if roi.size > 0:
            samples.append(float(np.mean(roi)))
    return np.mean(samples) * factor if samples else 120.0


def _sample(gray, x, y, r):
    roi = gray[max(0, y-r):y+r, max(0, x-r):x+r]
    return float(np.mean(roi)) if roi.size > 0 else 255.0


def _grid(cfg, sx, sy):
    r      = max(1, int(round(cfg["RADIUS"] * min(sx, sy))))
    pitch  = cfg["ROW_PITCH"] * sy
    row_ys = [int(round(cfg["ROW_Y_Q1"] * sy + i * pitch)) for i in range(50)]
    cols   = {c: [int(round(x * sx)) for x in xs]
              for c, xs in cfg["COL_X"].items()}
    bg_xs  = ([int(round(bx * sx)) for bx in cfg["BG_XS"]]
              if cfg["BG_XS"] else None)
    return row_ys, cols, r, bg_xs


# ── API publică ───────────────────────────────────────────────────────────────

def run_omr(image_path: str, sheet_type: str = "submed") -> np.ndarray:
    """Returnează matrice (150, 5) binară. 1 = bulă bifată."""
    cfg = CONFIGS[sheet_type]
    img = _load(image_path)
    gray, sx, sy = _prep(img, cfg)
    row_ys, cols, r, bg_xs = _grid(cfg, sx, sy)

    matrix = np.zeros((150, 5), dtype=int)
    for col_num, xs in cols.items():
        qb = (col_num - 1) * 50
        for ri, y in enumerate(row_ys):
            thresh = (_local_thresh(gray, y, r, bg_xs, cfg["BG_FACTOR"])
                      if cfg["THRESHOLD"] is None else cfg["THRESHOLD"])
            for oi, x in enumerate(xs):
                matrix[qb + ri, oi] = 1 if _sample(gray, x, y, r) < thresh else 0
    return matrix


def matrix_to_key(matrix: np.ndarray) -> dict:
    """
    Convertește matricea OMR în cheie răspuns.
    Returnează {"1": ["b"], "2": ["a","c"], ...} — doar întrebările cu răspuns.
    """
    key = {}
    for q in range(150):
        answers = [OPTS[i] for i in range(5) if matrix[q, i]]
        if answers:
            key[str(q + 1)] = sorted(answers)
    return key


def annotate_image(image_path: str, matrix: np.ndarray,
                   key: dict = None, sheet_type: str = "submed") -> np.ndarray:
    """
    Returnează imaginea BGR cu cercuri colorate.

    Fără key (scanare grilă corectă):
      verde aprins = bifat  |  gri = gol

    Cu key (corecție student):
      verde     = corect bifat
      roșu      = greșit bifat
      portocaliu = răspuns corect omis
      gri       = irelevant gol
    """
    cfg = CONFIGS[sheet_type]
    img = _load(image_path)
    _, sx, sy = _prep(img, cfg)
    row_ys, cols, r, _ = _grid(cfg, sx, sy)

    for col_num, xs in cols.items():
        qb = (col_num - 1) * 50
        for ri, y in enumerate(row_ys):
            q_idx   = qb + ri
            correct = set(key.get(str(q_idx + 1), [])) if key else None

            for oi, x in enumerate(xs):
                filled = bool(matrix[q_idx, oi])
                letter = OPTS[oi]

                if correct is None:
                    color = (20, 200, 80) if filled else (160, 170, 160)
                    thick = 3 if filled else 1
                else:
                    in_key = letter in correct
                    if   filled and in_key:       color, thick = (20, 200, 80),  3
                    elif filled and not in_key:   color, thick = (30, 30, 210),  3
                    elif not filled and in_key:   color, thick = (30, 150, 255), 3
                    else:                         color, thick = (160, 170, 160), 1

                cv2.circle(img, (x, y), r + 3, color, thick)

    # scalează la max 1200px lățime pentru transfer rapid
    h, w = img.shape[:2]
    if w > 1200:
        scale = 1200 / w
        img   = cv2.resize(img, (1200, int(h * scale)))

    return img
