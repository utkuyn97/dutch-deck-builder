/**
 * scripts/preview-cards.js — Display cards
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await sb
    .from('cards')
    .select('frequency_rank, dutch, schema, level, audio_url, card_data')
    .order('frequency_rank')
    .limit(15);

  if (error) { console.error(error); return; }

  console.log(`\n=== First 15 Cards ===\n`);
  for (const c of data) {
    const cd = c.card_data;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`#${c.frequency_rank} | ${c.dutch} | ${c.schema} | ${c.level} | audio: ${c.audio_url ? '✅' : '❌'}`);
    console.log(`  🇹🇷 ${cd.turkish || cd.turkish_a || '—'}`);
    console.log(`  🇬🇧 ${cd.english || cd.english_a || '—'}`);

    if (cd.article) console.log(`  📝 Article: ${cd.article}`);
    if (cd.plural) console.log(`  📝 Plural: ${cd.plural}`);
    if (cd.diminutive) console.log(`  📝 Diminutive: ${cd.diminutive}`);
    if (cd.de_het_rule) console.log(`  📝 De/Het: ${cd.de_het_rule}`);

    if (cd.presens_table) {
      const p = cd.presens_table;
      console.log(`  📝 Presens: ik ${p.ik}, jij ${p.jij}, hij ${p.hij}`);
    }
    if (cd.ovt) console.log(`  📝 OVT: ${cd.ovt}`);
    if (cd.ovt_table) {
      const o = cd.ovt_table;
      console.log(`  📝 OVT: ik ${o.ik}, wij ${o.wij}`);
    }
    if (cd.perfectum) console.log(`  📝 Perfectum: ${cd.perfectum}`);
    if (cd.aux_verb) console.log(`  📝 Hulpww: ${cd.aux_verb}`);
    if (cd.comparative) console.log(`  📝 Comp: ${cd.comparative}, Sup: ${cd.superlative}`);
    if (cd.word_order) console.log(`  📝 Word order: ${cd.word_order}`);
    if (cd.ipa) console.log(`  🔊 IPA: ${cd.ipa}`);

    console.log(`  📖 ${cd.example_nl || '—'}`);
  }

  // Stats
  const { count: total } = await sb.from('cards').select('id', { count: 'exact', head: true });
  const { count: withAudio } = await sb.from('cards').select('id', { count: 'exact', head: true }).not('audio_url', 'is', null);
  const { data: schemas } = await sb.from('cards').select('schema');
  const dist = {};
  (schemas || []).forEach(s => { dist[s.schema] = (dist[s.schema] || 0) + 1; });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Total: ${total} cards | Audio: ${withAudio || 0}`);
  console.log(`📊 Schema distribution:`);
  Object.entries(dist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`    ${k}: ${v}`));
}

main().catch(console.error);
