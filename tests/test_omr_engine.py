import importlib.util
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
ENGINE_PATH = ROOT / "render_api" / "omr_engine.py"

spec = importlib.util.spec_from_file_location("omr_engine", ENGINE_PATH)
omr_engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(omr_engine)


OPTS = "abcde"


def make_matrix(marked):
    matrix = np.zeros((150, 5), dtype=int)
    for question_no, answers in marked.items():
        for answer in answers:
            matrix[question_no - 1, OPTS.index(answer)] = 1
    return matrix


def draw_sheet(sheet_type, marked, scale=1.0):
    cfg = omr_engine.CONFIGS[sheet_type]
    width = int(round(cfg["REF_W"] * scale))
    height = int(round(cfg["REF_H"] * scale))
    image = np.full((height, width, 3), 255, dtype=np.uint8)

    sx = width / cfg["REF_W"]
    sy = height / cfg["REF_H"]
    row_ys, cols, radius, _ = omr_engine._grid(cfg, sx, sy)

    for question_no, answers in marked.items():
        question_idx = question_no - 1
        col_num = question_idx // 50 + 1
        row_idx = question_idx % 50
        y = row_ys[row_idx]

        for answer in answers:
            x = cols[col_num][OPTS.index(answer)]
            cv2.circle(image, (x, y), max(2, radius - 1), (0, 0, 0), -1)

    return image


def run_on_image(image, sheet_type):
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        path = Path(tmp.name)
    try:
        cv2.imwrite(str(path), image)
        return omr_engine.run_omr(str(path), sheet_type)
    finally:
        path.unlink(missing_ok=True)


class OmrEngineSyntheticTests(unittest.TestCase):
    def assert_matrix_marks(self, actual, expected_marks):
        expected = make_matrix(expected_marks)
        np.testing.assert_array_equal(actual, expected)

    def test_submed_blank_sheet_has_no_marks(self):
        matrix = run_on_image(draw_sheet("submed", {}), "submed")
        self.assertEqual(matrix.shape, (150, 5))
        self.assertEqual(int(matrix.sum()), 0)

    def test_submed_reads_known_marks(self):
        marked = {
            1: ["b"],
            2: ["a", "c", "e"],
            50: ["e"],
            51: ["d"],
            100: ["a", "b"],
            101: ["c"],
            150: ["a", "e"],
        }
        matrix = run_on_image(draw_sheet("submed", marked), "submed")
        self.assert_matrix_marks(matrix, marked)

    def test_submed_reads_known_marks_after_scaling(self):
        marked = {
            3: ["a"],
            49: ["b", "d"],
            52: ["e"],
            102: ["a", "c"],
            149: ["d"],
        }
        matrix = run_on_image(draw_sheet("submed", marked, scale=1.6), "submed")
        self.assert_matrix_marks(matrix, marked)

    def test_cluj_reads_known_marks(self):
        marked = {
            1: ["a"],
            25: ["b", "e"],
            51: ["c"],
            100: ["d"],
            150: ["a", "c", "e"],
        }
        matrix = run_on_image(draw_sheet("cluj", marked), "cluj")
        self.assert_matrix_marks(matrix, marked)

    def test_matrix_to_key_omits_empty_questions(self):
        marked = {
            1: ["b"],
            2: ["a", "c", "e"],
            150: ["d"],
        }
        self.assertEqual(
            omr_engine.matrix_to_key(make_matrix(marked)),
            {"1": ["b"], "2": ["a", "c", "e"], "150": ["d"]},
        )


class OmrEngineRealFixtureTests(unittest.TestCase):
    def summarize(self, matrix):
        row_counts = [int(row.sum()) for row in matrix]
        return {
            "filled": int(matrix.sum()),
            "answered": sum(count > 0 for count in row_counts),
            "empty": sum(count == 0 for count in row_counts),
            "multi4plus": sum(count >= 4 for count in row_counts),
        }

    def test_img_0709_submed_smoke_regression(self):
        matrix = omr_engine.run_omr(str(ROOT / "omr" / "IMG_0709.jpg"), "submed")
        self.assertEqual(matrix.shape, (150, 5))
        self.assertEqual(
            self.summarize(matrix),
            {"filled": 7, "answered": 4, "empty": 146, "multi4plus": 0},
        )

    def test_calib_submed_smoke_regression(self):
        matrix = omr_engine.run_omr(str(ROOT / "omr" / "calib.jpg"), "submed")
        self.assertEqual(matrix.shape, (150, 5))
        self.assertEqual(
            self.summarize(matrix),
            {"filled": 0, "answered": 0, "empty": 150, "multi4plus": 0},
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
