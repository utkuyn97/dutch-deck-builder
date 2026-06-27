#!/usr/bin/env node
/**
 * scripts/backfill-audio-all.cjs
 * Paginated ElevenLabs audio generation for all cards where audio_url=null.
 * Runs repeated queries to get past Supabase's 1000-row limit.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const ELEVEN_MODEL = 'eleven_v3';
const PAGE_SIZE = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateAudio(word) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: word, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`ElevenLabs ${resp.status}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

async function uploadAudio(key, mp3Buffer) {
  const filePath = `${key}.mp3`;
  const { error: upErr } = await sb.storage.from('card-audio').upload(filePath, mp3Buffer, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) throw upErr;
  const { data } = sb.storage.from('card-audio').getPublicUrl(filePath);
  return data.publicUrl;
}

async function main() {
  let totalSuccess = 0;
  let totalFailed = 0;
  let page = 0;

  while (true) {
    page++;
    const { data: cards, error } = await sb.from('cards')
      .select('id, frequency_rank, dutch, card_data')
      .is('audio_url', null)
      .order('frequency_rank')
      .limit(PAGE_SIZE);

    if (error) throw error;
    if (!cards || cards.length === 0) break;

    console.log(`\n📦 Page ${page}: ${cards.length} cards (total pending: ~${cards.length === PAGE_SIZE ? 'more remaining' : cards.length})`);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const word = card.dutch;
      const key = String(card.frequency_rank);

      try {
        const mp3 = await generateAudio(word);
        const audioUrl = await uploadAudio(key, mp3);
        const { error: updateErr } = await sb.from('cards').update({ audio_url: audioUrl }).eq('id', card.id);
        if (updateErr) throw updateErr;
        totalSuccess++;
        const globalIdx = (page - 1) * PAGE_SIZE + i + 1;
        process.stdout.write(`  ✅ ${word} (${globalIdx}/${totalSuccess + totalFailed + (cards.length - i - 1)})\r`);
      } catch (e) {
        totalFailed++;
        console.log(`  ❌ ${word}: ${e.message}`);
      }

      if (i < cards.length - 1) await sleep(300);
    }
  }

  console.log(`\n\n🏁 Done: ${totalSuccess} succeeded, ${totalFailed} failed`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
