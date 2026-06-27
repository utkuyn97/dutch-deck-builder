#!/usr/bin/env node
/**
 * scripts/export-to-anki.cjs
 * Converts cards from the Supabase cards table into an Anki-importable CSV.
 *
 * Usage: node scripts/export-to-anki.cjs
 * Output: exports/dutchdeck-cards.txt (Anki tab-separated format)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Order of all note fields — these must be supplied to Anki as the field names
const FIELDS = [
  'Dutch', 'English', 'Turkish', 'Schema', 'Level', 'FrequencyRank',
  'Article', 'Plural', 'Diminutive', 'DeHetRule', 'OnlyPlural',
  'PresensIK', 'PresensJIJ', 'PresensHIJ', 'PresensWIJ', 'PresensJULLIE', 'PresensZIJ',
  'OVT', 'OVT_IK', 'OVT_JIJ', 'OVT_HIJ', 'OVT_WIJ', 'OVT_JULLIE', 'OVT_ZIJ',
  'Perfectum', 'AuxVerb', 'Prefix', 'IsReflexive', 'IsSeparable',
  'ReflexiveIK', 'ReflexiveJIJ', 'ReflexiveHIJ', 'ReflexiveWIJ', 'ReflexiveJULLIE', 'ReflexiveZIJ',
  'AlsoNonReflexive', 'NonReflexiveMeaning',
  'Comparative', 'Superlative', 'InflectieRule', 'AlsoAdverb', 'OnlyPredicate',
  'WordOrder', 'WordOrderNote', 'ContrastWith',
  'TurkishA', 'TurkishB', 'EnglishA', 'EnglishB',
  'MeaningAType', 'MeaningAPerfectum', 'MeaningAAuxVerb', 'MeaningAExample',
  'MeaningBType', 'MeaningBPerfectum', 'MeaningBAuxVerb', 'MeaningBExample',
  'OvtNote', 'TRegel', 'GERule', 'BijzinExample', 'PerfectumRule',
  'ExampleNL', 'ExampleTR', 'ExampleEN', 'IPA', 'AudioURL', 'UsageNote',
  'Tags'
];

function extractFields(card) {
  const d = card.card_data || {};
  const pt = d.presens_table || {};
  const ovt = d.ovt_table || {};
  const rt = d.reflexive_table || {};
  const ma = d.meaning_a || {};
  const mb = d.meaning_b || {};

  // For separable verbs, present tense is joined (bel op → PresensIK = "bel op")
  const isSep = d.is_separable || d.schema === 'verb_separable';
  const presIK  = pt.ik   || (isSep ? d.presens_ik  : '') || '';
  const presJIJ = pt.jij  || (isSep ? d.presens_jij : '') || '';
  const presHIJ = pt.hij  || (isSep ? d.presens_hij : '') || '';
  const presWIJ = pt.wij  || (isSep ? d.presens_wij : '') || '';
  const presJUL = pt.jullie || '';
  const presZIJ = pt.zij  || '';

  const ovtIK  = ovt.ik   || '';
  const ovtWIJ = ovt.wij  || '';

  // OVT: irregular → use the table, regular → single field
  const isIrregular = d.schema === 'verb_irregular' || ovtIK;
  const ovtSingle = !isIrregular ? (d.ovt || '') : '';

  // Audio URL — Supabase storage or a direct mp3
  const audioUrl = card.audio_url || '';
  // For Anki: either [sound:filename.mp3] format OR a full URL
  // We use the full URL — AnkiMobile can stream it
  const audioField = audioUrl ? audioUrl : '';

  return {
    Dutch: d.dutch || card.dutch || '',
    English: d.english || '',
    Turkish: d.turkish || '',
    Schema: d.schema || card.schema || '',
    Level: d.level || card.level || '',
    FrequencyRank: String(card.frequency_rank || ''),
    Article: d.article || '',
    Plural: d.plural || '',
    Diminutive: d.diminutive || '',
    DeHetRule: d.de_het_rule || '',
    OnlyPlural: d.only_plural ? '1' : '',
    PresensIK: presIK,
    PresensJIJ: presJIJ,
    PresensHIJ: presHIJ,
    PresensWIJ: presWIJ,
    PresensJULLIE: presJUL,
    PresensZIJ: presZIJ,
    OVT: ovtSingle,
    OVT_IK: ovtIK,
    OVT_JIJ: ovt.jij || '',
    OVT_HIJ: ovt.hij || '',
    OVT_WIJ: ovtWIJ,
    OVT_JULLIE: ovt.jullie || '',
    OVT_ZIJ: ovt.zij || '',
    Perfectum: d.perfectum || ma.perfectum || '',
    AuxVerb: d.aux_verb || ma.aux_verb || '',
    Prefix: d.prefix || '',
    IsReflexive: d.is_reflexive ? '1' : '',
    IsSeparable: isSep ? '1' : '',
    ReflexiveIK: rt.ik || '',
    ReflexiveJIJ: rt.jij || '',
    ReflexiveHIJ: rt.hij || '',
    ReflexiveWIJ: rt.wij || '',
    ReflexiveJULLIE: rt.jullie || '',
    ReflexiveZIJ: rt.zij || '',
    AlsoNonReflexive: d.also_non_reflexive ? '1' : '',
    NonReflexiveMeaning: d.non_reflexive_meaning || '',
    Comparative: d.comparative || '',
    Superlative: d.superlative || '',
    InflectieRule: d.inflectie_rule || '',
    AlsoAdverb: d.also_adverb ? '1' : '',
    OnlyPredicate: d.only_predicatief ? '1' : '',
    WordOrder: d.word_order || '',
    WordOrderNote: d.word_order_note || '',
    ContrastWith: d.contrast_with || '',
    TurkishA: d.turkish_a || '',
    TurkishB: d.turkish_b || '',
    EnglishA: d.english_a || '',
    EnglishB: d.english_b || '',
    MeaningAType: ma.type || '',
    MeaningAPerfectum: ma.perfectum || '',
    MeaningAAuxVerb: ma.aux_verb || '',
    MeaningAExample: ma.example_nl || '',
    MeaningBType: mb.type || '',
    MeaningBPerfectum: mb.perfectum || '',
    MeaningBAuxVerb: mb.aux_verb || '',
    MeaningBExample: mb.example_nl || '',
    OvtNote: d.ovt_note || '',
    TRegel: d.t_regel_note || '',
    GERule: d.ge_rule || '',
    BijzinExample: d.bijzin_example || '',
    PerfectumRule: d.perfectum_rule || '',
    ExampleNL: d.example_nl || '',
    ExampleTR: d.example_tr || '',
    ExampleEN: d.example_en || '',
    IPA: d.ipa || '',
    AudioURL: audioField,
    UsageNote: d.usage_note || '',
    Tags: `DutchDeck ${d.level || ''} ${d.schema || ''}`.trim(),
  };
}

function escapeField(val) {
  if (!val) return '';
  // Anki tab-separated: replace newlines with <br>
  return String(val).replace(/\r?\n/g, '<br>').replace(/\t/g, ' ');
}

async function main() {
  console.log('🔗 Connecting to Supabase...');

  let all = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await sb
      .from('cards')
      .select('*')
      .order('frequency_rank', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) { console.error('Supabase error:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    console.log(`  ${all.length} cards fetched...`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`\n✅ ${all.length} cards in total`);

  // Build the CSV
  const lines = [];

  // Anki header comment
  lines.push('#separator:tab');
  lines.push('#html:true');
  lines.push('#notetype:DutchDeck');
  lines.push(`#columns:${FIELDS.join('\t')}`);
  lines.push('');

  for (const card of all) {
    const fields = extractFields(card);
    const row = FIELDS.map(f => escapeField(fields[f] || '')).join('\t');
    lines.push(row);
  }

  const outDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'dutchdeck-cards.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log(`\n📁 Output: exports/dutchdeck-cards.txt`);
  console.log(`\nTo import into Anki:`);
  console.log(`  1. Anki → File → Import`);
  console.log(`  2. Select dutchdeck-cards.txt`);
  console.log(`  3. Note type: DutchDeck`);
  console.log(`  4. Field mapping is automatic (from the #columns header)`);
}

main();
