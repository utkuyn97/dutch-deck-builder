const AdmZip = require('adm-zip');
const fzstd = require('fzstd');
const Database = require('better-sqlite3');
const fs = require('fs');

const z = new AdmZip('Sa .apkg');
const compressed = z.readFile('collection.anki21b');
const decompressed = fzstd.decompress(new Uint8Array(compressed));
fs.writeFileSync('.tmp.sqlite', Buffer.from(decompressed));

const db = new Database('.tmp.sqlite');

// Get POS distribution
const allNotes = db.prepare('SELECT flds FROM notes').all();
const posCount = {};
allNotes.forEach(row => {
  const f = row.flds.split(String.fromCharCode(31));
  const pos = f[2] || 'unknown';
  posCount[pos] = (posCount[pos] || 0) + 1;
});
console.log('POS Distribution:');
Object.entries(posCount).sort((a, b) => b[1] - a[1]).forEach(([pos, count]) => {
  console.log(`  ${pos}: ${count}`);
});

// Show samples of verb, noun, adj
console.log('\n--- Sample verb ---');
const verbs = allNotes.filter(r => r.flds.split(String.fromCharCode(31))[2] === 'verb').slice(0, 3);
verbs.forEach(r => {
  const f = r.flds.split(String.fromCharCode(31));
  console.log(`  ${f[0]} | ${f[1]} | ${f[2]} | ${f[3]} | ${f[4]}`);
});

console.log('\n--- Sample noun (de) ---');
const nounsDe = allNotes.filter(r => {
  const f = r.flds.split(String.fromCharCode(31));
  return f[2] === 'noun(de)';
}).slice(0, 3);
nounsDe.forEach(r => {
  const f = r.flds.split(String.fromCharCode(31));
  console.log(`  ${f[0]} | ${f[1]} | ${f[2]} | ${f[3]} | ${f[4]}`);
});

console.log('\n--- Sample noun (het) ---');
const nounsHet = allNotes.filter(r => {
  const f = r.flds.split(String.fromCharCode(31));
  return f[2] === 'noun(het)';
}).slice(0, 3);
nounsHet.forEach(r => {
  const f = r.flds.split(String.fromCharCode(31));
  console.log(`  ${f[0]} | ${f[1]} | ${f[2]} | ${f[3]} | ${f[4]}`);
});

console.log('\n--- Sample adj ---');
const adjs = allNotes.filter(r => r.flds.split(String.fromCharCode(31))[2] === 'adj').slice(0, 3);
adjs.forEach(r => {
  const f = r.flds.split(String.fromCharCode(31));
  console.log(`  ${f[0]} | ${f[1]} | ${f[2]} | ${f[3]} | ${f[4]}`);
});

console.log('\nTotal:', allNotes.length);

db.close();
fs.unlinkSync('.tmp.sqlite');
