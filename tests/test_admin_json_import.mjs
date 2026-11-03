import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('admin imports answer-key JSON helpers', () => {
  assert.match(
    html,
    /import \{ answerKeyToMatrix, normalizeAnswerKeyJson \} from '\.\/assets\/js\/answer-key-json\.js\?v=json-key-20260626';/,
  );
});

test('admin exposes JSON import controls', () => {
  assert.match(html, /id="btnImportJsonKey"/);
  assert.match(html, /id="keyJsonFile" accept="application\/json,\.json" hidden/);
});

test('admin JSON import populates editable key matrix', () => {
  const parseIdx = html.indexOf('const raw = JSON.parse(await file.text());');
  const normalizeIdx = html.indexOf('const key = normalizeAnswerKeyJson(raw);');
  const matrixIdx = html.indexOf('keyMatrix = answerKeyToMatrix(key);');
  const buildIdx = html.indexOf('buildGrid();', matrixIdx);

  assert.notEqual(parseIdx, -1, 'JSON file should be parsed');
  assert.notEqual(normalizeIdx, -1, 'JSON should be normalized');
  assert.notEqual(matrixIdx, -1, 'normalized key should populate matrix');
  assert.notEqual(buildIdx, -1, 'grid should be rebuilt after import');
  assert.ok(parseIdx < normalizeIdx);
  assert.ok(normalizeIdx < matrixIdx);
  assert.ok(matrixIdx < buildIdx);
});

test('admin still saves matrix through existing answer-key save path', () => {
  const keyIdx = html.indexOf('const key = matrixToKey(keyMatrix);');
  const saveIdx = html.indexOf("await Admin.saveAnswerKey(examId, '1', key, true);");

  assert.notEqual(keyIdx, -1);
  assert.notEqual(saveIdx, -1);
  assert.ok(keyIdx < saveIdx);
});
