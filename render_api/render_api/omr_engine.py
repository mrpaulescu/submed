"""
omr_engine.py  –  submed.ro answer sheet OMR
Calibrated for 1500 x 2000 px phone photos.
"""

import cv2
import numpy as np

ROW_Y_Q1     = 456
ROW_PITCH    = 29.0
ROWS_PER_COL = 50

COL_BUBBLE_X = {
    1: [223, 248, 275, 302, 329],
    2: [529, 555, 583, 611, 637],
    3: [855, 881, 909, 936, 963],
}

BUBBLE_RADIUS = 10
BG_SAMPLE_XS  = [180, 420, 720, 1010]
BG_FACTOR     = 0.60
REF_WIDTH     = 1500
REF_HEIGHT    = 2000


def _load(path):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot read: {path}")
    return img


def _prep(img):
    h, w = img.shape[:2]
    sx, sy = w / REF_WIDTH, h / REF_HEIGHT
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img.copy()
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    return gray, sx, sy


def _local_thresh(gray, y, r, bg_xs, factor):
    h, w = gray.shape
    samples = []
    for bx in bg_xs:
        roi = gray[max(0,y-r):y+r, max(0,bx-r):bx+r]
        if roi.size > 0:
            samples.append(float(np.mean(roi)))
    return np.mean(samples) * factor if samples else 120.0


def _sample(gray, x, y, r):
    h, w = gray.shape
    roi = gray[max(0,y-r):y+r, max(0,x-r):x+r]
    return float(np.mean(roi)) if roi.size > 0 else 255.0


def run_omr(image_path: str) -> np.ndarray:
    """
    Returns (150, 5) binary matrix.  1 = bubble filled.
    Columns: 0=a  1=b  2=c  3=d  4=e
    """
    img = _load(image_path)
    gray, sx, sy = _prep(img)

    r      = max(1, int(round(BUBBLE_RADIUS * min(sx, sy))))
    pitch  = ROW_PITCH * sy
    row_ys = [int(round(ROW_Y_Q1 * sy + i * pitch)) for i in range(ROWS_PER_COL)]
    bg_xs  = [int(round(bx * sx)) for bx in BG_SAMPLE_XS]
    cols   = {c: [int(round(x * sx)) for x in xs] for c, xs in COL_BUBBLE_X.items()}

    matrix = np.zeros((150, 5), dtype=int)
    for col_num, xs in cols.items():
        qb = (col_num - 1) * ROWS_PER_COL
        for ri, y in enumerate(row_ys):
            thresh = _local_thresh(gray, y, r, bg_xs, BG_FACTOR)
            for oi, x in enumerate(xs):
                matrix[qb + ri, oi] = 1 if _sample(gray, x, y, r) < thresh else 0
    return matrix


def annotate_image(image_path: str, matrix: np.ndarray, key: dict = None) -> np.ndarray:
    """
    Draw rings on every bubble.
    If key is provided:
      - correct answer filled correctly  → bright green
      - student filled wrongly           → red
      - correct answer not filled        → orange (missed)
      - empty & not expected             → dim green outline
    If no key: red = filled, green = empty.
    """
    img = _load(image_path)
    _, sx, sy = _prep(img)

    r      = max(1, int(round(BUBBLE_RADIUS * min(sx, sy))))
    pitch  = ROW_PITCH * sy
    row_ys = [int(round(ROW_Y_Q1 * sy + i * pitch)) for i in range(ROWS_PER_COL)]
    cols   = {c: [int(round(x * sx)) for x in xs] for c, xs in COL_BUBBLE_X.items()}
    opts   = "abcde"

    for col_num, xs in cols.items():
        qb = (col_num - 1) * ROWS_PER_COL
        for ri, y in enumerate(row_ys):
            q_idx   = qb + ri
            q_key   = str(q_idx + 1)
            correct = set(key.get(q_key, [])) if key else set()

            for oi, x in enumerate(xs):
                filled  = bool(matrix[q_idx, oi])
                letter  = opts[oi]

                if key:
                    is_correct_answer = letter in correct
                    if filled and is_correct_answer:
                        color = (20, 220, 80)     # green  – correct pick
                    elif filled and not is_correct_answer:
                        color = (30, 30, 220)     # red    – wrong pick
                    elif not filled and is_correct_answer:
                        color = (30, 160, 255)    # orange – missed answer
                    else:
                        color = (80, 100, 80)     # dim    – irrelevant empty
                else:
                    color = (30, 30, 220) if filled else (20, 180, 20)

                thickness = 3 if (filled or (key and letter in correct)) else 1
                cv2.circle(img, (x, y), r + 3, color, thickness)

    return img
