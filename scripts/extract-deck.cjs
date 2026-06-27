#!/usr/bin/env node
/**
 * scripts/extract-deck.js
 * Sa_.apkg → data/extracted-deck.json
 *
 * Parses the "A Frequency Dictionary of Dutch" Anki deck and writes a filtered
 * JSON array to data/extracted-deck.json for the card-generation pipeline.
 *
 * Usage:
 *   node scripts/extract-deck.js            # extract and write JSON
 *   node scripts/extract-deck.js --dry-run  # parse and count only, no write
 *
 * Produces records shaped like:
 *   {
 *     frequency_rank: 10002,            // globally-unique composite rank (see RANK NOTE)
 *     rank_tag: "Core_0002",            // original Anki tag
 *     rank_deck: "Core",                // Core/Fiction/Newspapers/General/Spoken/Web
 *     rank_within_deck: 2,              // index inside the sub-frequency-list
 *     dutch: "en",                      // base word (fld 1)
 *     pos: "conj",                      // raw POS (fld 2)
 *     pos_primary: "conj",              // first non-filtered POS sub-label
 *     definition_en: "and",             // English translation (fld 3)
 *     example_nl: "...",                // Dutch example (fld 4)
 *     example_en: "...",                // English example translation (fld 5)
 *     freq: "99.80",                    // raw frequency score (fld 6)
 *     audio_tag: "[sound:Nl-en.mp3]"    // original Anki audio tag (fld 7)
 *   }
 *
 * Records where the raw POS is exactly one of pron/num/interj/art — or where
 * every sub-POS in a compound like "1) art 2) pron" is filtered — are dropped.
 * This matches Sprint 01 CONTRACT §2 + TESTS.md check "pron/num/interj/art filtered".
 *
 * RANK NOTE: ARCHITECT.md describes the deck as "Core_0001 → Core_4979" — one
 * flat frequency list. The real deck ships six sub-lists (Core, Fiction,
 * Newspapers, General, Spoken, Web), each ranked from 1. Because
 * `cards.frequency_rank` is declared UNIQUE in infra/schema.sql, we expose a
 * composite `frequency_rank = DECK_PRIORITY * 10000 + rank_within_deck` that is
 * globally unique, stable across runs, and preserves "Core comes first" order.
 * See .claude/HANDOVER.md "Critical Notes" for the architect follow-up.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const AdmZip = require('adm-zip');
const { DatabaseSync } = require('node:sqlite');

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'ExperimentalWarning' || !/sqlite/i.test(w.message)) {
    console.warn(w);
  }
});

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DECK_PATH = resolveDeckPath();

function resolveDeckPath() {
  // Honor DECK_PATH if it points at a real file; otherwise autodetect any *.apkg
  // so stale .env entries (e.g. "Sa_.apkg" vs filesystem "Sa .apkg") don't break the pipeline.
  if (process.env.DECK_PATH) {
    const p = path.resolve(PROJECT_ROOT, process.env.DECK_PATH);
    if (fs.existsSync(p)) return p;
    console.warn(`[extract-deck] DECK_PATH ${process.env.DECK_PATH} not found — falling back to autodetect.`);
  }
  return findDeckFile(PROJECT_ROOT);
}
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'extracted-deck.json');

const FILTERED_POS = new Set(['pron', 'num', 'interj', 'art']);

const DECK_PRIORITY = {
  Core: 1,
  General: 2,
  Newspapers: 3,
  Spoken: 4,
  Fiction: 5,
  Web: 6,
};
const UNKNOWN_DECK_PRIORITY = 9;

function findDeckFile(root) {
  const candidates = fs.readdirSync(root).filter((f) => f.toLowerCase().endsWith('.apkg'));
  if (candidates.length === 0) {
    throw new Error(`No .apkg file found in ${root}. Set DECK_PATH or drop Sa_.apkg into the project root.`);
  }
  return path.join(root, candidates[0]);
}

function extractCollectionSqlite(apkgPath) {
  const zip = new AdmZip(apkgPath);
  const entries = zip.getEntries().map((e) => e.entryName);
  if (entries.includes('collection.anki21b')) {
    const compressed = zip.getEntry('collection.anki21b').getData();
    return zlib.zstdDecompressSync(compressed);
  }
  if (entries.includes('collection.anki21')) {
    return zip.getEntry('collection.anki21').getData();
  }
  if (entries.includes('collection.anki2')) {
    console.warn('[extract-deck] only collection.anki2 found — may be a stub.');
    return zip.getEntry('collection.anki2').getData();
  }
  throw new Error(`No collection.anki* entry in ${apkgPath}. Entries: ${entries.join(', ')}`);
}

function parsePosSubtypes(pos) {
  if (!pos) return [];
  const compound = pos.match(/\d\)\s*([^)]+?)(?=\s*\d\)|$)/g);
  if (compound && compound.length >= 1) {
    return compound.map((c) => c.replace(/^\d\)\s*/, '').trim());
  }
  return [pos.trim()];
}

function primaryPosLabel(pos) {
  const raw = pos.toLowerCase();
  if (raw.startsWith('noun')) return 'noun';
  if (raw.startsWith('verb')) return 'verb';
  if (raw.startsWith('adj')) return 'adj';
  if (raw.startsWith('adv')) return 'adv';
  return raw;
}

function shouldFilter(pos) {
  const subs = parsePosSubtypes(pos);
  if (subs.length === 0) return false;
  return subs.every((s) => FILTERED_POS.has(primaryPosLabel(s)));
}

function firstKeptPrimary(pos) {
  const subs = parsePosSubtypes(pos);
  for (const s of subs) {
    const p = primaryPosLabel(s);
    if (!FILTERED_POS.has(p)) return p;
  }
  return primaryPosLabel(pos);
}

function parseRankTag(rankTag) {
  const s = (rankTag || '').trim();
  if (!s) return { deck: null, within: null };
  const first = s.split('|')[0].trim();
  const m = first.match(/^([A-Za-z]+)_(\d+)$/);
  if (!m) return { deck: null, within: null };
  return { deck: m[1], within: parseInt(m[2], 10) };
}

function compositeRank(deck, within) {
  if (within == null) return null;
  // Core deck → original rank (1-943). Non-Core → with offset (collision avoidance)
  if (deck === 'Core') return within;
  const priority = DECK_PRIORITY[deck] != null ? DECK_PRIORITY[deck] : UNKNOWN_DECK_PRIORITY;
  return priority * 10000 + within;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  console.log(`[extract-deck] reading ${path.relative(PROJECT_ROOT, DECK_PATH)}`);
  const sqliteBuffer = extractCollectionSqlite(DECK_PATH);

  const tmpDb = path.join(os.tmpdir(), `dutchdeck-coll-${process.pid}.sqlite`);
  fs.writeFileSync(tmpDb, sqliteBuffer);

  let db;
  try {
    db = new DatabaseSync(tmpDb);
    const notes = db.prepare('SELECT id, guid, mid, tags, flds FROM notes').all();
    console.log(`[extract-deck] raw notes: ${notes.length}`);

    const records = [];
    const filteredByPos = {};
    let emptyPos = 0;

    for (const note of notes) {
      const fields = String(note.flds).split('\x1f');
      const [rankTag, word, pos, definitionEn, exampleNl, exampleEn, freq, audioTag] = fields;

      if (!pos || !pos.trim()) {
        emptyPos++;
        continue;
      }
      if (shouldFilter(pos)) {
        filteredByPos[pos] = (filteredByPos[pos] || 0) + 1;
        continue;
      }

      const { deck, within } = parseRankTag(rankTag);
      records.push({
        frequency_rank: compositeRank(deck, within),
        rank_tag: rankTag || null,
        rank_deck: deck,
        rank_within_deck: within,
        dutch: (word || '').trim(),
        pos: pos.trim(),
        pos_primary: firstKeptPrimary(pos),
        definition_en: (definitionEn || '').trim(),
        example_nl: (exampleNl || '').trim(),
        example_en: (exampleEn || '').trim(),
        freq: (freq || '').trim(),
        audio_tag: (audioTag || '').trim(),
      });
    }

    records.sort((a, b) => {
      if (a.frequency_rank == null) return 1;
      if (b.frequency_rank == null) return -1;
      return a.frequency_rank - b.frequency_rank;
    });

    const seen = new Map();
    for (const r of records) {
      if (r.frequency_rank == null) continue;
      if (seen.has(r.frequency_rank)) {
        throw new Error(
          `frequency_rank collision: ${r.frequency_rank} -> ${seen.get(r.frequency_rank)} and ${r.rank_tag}`
        );
      }
      seen.set(r.frequency_rank, r.rank_tag);
    }

    console.log(`[extract-deck] kept: ${records.length}`);
    console.log(`[extract-deck] filtered by POS: ${Object.values(filteredByPos).reduce((a, b) => a + b, 0)}`);
    if (emptyPos) console.log(`[extract-deck] skipped empty-POS notes: ${emptyPos}`);
    const topFilter = Object.entries(filteredByPos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (topFilter.length) {
      console.log('[extract-deck] filter breakdown:', topFilter.map(([k, v]) => `${k}=${v}`).join(', '));
    }

    if (dryRun) {
      console.log('[extract-deck] --dry-run: no file written');
      return;
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(records, null, 0));
    console.log(`[extract-deck] wrote ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} (${records.length} records)`);
  } finally {
    if (db) db.close();
    try { fs.unlinkSync(tmpDb); } catch (_) { /* ignore */ }
  }
}

try {
  main();
} catch (err) {
  console.error('[extract-deck] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
}
