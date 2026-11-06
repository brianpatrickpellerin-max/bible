"""Check imported word coordinates, coverage, hashes and draft provenance."""
import gzip
import hashlib
import json
from pathlib import Path
import unicodedata

root = Path(__file__).resolve().parents[1]

def load(path):
    raw = (root / path).read_bytes()
    if path.endswith('.gz'):
        assert hashlib.sha256(raw).hexdigest()[:10] in path, path
        raw = gzip.decompress(raw)
    return json.loads(raw)

def key(value):
    value = unicodedata.normalize('NFC', value).lower().replace('ς', 'σ')
    return ''.join(c for c in value if unicodedata.category(c)[0] in 'LM')

manifest = load('data/lxx-english/manifest.unified-module1.json')
report = load('data/lxx-english/coverage.module.json')
base = {book['id']: book for book in load('data/lxx/manifest.de6f6944de.json')['books']}
totals = {'verses': 0, 'words': 0, 'blank': 0, 'incomplete': 0, 'drafts': 0}

for name, entry in manifest['books'].items():
    english = load(entry['file'])
    assert english['base_file'] == entry['base_file'] == base[name]['file']
    greek = dict(load(entry['base_file'])['verses'])
    refs = english['verses']
    assert len(refs) == entry['counts']['accepted_verses']
    assert entry['counts'] == report['books'][name]
    draft_refs = english.get('draft_refs', [])
    assert len(draft_refs) == len(set(draft_refs)) == entry['counts']['draft_verses']
    assert set(draft_refs) <= set(refs)
    assert set(english.get('orders', {})) <= set(draft_refs)
    word_count = blank_count = 0
    for ref, words in refs.items():
        assert ref in greek, (name, ref)
        assert [key(w[0]) for w in words] == [key(w[0]) for w in greek[ref]], (name, ref)
        assert all(len(w) == 3 and isinstance(w[1], str) for w in words), (name, ref)
        if ref in english.get('orders', {}):
            assert sorted(english['orders'][ref]) == list(range(len(words)))
        missing = sum(not w[1] for w in words)
        word_count += len(words)
        blank_count += missing
        totals['incomplete'] += bool(missing)
    assert word_count == entry['counts']['matched_tokens']
    assert blank_count == entry['counts']['blank_source_glosses']
    assert word_count - blank_count == entry['counts']['supplied_glosses']
    totals['verses'] += len(refs)
    totals['words'] += word_count
    totals['blank'] += blank_count
    totals['drafts'] += len(draft_refs)

assert len(manifest['books']) == 53
assert totals['verses'] == report['totals']['accepted_verses'] == 26707
assert totals['words'] == report['totals']['matched_tokens']
assert totals['blank'] == report['totals']['blank_source_glosses']
assert totals['drafts'] == report['totals']['draft_verses'] == 7
assert totals['incomplete'] == 5498
print('PASS: 53 Greek texts; matched English word links, blank labels, hashes and drafts', totals)
