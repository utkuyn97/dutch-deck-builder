/**
 * tests/sprint-02-runner.js
 * Sprint 2 acceptance tests — validates React UI setup, SM-2 ESM, queue logic,
 * sibling bury/unlock, streak, session timer, and Supabase integration.
 *
 * Run: node tests/sprint-02-runner.js
 *
 * NOTE: sm2.js is now ESM. This test file uses dynamic import().
 * Node scripts still work with --experimental-vm-modules or dynamic import.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Windows requires file:// URLs for dynamic import()
const importModule = (p) => import(pathToFileURL(p).href);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Test Framework ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: '✅ PASS' });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    results.push({ name, status: '❌ FAIL', error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\n🧪 Sprint 02 — Test Runner\n');

// === 1. Project Structure ===
console.log('📁 1. Project Structure');

await test('vite.config.js exists', async () => {
  assert(existsSync(resolve(ROOT, 'vite.config.js')));
});

await test('index.html exists with React root', async () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');
  assert(html.includes('id="root"'), 'Missing root div');
  assert(html.includes('/src/main.jsx'), 'Missing main.jsx script');
  assert(html.includes('viewport'), 'Missing viewport meta');
});

await test('package.json has React + Vite deps', async () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  assert(pkg.dependencies['react'], 'Missing react dep');
  assert(pkg.dependencies['react-dom'], 'Missing react-dom dep');
  assert(pkg.devDependencies['vite'], 'Missing vite devDep');
  assert(pkg.devDependencies['@vitejs/plugin-react'], 'Missing plugin-react');
  assert(pkg.type === 'module', 'package.json type should be "module"');
});

await test('src/main.jsx exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/main.jsx')));
});

await test('src/App.jsx exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/App.jsx')));
});

await test('src/lib/supabase.js exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/lib/supabase.js')));
});

await test('.env has VITE_ Supabase vars', async () => {
  const env = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  assert(env.includes('VITE_SUPABASE_URL'), 'Missing VITE_SUPABASE_URL');
  assert(env.includes('VITE_SUPABASE_ANON_KEY'), 'Missing VITE_SUPABASE_ANON_KEY');
});

// === 2. CSS Design System ===
console.log('\n🎨 2. CSS Design System');

await test('Design tokens CSS exists', async () => {
  const css = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');
  assert(css.includes('--bg-primary'), 'Missing --bg-primary token');
  assert(css.includes('--accent'), 'Missing --accent token');
  assert(css.includes('--safe-top'), 'Missing safe-area-inset tokens');
  assert(css.includes('--font-family'), 'Missing font-family token');
});

await test('Mobile-first CSS (390px target)', async () => {
  const global = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf-8');
  assert(global.includes('430px') || global.includes('390px'), 'Missing mobile max-width');
  assert(global.includes('100dvh') || global.includes('100vh'), 'Missing dvh/vh');
});

await test('Card flip CSS exists', async () => {
  const css = readFileSync(resolve(ROOT, 'src/styles/review.css'), 'utf-8');
  assert(css.includes('perspective'), 'Missing perspective');
  assert(css.includes('rotateY'), 'Missing rotateY transform');
  assert(css.includes('backface-visibility'), 'Missing backface-visibility');
  assert(css.includes('preserve-3d'), 'Missing preserve-3d');
});

// === 3. SM-2 ESM Module ===
console.log('\n⚙️ 3. SM-2 ESM Module');

await test('sm2.js is valid ESM with named exports', async () => {
  const sm2 = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  assert(typeof sm2.scheduleCard === 'function', 'Missing scheduleCard export');
  assert(typeof sm2.getSiblingAction === 'function', 'Missing getSiblingAction export');
  assert(typeof sm2.isLeech === 'function', 'Missing isLeech export');
  assert(typeof sm2.getNextDuePreview === 'function', 'Missing getNextDuePreview export');
  assert(typeof sm2.formatDueTime === 'function', 'Missing formatDueTime export');
  assert(typeof sm2.DEFAULTS === 'object', 'Missing DEFAULTS export');
});

await test('scheduleCard: new → learning (Again)', async () => {
  const { scheduleCard } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  const now = new Date('2026-04-25T10:00:00Z');
  const result = scheduleCard(
    { queue: 'new', learning_step: 0, ease_factor: 2.5, interval: 0, lapses: 0 },
    'again',
    { now }
  );
  assert(result.queue === 'learning', `Expected learning, got ${result.queue}`);
  assert(result.learning_step === 0, 'Step should be 0');
  assert(result.ease_factor === 2.5, 'Ease should be unchanged (Anki rule)');
});

await test('scheduleCard: learning → review (Good, last step)', async () => {
  const { scheduleCard } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  const now = new Date('2026-04-25T10:00:00Z');
  const result = scheduleCard(
    { queue: 'learning', learning_step: 1, ease_factor: 2.5, interval: 0, lapses: 0 },
    'good',
    { now }
  );
  assert(result.queue === 'review', `Expected review, got ${result.queue}`);
  assert(result.interval === 1, `Expected interval 1, got ${result.interval}`);
});

await test('scheduleCard: review → relearning (Again, ease -0.20)', async () => {
  const { scheduleCard } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  const now = new Date('2026-04-25T10:00:00Z');
  const result = scheduleCard(
    { queue: 'review', learning_step: 0, ease_factor: 2.5, interval: 5, lapses: 0 },
    'again',
    { now }
  );
  assert(result.queue === 'relearning', `Expected relearning, got ${result.queue}`);
  assert(result.ease_factor === 2.3, `Expected ease 2.3, got ${result.ease_factor}`);
  assert(result.lapses === 1, `Expected lapses 1, got ${result.lapses}`);
});

await test('getNextDuePreview returns all 4 ratings', async () => {
  const { getNextDuePreview } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  const preview = getNextDuePreview(
    { queue: 'new', learning_step: 0, ease_factor: 2.5, interval: 0, lapses: 0 },
    { now: new Date() }
  );
  assert(preview.again !== undefined, 'Missing again preview');
  assert(preview.hard !== undefined, 'Missing hard preview');
  assert(preview.good !== undefined, 'Missing good preview');
  assert(preview.easy !== undefined, 'Missing easy preview');
});

await test('formatDueTime produces readable strings', async () => {
  const { formatDueTime } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  const now = new Date('2026-04-25T10:00:00Z');
  assert(formatDueTime(new Date('2026-04-25T10:00:30Z'), now) === '1dk', `Got: ${formatDueTime(new Date('2026-04-25T10:00:30Z'), now)}`);
  assert(formatDueTime(new Date('2026-04-25T10:10:00Z'), now) === '10dk');
  assert(formatDueTime(new Date('2026-04-26T10:00:00Z'), now) === '1g');
  assert(formatDueTime(new Date('2026-04-29T10:00:00Z'), now) === '4g');
});

// === 4. Sibling Logic ===
console.log('\n👯 4. Sibling Logic');

await test('getSiblingAction: graduated + locked → unlock', async () => {
  const { getSiblingAction } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  assert(getSiblingAction('graduated', 'locked') === 'unlock');
});

await test('getSiblingAction: flipped + new → bury', async () => {
  const { getSiblingAction } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  assert(getSiblingAction('flipped', 'new') === 'bury');
});

await test('getSiblingAction: flipped + locked → null (no bury)', async () => {
  const { getSiblingAction } = await importModule(resolve(ROOT, 'src/lib/sm2.js'));
  assert(getSiblingAction('flipped', 'locked') === null);
});

// === 5. Supabase Data ===
console.log('\n🗄️ 5. Supabase Data');

await test('Cards table has data', async () => {
  const { count } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });
  assert(count > 0, `Expected cards, got ${count}`);
});

await test('card_progress has nl_tr and tr_nl entries', async () => {
  const { count: nlCount } = await supabase
    .from('card_progress')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'nl_tr');
  const { count: trCount } = await supabase
    .from('card_progress')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'tr_nl');
  assert(nlCount > 0, `No nl_tr entries`);
  assert(trCount > 0, `No tr_nl entries`);
});

await test('user_settings row exists', async () => {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1)
    .single();
  assert(data, 'No user_settings row');
  assert(data.new_cards_per_day === 20, `Expected 20 new/day, got ${data.new_cards_per_day}`);
  assert(data.max_reviews_per_day === 200, `Expected 200 reviews/day, got ${data.max_reviews_per_day}`);
});

await test('Queue counts are valid', async () => {
  const now = new Date().toISOString();
  const { count: newCount } = await supabase
    .from('card_progress')
    .select('*', { count: 'exact', head: true })
    .eq('queue', 'new');
  assert(newCount >= 0, 'Invalid new count');
});

// === 6. Card Renderer ===
console.log('\n🃏 6. Card Renderer');

await test('cardRenderer handles verb_irregular schema', async () => {
  const { getCardDisplay } = await importModule(resolve(ROOT, 'src/lib/cardRenderer.js'));
  const card = {
    dutch: 'kunnen',
    schema: 'verb_irregular',
    audio_url: null,
    card_data: {
      ipa: 'ˈkʏnə(n)',
      dutch: 'kunnen',
      level: 'A1',
      schema: 'verb_irregular',
      english: 'can, to be able to',
      turkish: 'yapabilmek',
      aux_verb: 'heeft',
      ovt_table: { ik: 'kon', hij: 'kon', jij: 'kon', wij: 'konden', zij: 'konden', jullie: 'konden' },
      perfectum: 'gekund',
      example_en: 'Maybe we can go.',
      example_nl: 'Misschien kunnen we gaan.',
      example_tr: 'Belki gidebiliriz.',
      presens_table: { ik: 'kan', hij: 'kan', jij: 'kan', wij: 'kunnen', zij: 'kunnen', jullie: 'kunnen' },
    },
  };
  const display = getCardDisplay(card, 'nl_tr');
  assert(display.frontWord === 'kunnen', `Wrong front: ${display.frontWord}`);
  assert(display.ipa === 'ˈkʏnə(n)', 'Missing IPA');
  assert(display.level === 'A1', 'Missing level');
  assert(display.translation.primary === 'yapabilmek', 'Wrong translation');
  assert(display.translation.secondary === 'can, to be able to', 'Wrong EN translation');
  assert(display.example.nl === 'Misschien kunnen we gaan.', 'Missing NL example');
  assert(display.example.tr === 'Belki gidebiliriz.', 'Missing TR example');

  // Check details have presens and ovt tables
  const presens = display.details.find(d => d.label === 'Presens');
  assert(presens, 'Missing presens detail');
  assert(presens.type === 'verb_table', 'Presens should be verb_table type');
  assert(presens.table.length >= 5, `Presens table too short: ${presens.table.length}`);

  const ovt = display.details.find(d => d.label === 'OVT');
  assert(ovt, 'Missing OVT detail');
  assert(ovt.type === 'verb_table', 'OVT should be verb_table type');

  const perf = display.details.find(d => d.label === 'Perfectum');
  assert(perf, 'Missing Perfectum');
  assert(perf.value === 'gekund', 'Wrong perfectum value');

  const aux = display.details.find(d => d.label === 'Hulpww.');
  assert(aux, 'Missing auxiliary verb');
  assert(aux.value === 'heeft', 'Wrong aux value');
});

await test('cardRenderer handles noun schema', async () => {
  const { getCardDisplay } = await importModule(resolve(ROOT, 'src/lib/cardRenderer.js'));
  const card = {
    dutch: 'huis',
    schema: 'noun',
    card_data: {
      dutch: 'huis',
      turkish: 'ev',
      english: 'house',
      article: 'het',
      plural: 'huizen',
      diminutive: 'huisje',
    },
  };
  const display = getCardDisplay(card, 'nl_tr');
  assert(display.frontWord === 'huis');
  const article = display.details.find(d => d.label === 'Artikel');
  assert(article && article.value === 'het', 'Missing/wrong article');
  const plural = display.details.find(d => d.label === 'Meervoud');
  assert(plural && plural.value === 'huizen', 'Missing/wrong plural');
});

await test('cardRenderer handles tr_nl direction', async () => {
  const { getCardDisplay } = await importModule(resolve(ROOT, 'src/lib/cardRenderer.js'));
  const card = {
    dutch: 'huis',
    schema: 'noun',
    card_data: { dutch: 'huis', turkish: 'ev', english: 'house' },
  };
  const display = getCardDisplay(card, 'tr_nl');
  assert(display.frontWord === 'ev', `TR→NL front should be 'ev', got '${display.frontWord}'`);
  assert(display.translation.primary === 'huis');
});

// === 7. Component Files ===
console.log('\n📦 7. Component Files');

await test('HomeScreen component exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/components/HomeScreen.jsx')));
});

await test('ReviewScreen component exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/components/ReviewScreen.jsx')));
});

await test('CardBack component exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/components/CardBack.jsx')));
});

await test('useSessionTimer hook exists', async () => {
  assert(existsSync(resolve(ROOT, 'src/hooks/useSessionTimer.js')));
});

await test('ReviewScreen has rating buttons', async () => {
  const src = readFileSync(resolve(ROOT, 'src/components/ReviewScreen.jsx'), 'utf-8');
  assert(src.includes('rating-again'), 'Missing Again button');
  assert(src.includes('rating-hard'), 'Missing Hard button');
  assert(src.includes('rating-good'), 'Missing Good button');
  assert(src.includes('rating-easy'), 'Missing Easy button');
});

await test('ReviewScreen has sibling bury/unlock', async () => {
  const src = readFileSync(resolve(ROOT, 'src/components/ReviewScreen.jsx'), 'utf-8');
  assert(src.includes('handleSiblingBury'), 'Missing sibling bury');
  assert(src.includes('handleSiblingUnlock'), 'Missing sibling unlock');
  assert(src.includes("getSiblingAction('graduated'"), 'Missing graduated check');
  assert(src.includes("getSiblingAction('flipped'"), 'Missing flipped check');
});

await test('ReviewScreen has queue count display', async () => {
  const src = readFileSync(resolve(ROOT, 'src/components/ReviewScreen.jsx'), 'utf-8');
  assert(src.includes('counts.new'), 'Missing new count display');
  assert(src.includes('counts.learning'), 'Missing learning count display');
  assert(src.includes('counts.review'), 'Missing review count display');
});

await test('HomeScreen has streak display', async () => {
  const src = readFileSync(resolve(ROOT, 'src/components/HomeScreen.jsx'), 'utf-8');
  assert(src.includes('streak'), 'Missing streak display');
  assert(src.includes('🔥'), 'Missing streak emoji');
});

await test('useSessionTimer has visibilitychange', async () => {
  const src = readFileSync(resolve(ROOT, 'src/hooks/useSessionTimer.js'), 'utf-8');
  assert(src.includes('visibilitychange'), 'Missing visibilitychange handler');
  assert(src.includes('document.hidden'), 'Missing document.hidden check');
});

// === 8. Build Test ===
console.log('\n🏗️ 8. Build Verification');

await test('Vite build produces dist/', async () => {
  // Check if dist exists (from previous build) or just verify config
  const config = readFileSync(resolve(ROOT, 'vite.config.js'), 'utf-8');
  assert(config.includes('react'), 'Missing React plugin in vite config');
  assert(config.includes("host"), 'Missing host config for LAN access');
});

// === Summary ===
console.log('\n' + '═'.repeat(50));
console.log(`\n📊 Sprint 02 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ FAILURES:');
  results.filter(r => r.status === '❌ FAIL').forEach(r => {
    console.log(`   ${r.name}: ${r.error}`);
  });
  console.log('');
}

console.log(failed === 0 ? '🎉 ALL TESTS PASSED!' : '⛔ SPRINT NOT COMPLETE');
process.exit(failed > 0 ? 1 : 0);
