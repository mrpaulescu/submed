import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const jsDirs = ['assets/js', 'tools', 'tests'];
const rootFiles = ['config.example.js', 'config.public.js', 'compounds.js', 'config.js']
  .filter(file => existsSync(join(root, file)));
const htmlFiles = ['admin-content.html', 'flashcards.html', 'login.html'];

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (/\.(mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function nodeCheck(file) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    `${file}\n${result.stdout || ''}${result.stderr || ''}`,
  );
}

function inlineScripts(html) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[1] || '';
    const body = match[2].trim();
    if (!body || /\bsrc\s*=/.test(attrs)) continue;
    scripts.push({
      module: /\btype\s*=\s*["']module["']/i.test(attrs),
      body,
    });
  }
  return scripts;
}

test('javascript and mjs files pass node syntax check', () => {
  const files = [
    ...rootFiles.map(file => join(root, file)),
    ...jsDirs.flatMap(dir => listJsFiles(join(root, dir))),
  ];
  assert.ok(files.length > 10, 'expected project JS files to be discovered');
  files.forEach(nodeCheck);
});

test('inline page scripts pass node syntax check', () => {
  const temp = mkdtempSync(join(root, '.tmp-js-check-'));
  try {
    for (const htmlFile of htmlFiles) {
      const html = readFileSync(join(root, htmlFile), 'utf8');
      inlineScripts(html).forEach((script, index) => {
        const ext = script.module ? 'mjs' : 'js';
        const file = join(temp, `${htmlFile}-${index}.${ext}`);
        writeFileSync(file, `${script.body}\n`, 'utf8');
        nodeCheck(file);
      });
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
