#!/usr/bin/env node
/**
 * scripts/generate-cards.js
 * Sprint 01 — Card generation pipeline
 *
 * Pipeline:
 *   1. data/extracted-deck.json → batches of BATCH_SIZE (default 20)
 *   2. Each batch goes to claude-sonnet-4-6, returns card JSON (11 schemas)
 *   3. ElevenLabs audio is generated per card, audio_url is written to the card (KARAR-018)
 *   4. Insert into the cards table; seed nl_tr + tr_nl card_progress (with siblings)
 *   5. pipeline_state checkpoint is updated — for crash recovery
 *
 * Usage:
 *   node scripts/generate-cards.js                 # full run, resumes where it left off
 *   node scripts/generate-cards.js --limit 50      # Sprint 1 test target (50 cards)
 *   node scripts/generate-cards.js --dry-run       # don't touch Supabase/Claude/Eleven
 *   node scripts/generate-cards.js --reset         # reset the checkpoint (CAUTION!)
 *   node scripts/generate-cards.js --skip-audio    # skip audio generation (debug)
 *
 * Environment variables (.env):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   ANTHROPIC_API_KEY
 *   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
 *   BATCH_SIZE=20, BATCH_DELAY_MS=2000
 */

'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTRACT_PATH = path.join(PROJECT_ROOT, 'data', 'extracted-deck.json');
const PROMPT_PATH = path.join(PROJECT_ROOT, 'prompts', 'card-generation.md');
const ERROR_LOG = path.join(PROJECT_ROOT, 'data', 'pipeline-errors.jsonl');

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || '2000', 10);
const MODEL = 'claude-sonnet-4-6';
const ELEVEN_MODEL = 'eleven_v3';

const args = new Set(process.argv.slice(2));
const argVal = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};
const LIMIT = argVal('--limit') ? parseInt(argVal('--limit'), 10) : null;
const DRY_RUN = args.has('--dry-run');
const RESET = args.has('--reset');
const SKIP_AUDIO = args.has('--skip-audio');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg, ...rest) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${msg}`, ...rest);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || /^(eyXXXX|XXXX|sk-ant-XXXX)/.test(v) || v.includes('YOURDOMAIN')) {
    throw new Error(`Missing or placeholder env var: ${name}. Fill .env before running.`);
  }
  return v;
}

function buildSystemPrompt() {
  // System prompt comes from prompts/card-generation.md (markdown) — we pass it
  // verbatim so the Architect can tweak grammar rules without touching pipeline code.
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildBatchUserPrompt(batch) {
  // We send compact JSON so the model can see POS hints from the source deck
  // and align schema detection with the raw Anki POS label.
  const payload = batch.map((w) => ({
    dutch: w.dutch,
    raw_pos: w.pos,
    pos_primary: w.pos_primary,
    english: w.definition_en,
    example_nl: w.example_nl,
    example_en: w.example_en,
    rank_tag: w.rank_tag,
    frequency_rank: w.frequency_rank,
    rank_deck: w.rank_deck,
  }));
  return (
    `Aşağıdaki ${batch.length} Hollandaca kelime için "Çıktı Formatı" bölümündeki ` +
    `schema'lara uygun tam kart JSON'u üret.\n\n` +
    `Her kelime için tek bir JSON objesi; tüm ${batch.length} obje'yi bir JSON array ` +
    `içinde döndür. Başka metin ekleme — sadece \`[...]\`.\n\n` +
    `Her objede orijinal frequency_rank ve rank_tag alanlarını AYNEN koru.\n\n` +
    `GİRDİ:\n${JSON.stringify(payload, null, 2)}`
  );
}

function parseClaudeJson(text) {
  // Be defensive: strip Markdown fencing if present.
  let s = (text || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  // Find first `[` and last `]` to isolate JSON array.
  const i = s.indexOf('[');
  const j = s.lastIndexOf(']');
  if (i < 0 || j < i) throw new Error('No JSON array in Claude response');
  return JSON.parse(s.slice(i, j + 1));
}

async function callClaude(client, systemPrompt, userPrompt) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = (resp.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  return parseClaudeJson(text);
}

async function generateAudio(dutchWord, elevenKey, voiceId) {
  // ElevenLabs TTS — returns mp3 Buffer. We store via Supabase Storage bucket
  // (expected: 'card-audio') and surface the public URL on cards.audio_url.
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: dutchWord,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`ElevenLabs ${resp.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf;
}

async function uploadAudio(sb, cardKey, mp3Buffer) {
  // Storage bucket must exist: 'card-audio'. Create it one-time via:
  //   supabase storage create card-audio --public
  const filePath = `${cardKey}.mp3`;
  const { error: upErr } = await sb.storage
    .from('card-audio')
    .upload(filePath, mp3Buffer, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) throw upErr;
  const { data } = sb.storage.from('card-audio').getPublicUrl(filePath);
  return data.publicUrl;
}

async function loadCheckpoint(sb) {
  const { data, error } = await sb.from('pipeline_state').select('*').maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data || { last_processed_rank: 0, status: 'idle', errors: [] };
}

async function saveCheckpoint(sb, cp) {
  const row = { ...cp, updated_at: new Date().toISOString() };
  if (cp.id) {
    const { error } = await sb.from('pipeline_state').update(row).eq('id', cp.id);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('pipeline_state').insert(row).select().single();
    if (error) throw error;
    cp.id = data.id;
  }
}

async function insertCardWithSiblings(sb, cardRow) {
  // cardRow: { frequency_rank, dutch, schema, level, card_data, audio_url }
  const { data: card, error: cardErr } = await sb
    .from('cards')
    .upsert(cardRow, { onConflict: 'frequency_rank' })
    .select()
    .single();
  if (cardErr) throw cardErr;

  // Seed card_progress: nl_tr → new, tr_nl → locked, sibling_id pointing to each other.
  const { data: existing } = await sb
    .from('card_progress')
    .select('id,direction')
    .eq('card_id', card.id);

  if (!existing || existing.length === 0) {
    const { data: nl, error: e1 } = await sb
      .from('card_progress')
      .insert({ card_id: card.id, direction: 'nl_tr', queue: 'new' })
      .select()
      .single();
    if (e1) throw e1;
    const { data: tr, error: e2 } = await sb
      .from('card_progress')
      .insert({ card_id: card.id, direction: 'tr_nl', queue: 'locked', sibling_id: nl.id })
      .select()
      .single();
    if (e2) throw e2;
    // Back-link sibling on nl_tr.
    const { error: e3 } = await sb
      .from('card_progress')
      .update({ sibling_id: tr.id })
      .eq('id', nl.id);
    if (e3) throw e3;
  }
  return card;
}

function pickSchema(posPrimary, rawPos, card) {
  // Claude fills `schema` in the returned JSON. Fallback to coarse POS if absent.
  if (card && card.schema) return card.schema;
  if (posPrimary === 'noun') return 'noun';
  if (posPrimary === 'verb') return 'verb_regular'; // safe default
  if (posPrimary === 'adj') return 'adjective';
  if (posPrimary === 'adv') return 'adverb';
  if (posPrimary === 'conj') return 'conjunction';
  if (posPrimary === 'prep') return 'preposition';
  return 'adverb';
}

async function main() {
  log(`DutchDeck pipeline — model=${MODEL} batch=${BATCH_SIZE} ${DRY_RUN ? '[DRY-RUN]' : ''}`);

  if (!fs.existsSync(EXTRACT_PATH)) {
    throw new Error(`Missing ${EXTRACT_PATH}. Run: node scripts/extract-deck.js`);
  }
  const all = JSON.parse(fs.readFileSync(EXTRACT_PATH, 'utf8'));
  log(`loaded ${all.length} words from data/extracted-deck.json`);

  if (DRY_RUN) {
    log('--dry-run: skipping Supabase/Claude/ElevenLabs. Pipeline is parseable and inputs are present.');
    return;
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_ANON_KEY');
  const anthropicKey = requireEnv('ANTHROPIC_API_KEY');
  const elevenKey = SKIP_AUDIO ? null : requireEnv('ELEVENLABS_API_KEY');
  const voiceId = SKIP_AUDIO
    ? null
    : (process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM');

  const sb = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Checkpoint load / reset
  let cp = await loadCheckpoint(sb);
  if (RESET) {
    log('--reset: zeroing checkpoint');
    cp = { ...cp, last_processed_rank: 0, status: 'idle', errors: [] };
    await saveCheckpoint(sb, cp);
  }
  log(`checkpoint: last_processed_rank=${cp.last_processed_rank} status=${cp.status} errors=${(cp.errors || []).length}`);

  // Filter by checkpoint (records are sorted by frequency_rank in extract).
  let remaining = all.filter((w) => (w.frequency_rank || 0) > (cp.last_processed_rank || 0));
  if (LIMIT != null) remaining = remaining.slice(0, LIMIT);
  log(`processing ${remaining.length} words` + (LIMIT ? ` (--limit ${LIMIT})` : ''));

  const systemPrompt = buildSystemPrompt();
  cp.status = 'running';
  await saveCheckpoint(sb, cp);

  let processed = 0;
  let failedWords = 0;
  fs.mkdirSync(path.dirname(ERROR_LOG), { recursive: true });

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    log(`batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(remaining.length / BATCH_SIZE)} — ${batch.length} words (from ${batch[0].rank_tag})`);

    let cards = [];
    try {
      cards = await callClaude(anthropic, systemPrompt, buildBatchUserPrompt(batch));
    } catch (e) {
      log(`  ❌ Claude batch error: ${e.message} — skipping batch`);
      cp.errors = (cp.errors || []).concat([{ rank_tag: batch.map((b) => b.rank_tag), error: e.message, at: new Date().toISOString() }]);
      fs.appendFileSync(ERROR_LOG, JSON.stringify({ kind: 'batch', error: e.message, sample: batch[0].rank_tag }) + '\n');
      failedWords += batch.length;
      await saveCheckpoint(sb, cp);
      await sleep(BATCH_DELAY_MS);
      continue;
    }

    // Each `cards[k]` corresponds to `batch[k]` by order.
    for (let k = 0; k < batch.length; k++) {
      const src = batch[k];
      const card = cards[k];
      if (!card || !card.dutch) {
        log(`  ❌ missing card for ${src.rank_tag} (${src.dutch})`);
        cp.errors = (cp.errors || []).concat([{ rank_tag: src.rank_tag, error: 'Claude omitted card', at: new Date().toISOString() }]);
        fs.appendFileSync(ERROR_LOG, JSON.stringify({ kind: 'missing', rank_tag: src.rank_tag }) + '\n');
        failedWords++;
        continue;
      }

      // Normalize required fields.
      if (!card.turkish && card.turkish_a) card.turkish = card.turkish_a; // dual verb case
      card.rank_tag = src.rank_tag;
      card.frequency_rank = src.frequency_rank;
      card.english = card.english || src.definition_en;
      card.example_nl = card.example_nl || src.example_nl;
      card.example_en = card.example_en || src.example_en;

      // ElevenLabs audio — per-word (KARAR-018: inside the pipeline, no separate post-pipeline step).
      let audio_url = null;
      if (!SKIP_AUDIO) {
        try {
          const mp3 = await generateAudio(card.dutch, elevenKey, voiceId);
          audio_url = await uploadAudio(sb, src.rank_tag || String(card.frequency_rank), mp3);
        } catch (e) {
          log(`  ⚠ audio failed for ${card.dutch}: ${e.message}`);
          cp.errors = (cp.errors || []).concat([{ rank_tag: src.rank_tag, error: `audio: ${e.message}`, at: new Date().toISOString() }]);
          fs.appendFileSync(ERROR_LOG, JSON.stringify({ kind: 'audio', rank_tag: src.rank_tag, error: e.message }) + '\n');
        }
      }

      // Strip pipeline artifacts from card_data (they already exist as DB columns)
      delete card.rank_tag;
      delete card.rank_deck;
      delete card.rank_within_deck;
      delete card.frequency_rank;

      const cardRow = {
        frequency_rank: src.frequency_rank,
        dutch: card.dutch,
        schema: pickSchema(src.pos_primary, src.pos, card),
        level: card.level || null,
        card_data: card,
        audio_url,
      };

      try {
        await insertCardWithSiblings(sb, cardRow);
        processed++;
      } catch (e) {
        log(`  ❌ DB insert failed for ${card.dutch}: ${e.message}`);
        cp.errors = (cp.errors || []).concat([{ rank_tag: src.rank_tag, error: `db: ${e.message}`, at: new Date().toISOString() }]);
        fs.appendFileSync(ERROR_LOG, JSON.stringify({ kind: 'db', rank_tag: src.rank_tag, error: e.message }) + '\n');
        failedWords++;
      }

      cp.last_processed_rank = Math.max(cp.last_processed_rank || 0, src.frequency_rank || 0);
    }

    await saveCheckpoint(sb, cp);
    if (i + BATCH_SIZE < remaining.length) await sleep(BATCH_DELAY_MS);
  }

  cp.status = 'done';
  await saveCheckpoint(sb, cp);
  log(`✅ done. processed=${processed} failed=${failedWords}`);
}

main().catch((e) => {
  console.error('[generate-cards] FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
