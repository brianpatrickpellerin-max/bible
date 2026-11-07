const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html');
const scripts = [...html.matchAll(/src="(lxx(?:-core)?\.[a-f0-9]{12}\.js)"/g)].map(m => m[1]);
assert.equal(scripts.length, 2);
const worker = read(scripts[1]).match(/new Worker\('([^']+)'\)/)[1];
assert.match(worker, /^lxx-worker\.[a-f0-9]{12}\.js$/);
assert.ok(read(worker).includes(`importScripts('${scripts[0]}')`));
for (const name of [...scripts, worker]) {
  const hash = crypto.createHash('sha256').update(read(name)).digest('hex').slice(0, 12);
  assert.ok(name.includes(hash), name);
  assert.ok(read('sw.js').includes(`"${name}"`), name + ' is precached');
}

// Reproduce the installed v25 worker's cache-first, ignoreSearch behaviour.
// New filenames must reach the network even while that old worker controls
// the first visit after an update; a query string alone would stay stale.
const oldWorker = execFileSync('git', ['show', 'f17c5fe:sw.js'], {cwd: root, encoding: 'utf8'});
const handlers = {};
const stale = new Map(['lxx.js', 'lxx-core.js', 'lxx-worker.js'].map(name => ['/bible/' + name, 'stale ' + name]));
const caches = {
  match: async req => stale.get(new URL(typeof req === 'string' ? req : req.url, 'https://test').pathname),
  open: async () => ({put: async () => {}})
};
vm.runInNewContext(oldWorker, {
  self: {addEventListener: (event, handler) => {handlers[event] = handler;}},
  location: {origin: 'https://test'}, URL, caches, setTimeout,
  fetch: async req => ({ok: true, body: 'fresh ' + req.url, clone() {return this;}})
});
async function request(filename) {
  let response;
  handlers.fetch({request: {method: 'GET', mode: 'cors', url: 'https://test/bible/' + filename}, respondWith: p => {response = p;}});
  return response;
}
(async () => {
  assert.equal(await request('lxx.js?v=26'), 'stale lxx.js');
  for (const name of [...scripts, worker]) assert.match((await request(name)).body, /^fresh /);
  console.log('PASS: hashed dependency chain, offline precache and upgrade through the stale v25 worker');
})().catch(e => {console.error(e); process.exitCode = 1;});
