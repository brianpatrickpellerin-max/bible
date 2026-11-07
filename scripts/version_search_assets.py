"""Give search scripts content-based URLs, including their worker dependencies.

Run after editing lxx-core.js, lxx-worker.js or lxx.js. Older service workers
ignore query strings, so only a new filename reliably bypasses their cache.
"""
import hashlib
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]


def asset(stem, text):
    filename = f'{stem}.{hashlib.sha256(text.encode()).hexdigest()[:12]}.js'
    for previous in root.glob(f'{stem}.*.js'):
        if re.fullmatch(rf'{re.escape(stem)}\.[a-f0-9]{{12}}\.js', previous.name):
            previous.unlink()
    (root / filename).write_text(text)
    return filename


core = asset('lxx-core', (root / 'lxx-core.js').read_text())
worker = asset('lxx-worker', (root / 'lxx-worker.js').read_text().replace("importScripts('lxx-core.js')", f"importScripts('{core}')"))
app = asset('lxx', (root / 'lxx.js').read_text().replace("new Worker('lxx-worker.js')", f"new Worker('{worker}')"))
for filename in ['index.html', 'sw.js']:
    text = (root / filename).read_text()
    for stem, versioned in [('lxx-core', core), ('lxx-worker', worker), ('lxx', app)]:
        text = re.sub(rf'(?<=[\"\']){stem}(?:\.[a-f0-9]{{12}})?\.js(?=[\"\'])', versioned, text)
    (root / filename).write_text(text)
print('Versioned search assets:', core, worker, app)
