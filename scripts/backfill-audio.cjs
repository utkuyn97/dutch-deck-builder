#!/usr/bin/env node
/**
 * scripts/backfill-audio.js
 * Generates ElevenLabs audio for cards whose audio_url is null and uploads it to Supabase Storage.
 *
 * Usage:
 *   node scripts/backfill-audio.js              # fill in all null audios
 *   node scripts/backfill-audio.js --limit 20   # only 20 of them
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const ELEVEN_MODEL = 'eleven_v3';

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateAudio(word) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: word,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`ElevenLabs ${resp.status}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

async function uploadAudio(key, mp3Buffer) {
  const filePath = `${key}.mp3`;
  const { error: upErr } = await sb.storage
    .from('card-audio')
    .upload(filePath, mp3Buffer, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) throw upErr;
  const { data } = sb.storage.from('card-audio').getPublicUrl(filePath);
  return data.publicUrl;
}

async function main() {
  let query = sb.from('cards')
    .select('id, frequency_rank, dutch, card_data')
    .is('audio_url', null)
    .order('frequency_rank');

  if (LIMIT) query = query.limit(LIMIT);

  const { data: cards, error } = await query;
  if (error) throw error;

  console.log(`🔊 ${cards.length} cards awaiting audio${LIMIT ? ` (limit: ${LIMIT})` : ''}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const word = card.dutch;
    const key = card.card_data?.rank_tag || String(card.frequency_rank);

    try {
      const mp3 = await generateAudio(word);
      const audioUrl = await uploadAudio(key, mp3);

      const { error: updateErr } = await sb
        .from('cards')
        .update({ audio_url: audioUrl })
        .eq('id', card.id);

      if (updateErr) throw updateErr;

      success++;
      process.stdout.write(`  ✅ ${word} (${i + 1}/${cards.length})\r`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${word}: ${e.message}`);
    }

    // Rate limit
    if (i < cards.length - 1) await sleep(300);
  }

  console.log(`\n\n🏁 Completed: ${success} succeeded, ${failed} failed`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
