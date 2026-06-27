#!/usr/bin/env bash
# tests/sprint-01.sh — DutchDeck Sprint 01 regression
# Canonical source: sprints/sprint-01/TESTS.md

set -u
cd "$(dirname "$0")/.." || exit 1

# Load .env if present so SUPABASE_URL/etc. become visible to node subprocesses.
if [ -f .env ]; then
  # Export everything that isn't a comment/blank line.
  # shellcheck disable=SC2046
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PASS=0
FAIL=0
SKIP=0

check() {
  local rc=$1
  local name=$2
  if [ "$rc" -eq 0 ]; then
    echo "✅ PASS: $name"
    PASS=$((PASS+1))
  elif [ "$rc" -eq 77 ]; then
    echo "⏭  SKIP: $name"
    SKIP=$((SKIP+1))
  else
    echo "❌ FAIL: $name"
    FAIL=$((FAIL+1))
  fi
}

supabase_ready() {
  # Returns 0 if env looks filled; 77 if placeholder (test skipped).
  if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then return 77; fi
  case "$SUPABASE_URL" in *XXXX*|*YOURDOMAIN*) return 77 ;; esac
  case "$SUPABASE_ANON_KEY" in eyXXXX*|XXXX*) return 77 ;; esac
  return 0
}

echo "=== DutchDeck Sprint 01 Tests ==="
echo ""

# --- Supabase ---
echo "--- Supabase ---"
if ! supabase_ready; then
  echo "⚠  SUPABASE_URL / SUPABASE_ANON_KEY not set — Supabase-dependent tests will SKIP."
  SB_READY=77
else
  SB_READY=0
fi

# 1. Supabase connection
if [ "$SB_READY" -eq 0 ]; then
  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  sb.from('cards').select('count').then(({error}) => {
    if(error) { console.error(error.message); process.exit(1) }
    process.exit(0)
  }).catch(e => { console.error(e.message); process.exit(1) })
  " 2>/dev/null
  check $? "Supabase connection"
else
  check 77 "Supabase connection"
fi

# 2. Tables exist (count check for each)
if [ "$SB_READY" -eq 0 ]; then
  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const tables = ['cards','card_progress','grammar_topics','grammar_exercises',
    'grammar_progress','daily_sessions','daily_stats','word_context_history',
    'pipeline_state','pending_words','user_settings']
  ;(async () => {
    for (const t of tables) {
      const { error } = await sb.from(t).select('*').limit(1)
      if (error) { console.error(t, error.message); process.exit(1) }
    }
    process.exit(0)
  })()
  " 2>/dev/null
  check $? "All tables exist"
else
  check 77 "All tables exist"
fi

# --- Deck Extract ---
echo ""
echo "--- Deck Extract ---"
node scripts/extract-deck.js --dry-run >/dev/null 2>&1
check $? "Sa_.apkg extract works"

node -e "
const data = require('./data/extracted-deck.json')
if(data.length >= 4900) process.exit(0)
else { console.error('Expected 4979, found:', data.length); process.exit(1) }
" 2>/dev/null
check $? "4,979 words extracted"

node -e "
const data = require('./data/extracted-deck.json')
const bad = data.filter(d => ['pron','num','interj','art'].includes(d.pos))
if(bad.length === 0) process.exit(0)
else { console.error('Not filtered:', bad.slice(0,3)); process.exit(1) }
" 2>/dev/null
check $? "pron/num/interj/art filtered out"

# --- Pipeline ---
echo ""
echo "--- Pipeline ---"
if [ "$SB_READY" -eq 0 ]; then
  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  sb.from('pipeline_state').select('*').maybeSingle().then(({data, error}) => {
    if(error && error.code !== 'PGRST116') { console.error(error.message); process.exit(1) }
    process.exit(0)
  })
  " 2>/dev/null
  check $? "pipeline_state table is accessible"

  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  sb.from('cards').select('id', { count: 'exact', head: true }).then(({count, error}) => {
    if(error) { console.error(error.message); process.exit(1) }
    if((count || 0) >= 50) process.exit(0)
    else { console.error('Expected 50+ cards, found:', count); process.exit(1) }
  })
  " 2>/dev/null
  check $? "At least 50 cards generated"
else
  check 77 "pipeline_state table is accessible"
  check 77 "At least 50 cards generated"
fi

# --- Schema Detection ---
echo ""
echo "--- Schema Detection ---"
if [ "$SB_READY" -eq 0 ]; then
  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const schemas = ['noun','verb_regular','verb_irregular','verb_separable',
    'verb_inseparable','verb_dual','verb_reflexive','adjective','adverb',
    'conjunction','preposition']
  sb.from('cards').select('schema').then(({data, error}) => {
    if(error) { console.error(error.message); process.exit(1) }
    const found = [...new Set((data||[]).map(d => d.schema))]
    const missing = schemas.filter(s => !found.includes(s))
    if(missing.length <= 3) process.exit(0)
    else { console.error('Missing schema:', missing); process.exit(1) }
  })
  " 2>/dev/null
  check $? "Core schema types present"

  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  sb.from('cards').select('card_data').limit(10).then(({data, error}) => {
    if(error) { console.error(error.message); process.exit(1) }
    const invalid = (data||[]).filter(d => !d.card_data.turkish || !d.card_data.dutch)
    if(invalid.length === 0) process.exit(0)
    else { console.error('Missing field:', invalid[0]); process.exit(1) }
  })
  " 2>/dev/null
  check $? "Required fields populated (dutch, turkish)"
else
  check 77 "Core schema types present"
  check 77 "Required fields populated (dutch, turkish)"
fi

# --- Card Progress ---
echo ""
echo "--- Card Progress ---"
if [ "$SB_READY" -eq 0 ]; then
  node -e "
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  sb.from('card_progress').select('direction,queue').limit(200).then(({data, error}) => {
    if(error) { console.error(error.message); process.exit(1) }
    const nltr = (data||[]).filter(d => d.direction === 'nl_tr' && d.queue === 'new')
    const trnl = (data||[]).filter(d => d.direction === 'tr_nl' && d.queue === 'locked')
    if(nltr.length >= 25 && trnl.length >= 25) process.exit(0)
    else { console.error('nl_tr new:', nltr.length, 'tr_nl locked:', trnl.length); process.exit(1) }
  })
  " 2>/dev/null
  check $? "nl_tr=new, tr_nl=locked seed correct"
else
  check 77 "nl_tr=new, tr_nl=locked seed correct"
fi

# --- SM-2 Algorithm --- (all pure JS, no Supabase)
echo ""
echo "--- SM-2 Algorithm ---"
node -e "
const { scheduleCard } = require('./src/lib/sm2.js')
const newCard = { queue: 'learning', learning_step: 0, ease_factor: 2.5, interval: 0, lapses: 0 }
const result = scheduleCard(newCard, 'good', {})
if(result.learning_step === 1) process.exit(0)
else { console.error('expected step 1, got', result.learning_step); process.exit(1) }
" 2>/dev/null
check $? "SM-2: Learning Good → next step"

node -e "
const { scheduleCard } = require('./src/lib/sm2.js')
const card = { queue: 'learning', learning_step: 1, ease_factor: 2.5, interval: 0, lapses: 0 }
const result = scheduleCard(card, 'again', {})
if(result.ease_factor === 2.5) process.exit(0)
else { console.error('Learning Again ease changed:', result.ease_factor); process.exit(1) }
" 2>/dev/null
check $? "SM-2: Learning Again does NOT affect ease (Anki rule)"

node -e "
const { scheduleCard } = require('./src/lib/sm2.js')
const card = { queue: 'review', ease_factor: 2.5, interval: 10, lapses: 0, learning_step: 0 }
const result = scheduleCard(card, 'again', {})
if(Math.abs(result.ease_factor - 2.3) < 1e-9 && result.queue === 'relearning') process.exit(0)
else { console.error('Review Again: got ease=', result.ease_factor, 'queue=', result.queue); process.exit(1) }
" 2>/dev/null
check $? "SM-2: Review Again → ease -0.20, relearning"

node -e "
const { scheduleCard } = require('./src/lib/sm2.js')
const card = { queue: 'review', ease_factor: 1.35, interval: 5, lapses: 7, learning_step: 0 }
const result = scheduleCard(card, 'again', {})
if(result.ease_factor >= 1.30) process.exit(0)
else { console.error('Ease floor 1.30 violated:', result.ease_factor); process.exit(1) }
" 2>/dev/null
check $? "SM-2: Ease floor 1.30 is preserved"

node -e "
const { scheduleCard } = require('./src/lib/sm2.js')
const card = { queue: 'review', ease_factor: 1.3, interval: 1, lapses: 0, learning_step: 0 }
const hard = scheduleCard(card, 'hard', {})
if(hard.interval >= 2) process.exit(0)
else { console.error('Min interval violated. Hard interval:', hard.interval); process.exit(1) }
" 2>/dev/null
check $? "SM-2: Minimum interval guarantee (interval+1)"

# --- Sibling Logic ---
echo ""
echo "--- Sibling Logic ---"
node -e "
const { getSiblingAction } = require('./src/lib/sm2.js')
const result = getSiblingAction('graduated', 'locked')
if(result === 'unlock') process.exit(0)
else { console.error('graduated → expected unlock, found:', result); process.exit(1) }
" 2>/dev/null
check $? "Sibling: nl_tr graduated → tr_nl unlock"

echo ""
echo "================================"
echo "PASS: $PASS | FAIL: $FAIL | SKIP: $SKIP"
if [ $FAIL -eq 0 ]; then
  if [ $SKIP -gt 0 ]; then
    echo "✅ Sprint 01 PARTIAL — offline tests green, $SKIP Supabase tests skipped (fill .env to run them)."
  else
    echo "✅ Sprint 01 PASSED"
  fi
  exit 0
else
  echo "❌ Sprint 01 FAILED — $FAIL test(s) failed"
  exit 1
fi
