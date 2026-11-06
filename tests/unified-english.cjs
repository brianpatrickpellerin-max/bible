const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const C = require('../lxx-core.js');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const manifest = read('data/lxx-english/manifest.unified-draft1.json');
const exodus = manifest.books.exodus;
const draft = read(exodus.file);
const source = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, exodus.base_file))).toString('utf8'));
const greek = new Map(source.verses);

assert.equal(manifest.books.genesis.counts.accepted_verses, 1482);
assert.equal(draft.kind, 'assistant-draft');
assert.equal(draft.status, 'draft-awaiting-further-review');
assert.equal(draft.base_file, exodus.base_file);
assert.equal(Object.keys(draft.verses).length, exodus.counts.accepted_verses);
for (const [ref, words] of Object.entries(draft.verses)) {
  const tokens = greek.get(ref);
  assert.ok(tokens, ref);
  assert.equal(words.length, tokens.length, ref);
  words.forEach((w, i) => {
    assert.equal(C.surfaceKey(w[0]), C.surfaceKey(tokens[i][0]), ref + ' token ' + i);
    assert.ok(w[1], ref + ' token ' + i);
  });
  if (draft.orders[ref]) assert.ok(C.validOrder(draft.orders[ref], words.length), ref);
}
assert.equal(C.validOrder([0, 0], 2), null);
assert.equal(C.validOrder([1, 2], 2), null);

const verse = draft.verses['1:5'];
const order = draft.orders['1:5'];
const sentence = order.map(i => verse[i][1]).join(' ');
assert.ok(sentence.startsWith('And Joseph was in Egypt;'), sentence);
const tokens = verse.map(w => [w[0], 0]);
const lex = {lemmas: [{lemma: '', entries: []}]};
assert.ok(C.matches(tokens, C.query('"and Joseph"', false), lex, verse.map(w => w[1]), order));
assert.equal(C.matches(tokens, C.query('"and Joseph"', false), lex, verse.map(w => w[1])), null);
// An omitted word is not transparent to an exact phrase search.
const gapTokens = [['α', 0], ['β', 0], ['γ', 0]];
assert.equal(C.matches(gapTokens, C.query('"beginning God"', false), lex, ['beginning', '', 'God']), null);
assert.ok(C.matches(gapTokens, C.query('"beginning God"', false), lex, ['beginning', 'God', 'made']));
const imported = read('data/lxx-english/manifest.unified-module1.json');
const combinedExodus = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, imported.books.exodus.file))));
assert.equal(combinedExodus.draft_refs.length, 7);
for (const [ref, words] of Object.entries(draft.verses)) {
  assert.deepEqual(combinedExodus.verses[ref], words, ref);
  assert.deepEqual(combinedExodus.orders[ref], draft.orders[ref], ref);
}
assert.equal(imported.books.exodus.counts.draft_verses, 7);
console.log('PASS: draft source matching, word alignment, display order and phrase search');
