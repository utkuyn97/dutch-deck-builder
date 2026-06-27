#!/usr/bin/env node
/**
 * scripts/download-audio.cjs
 * Downloads all mp3s from Supabase → exports/audio/
 * Then build-apkg.cjs embeds them into the .apkg.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const AUDIO_DIR = path.join(__dirname, '..', 'exports', 'audio');
const CONCURRENCY = 25;

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve('skip'); return; }
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve('ok'); });
    }).on('error', (e) => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(e);
    });
  });
}

async function pool(tasks, concurrency) {
  let i = 0;
  let done = 0;
  const total = tasks.length;
  const results = [];

  async function worker() {
    while (i < total) {
      const idx = i++;
      try {
        await tasks[idx]();
        results[idx] = true;
      } catch (e) {
        results[idx] = false;
        console.error(`  ❌ ${idx}: ${e.message}`);
      }
      done++;
      if (done % 100 === 0) process.stdout.write(`  ${done}/${total}\n`);
    }
  }

  const workers = [];
  for (let w = 0; w < concurrency; w++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

  console.log('🔗 Fetching cards...');
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('cards')
      .select('dutch, audio_url, frequency_rank')
      .order('frequency_rank', { ascending: true })
      .range(from, from + 999);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    from += 1000;
  }
  console.log(`✅ ${all.length} cards`);

  const withAudio = all.filter(c => c.audio_url);
  const existing = fs.readdirSync(AUDIO_DIR).length;
  console.log(`🎵 ${withAudio.length} audio files (${existing} already downloaded)\n`);

  const tasks = withAudio.map(card => {
    const filename = card.audio_url.split('/').pop();
    const dest = path.join(AUDIO_DIR, filename);
    return () => downloadFile(card.audio_url, dest);
  });

  await pool(tasks, CONCURRENCY);

  const finalCount = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.mp3')).length;
  console.log(`\n✅ ${finalCount} mp3 ready → exports/audio/`);
}

main().catch(e => { console.error(e); process.exit(1); });
