import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  normalizeChemicalStructureImport,
  slugify,
} from '../assets/js/learning-import.js';

const DEFAULT_SOURCE = new URL('../compounds.js', import.meta.url);

const SECTION_RULES = [
  ['alkanes', { chapter: 'Alcani', groups: ['alkan'] }],
  ['alkenes', { chapter: 'Alchene', groups: ['alkena'] }],
  ['alkynes', { chapter: 'Alchine', groups: ['alchina'] }],
  ['alcohols', { chapter: 'Alcooli', groups: ['alcool'] }],
  ['ethers', { chapter: 'Eteri', groups: ['eter'] }],
  ['aldehydes', { chapter: 'Aldehide', groups: ['aldehida'] }],
  ['ketones', { chapter: 'Cetone', groups: ['cetona'] }],
  ['carboxylic acids', { chapter: 'Acizi carboxilici', groups: ['acid carboxilic'] }],
  ['esters', { chapter: 'Esteri', groups: ['ester'] }],
  ['amines', { chapter: 'Amine', groups: ['amina'] }],
  ['amides', { chapter: 'Amide', groups: ['amida'] }],
  ['nitriles', { chapter: 'Nitrili', groups: ['nitril'] }],
  ['halogenated', { chapter: 'Derivati halogenati', groups: ['halogenura'] }],
  ['aromatics', { chapter: 'Aromatici', groups: ['aromatic'] }],
  ['thiols', { chapter: 'Tioli si sulfuri', groups: ['tiol', 'sulfura'] }],
  ['anhydrides', { chapter: 'Anhidride', groups: ['anhidrida'] }],
  ['epoxides', { chapter: 'Epoxizi si oxirani', groups: ['epoxid'] }],
  ['diols', { chapter: 'Dioli si polioli', groups: ['alcool', 'diol'] }],
  ['amino acids', { chapter: 'Aminoacizi', groups: ['aminoacid'] }],
];

const CATEGORY_RULES = {
  alcani: { chapter: 'Alcani', groups: ['alkan'] },
  alchene: { chapter: 'Alchene', groups: ['alkena'] },
  alchine: { chapter: 'Alchine', groups: ['alchina'] },
  alcooli: { chapter: 'Alcooli', groups: ['alcool'] },
  fenoli: { chapter: 'Fenoli', groups: ['fenol'] },
  amine: { chapter: 'Amine', groups: ['amina'] },
  'compusi carbonilici': { chapter: 'Compusi carbonilici', groups: ['carbonil'] },
  'compusi carboxilici': { chapter: 'Compusi carboxilici', groups: ['acid carboxilic'] },
  'acizi grasi': { chapter: 'Acizi grasi', groups: ['acid carboxilic', 'acid gras'] },
  aminoacizi: { chapter: 'Aminoacizi', groups: ['aminoacid'] },
  aromatici: { chapter: 'Aromatici', groups: ['aromatic'] },
};

function uniqueStrings(values) {
  return [...new Set((values || [])
    .flat()
    .map(value => String(value || '').trim())
    .filter(Boolean))];
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().trim();
}

function sectionRule(section) {
  const key = normalizeKey(section);
  const found = SECTION_RULES.find(([needle]) => key.includes(needle));
  return found?.[1] || { chapter: 'Chimie organica', groups: [] };
}

function categoryRule(category) {
  return CATEGORY_RULES[normalizeKey(category)] || null;
}

export function extractCompoundSections(source) {
  const sections = [];
  let inArray = false;
  let currentSection = 'Chimie organica';

  for (const line of source.split(/\r?\n/)) {
    if (line.includes('const ORGANIC_COMPOUNDS = [')) {
      inArray = true;
      continue;
    }
    if (!inArray) continue;
    if (line.trim() === '];') break;

    const comment = line.match(/^\s*\/\/\s*(.+)$/);
    if (comment) {
      currentSection = comment[1].trim();
      continue;
    }
    if (line.includes('{') && line.includes('smiles') && line.includes('iupac')) {
      sections.push(currentSection);
    }
  }

  return sections;
}

export function loadCompoundsFromSource(source) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `${source}\nthis.__compounds = ORGANIC_COMPOUNDS; this.__unique = typeof UNIQUE_COMPOUNDS === 'undefined' ? ORGANIC_COMPOUNDS : UNIQUE_COMPOUNDS;`,
    context,
  );

  if (!Array.isArray(context.__compounds)) {
    throw new Error('ORGANIC_COMPOUNDS was not found in compounds.js');
  }

  return {
    compounds: context.__compounds,
    uniqueCompounds: Array.isArray(context.__unique) ? context.__unique : context.__compounds,
  };
}

function compoundToImportRow(compound, index, section) {
  const category = compound.category || null;
  const rule = categoryRule(category) || sectionRule(section);
  const iupac = compound.iupac;
  const displayName = compound.roName || compound.common_name || iupac;
  const aliases = uniqueStrings([
    compound.aliases || [],
    compound.aliasesRo || [],
    displayName !== iupac ? [iupac] : [],
  ]);

  return {
    slug: slugify(iupac || displayName || compound.smiles),
    source_key: `compounds-js:${slugify(iupac || displayName || compound.smiles)}`,
    name: displayName,
    iupac,
    smiles: compound.smiles,
    aliases,
    functional_groups: uniqueStrings(rule.groups),
    subject: 'chimie',
    chapter: rule.chapter,
    metadata: {
      source: 'compounds.js',
      source_index: index,
      source_section: section || null,
      source_category: category,
      original_iupac: iupac,
    },
  };
}

export function convertCompoundsToStructures(source) {
  const sections = extractCompoundSections(source);
  const { compounds } = loadCompoundsFromSource(source);
  const rows = compounds.map((compound, index) =>
    compoundToImportRow(compound, index, sections[index] || 'Chimie organica'));
  const normalized = normalizeChemicalStructureImport(rows);
  const deduped = [...new Map(normalized.map(row => [row.slug, row])).values()];

  return {
    structures: deduped,
    meta: {
      source: 'compounds.js',
      inputCount: compounds.length,
      outputCount: deduped.length,
      duplicateCount: normalized.length - deduped.length,
      chapters: [...new Set(deduped.map(row => row.chapter).filter(Boolean))].sort(),
    },
  };
}

function parseArgs(argv) {
  const args = {
    source: null,
    output: null,
    wrap: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--source') args.source = argv[++i];
    else if (arg === '--out' || arg === '-o') args.output = argv[++i];
    else if (arg === '--wrap') args.wrap = true;
    else if (!args.output) args.output = arg;
    else throw new Error(`Argument necunoscut: ${arg}`);
  }

  return args;
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const sourceUrl = args.source ? new URL(args.source, `file://${process.cwd()}/`) : DEFAULT_SOURCE;
  const source = readFileSync(sourceUrl, 'utf8');
  const result = convertCompoundsToStructures(source);
  const payload = args.wrap ? result : result.structures;
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  if (args.output) {
    writeFileSync(args.output, json, 'utf8');
    console.log(`Wrote ${result.meta.outputCount} structures to ${args.output}`);
    console.log(`Input: ${result.meta.inputCount}. Duplicates skipped: ${result.meta.duplicateCount}.`);
  } else {
    process.stdout.write(json);
  }

  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
