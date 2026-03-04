"""
Submed OMR API  —  deploy this on Render.com
=============================================
Endpoints:
  GET  /exams          → list all available exams
  POST /scan           → upload photo + exam_id → score + annotated image
  GET  /admin/exams                   → list exams (admin)
  POST /admin/exams                   → create exam
  GET  /admin/exams/<id>              → get one exam
  PUT  /admin/exams/<id>              → update exam
  DELETE /admin/exams/<id>            → delete exam

CORS is open so your cPanel site can call this API.
Protect /admin/* with the ADMIN_SECRET env variable.
"""

import os, json, uuid, re, base64
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

from omr_engine import run_omr, annotate_image

app = Flask(__name__)
CORS(app)  # allow requests from your cPanel domain

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB

EXAMS_DIR   = Path("exams")
UPLOADS_DIR = Path("/tmp/omr_uploads")
EXAMS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED     = {".jpg", ".jpeg", ".png", ".webp"}
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "change-me-in-render-dashboard")


# ── helpers ───────────────────────────────────────────────────────────────────

def check_admin():
    token = request.headers.get("X-Admin-Secret", "")
    if token != ADMIN_SECRET:
        return jsonify({"error": "Unauthorized"}), 401
    return None


def list_exams_data():
    exams = []
    for p in EXAMS_DIR.glob("*.json"):
        try:
            d = json.loads(p.read_text())
            exams.append({"id": p.stem, "name": d["name"], "date": d.get("date","")})
        except Exception:
            pass
    return sorted(exams, key=lambda e: e["date"], reverse=True)


def parse_key(raw):
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    clean = {}
    for k, v in parsed.items():
        q = int(k)
        assert 1 <= q <= 150
        assert isinstance(v, list)
        assert all(c in "abcde" for c in v)
        clean[str(q)] = sorted(v)
    return clean


def score_sheet(matrix, key):
    opts = "abcde"
    results, correct_n, graded_n = [], 0, 0
    for q in range(150):
        qk = str(q + 1)
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


def unique_id(name):
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "exam"
    candidate, i = slug, 2
    while (EXAMS_DIR / f"{candidate}.json").exists():
        candidate = f"{slug}_{i}"; i += 1
    return candidate


# ── public endpoints ──────────────────────────────────────────────────────────

@app.route("/exams")
def exams_list():
    return jsonify(list_exams_data())


@app.route("/scan", methods=["POST"])
def scan():
    exam_id = request.form.get("exam_id", "").strip()
    path    = EXAMS_DIR / f"{exam_id}.json"
    if not exam_id or not path.exists():
        return jsonify({"error": "Examen negăsit."}), 404

    exam = json.loads(path.read_text())

    if "sheet" not in request.files or not request.files["sheet"].filename:
        return jsonify({"error": "Nicio imagine încărcată."}), 400

    file = request.files["sheet"]
    ext  = Path(file.filename).suffix.lower()
    if ext not in ALLOWED:
        return jsonify({"error": f"Tip nesuportat ({ext})."}), 400

    tmp = UPLOADS_DIR / f"{uuid.uuid4().hex}{ext}"
    file.save(tmp)

    try:
        matrix  = run_omr(str(tmp))
        report  = score_sheet(matrix, exam["key"])
        ann     = annotate_image(str(tmp), matrix, exam["key"])
        _, buf  = cv2.imencode(".jpg", ann, [cv2.IMWRITE_JPEG_QUALITY, 82])
        img_b64 = base64.b64encode(buf).decode()
        return jsonify({**report, "exam_name": exam["name"], "image": img_b64})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: tmp.unlink()
        except: pass


# ── admin endpoints ───────────────────────────────────────────────────────────

@app.route("/admin/exams", methods=["GET"])
def admin_exams_list():
    err = check_admin()
    if err: return err
    exams = []
    for p in EXAMS_DIR.glob("*.json"):
        try:
            d = json.loads(p.read_text())
            exams.append({"id": p.stem, "name": d["name"],
                          "date": d.get("date",""), "key": d.get("key",{})})
        except: pass
    return jsonify(sorted(exams, key=lambda e: e["date"], reverse=True))


@app.route("/admin/exams", methods=["POST"])
def admin_exam_create():
    err = check_admin()
    if err: return err
    body = request.get_json()
    try:
        name = body["name"].strip()
        key  = parse_key(body.get("key", {}))
        eid  = unique_id(name)
        (EXAMS_DIR / f"{eid}.json").write_text(
            json.dumps({"name": name, "date": body.get("date",""), "key": key},
                       indent=2, ensure_ascii=False))
        return jsonify({"id": eid}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/admin/exams/<exam_id>", methods=["GET"])
def admin_exam_get(exam_id):
    err = check_admin()
    if err: return err
    p = EXAMS_DIR / f"{exam_id}.json"
    if not p.exists(): return jsonify({"error": "Not found"}), 404
    d = json.loads(p.read_text())
    return jsonify({"id": exam_id, **d})


@app.route("/admin/exams/<exam_id>", methods=["PUT"])
def admin_exam_update(exam_id):
    err = check_admin()
    if err: return err
    p = EXAMS_DIR / f"{exam_id}.json"
    if not p.exists(): return jsonify({"error": "Not found"}), 404
    body = request.get_json()
    try:
        key = parse_key(body.get("key", {}))
        p.write_text(json.dumps(
            {"name": body["name"], "date": body.get("date",""), "key": key},
            indent=2, ensure_ascii=False))
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/admin/exams/<exam_id>", methods=["DELETE"])
def admin_exam_delete(exam_id):
    err = check_admin()
    if err: return err
    p = EXAMS_DIR / f"{exam_id}.json"
    if p.exists(): p.unlink()
    return jsonify({"ok": True})


# ── boot ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
