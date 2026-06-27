#!/usr/bin/env node
/**
 * scripts/migrate-fix-ranks.js
 * Fixes the frequency_rank of existing cards and cleans up pipeline artifacts from card_data.
 * Core_XXXX → XXXX (removes the 10000 offset)
 * Deletes rank_tag, rank_deck, rank_within_deck, frequency_rank from card_data
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  // Fetch all cards
  const { data: cards, error } = await sb
    .from('cards')
    .select('id, frequency_rank, card_data')
    .order('frequency_rank');

  if (error) throw error;
  console.log(`📊 ${cards.length} cards found`);

  let fixed = 0;
  let errors = 0;

  for (const card of cards) {
    const oldRank = card.frequency_rank;
    const cd = { ...card.card_data };

    // Extract the original rank from rank_tag
    const rankTag = cd.rank_tag;
    let newRank = oldRank;

    if (rankTag) {
      const match = rankTag.match(/^Core_(\d+)$/);
      if (match) {
        newRank = parseInt(match[1], 10); // Core_0023 → 23
      }
      // Non-Core decks keep their offset (but are cleaned up from card_data)
    }

    // Clean up pipeline artifacts
    delete cd.rank_tag;
    delete cd.rank_deck;
    delete cd.rank_within_deck;
    delete cd.frequency_rank;

    // Update
    const updates = { card_data: cd };
    if (newRank !== oldRank) {
      updates.frequency_rank = newRank;
    }

    const { error: updateErr } = await sb
      .from('cards')
      .update(updates)
      .eq('id', card.id);

    if (updateErr) {
      console.log(`  ❌ ${cd.dutch || oldRank}: ${updateErr.message}`);
      errors++;
    } else {
      if (newRank !== oldRank) {
        fixed++;
      }
    }
  }

  console.log(`\n✅ Done: ${fixed} ranks fixed, ${errors} errors`);

  // Verification
  const { data: sample } = await sb
    .from('cards')
    .select('frequency_rank, dutch, card_data')
    .order('frequency_rank')
    .limit(5);

  console.log('\n📋 First 5 cards (fixed):');
  sample.forEach(c => {
    const hasArtifacts = c.card_data.rank_tag || c.card_data.rank_deck;
    console.log(`  #${c.frequency_rank} | ${c.dutch} | artifacts: ${hasArtifacts ? '⚠ STILL PRESENT' : '✅ clean'}`);
  });
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
