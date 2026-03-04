"""
Submed OMR API  —  deploy pe Render.com
========================================
Endpoint-uri publice:
  GET  /exams                  → lista examene
  POST /scan                   → scanează foaia studentului

Endpoint-uri admin (necesită header X-Admin-Secret):
  POST /admin/scan-key         → scanează grila corectă → returnează matrice + imagine (NU salvează)
  GET  /admin/exams            → lista examene cu chei
  POST /admin/exams            → creează examen
  GET  /admin/exams/<id>       → detalii examen
  PUT  /admin/exams/<id>       → actualizează examen
  DELETE /admin/exams/<id>     → șterge examen
"""

import os, json, uuid, re, base64
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

from omr_engine import run_omr, annotate_image, matrix_to_key

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

EXAMS_DIR    = Path("exams")
UPLOADS_DIR  = Path("/tmp/omr_uploads")
EXAMS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED       = {".jpg", ".jpeg", ".png", ".webp"}
ADMIN_SECRET  = os.environ.get("ADMIN_SECRET", "change-me")


# ── helpers ───────────────────────────────────────────────────────────────────

def _auth():
    if request.headers.get("X-Admin-Secret", "") != ADMIN_SECRET:
        return jsonify({"error": "Neautorizat"}), 401
    return None


def _save_upload(file) -> Path:
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED:
        raise ValueError(f"Tip nesuportat: {ext}")
    path = UPLOADS_DIR / f"{uuid.uuid4().hex}{ext}"
    file.save(path)
    return path


def _img_to_b64(img_bgr) -> str:
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return base64.b64encode(buf).decode()


def _parse_key(raw) -> dict:
    if isinstance(raw, str):
        raw = json.loads(raw)
    clean = {}
    for k, v in raw.items():
        q = int(k)
        assert 1 <= q <= 150, f"Q{q} în afara domeniului"
        assert isinstance(v, list) and all(c in "abcde" for c in v)
        clean[str(q)] = sorted(v)
    return clean


def _score(matrix, key):
    results, correct_n, graded_n = [], 0, 0
    opts = "abcde"
    for q in range(150):
        qk      = str(q + 1)
        student = [opts[i] for i in range(5) if matrix[q, i]]
        correct = key.get(qk, [])
        if not correct:
            results.append({"q": q+1, "student": student, "correct": [], "status": "ungraded"})
            continue
        graded_n += 1
        ok = sorted(student) == sorted(correct)
        if ok: correct_n += 1
        results.append({"q": q+1, "student": student, "correct": correct,
                        "status": "correct" if ok else "wrong"})
    pct = round(correct_n / graded_n * 100, 1) if graded_n else 0
    return {"score": correct_n, "total": graded_n, "percentage": pct, "questions": results}


def _unique_id(name):
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "exam"
    cand, i = slug, 2
    while (EXAMS_DIR / f"{cand}.json").exists():
        cand = f"{slug}_{i}"; i += 1
    return cand


# ── endpoint-uri publice ──────────────────────────────────────────────────────

@app.route("/exams")
def exams_list():
    out = []
    for p in EXAMS_DIR.glob("*.json"):
        try:
            d = json.loads(p.read_text())
            out.append({"id": p.stem, "name": d["name"], "date": d.get("date", "")})
        except Exception:
            pass
    return jsonify(sorted(out, key=lambda e: e["date"], reverse=True))


@app.route("/scan", methods=["POST"])
def scan_student():
    exam_id = request.form.get("exam_id", "").strip()
    p = EXAMS_DIR / f"{exam_id}.json"
    if not exam_id or not p.exists():
        return jsonify({"error": "Examen negăsit."}), 404

    exam = json.loads(p.read_text())

    if "sheet" not in request.files or not request.files["sheet"].filename:
        return jsonify({"error": "Nicio imagine încărcată."}), 400

    try:
        tmp        = _save_upload(request.files["sheet"])
        sheet_type = exam.get("sheet_type", "submed")
        matrix     = run_omr(str(tmp), sheet_type)
        report     = _score(matrix, exam["key"])
        ann        = annotate_image(str(tmp), matrix, exam["key"], sheet_type)
        return jsonify({**report, "exam_name": exam["name"], "image": _img_to_b64(ann)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: tmp.unlink()
        except: pass


# ── endpoint-uri admin ────────────────────────────────────────────────────────

@app.route("/admin/scan-key", methods=["POST"])
def admin_scan_key():
    """
    Scanează o fotografie a grilei corecte și returnează:
      - matricea ca dict {"1":["b"], ...}
      - imaginea adnotată (verde = bifat)
    NU salvează nimic — adminul verifică și trimite explicit /admin/exams
    """
    err = _auth()
    if err: return err

    if "sheet" not in request.files or not request.files["sheet"].filename:
        return jsonify({"error": "Nicio imagine."}), 400

    sheet_type = request.form.get("sheet_type", "submed")
    if sheet_type not in ("submed", "cluj"):
        return jsonify({"error": "Tip foaie necunoscut."}), 400

    try:
        tmp    = _save_upload(request.files["sheet"])
        matrix = run_omr(str(tmp), sheet_type)
        key    = matrix_to_key(matrix)
        ann    = annotate_image(str(tmp), matrix, key=None, sheet_type=sheet_type)
        # returnează și matricea ca array 150x5 pentru editare în browser
        matrix_list = matrix.tolist()
        return jsonify({"key": key, "matrix": matrix_list, "image": _img_to_b64(ann)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: tmp.unlink()
        except: pass


@app.route("/admin/exams", methods=["GET"])
def admin_exams_get():
    err = _auth()
    if err: return err
    out = []
    for p in EXAMS_DIR.glob("*.json"):
        try:
            d = json.loads(p.read_text())
            out.append({"id": p.stem, **d})
        except: pass
    return jsonify(sorted(out, key=lambda e: e.get("date",""), reverse=True))


@app.route("/admin/exams", methods=["POST"])
def admin_exam_create():
    err = _auth()
    if err: return err
    body = request.get_json()
    try:
        name       = body["name"].strip()
        key        = _parse_key(body.get("key", {}))
        sheet_type = body.get("sheet_type", "submed")
        eid        = _unique_id(name)
        payload    = {"name": name, "date": body.get("date",""),
                      "sheet_type": sheet_type, "key": key}
        (EXAMS_DIR / f"{eid}.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False))
        return jsonify({"id": eid}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/admin/exams/<eid>", methods=["GET"])
def admin_exam_get(eid):
    err = _auth()
    if err: return err
    p = EXAMS_DIR / f"{eid}.json"
    if not p.exists(): return jsonify({"error": "Negăsit"}), 404
    return jsonify({"id": eid, **json.loads(p.read_text())})


@app.route("/admin/exams/<eid>", methods=["PUT"])
def admin_exam_update(eid):
    err = _auth()
    if err: return err
    p = EXAMS_DIR / f"{eid}.json"
    if not p.exists(): return jsonify({"error": "Negăsit"}), 404
    body = request.get_json()
    try:
        key        = _parse_key(body.get("key", {}))
        sheet_type = body.get("sheet_type", "submed")
        payload    = {"name": body["name"], "date": body.get("date",""),
                      "sheet_type": sheet_type, "key": key}
        p.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/admin/exams/<eid>", methods=["DELETE"])
def admin_exam_delete(eid):
    err = _auth()
    if err: return err
    p = EXAMS_DIR / f"{eid}.json"
    if p.exists(): p.unlink()
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
