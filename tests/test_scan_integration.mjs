import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../scan.html', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function indexOfOrThrow(needle) {
  const idx = html.indexOf(needle);
  assert.notEqual(idx, -1, `Missing: ${needle}`);
  return idx;
}

test('scan imports analyzeMatrix from OMR module', () => {
  assert.match(
    html,
    /import \{ processSheet, annotate, analyzeMatrix \} from '\.\/assets\/js\/omr\.js\?v=ocr-quality-20260621';/,
  );
});

test('scan imports PDF renderer helpers', () => {
  assert.match(
    html,
    /import \{ isPdfFile, renderPdfFirstPageToImageFile \} from '\.\/assets\/js\/pdf-renderer\.js\?v=pdf-upload-20260621';/,
  );
});

test('scan accepts PDF files in the upload input', () => {
  assert.match(html, /accept="image\/\*,application\/pdf,\.pdf"/);
  assert.match(html, /JPG, PNG, WebP sau PDF/);
});

test('scan validates matrix before scoring', () => {
  const convertIdx = indexOfOrThrow('await renderPdfFirstPageToImageFile(file, {');
  const processIdx = indexOfOrThrow('await processSheet(ocrFile, currentSheetType)');
  const analyzeIdx = indexOfOrThrow('currentQualityReport = analyzeMatrix(matrix, {');
  const assertIdx = indexOfOrThrow('assertScanQuality(currentQualityReport);');
  const scoreIdx = indexOfOrThrow('await API.scoreMatrix(currentExamId, matrix)');

  assert.ok(convertIdx < processIdx, 'PDF conversion should happen before processSheet');
  assert.ok(processIdx < analyzeIdx, 'analyzeMatrix should run after processSheet');
  assert.ok(analyzeIdx < assertIdx, 'quality report should be checked after analysis');
  assert.ok(assertIdx < scoreIdx, 'quality check should run before scoring');
});

test('scan stores diagnostics returned by processSheet', () => {
  assert.match(
    html,
    /const \{ matrix, image, contest, diagnostics \} = await processSheet\(ocrFile, currentSheetType\);/,
  );
  assert.match(html, /currentDiagnostics = diagnostics;/);
});

test('save path checks quality report before saving', () => {
  const saveClickIdx = indexOfOrThrow("document.getElementById('saveBtn').addEventListener('click'");
  const assertIdx = html.indexOf('assertScanQuality(currentQualityReport);', saveClickIdx);
  const saveIdx = html.indexOf('await API.saveSubmission(currentResult', saveClickIdx);

  assert.notEqual(assertIdx, -1, 'save handler should check quality report');
  assert.notEqual(saveIdx, -1, 'save handler should save submission');
  assert.ok(assertIdx < saveIdx, 'quality check should run before saveSubmission');
});

test('file input is reset so the same file can be uploaded again', () => {
  assert.match(
    html,
    /scanCard\.addEventListener\('click', \(\) => \{\s*fileInput\.value = '';\s*fileInput\.click\(\);\s*\}\);/s,
  );
  assert.match(
    html,
    /fileInput\.addEventListener\('change', e => \{\s*const file = e\.target\.files\[0\];\s*e\.target\.value = '';\s*if \(file\) handleFile\(file\);\s*\}\);/s,
  );
});

test('failsafe does not flag 4+ bubble answers confirmed correct by scoring', () => {
  assert.match(
    html,
    /const scored = currentResult\?\.questions\?\.find\(item => item\.q === q \+ 1\);/,
  );
  assert.match(
    html,
    /if \(n >= 4 && scored\?\.status !== 'correct'\) suspect\+\+;/,
  );
});
