#!/usr/bin/env node
/**
 * scripts/export-grammar-to-anki.cjs
 * grammar-topics.json → Anki-importable CSV
 *
 * Usage: node scripts/export-grammar-to-anki.cjs
 * Output: exports/dutchdeck-grammar.txt
 */

const fs = require('fs');
const path = require('path');

const topics = require('../data/grammar-topics.json');

const FIELDS = [
  'Topic', 'Level', 'Category',
  'Rule', 'RuleNote', 'Contrast', 'CommonMistake',
  'Example1NL', 'Example1TR', 'Example1EN',
  'Example2NL', 'Example2TR', 'Example2EN',
  'Example3NL', 'Example3TR',
  'GapQ1', 'GapA1', 'GapNote1',
  'GapQ2', 'GapA2', 'GapNote2',
  'ErrorQ', 'ErrorA', 'ErrorNote',
  'RuleQ1', 'RuleA1', 'RuleNote1',
  'RuleQ2', 'RuleA2', 'RuleNote2',
  'TransQ', 'TransA',
  'Tags'
];

const fieldMap = {
  Topic:        t => t.topic || '',
  Level:        t => t.level || '',
  Category:     t => t.category || '',
  Rule:         t => t.rule || '',
  RuleNote:     t => t.ruleNote || '',
  Contrast:     t => t.contrast || '',
  CommonMistake:t => t.commonMistake || '',
  Example1NL:   t => t.example1NL || '',
  Example1TR:   t => t.example1TR || '',
  Example1EN:   t => t.example1EN || '',
  Example2NL:   t => t.example2NL || '',
  Example2TR:   t => t.example2TR || '',
  Example2EN:   t => t.example2EN || '',
  Example3NL:   t => t.example3NL || '',
  Example3TR:   t => t.example3TR || '',
  GapQ1:        t => t.gapQ1 || '',
  GapA1:        t => t.gapA1 || '',
  GapNote1:     t => t.gapNote1 || '',
  GapQ2:        t => t.gapQ2 || '',
  GapA2:        t => t.gapA2 || '',
  GapNote2:     t => t.gapNote2 || '',
  ErrorQ:       t => t.errorQ || '',
  ErrorA:       t => t.errorA || '',
  ErrorNote:    t => t.errorNote || '',
  RuleQ1:       t => t.ruleQ1 || '',
  RuleA1:       t => t.ruleA1 || '',
  RuleNote1:    t => t.ruleNote1 || '',
  RuleQ2:       t => t.ruleQ2 || '',
  RuleA2:       t => t.ruleA2 || '',
  RuleNote2:    t => t.ruleNote2 || '',
  TransQ:       t => t.transQ || '',
  TransA:       t => t.transA || '',
  Tags:         t => `DutchDeckGrammar ${t.level || ''} ${t.category || ''}`.trim(),
};

function esc(val) {
  return String(val || '').replace(/\r?\n/g, '<br>').replace(/\t/g, ' ');
}

const lines = [
  '#separator:tab',
  '#html:true',
  '#notetype:DutchDeckGrammar',
  `#columns:${FIELDS.join('\t')}`,
  '',
];

for (const topic of topics) {
  const row = FIELDS.map(f => esc(fieldMap[f] ? fieldMap[f](topic) : '')).join('\t');
  lines.push(row);
}

const outDir = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'dutchdeck-grammar.txt');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(`✅ ${topics.length} grammar topics exported`);
console.log(`📁 exports/dutchdeck-grammar.txt`);
console.log(`\nImport into Anki:`);
console.log(`  File → Import → dutchdeck-grammar.txt`);
console.log(`  Note type: DutchDeckGrammar`);
