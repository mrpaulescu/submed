// ============================================================================
// SubMed v2 — Motor OMR în browser (port după render_api/omr_engine.py)
// ============================================================================
// Rulează 100% pe dispozitivul userului (fără server de procesare → fără
// cold-start). Produce o matrice 150×5 (1 = bulă bifată) dintr-o imagine.
//
// Algoritmul (identic cu varianta Python):
//   1. scalează coordonatele de calibrare la dimensiunea reală a imaginii
//   2. grayscale (0.299R+0.587G+0.114B) + blur 3×3 ușor
//   3. pentru fiecare bulă: media intensității într-un pătrat; bifat dacă
//      media < prag (prag adaptiv per-rând pentru „submed", fix pentru „cluj")
//
// Folosire:
//   import { processSheet, matrixToKey, annotate } from './omr.js';
//   const { matrix, image } = await processSheet(file, 'submed');
// ============================================================================

const OPTS = 'abcde';

// ── Calibrări (px în imaginea de referință) ─────────────────────
const CONFIGS = {
  submed: {
    // recalibrat pentru foaia BulineSubmed (din IMG_1647), frame ref 1500×2000
    ROW_Y_Q1: 562, ROW_PITCH: 24.3,
    COL_X: { 1: [323,346,369,392,415], 2: [593,617,640,664,688], 3: [863,887,910,934,957] },
    RADIUS: 6, BG_XS: [278,526,794,992], BG_FACTOR: 0.62,
    REF_W: 1500, REF_H: 2000, THRESHOLD: null,   // null = prag adaptiv per-rând
    // zona „număr de concurs": 5 coloane (cifre) × 10 rânduri (0-9)
    // calibrat din BulineSubmed completată (IMG_1647), frame ref 1500×2000
    CONTEST: {
      COLS_X: [1152.8, 1176.1, 1199.9, 1223.2, 1246.5],
      ROWS_Y: [622.5, 645.8, 669.6, 693.0, 716.8, 740.1, 763.9, 787.2, 811.0, 834.3],
      RADIUS: 5,
    },
  },
  cluj: {
    ROW_Y_Q1: 738, ROW_PITCH: 53.16,
    COL_X: { 1: [247,301,353,407,459], 2: [832,885,939,992,1045], 3: [1410,1464,1519,1573,1626] },
    RADIUS: 18, BG_XS: null, BG_FACTOR: null,
    REF_W: 2481, REF_H: 3509, THRESHOLD: 120,
    CONTEST: null,
  },
};

// ── Încărcare imagine → grayscale (respectă orientarea EXIF) ────
async function _loadGray(file) {
  // createImageBitmap respectă rotația EXIF a pozelor de telefon
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const w = bitmap.width, h = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);   // RGBA

  // grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { bitmap, gray, w, h };
}

// ── Blur 3×3 gaussian ([1 2 1;2 4 2;1 2 1]/16) ──────────────────
function _blur3(gray, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0, x2 = x < w - 1 ? x + 1 : w - 1;
      const y0 = y > 0 ? y - 1 : 0, y2 = y < h - 1 ? y + 1 : h - 1;
      const r0 = y0 * w, r1 = y * w, r2 = y2 * w;
      out[r1 + x] = (
        gray[r0+x0] + 2*gray[r0+x] + gray[r0+x2] +
        2*gray[r1+x0] + 4*gray[r1+x] + 2*gray[r1+x2] +
        gray[r2+x0] + 2*gray[r2+x] + gray[r2+x2]
      ) / 16;
    }
  }
  return out;
}

// ── Media intensității într-un pătrat centrat în (x,y) ──────────
function _sample(gray, w, h, x, y, r) {
  const x1 = Math.max(0, x - r), x2 = Math.min(w, x + r);
  const y1 = Math.max(0, y - r), y2 = Math.min(h, y + r);
  let sum = 0, n = 0;
  for (let yy = y1; yy < y2; yy++) {
    const row = yy * w;
    for (let xx = x1; xx < x2; xx++) { sum += gray[row + xx]; n++; }
  }
  return n > 0 ? sum / n : 255;
}

// ── Prag adaptiv local (media fundalului alb × factor) ──────────
function _localThresh(gray, w, h, y, r, bgXs, factor) {
  const samples = [];
  for (const bx of bgXs) samples.push(_sample(gray, w, h, bx, y, r));
  if (!samples.length) return 120;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return mean * factor;
}

// ── Construiește grila scalată la dimensiunea reală ─────────────
function _grid(cfg, sx, sy) {
  const r = Math.max(1, Math.round(cfg.RADIUS * Math.min(sx, sy)));
  const pitch = cfg.ROW_PITCH * sy;
  const rowYs = Array.from({ length: 50 }, (_, i) => Math.round(cfg.ROW_Y_Q1 * sy + i * pitch));
  const cols = {};
  for (const [c, xs] of Object.entries(cfg.COL_X)) cols[c] = xs.map(x => Math.round(x * sx));
  const bgXs = cfg.BG_XS ? cfg.BG_XS.map(bx => Math.round(bx * sx)) : null;
  return { rowYs, cols, r, bgXs };
}

// ── Citește numărul de concurs (5 cifre) din zona dedicată ──────
// Întoarce { code:"40305", digits:[4,0,3,0,5], perCol:[[..]], ambiguous:bool }.
// digit = null dacă o coloană are 0 sau 2+ bule (cod ambiguu → failsafe).
function readContest(gray, w, h, sx, sy, cc) {
  const r = Math.max(2, Math.round(cc.RADIUS * Math.min(sx, sy)));
  const colsX = cc.COLS_X.map(x => Math.round(x * sx));
  const rowsY = cc.ROWS_Y.map(y => Math.round(y * sy));
  const means = colsX.map(cx => rowsY.map(cy => _sample(gray, w, h, cx, cy, r)));
  const all = means.flat();
  const bg = all.reduce((a, b) => a + b, 0) / all.length;
  const thresh = bg * 0.6;                       // adaptiv la iluminare
  const digits = [], perCol = [];
  for (let c = 0; c < colsX.length; c++) {
    const fr = [];
    for (let d = 0; d < rowsY.length; d++) if (means[c][d] < thresh) fr.push(d);
    perCol.push(fr);
    digits.push(fr.length === 1 ? fr[0] : null);
  }
  return {
    code: digits.map(d => d === null ? '?' : d).join(''),
    digits, perCol,
    ambiguous: digits.some(d => d === null),
  };
}

// ── API publică ─────────────────────────────────────────────────

// Procesează imaginea și întoarce matricea + bitmap-ul (pentru adnotare).
function _round(n, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// Turns one sampled bubble into a binary decision plus a confidence signal.
// Confidence is relative to the threshold margin, not a probability.
export function classifyBubbleIntensity(intensity, threshold, {
  relativeMargin = 0.12,
} = {}) {
  if (!Number.isFinite(intensity) || !Number.isFinite(threshold) || threshold <= 0) {
    throw new Error('Intensitate/prag invalid pentru clasificarea bulinei.');
  }
  if (!Number.isFinite(relativeMargin) || relativeMargin <= 0) {
    throw new Error('Marja de confidence trebuie sa fie pozitiva.');
  }

  const filled = intensity < threshold;
  const margin = Math.max(threshold * relativeMargin, 1);
  const distance = Math.abs(intensity - threshold);
  const confidence = Math.min(1, distance / margin);
  const ambiguous = confidence < 1;

  return {
    filled,
    ambiguous,
    state: ambiguous ? 'ambiguous' : (filled ? 'filled' : 'empty'),
    confidence: _round(confidence),
    intensity: _round(intensity, 2),
    threshold: _round(threshold, 2),
    delta: _round(threshold - intensity, 2),
    margin: _round(margin, 2),
  };
}

export async function processSheet(file, sheetType = 'submed') {
  const cfg = CONFIGS[sheetType];
  if (!cfg) throw new Error(`Tip foaie necunoscut: ${sheetType}`);

  const { bitmap, gray: rawGray, w, h } = await _loadGray(file);
  const gray = _blur3(rawGray, w, h);
  const sx = w / cfg.REF_W, sy = h / cfg.REF_H;
  const { rowYs, cols, r, bgXs } = _grid(cfg, sx, sy);

  const matrix = Array.from({ length: 150 }, () => [0, 0, 0, 0, 0]);
  const confidence = Array.from({ length: 150 }, () => [0, 0, 0, 0, 0]);
  const samples = Array.from({ length: 150 }, () => Array(5).fill(null));
  const lowConfidenceBubbles = [];
  for (const [colNum, xs] of Object.entries(cols)) {
    const qb = (Number(colNum) - 1) * 50;
    for (let ri = 0; ri < rowYs.length; ri++) {
      const y = rowYs[ri];
      const thresh = cfg.THRESHOLD === null
        ? _localThresh(gray, w, h, y, r, bgXs, cfg.BG_FACTOR)
        : cfg.THRESHOLD;
      for (let oi = 0; oi < xs.length; oi++) {
        const qIdx = qb + ri;
        const sample = classifyBubbleIntensity(_sample(gray, w, h, xs[oi], y, r), thresh);
        matrix[qIdx][oi] = sample.filled ? 1 : 0;
        confidence[qIdx][oi] = sample.confidence;
        samples[qIdx][oi] = sample;
        if (sample.ambiguous) {
          lowConfidenceBubbles.push({
            q: qIdx + 1,
            option: OPTS[oi],
            confidence: sample.confidence,
            intensity: sample.intensity,
            threshold: sample.threshold,
            filled: sample.filled,
          });
        }
      }
    }
  }
  const contest = cfg.CONTEST ? readContest(gray, w, h, sx, sy, cfg.CONTEST) : null;
  return {
    matrix,
    contest,
    image: bitmap,
    width: w,
    height: h,
    diagnostics: {
      confidence,
      samples,
      lowConfidenceBubbles,
      lowConfidenceQuestions: [...new Set(lowConfidenceBubbles.map(b => b.q))],
    },
  };
}

// Matrice → cheie {"1":["b"],"2":["a","c"], ...} (doar întrebările bifate).
export function matrixToKey(matrix) {
  const key = {};
  for (let q = 0; q < 150; q++) {
    const ans = [];
    for (let i = 0; i < 5; i++) if (matrix[q][i]) ans.push(OPTS[i]);
    if (ans.length) key[String(q + 1)] = ans.sort();
  }
  return key;
}

// Desenează cercuri colorate peste imagine → dataURL JPEG (max 1200px lățime).
//   fără key:  verde = bifat, gri = gol
//   cu key:    verde = corect, roșu = greșit, portocaliu = corect omis, gri = irelevant
// Analizeaza matricea inainte de scoring/salvare. Nu schimba raspunsurile;
// doar intoarce semnale de calitate care pot bloca sau cere revizuire.
export function analyzeMatrix(matrix, {
  contest = null,
  diagnostics = null,
  expectedContestCode = null,
  minAnsweredQuestions = 1,
  maxOptionsPerQuestion = 3,
  maxLowConfidenceBubbles = 0,
} = {}) {
  if (!Array.isArray(matrix) || matrix.length !== 150) {
    throw new Error('Matrice invalida: trebuie sa aiba 150 de intrebari.');
  }

  const questionCounts = [];
  const blankQuestions = [];
  const multiMarkQuestions = [];
  const overfilledQuestions = [];
  let filledBubbles = 0;

  for (let q = 0; q < 150; q++) {
    const row = matrix[q];
    if (!Array.isArray(row) || row.length !== 5) {
      throw new Error(`Matrice invalida: intrebarea ${q + 1} nu are 5 optiuni.`);
    }

    let count = 0;
    for (let oi = 0; oi < 5; oi++) {
      const value = row[oi];
      if (value !== 0 && value !== 1 && value !== false && value !== true) {
        throw new Error(`Matrice invalida: valoare nebinara la intrebarea ${q + 1}.`);
      }
      if (value === 1 || value === true) count++;
    }

    questionCounts.push(count);
    filledBubbles += count;
    if (count === 0) blankQuestions.push(q + 1);
    if (count > 1) multiMarkQuestions.push(q + 1);
    if (count > maxOptionsPerQuestion) overfilledQuestions.push(q + 1);
  }

  const answeredQuestions = 150 - blankQuestions.length;
  const warnings = [];

  if (filledBubbles === 0) {
    warnings.push({
      code: 'empty-sheet',
      severity: 'error',
      message: 'Nu a fost detectata nicio bulina completata.',
    });
  } else if (answeredQuestions < minAnsweredQuestions) {
    warnings.push({
      code: 'too-few-answers',
      severity: 'error',
      message: `Au fost detectate doar ${answeredQuestions} intrebari completate.`,
    });
  }

  if (overfilledQuestions.length) {
    warnings.push({
      code: 'overfilled-questions',
      severity: 'warning',
      message: `${overfilledQuestions.length} intrebari au prea multe buline completate.`,
      questions: overfilledQuestions,
    });
  }

  const lowConfidenceBubbles = diagnostics?.lowConfidenceBubbles ?? [];
  if (lowConfidenceBubbles.length > maxLowConfidenceBubbles) {
    warnings.push({
      code: 'low-confidence-bubbles',
      severity: 'warning',
      message: `${lowConfidenceBubbles.length} buline sunt aproape de pragul de decizie.`,
      bubbles: lowConfidenceBubbles,
    });
  }

  if (contest?.ambiguous) {
    warnings.push({
      code: 'ambiguous-contest-code',
      severity: 'warning',
      message: 'Codul de concurs citit de pe foaie este ambiguu.',
    });
  } else if (expectedContestCode && contest?.code && contest.code !== expectedContestCode) {
    warnings.push({
      code: 'contest-code-mismatch',
      severity: 'error',
      message: 'Codul de concurs de pe foaie nu corespunde contului curent.',
    });
  }

  const blockingWarnings = warnings.filter(w => w.severity === 'error');

  return {
    ok: blockingWarnings.length === 0,
    needsReview: warnings.length > 0,
    totalQuestions: 150,
    totalOptions: 5,
    filledBubbles,
    answeredQuestions,
    blankQuestions,
    multiMarkQuestions,
    overfilledQuestions,
    lowConfidenceBubbles,
    questionCounts,
    warnings,
  };
}

export function annotate(image, matrix, key, sheetType = 'submed') {
  const cfg = CONFIGS[sheetType];
  const w = image.width, h = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const sx = w / cfg.REF_W, sy = h / cfg.REF_H;
  const { rowYs, cols, r } = _grid(cfg, sx, sy);

  const GREEN = '#14c850', RED = '#d21e1e', ORANGE = '#ff9619', GRAY = '#a0aaa0';

  for (const [colNum, xs] of Object.entries(cols)) {
    const qb = (Number(colNum) - 1) * 50;
    for (let ri = 0; ri < rowYs.length; ri++) {
      const qIdx = qb + ri, y = rowYs[ri];
      const correct = key ? new Set(key[String(qIdx + 1)] || []) : null;
      for (let oi = 0; oi < xs.length; oi++) {
        const filled = !!matrix[qIdx][oi];
        let color, thick;
        if (correct === null) {
          color = filled ? GREEN : GRAY; thick = filled ? 3 : 1;
        } else {
          const inKey = correct.has(OPTS[oi]);
          if (filled && inKey)        { color = GREEN;  thick = 3; }
          else if (filled && !inKey)  { color = RED;    thick = 3; }
          else if (!filled && inKey)  { color = ORANGE; thick = 3; }
          else                        { color = GRAY;   thick = 1; }
        }
        ctx.beginPath();
        ctx.arc(xs[oi], y, r + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = thick; ctx.stroke();
      }
    }
  }

  // scalează la max 1200px pentru transfer/afișare rapidă
  if (w > 1200) {
    const scale = 1200 / w;
    const out = document.createElement('canvas');
    out.width = 1200; out.height = Math.round(h * scale);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.82);
  }
  return canvas.toDataURL('image/jpeg', 0.82);
}
