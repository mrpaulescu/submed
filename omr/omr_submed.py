"""
OMR (Optical Mark Recognition) for submed.ro Answer Sheet
==========================================================
Reads a phone photo (or scan) of the submed.ro answer sheet and produces
a 150x5 binary matrix where matrix[q][opt] == 1 means the bubble for
question q+1, option opt is filled.

    Columns: 0=a, 1=b, 2=c, 3=d, 4=e
    Rows:    0=Q1 ... 149=Q150

Key differences from the Cluj/flat-scan version
------------------------------------------------
- Phone photo: uneven lighting, darker at edges/bottom
- Uses a per-row adaptive threshold (60% of local background brightness)
  so it works regardless of lighting gradients across the photo
- Calibrated for the submed.ro 3-column 5-option layout at ~1500x2000 px

Calibration
-----------
Measured from IMG_0709.jpg (1500x2000 px phone photo):
  Q1 row y = 456 px,  row pitch = 29.0 px
  Col1 (Q1-Q50)   x: [223, 248, 275, 302, 329]
  Col2 (Q51-Q100) x: [529, 555, 583, 611, 637]
  Col3 (Q101-Q150)x: [855, 881, 909, 936, 963]

Requirements: opencv-python (cv2), numpy

Usage
-----
    python omr_submed.py <input.jpg|input.png|input.pdf> [options]

    Options:
      --output  / -o  PATH   Save results to CSV  (default: print only)
      --annotate / -a PATH   Save colour-annotated image
      --quiet   / -q         Suppress stdout matrix
"""

import cv2
import numpy as np
import subprocess
import os
import csv
import argparse


# ---------------------------------------------------------------------------
# GRID CALIBRATION  (pixels in the reference 1500x2000 phone photo)
# ---------------------------------------------------------------------------

ROW_Y_Q1     = 456       # y-centre of Q1 row (full image)
ROW_PITCH    = 29.0      # vertical distance between consecutive rows (px)
ROWS_PER_COL = 50        # questions per column section

# X-centres for options a-e in each of the three question columns
COL_BUBBLE_X = {
    1: [223, 248, 275, 302, 329],        # Q1   - Q50
    2: [529, 555, 583, 611, 637],        # Q51  - Q100
    3: [855, 881, 909, 936, 963],        # Q101 - Q150
}

# Sampling square half-size (px) inside each bubble
BUBBLE_RADIUS = 10

# X positions of white-paper background used for per-row adaptive thresholding
# (gaps between / outside the three columns)
BG_SAMPLE_XS = [180, 420, 720, 1010]

# Filled bubble = mean < BG_FACTOR * local_background_mean
BG_FACTOR = 0.60

# Reference image size (used to scale coordinates if input differs)
REF_WIDTH  = 1500
REF_HEIGHT = 2000


# ---------------------------------------------------------------------------
# IMAGE I/O
# ---------------------------------------------------------------------------

def pdf_to_image(pdf_path: str, dpi: int = 200) -> np.ndarray:
    """Convert the first page of a PDF to a BGR numpy array via pdftoppm."""
    tmp_prefix = "/tmp/_omr_submed_page"
    result = subprocess.run(
        ["pdftoppm", "-r", str(dpi), "-f", "1", "-l", "1", pdf_path, tmp_prefix],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pdftoppm failed:\n{result.stderr.decode()}")
    ppm_path = f"{tmp_prefix}-1.ppm"
    img = cv2.imread(ppm_path)
    try:
        os.remove(ppm_path)
    except OSError:
        pass
    if img is None:
        raise RuntimeError("Could not read the converted page image.")
    return img


def load_image(path: str) -> np.ndarray:
    """Load a PDF, PNG, or JPG as a colour (BGR) numpy array."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return pdf_to_image(path)
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {path}")
    return img


def preprocess(img: np.ndarray) -> tuple:
    """
    Resize to reference dimensions if needed, then convert to grayscale.
    Returns (gray, scale_x, scale_y).
    """
    h, w = img.shape[:2]
    scale_x = w / REF_WIDTH
    scale_y = h / REF_HEIGHT
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img.copy()
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    return gray, scale_x, scale_y


# ---------------------------------------------------------------------------
# ADAPTIVE THRESHOLD
# ---------------------------------------------------------------------------

def local_threshold(gray: np.ndarray, y: int, radius: int,
                    bg_xs: list, factor: float) -> float:
    """
    Estimate the local background brightness at row y and return
    the intensity threshold for a filled bubble (factor * background).
    """
    samples = []
    h, w = gray.shape
    for bx in bg_xs:
        y1, y2 = max(0, y - radius), min(h, y + radius)
        x1, x2 = max(0, bx - radius), min(w, bx + radius)
        roi = gray[y1:y2, x1:x2]
        if roi.size > 0:
            samples.append(float(np.mean(roi)))
    return np.mean(samples) * factor if samples else 120.0


# ---------------------------------------------------------------------------
# BUBBLE SAMPLING
# ---------------------------------------------------------------------------

def sample_bubble(gray: np.ndarray, x: int, y: int, radius: int) -> float:
    """Return the mean pixel intensity in the square centred on (x, y)."""
    h, w = gray.shape
    y1, y2 = max(0, y - radius), min(h, y + radius)
    x1, x2 = max(0, x - radius), min(w, x + radius)
    roi = gray[y1:y2, x1:x2]
    return float(np.mean(roi)) if roi.size > 0 else 255.0


# ---------------------------------------------------------------------------
# CORE OMR
# ---------------------------------------------------------------------------

def run_omr(image_path: str) -> np.ndarray:
    """
    Process an answer-sheet image and return a (150, 5) binary matrix.

    Returns
    -------
    np.ndarray, shape (150, 5), dtype int
        matrix[q][opt] == 1  ->  bubble filled for question q+1, option opt
        (opt: 0=a, 1=b, 2=c, 3=d, 4=e)
    """
    img            = load_image(image_path)
    gray, sx, sy   = preprocess(img)

    # Scale all reference coordinates to actual image size
    def sx_(x): return int(round(x * sx))
    def sy_(y): return int(round(y * sy))

    radius  = max(1, int(round(BUBBLE_RADIUS * min(sx, sy))))
    pitch   = ROW_PITCH * sy

    row_ys  = [int(round(ROW_Y_Q1 * sy + i * pitch)) for i in range(ROWS_PER_COL)]
    bg_xs_s = [sx_(bx) for bx in BG_SAMPLE_XS]
    col_xs_s = {col: [sx_(x) for x in xs] for col, xs in COL_BUBBLE_X.items()}

    matrix = np.zeros((150, 5), dtype=int)

    for col_num, xs in col_xs_s.items():
        q_base = (col_num - 1) * ROWS_PER_COL

        for row_idx, y in enumerate(row_ys):
            q_idx  = q_base + row_idx
            thresh = local_threshold(gray, y, radius, bg_xs_s, BG_FACTOR)

            for opt_idx, x in enumerate(xs):
                intensity = sample_bubble(gray, x, y, radius)
                matrix[q_idx, opt_idx] = 1 if intensity < thresh else 0

    return matrix


# ---------------------------------------------------------------------------
# OUTPUT HELPERS
# ---------------------------------------------------------------------------

def print_matrix(matrix: np.ndarray) -> None:
    """Pretty-print the 150x5 matrix to stdout."""
    header = f"{'Q':>5}  {'a':>2} {'b':>2} {'c':>2} {'d':>2} {'e':>2}   Marked"
    print(header)
    print("-" * len(header))
    for q in range(matrix.shape[0]):
        row   = matrix[q]
        bits  = "  ".join(str(v) for v in row)
        marks = "".join("abcde"[i] if row[i] else "." for i in range(5))
        print(f"Q{q+1:>4}  {bits}   ({marks})")


def save_csv(matrix: np.ndarray, out_path: str) -> None:
    """Write the matrix to a CSV file."""
    with open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Question", "a", "b", "c", "d", "e", "Marked"])
        for q in range(matrix.shape[0]):
            row   = matrix[q]
            marks = "".join("abcde"[i] if row[i] else "." for i in range(5))
            writer.writerow([f"Q{q+1}"] + list(map(int, row)) + [marks])
    print(f"Saved CSV -> {out_path}")


def save_annotated_image(image_path: str, matrix: np.ndarray, out_path: str) -> None:
    """
    Write a colour-annotated copy of the answer sheet:
      Red ring   = filled bubble detected
      Green ring = empty bubble
    """
    img          = load_image(image_path)
    _, sx, sy    = preprocess(img)

    def sx_(x): return int(round(x * sx))
    def sy_(y): return int(round(y * sy))

    radius  = max(1, int(round(BUBBLE_RADIUS * min(sx, sy))))
    pitch   = ROW_PITCH * sy
    row_ys  = [int(round(ROW_Y_Q1 * sy + i * pitch)) for i in range(ROWS_PER_COL)]
    col_xs_s = {col: [sx_(x) for x in xs] for col, xs in COL_BUBBLE_X.items()}

    for col_num, xs in col_xs_s.items():
        q_base = (col_num - 1) * ROWS_PER_COL
        for row_idx, y in enumerate(row_ys):
            q_idx = q_base + row_idx
            for opt_idx, x in enumerate(xs):
                filled = bool(matrix[q_idx, opt_idx])
                color  = (0, 0, 220) if filled else (0, 180, 0)
                cv2.circle(img, (x, y), radius + 4, color, 2)

    cv2.imwrite(out_path, img)
    print(f"Saved annotated image -> {out_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> np.ndarray:
    parser = argparse.ArgumentParser(
        description="OMR for submed.ro answer sheet - outputs a 150x5 binary matrix."
    )
    parser.add_argument("input",
                        help="Path to the answer-sheet JPG, PNG, or PDF")
    parser.add_argument("--output", "-o", default=None,
                        help="Save results to a CSV file")
    parser.add_argument("--annotate", "-a", default=None,
                        help="Save colour-annotated image to this path")
    parser.add_argument("--quiet", "-q", action="store_true",
                        help="Suppress matrix print to stdout")
    args = parser.parse_args()

    print(f"Processing: {args.input}")
    matrix = run_omr(args.input)

    if not args.quiet:
        print()
        print_matrix(matrix)

    if args.output:
        save_csv(matrix, args.output)

    if args.annotate:
        save_annotated_image(args.input, matrix, args.annotate)

    return matrix


if __name__ == "__main__":
    main()