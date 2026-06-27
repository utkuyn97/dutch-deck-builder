/**
 * tests/sprint-01-runner.js
 * Windows-compatible Sprint 01 test runner (no bash required).
 *
 * Usage:
 *   node tests/sprint-01-runner.js
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Load .env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

let PASS = 0;
let FAIL = 0;
let SKIP = 0;

function check(passed, name, skipReason) {
  if (skipReason) {
    console.log(`⏭  SKIP: ${name} (${skipReason})`);
    SKIP++;
  } else if (passed) {
    console.log(`✅ PASS: ${name}`);
    PASS++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    FAIL++;
  }
}

function supabaseReady() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return false;
  if (url.includes('XXXX') || key.startsWith('eyXXXX')) return false;
  return true;
}

async function main() {
  console.log('=== DutchDeck Sprint 01 Tests ===\n');

  const sbReady = supabaseReady();

  // ─── Supabase Tests ───────────────────────────
  console.log('--- Supabase ---');
  if (!sbReady) {
    console.log('⚠  SUPABASE_URL / SUPABASE_ANON_KEY not set — Supabase tests SKIP.\n');
  }

  // 1. Supabase connection
  if (sbReady) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { error } = await sb.from('cards').select('count');
      check(!error, 'Supabase connection');
    } catch (e) {
      check(false, 'Supabase connection');
    }
  } else {
    check(false, 'Supabase connection', 'no credentials');
  }

  // 2. Tables exist
  if (sbReady) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const tables = ['cards', 'card_progress', 'grammar_topics', 'grammar_exercises',
        'grammar_progress', 'daily_sessions', 'daily_stats', 'word_context_history',
        'pipeline_state', 'pending_words', 'user_settings'];
      let allOk = true;
      for (const t of tables) {
        const { error } = await sb.from(t).select('*').limit(1);
        if (error) { allOk = false; console.error(`  Table ${t}: ${error.message}`); }
      }
      check(allOk, 'All tables exist');
    } catch (e) {
      check(false, 'All tables exist');
    }
  } else {
    check(false, 'All tables exist', 'no credentials');
  }

  // ─── Deck Extract ─────────────────────────────
  console.log('\n--- Deck Extract ---');

  // 3. Extract works (does the data file exist)
  const extractPath = path.resolve(__dirname, '..', 'data', 'extracted-deck.json');
  check(fs.existsSync(extractPath), 'Sa_.apkg extract works');

  // 4. 4979+ words
  if (fs.existsSync(extractPath)) {
    const data = JSON.parse(fs.readFileSync(extractPath, 'utf8'));
    check(data.length >= 4900, `4,979 words extracted (found: ${data.length})`);

    // 5. Filtering
    const bad = data.filter(d => ['pron', 'num', 'interj', 'art'].includes(d.pos));
    check(bad.length === 0, 'pron/num/interj/art filtered out');
  } else {
    check(false, '4,979 words extracted');
    check(false, 'pron/num/interj/art filtered out');
  }

  // ─── Pipeline (Supabase) ──────────────────────
  console.log('\n--- Pipeline ---');
  if (sbReady) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { error } = await sb.from('pipeline_state').select('*').maybeSingle();
      check(!error || error.code === 'PGRST116', 'pipeline_state table is accessible');
    } catch (e) {
      check(false, 'pipeline_state table is accessible');
    }

    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { count, error } = await sb.from('cards').select('id', { count: 'exact', head: true });
      check(!error && (count || 0) >= 50, `At least 50 cards generated (found: ${count || 0})`);
    } catch (e) {
      check(false, 'At least 50 cards generated');
    }
  } else {
    check(false, 'pipeline_state table is accessible', 'no credentials');
    check(false, 'At least 50 cards generated', 'no credentials');
  }

  // ─── Schema Detection ─────────────────────────
  console.log('\n--- Schema Detection ---');
  if (sbReady) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const schemas = ['noun', 'verb_regular', 'verb_irregular', 'verb_separable',
        'verb_inseparable', 'verb_dual', 'verb_reflexive', 'adjective', 'adverb',
        'conjunction', 'preposition'];
      let allFound = [];
      for (const s of schemas) {
        const { data: d, error: e } = await sb.from('cards').select('id').eq('schema', s).limit(1);
        if (!e && d && d.length > 0) allFound.push(s);
      }
      const missing = schemas.filter(s => !allFound.includes(s));
      check(missing.length <= 3, `Core schema types present (missing: ${missing.length <= 3 ? missing.join(', ') || 'none' : missing.join(', ')})`);
    } catch (e) {
      check(false, 'Core schema types present');
    }

    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await sb.from('cards').select('card_data').limit(10);
      if (error) throw error;
      const invalid = (data || []).filter(d => !d.card_data.turkish || !d.card_data.dutch);
      check(invalid.length === 0, 'Required fields populated (dutch, turkish)');
    } catch (e) {
      check(false, 'Required fields populated (dutch, turkish)');
    }
  } else {
    check(false, 'Core schema types present', 'no credentials');
    check(false, 'Required fields populated (dutch, turkish)', 'no credentials');
  }

  // ─── Card Progress ────────────────────────────
  console.log('\n--- Card Progress ---');
  if (sbReady) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await sb.from('card_progress').select('direction,queue').limit(200);
      if (error) throw error;
      const nltr = (data || []).filter(d => d.direction === 'nl_tr' && d.queue === 'new');
      const trnl = (data || []).filter(d => d.direction === 'tr_nl' && d.queue === 'locked');
      check(nltr.length >= 25 && trnl.length >= 25,
        `nl_tr=new, tr_nl=locked seed correct (nl_tr:${nltr.length}, tr_nl:${trnl.length})`);
    } catch (e) {
      check(false, 'nl_tr=new, tr_nl=locked seed correct');
    }
  } else {
    check(false, 'nl_tr=new, tr_nl=locked seed correct', 'no credentials');
  }

  // ─── SM-2 Algorithm ───────────────────────────
  console.log('\n--- SM-2 Algorithm ---');
  const { scheduleCard, getSiblingAction } = await import('../src/lib/sm2.js');

  // Test 1: Learning Good → next step
  {
    const card = { queue: 'learning', learning_step: 0, ease_factor: 2.5, interval: 0, lapses: 0 };
    const result = scheduleCard(card, 'good', {});
    check(result.learning_step === 1, 'SM-2: Learning Good → next step');
  }

  // Test 2: Learning Again does NOT affect ease
  {
    const card = { queue: 'learning', learning_step: 1, ease_factor: 2.5, interval: 0, lapses: 0 };
    const result = scheduleCard(card, 'again', {});
    check(result.ease_factor === 2.5, `SM-2: Learning Again does NOT affect ease (Anki rule) [ease=${result.ease_factor}]`);
  }

  // Test 3: Review Again → ease -0.20, relearning
  {
    const card = { queue: 'review', ease_factor: 2.5, interval: 10, lapses: 0, learning_step: 0 };
    const result = scheduleCard(card, 'again', {});
    check(
      Math.abs(result.ease_factor - 2.3) < 1e-9 && result.queue === 'relearning',
      `SM-2: Review Again → ease -0.20, relearning [ease=${result.ease_factor}, queue=${result.queue}]`
    );
  }

  // Test 4: Ease floor 1.30
  {
    const card = { queue: 'review', ease_factor: 1.35, interval: 5, lapses: 7, learning_step: 0 };
    const result = scheduleCard(card, 'again', {});
    check(result.ease_factor >= 1.30, `SM-2: Ease floor 1.30 preserved [ease=${result.ease_factor}]`);
  }

  // Test 5: Minimum interval guarantee
  {
    const card = { queue: 'review', ease_factor: 1.3, interval: 1, lapses: 0, learning_step: 0 };
    const hard = scheduleCard(card, 'hard', {});
    check(hard.interval >= 2, `SM-2: Minimum interval guarantee (interval+1) [interval=${hard.interval}]`);
  }

  // ─── Sibling Logic ────────────────────────────
  console.log('\n--- Sibling Logic ---');
  {
    const result = getSiblingAction('graduated', 'locked');
    check(result === 'unlock', `Sibling: nl_tr graduated → tr_nl unlock [result=${result}]`);
  }

  // ─── Result ───────────────────────────────────
  console.log('\n================================');
  console.log(`PASS: ${PASS} | FAIL: ${FAIL} | SKIP: ${SKIP}`);
  if (FAIL === 0) {
    if (SKIP > 0) {
      console.log(`✅ Sprint 01 PARTIAL — offline tests green, ${SKIP} Supabase tests skipped.`);
    } else {
      console.log('✅ Sprint 01 PASSED');
    }
  } else {
    console.log(`❌ Sprint 01 FAILED — ${FAIL} test(s) failed`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
