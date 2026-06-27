#!/usr/bin/env node
/**
 * scripts/reindex-ranks.js
 * Reindexes all cards into sequential ranks starting from 1.
 * Core first (original rank preserved), non-Core after (continuing from 944).
 * Also updates extracted-deck.json.
 */
'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const EXTRACT_PATH = path.join(__dirname, '..', 'data', 'extracted-deck.json');

async function main() {
  // 1. Fix extracted-deck.json
  console.log('📝 Fixing extracted-deck.json...');
  const data = JSON.parse(fs.readFileSync(EXTRACT_PATH, 'utf8'));

  // Core cards keep their original ranks, non-Core cards are reindexed sequentially
  const core = data.filter(d => d.rank_deck === 'Core').sort((a, b) => a.frequency_rank - b.frequency_rank);
  const nonCore = data.filter(d => d.rank_deck !== 'Core').sort((a, b) => a.frequency_rank - b.frequency_rank);

  const maxCoreRank = core.length > 0 ? Math.max(...core.map(c => c.frequency_rank)) : 0;
  console.log(`  Core: ${core.length} cards (rank 1-${maxCoreRank})`);
  console.log(`  Non-Core: ${nonCore.length} cards`);

  // Assign new ranks to non-Core cards (starting from maxCoreRank + 1)
  const oldToNew = new Map();
  nonCore.forEach((d, i) => {
    const oldRank = d.frequency_rank;
    const newRank = maxCoreRank + 1 + i;
    oldToNew.set(oldRank, newRank);
    d.frequency_rank = newRank;
  });
  
  // Merge and sort
  const merged = [...core, ...nonCore].sort((a, b) => a.frequency_rank - b.frequency_rank);
  fs.writeFileSync(EXTRACT_PATH, JSON.stringify(merged, null, 0));
  console.log(`  ✅ JSON updated: rank ${merged[0].frequency_rank}-${merged[merged.length - 1].frequency_rank}`);

  // 2. Fix cards in Supabase
  console.log('\n📊 Fixing Supabase cards...');

  // Fetch non-Core cards (rank >= 10000)
  const { data: dbCards, error } = await sb
    .from('cards')
    .select('id, frequency_rank')
    .gte('frequency_rank', 10000)
    .order('frequency_rank');
  
  if (error) throw error;
  console.log(`  Found ${dbCards.length} non-Core cards`);

  if (dbCards.length === 0) {
    console.log('  No cards to fix');
    return;
  }

  // Temporarily move to very large ranks (because of the unique constraint)
  console.log('  Step 1: Moving to temporary ranks...');
  for (const card of dbCards) {
    const tempRank = 900000 + card.frequency_rank;
    const { error: e } = await sb.from('cards').update({ frequency_rank: tempRank }).eq('id', card.id);
    if (e) console.log(`    ❌ temp ${card.frequency_rank}: ${e.message}`);
  }

  // Move to the correct ranks
  console.log('  Step 2: Moving to correct ranks...');
  let fixed = 0;
  for (const card of dbCards) {
    const newRank = oldToNew.get(card.frequency_rank);
    if (!newRank) {
      console.log(`    ⚠ Rank mapping not found: ${card.frequency_rank}`);
      continue;
    }
    const tempRank = 900000 + card.frequency_rank;
    const { error: e } = await sb.from('cards').update({ frequency_rank: newRank }).eq('frequency_rank', tempRank);
    if (e) console.log(`    ❌ ${card.frequency_rank} → ${newRank}: ${e.message}`);
    else fixed++;
  }
  
  console.log(`\n✅ ${fixed}/${dbCards.length} cards fixed`);

  // 3. Update pipeline checkpoint
  const { data: maxCard } = await sb.from('cards').select('frequency_rank').order('frequency_rank', { ascending: false }).limit(1);
  const newCheckpoint = maxCard[0].frequency_rank;
  await sb.from('pipeline_state').update({ last_processed_rank: newCheckpoint, status: 'idle' }).not('id', 'is', null);
  console.log(`  Checkpoint: ${newCheckpoint}`);

  // Verification
  const { data: sample } = await sb.from('cards').select('frequency_rank, dutch').order('frequency_rank', { ascending: false }).limit(5);
  console.log('\n📋 Top 5 ranks:');
  sample.forEach(c => console.log(`  #${c.frequency_rank} | ${c.dutch}`));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
