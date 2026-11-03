import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  convertCompoundsToStructures,
  extractCompoundSections,
} from '../tools/compounds-to-structures.mjs';

const source = readFileSync(new URL('../compounds.js', import.meta.url), 'utf8');
const generatedSeed = JSON.parse(readFileSync(
  new URL('../assets/files/chemical-structures-import.json', import.meta.url),
  'utf8',
));

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('extracts source sections from compounds.js', () => {
  const sections = extractCompoundSections(source);
  assert.ok(sections.length > 300);
  assert.ok(sections[0].startsWith('Alkanes'));
  assert.equal(sections[26], 'Alkenes');
});

test('converts compounds.js to importable chemical structures', () => {
  const { structures, meta } = convertCompoundsToStructures(source);

  assert.ok(structures.length > 300);
  assert.equal(meta.inputCount > structures.length, true);
  assert.equal(meta.duplicateCount, meta.inputCount - structures.length);
  assert.ok(meta.chapters.includes('Alcani'));
  assert.ok(meta.chapters.includes('Alcooli'));
  assert.ok(meta.chapters.includes('Compusi carboxilici'));
});

test('keeps romanian names, aliases, chapters and metadata', () => {
  const { structures } = convertCompoundsToStructures(source);
  const methane = structures.find(row => row.iupac_name === 'methane');
  const ethanol = structures.find(row => row.iupac_name === 'ethanol');

  assert.equal(methane.name, 'metan');
  assert.equal(methane.chapter, 'Alcani');
  assert.deepEqual(methane.functional_groups, ['alkan']);
  assert.equal(methane.subject, 'chimie');
  assert.equal(methane.metadata.source, 'compounds.js');

  assert.equal(ethanol.name, 'etanol');
  assert.equal(ethanol.chapter, 'Alcooli');
  assert.ok(ethanol.aliases.includes('alcool etilic'));
});

test('deduplicates by stable slug for reimport', () => {
  const { structures } = convertCompoundsToStructures(source);
  const slugs = structures.map(row => row.slug);
  assert.equal(slugs.length, new Set(slugs).size);
  assert.ok(slugs.includes('methane'));
});

test('generated seed file matches converter output', () => {
  const { structures } = convertCompoundsToStructures(source);
  assert.equal(generatedSeed.length, structures.length);
  assert.deepEqual(generatedSeed[0], structures[0]);
  assert.ok(generatedSeed.every(row => row.subject === 'chimie'));
});
