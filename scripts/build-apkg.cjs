#!/usr/bin/env node
/**
 * scripts/build-apkg.cjs
 * 
 * Exports/dutchdeck-cards.txt + grammar → DutchDeck.apkg
 * Note type, templates, CSS, cards — everything in one ready-made package.
 * Import into Anki with a single click.
 *
 * Usage:  node scripts/build-apkg.cjs
 * Output: exports/DutchDeck.apkg
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const JSZip = require('jszip');

// ─── Config ───────────────────────────────────────────────────
const EDGE_URL = process.env.SUPABASE_URL;
const DECK_NAME = 'DutchDeck';
const GRAMMAR_DECK_NAME = 'DutchDeck::Gramer';
const AUDIO_DIR = path.join(__dirname, '..', 'exports', 'audio');

// Stable IDs (ms timestamps — arbitrary but fixed)
const DECK_ID       = 1714000000000;
const GRAMMAR_DECK_ID = 1714000000001;
const MODEL_ID      = 1714100000000;
const GRAMMAR_MODEL_ID = 1714100000001;
const DCONF_ID      = 1;

// ─── Helpers ──────────────────────────────────────────────────
function guid() {
  // Anki uses 10-char base91 GUIDs
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  let g = '';
  for (let i = 0; i < 10; i++) g += chars[Math.floor(Math.random() * chars.length)];
  return g;
}

function fieldChecksum(firstField) {
  // Anki csum: first 8 hex chars of sha1 as unsigned 32-bit int
  const hash = crypto.createHash('sha1').update(firstField, 'utf8').digest('hex');
  return parseInt(hash.substring(0, 8), 16);
}

function nowSecs() { return Math.floor(Date.now() / 1000); }

function readTemplate(filename) {
  return fs.readFileSync(path.join(__dirname, '..', 'anki-templates', filename), 'utf8');
}

function replaceEdgeUrl(html) {
  return html.replace(/https:\/\/SUPABASE_EDGE_URL/g, EDGE_URL);
}

// ─── Parse Templates ──────────────────────────────────────────
function parseVocabTemplates() {
  const css = readTemplate('shared.css');

  // kart1-nl-tr.html
  const k1Raw = replaceEdgeUrl(readTemplate('kart1-nl-tr.html'));
  // Front: everything between "<!-- ── FRONT TEMPLATE ── -->" and "<!-- ── ... BACK TEMPLATE"
  const k1Lines = k1Raw.split('\n');
  let k1FrontLines = [];
  let k1BackLines = [];
  let inBack = false;
  let pastFrontMarker = false;
  for (const line of k1Lines) {
    if (line.includes('FRONT TEMPLATE')) { pastFrontMarker = true; continue; }
    if (line.includes('BACK TEMPLATE')) { inBack = true; continue; }
    if (!pastFrontMarker) continue;
    // Skip separator comment lines (the ──── lines)
    if (/^\s*─+\s*-->/.test(line)) continue;
    if (inBack) k1BackLines.push(line);
    else k1FrontLines.push(line);
  }
  const k1Front = k1FrontLines.join('\n').trim();
  const k1Back = k1BackLines.join('\n').trim();

  // kart2-tr-nl.html  
  const k2Raw = readTemplate('kart2-tr-nl.html');
  const k2Lines = k2Raw.split('\n');
  let k2FrontLines = [];
  let k2BackLines = [];
  inBack = false;
  pastFrontMarker = false;
  for (const line of k2Lines) {
    if (line.includes('FRONT TEMPLATE')) { pastFrontMarker = true; continue; }
    if (line.includes('BACK TEMPLATE')) { inBack = true; continue; }
    if (!pastFrontMarker) continue;
    if (/^\s*─+\s*-->/.test(line)) continue;
    if (inBack) k2BackLines.push(line);
    else k2FrontLines.push(line);
  }
  const k2Front = k2FrontLines.join('\n').trim();
  const k2Back = k2BackLines.join('\n').trim();

  return { css, k1Front, k1Back, k2Front, k2Back };
}

function parseGrammarTemplates() {
  const raw = replaceEdgeUrl(readTemplate('grammar-cards.html'));

  // Split into 3 cards by section markers
  const sections = raw.split(/<!-- ══+\s*KART \d/);
  // sections[0] is preamble, sections[1]=Kart1, sections[2]=Kart2, sections[3]=Kart3

  function extractFrontBack(section) {
    const frontMarker = '<!-- FRONT -->';
    const backMarker = '<!-- BACK -->';
    const frontStart = section.indexOf(frontMarker);
    const backStart = section.indexOf(backMarker);

    if (frontStart === -1 || backStart === -1) return null;

    const front = section.substring(frontStart + frontMarker.length, backStart).trim();
    const back = section.substring(backStart + backMarker.length).trim();
    return { front, back };
  }

  const cards = [];
  for (let i = 1; i < sections.length; i++) {
    const parsed = extractFrontBack(sections[i]);
    if (parsed) cards.push(parsed);
  }

  return cards; // [{front, back}, {front, back}, {front, back}]
}

// ─── Vocab Fields ─────────────────────────────────────────────
const VOCAB_FIELDS = [
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

const GRAMMAR_FIELDS = [
  'Topic', 'Level', 'Category', 'Rule', 'RuleNote', 'Contrast', 'CommonMistake',
  'Example1NL', 'Example1TR', 'Example1EN',
  'Example2NL', 'Example2TR', 'Example2EN',
  'Example3NL', 'Example3TR',
  'GapQ1', 'GapA1', 'GapNote1', 'GapQ2', 'GapA2', 'GapNote2',
  'ErrorQ', 'ErrorA', 'ErrorNote',
  'RuleQ1', 'RuleA1', 'RuleNote1', 'RuleQ2', 'RuleA2', 'RuleNote2',
  'TransQ', 'TransA',
  'Tags'
];

// ─── Read exported TSV files ──────────────────────────────────
function readVocabTSV() {
  const filePath = path.join(__dirname, '..', 'exports', 'dutchdeck-cards.txt');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const rows = [];
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.trim() === '') continue;
    rows.push(line.split('\t'));
  }
  return rows;
}

function readGrammarTSV() {
  const filePath = path.join(__dirname, '..', 'exports', 'dutchdeck-grammar.txt');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const rows = [];
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.trim() === '') continue;
    rows.push(line.split('\t'));
  }
  return rows;
}

// ─── Build Anki SQLite ────────────────────────────────────────
async function main() {
  console.log('🔧 Building .apkg...\n');

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create Anki schema
  db.run(`CREATE TABLE col (
    id integer PRIMARY KEY,
    crt integer NOT NULL,
    mod integer NOT NULL,
    scm integer NOT NULL,
    ver integer NOT NULL,
    dty integer NOT NULL,
    usn integer NOT NULL,
    ls integer NOT NULL,
    conf text NOT NULL,
    models text NOT NULL,
    decks text NOT NULL,
    dconf text NOT NULL,
    tags text NOT NULL
  )`);

  db.run(`CREATE TABLE notes (
    id integer PRIMARY KEY,
    guid text NOT NULL,
    mid integer NOT NULL,
    mod integer NOT NULL,
    usn integer NOT NULL,
    tags text NOT NULL,
    flds text NOT NULL,
    sfld text NOT NULL,
    csum integer NOT NULL,
    flags integer NOT NULL,
    data text NOT NULL
  )`);

  db.run(`CREATE TABLE cards (
    id integer PRIMARY KEY,
    nid integer NOT NULL,
    did integer NOT NULL,
    ord integer NOT NULL,
    mod integer NOT NULL,
    usn integer NOT NULL,
    type integer NOT NULL,
    queue integer NOT NULL,
    due integer NOT NULL,
    ivl integer NOT NULL,
    factor integer NOT NULL,
    reps integer NOT NULL,
    lapses integer NOT NULL,
    left integer NOT NULL,
    odue integer NOT NULL,
    odid integer NOT NULL,
    flags integer NOT NULL,
    data text NOT NULL
  )`);

  db.run(`CREATE TABLE revlog (
    id integer PRIMARY KEY,
    cid integer NOT NULL,
    usn integer NOT NULL,
    ease integer NOT NULL,
    ivl integer NOT NULL,
    lastIvl integer NOT NULL,
    factor integer NOT NULL,
    time integer NOT NULL,
    type integer NOT NULL
  )`);

  db.run(`CREATE TABLE graves (
    usn integer NOT NULL,
    oid integer NOT NULL,
    type integer NOT NULL
  )`);

  // Parse templates
  const vt = parseVocabTemplates();
  const gt = parseGrammarTemplates();

  // ─── Models (Note Types) ───────────────────────────
  function buildFieldDefs(fieldNames) {
    return fieldNames.map((name, i) => ({
      font: 'Arial',
      media: [],
      name: name,
      ord: i,
      rtl: false,
      size: 20,
      sticky: false,
    }));
  }

  const vocabModel = {
    id: MODEL_ID,
    name: DECK_NAME,
    type: 0,
    mod: nowSecs(),
    usn: -1,
    sortf: 0,
    did: DECK_ID,
    tmpls: [
      { name: 'NL → TR', ord: 0, qfmt: vt.k1Front, afmt: vt.k1Back, bqfmt: '', bafmt: '', did: null },
      { name: 'TR → NL', ord: 1, qfmt: vt.k2Front, afmt: vt.k2Back, bqfmt: '', bafmt: '', did: null },
    ],
    flds: buildFieldDefs(VOCAB_FIELDS),
    css: vt.css,
    latexPre: '',
    latexPost: '',
    latexsvg: false,
    req: [
      [0, 'any', [0]],  // Card 1 needs field 0 (Dutch)
      [1, 'any', [1]],  // Card 2 needs field 1 (English)
    ],
    tags: [],
    vers: [],
  };

  const grammarModel = {
    id: GRAMMAR_MODEL_ID,
    name: GRAMMAR_DECK_NAME.replace('::', ' '),
    type: 0,
    mod: nowSecs(),
    usn: -1,
    sortf: 0,
    did: GRAMMAR_DECK_ID,
    tmpls: gt.map((card, i) => ({
      name: ['Rule', 'Example', 'Quiz'][i] || `Card ${i+1}`,
      ord: i,
      qfmt: card.front,
      afmt: card.back,
      bqfmt: '',
      bafmt: '',
      did: null,
    })),
    flds: buildFieldDefs(GRAMMAR_FIELDS),
    css: vt.css,
    latexPre: '',
    latexPost: '',
    latexsvg: false,
    req: [
      [0, 'any', [0]],  // Card 1: Topic
      [1, 'any', [13]], // Card 2: Example3NL (field index 13)
      [2, 'any', [23]], // Card 3: RuleQ1 (field index 23)
    ],
    tags: [],
    vers: [],
  };

  const models = {};
  models[MODEL_ID] = vocabModel;
  models[GRAMMAR_MODEL_ID] = grammarModel;

  // ─── Decks ─────────────────────────────────────────
  const decks = {
    1: { id: 1, name: 'Default', mod: nowSecs(), usn: -1, lrnToday: [0,0], revToday: [0,0], newToday: [0,0], timeToday: [0,0], collapsed: false, browserCollapsed: false, desc: '', dyn: 0, conf: DCONF_ID, extendNew: 10, extendRev: 50 },
    [DECK_ID]: { id: DECK_ID, name: DECK_NAME, mod: nowSecs(), usn: -1, lrnToday: [0,0], revToday: [0,0], newToday: [0,0], timeToday: [0,0], collapsed: false, browserCollapsed: false, desc: 'DutchDeck — Dutch vocabulary cards', dyn: 0, conf: DCONF_ID, extendNew: 10, extendRev: 50 },
    [GRAMMAR_DECK_ID]: { id: GRAMMAR_DECK_ID, name: GRAMMAR_DECK_NAME, mod: nowSecs(), usn: -1, lrnToday: [0,0], revToday: [0,0], newToday: [0,0], timeToday: [0,0], collapsed: false, browserCollapsed: false, desc: 'DutchDeck — Grammar rules', dyn: 0, conf: DCONF_ID, extendNew: 10, extendRev: 50 },
  };

  // ─── Deck Config ───────────────────────────────────
  const dconf = {
    [DCONF_ID]: {
      id: DCONF_ID, name: 'Default', mod: nowSecs(), usn: -1,
      maxTaken: 60, autoplay: true, timer: 0, replayq: true,
      new: { delays: [1, 10], ints: [1, 4, 0], initialFactor: 2500, order: 1, perDay: 20 },
      rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1, ivlFct: 1, maxIvl: 36500 },
      lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 },
    },
  };

  // ─── Conf ──────────────────────────────────────────
  const conf = {
    activeDecks: [1],
    curDeck: 1,
    newSpread: 0,
    collapseTime: 1200,
    timeLim: 0,
    estTimes: true,
    dueCounts: true,
    curModel: MODEL_ID,
    nextPos: 1,
    sortType: 'noteFld',
    sortBackwards: false,
    addToCur: true,
  };

  // Insert col
  const now = nowSecs();
  db.run(`INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    1,                           // id
    now,                         // crt (created timestamp)
    now,                         // mod
    now * 1000,                  // scm (schema mod, ms)
    11,                          // ver (Anki 2.1 schema version)
    0,                           // dty
    0,                           // usn
    0,                           // ls (last sync)
    JSON.stringify(conf),
    JSON.stringify(models),
    JSON.stringify(decks),
    JSON.stringify(dconf),
    JSON.stringify({}),          // tags
  ]);

  // ─── Insert Vocab Notes + Cards ────────────────────
  const vocabRows = readVocabTSV();
  console.log(`📚 Processing ${vocabRows.length} vocabulary cards...`);

  // AudioURL field index (62nd field = index 62 in VOCAB_FIELDS: 'AudioURL')
  const audioFieldIdx = VOCAB_FIELDS.indexOf('AudioURL');
  const mediaMap = {}; // {"0": "Core_0002.mp3", ...}
  let mediaIdx = 0;
  const audioFilesUsed = new Set();

  let noteId = 1714200000000;
  let cardId = 1714300000000;
  let dueCounter = 0;

  for (const row of vocabRows) {
    // Replace AudioURL: full URL → just filename
    if (audioFieldIdx >= 0 && row[audioFieldIdx]) {
      const url = row[audioFieldIdx];
      if (url.startsWith('http')) {
        const filename = url.split('/').pop();
        row[audioFieldIdx] = filename;
        if (!audioFilesUsed.has(filename)) {
          audioFilesUsed.add(filename);
          mediaMap[String(mediaIdx)] = filename;
          mediaIdx++;
        }
      }
    }

    const flds = row.join('\x1f'); // Anki uses unit separator
    const sortField = row[0] || '';
    const tags = row[row.length - 1] || '';

    // Insert note
    db.run(`INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      noteId,
      guid(),
      MODEL_ID,
      now,
      -1,
      tags ? ` ${tags} ` : '',
      flds,
      sortField,
      fieldChecksum(sortField),
      0,
      '',
    ]);

    // Card 1: NL→TR (ord=0)
    db.run(`INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      cardId++, noteId, DECK_ID, 0, now, -1,
      0, 0, dueCounter, 0, 0, 0, 0, 0, 0, 0, 0, '',
    ]);

    // Card 2: TR→NL (ord=1) — only if English field exists
    if (row[1] && row[1].trim()) {
      db.run(`INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        cardId++, noteId, DECK_ID, 1, now, -1,
        0, 0, dueCounter, 0, 0, 0, 0, 0, 0, 0, 0, '',
      ]);
    }

    noteId++;
    dueCounter++;
  }

  // ─── Insert Grammar Notes + Cards ──────────────────
  const grammarRows = readGrammarTSV();
  console.log(`📖 Processing ${grammarRows.length} grammar cards...`);

  for (const row of grammarRows) {
    const flds = row.join('\x1f');
    const sortField = row[0] || '';
    const tags = row[row.length - 1] || '';

    db.run(`INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      noteId,
      guid(),
      GRAMMAR_MODEL_ID,
      now,
      -1,
      tags ? ` ${tags} ` : '',
      flds,
      sortField,
      fieldChecksum(sortField),
      0,
      '',
    ]);

    // Card 1: Rule (always)
    db.run(`INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      cardId++, noteId, GRAMMAR_DECK_ID, 0, now, -1,
      0, 0, dueCounter, 0, 0, 0, 0, 0, 0, 0, 0, '',
    ]);

    // Card 2: Example (if Example3NL exists — field index 13)
    if (row[13] && row[13].trim()) {
      db.run(`INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        cardId++, noteId, GRAMMAR_DECK_ID, 1, now, -1,
        0, 0, dueCounter, 0, 0, 0, 0, 0, 0, 0, 0, '',
      ]);
    }

    // Card 3: Quiz (if RuleQ1 exists — field index 23)
    if (row[23] && row[23].trim()) {
      db.run(`INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        cardId++, noteId, GRAMMAR_DECK_ID, 2, now, -1,
        0, 0, dueCounter, 0, 0, 0, 0, 0, 0, 0, 0, '',
      ]);
    }

    noteId++;
    dueCounter++;
  }

  // ─── Export to .apkg (ZIP) ─────────────────────────
  const data = db.export();
  const buffer = Buffer.from(data);
  db.close();

  const zip = new JSZip();
  // Meta file — version marker (protobuf: field 1, varint 3 = Anki 2.1 package)
  zip.file('meta', Buffer.from([0x08, 0x03]));
  zip.file('collection.anki2', buffer);

  // Embed audio files — skip empty/0-byte files, use STORE (no compression) for media
  let audioCount = 0;
  let skipped = 0;
  const cleanMediaMap = {};
  const entries = Object.entries(mediaMap);
  console.log(`\n🎵 Embedding ${entries.length} audio files...`);
  for (const [numKey, filename] of entries) {
    const audioPath = path.join(AUDIO_DIR, filename);
    if (fs.existsSync(audioPath)) {
      const buf = fs.readFileSync(audioPath);
      if (buf.length > 0) {
        zip.file(numKey, buf, { compression: 'STORE' });
        cleanMediaMap[numKey] = filename;
        audioCount++;
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }
  zip.file('media', JSON.stringify(cleanMediaMap));
  console.log(`   ✅ ${audioCount} mp3 embedded${skipped ? ` (${skipped} empty skipped)` : ''}`);

  const outDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'DutchDeck.apkg');
  console.log('\n📦 Creating ZIP (this may take a moment)...');
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  fs.writeFileSync(outPath, zipBuffer);

  const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(1);
  console.log(`\n✅ exports/DutchDeck.apkg created (${sizeMB} MB)`);
  console.log(`   📚 ${vocabRows.length} vocabulary notes (${vocabRows.length * 2} cards)`);
  console.log(`   📖 ${grammarRows.length} grammar notes`);
  console.log(`   🎵 ${audioCount} audio files embedded`);
  console.log(`   🎨 Template + CSS embedded`);
  console.log(`   🔗 Edge URL: ${EDGE_URL}`);
  console.log(`\n🎯 Anki → File → Import → DutchDeck.apkg → Done!`);
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
