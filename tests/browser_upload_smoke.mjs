import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.slice(1));
const SERVER_PORT = 5510;
const DEBUG_PORT = 9224;
const TEST_IMAGE = resolve(ROOT, 'omr/test-upload-submed.png');
const TEST_PDF = resolve(ROOT, 'omr/test-upload-submed.pdf');

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

async function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill();
  await Promise.race([
    new Promise(resolveStop => child.once('exit', resolveStop)),
    delay(2000),
  ]);
}

async function removeDirWithRetry(path) {
  for (let i = 0; i < 10; i++) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (i === 9) throw error;
      await delay(250);
    }
  }
}

async function waitForHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  return candidates.find(path => {
    return !!path && existsSync(path);
  });
}

class Cdp {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws = new WebSocket(wsUrl);
  }

  async open() {
    await new Promise((resolveOpen, rejectOpen) => {
      this.ws.addEventListener('open', resolveOpen, { once: true });
      this.ws.addEventListener('error', rejectOpen, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolvePending, rejectPending } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rejectPending(new Error(JSON.stringify(msg.error)));
        else resolvePending(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolvePending, rejectPending) => {
      this.pending.set(id, { resolvePending, rejectPending });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const chromePath = findChrome();
  assert.ok(chromePath, 'Chrome/Edge executable not found. Set CHROME_PATH if needed.');

  const server = spawn('python', ['-m', 'http.server', String(SERVER_PORT), '--bind', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'ignore',
    windowsHide: true,
  });
  await waitForHttp(`http://127.0.0.1:${SERVER_PORT}/assets/js/omr.js`);

  const userDataDir = mkdtempSync(resolve(tmpdir(), 'submed-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  try {
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`);

    const harnessPath = resolve(ROOT, '__tmp_browser_upload_smoke.html');
    const html = `
      <!doctype html>
      <meta charset="utf-8">
      <input id="file" type="file">
      <script type="module">
        import { processSheet, analyzeMatrix, matrixToKey } from './assets/js/omr.js';
        import { isPdfFile, renderPdfFirstPageToImageFile } from './assets/js/pdf-renderer.js';
        window.result = null;
        window.error = null;
        document.getElementById('file').addEventListener('change', async event => {
          try {
            const file = event.target.files[0];
            const ocrFile = isPdfFile(file)
              ? await renderPdfFirstPageToImageFile(file, { targetWidth: 1500 })
              : file;
            const out = await processSheet(ocrFile, 'submed');
            const report = analyzeMatrix(out.matrix, { diagnostics: out.diagnostics });
            const key = matrixToKey(out.matrix);
            window.result = {
              sourceType: file.type,
              ok: report.ok,
              answeredQuestions: report.answeredQuestions,
              filledBubbles: report.filledBubbles,
              warnings: report.warnings.map(w => w.code),
              lowConfidenceCount: out.diagnostics.lowConfidenceBubbles.length,
              key,
            };
          } catch (error) {
            window.error = String(error && (error.stack || error.message || error));
          } finally {
            document.body.dataset.done = '1';
          }
        });
      </script>
    `;
    writeFileSync(harnessPath, html);
    const pageUrl = `http://127.0.0.1:${SERVER_PORT}/__tmp_browser_upload_smoke.html`;
    const targetResponse = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(pageUrl)}`, {
      method: 'PUT',
    });
    const target = await targetResponse.json();
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    try {
      await cdp.send('Page.enable');
      await cdp.send('DOM.enable');
      await delay(500);

      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '#file',
      });
      assert.ok(nodeId, 'File input not found');

      async function uploadAndRead(filePath) {
        await cdp.send('Runtime.evaluate', {
          expression: "window.result = null; window.error = null; delete document.body.dataset.done; document.getElementById('file').value = '';",
        });
        await cdp.send('DOM.setFileInputFiles', {
          nodeId,
          files: [filePath],
        });

        for (let i = 0; i < 120; i++) {
          const done = await cdp.send('Runtime.evaluate', {
            expression: "document.body.dataset.done === '1'",
            returnByValue: true,
          });
          if (done.result.value) break;
          await delay(100);
        }

        const evaluated = await cdp.send('Runtime.evaluate', {
          expression: 'JSON.stringify({ result: window.result, error: window.error })',
          returnByValue: true,
        });
        const payload = JSON.parse(evaluated.result.value);
        assert.equal(payload.error, null, payload.error);
        assert.equal(payload.result.ok, true);
        assert.equal(payload.result.answeredQuestions, 12);
        assert.equal(payload.result.filledBubbles, 22);
        assert.deepEqual(payload.result.key['1'], ['a', 'c', 'e']);
        assert.deepEqual(payload.result.key['10'], ['e']);
        assert.deepEqual(payload.result.key['51'], ['a']);
        assert.deepEqual(payload.result.key['101'], ['c']);
        return payload.result;
      }

      const imageResult = await uploadAndRead(TEST_IMAGE);
      const pdfResult = await uploadAndRead(TEST_PDF);

      console.log('ok - browser image upload smoke test');
      console.log(JSON.stringify(imageResult, null, 2));
      console.log('ok - browser PDF upload smoke test');
      console.log(JSON.stringify(pdfResult, null, 2));
    } finally {
      cdp.close();
      unlinkSync(harnessPath);
    }
  } finally {
    await stopProcess(chrome);
    await stopProcess(server);
    await removeDirWithRetry(userDataDir);
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
