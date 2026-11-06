#!/usr/bin/env python3
"""Import only source-English verses matching the site's full Greek sequence.

Input is the publisher's explicitly downloaded MyBible SQLite3 module, not a
scrape. The user's existing Greek corpus determines verse identity and word
positions. A different word, word count, or reference is excluded.
"""
import argparse
import gzip
import hashlib
import html
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
BASE_MANIFEST = ROOT / 'data/lxx/manifest.de6f6944de.json'
OUTPUT = ROOT / 'data/lxx-english'
BOOKS = {
    10:'genesis', 20:'exodus', 30:'leviticus', 40:'numbers',
    50:'deuteronomy', 60:'joshua-vaticanus-b', 70:'judges',
    71:'judges-vaticanus-b', 80:'ruth', 90:'1-samuel', 100:'2-samuel',
    110:'1-kings', 120:'2-kings', 130:'1-chronicles', 140:'2-chronicles',
    165:'1-esdras', 170:'tobit', 171:'tobit-sinaiticus', 180:'judith',
    190:'esther-greek', 220:'job-lxx', 230:'psalms-lxx',
    235:'psalms-of-solomon', 240:'proverbs', 245:'odes', 250:'ecclesiastes',
    260:'song-of-solomon', 270:'wisdom', 280:'sirach', 290:'isaiah',
    300:'jeremiah-lxx', 310:'lamentations', 315:'letter-of-jeremiah',
    320:'baruch', 330:'ezekiel', 340:'daniel-theodotion', 341:'daniel',
    350:'hosea', 360:'joel', 370:'amos', 380:'obadiah', 390:'jonah',
    400:'micah', 410:'nahum', 420:'habakkuk', 430:'zephaniah',
    440:'haggai', 450:'zechariah', 460:'malachi', 462:'1-maccabees',
    464:'2-maccabees', 466:'3-maccabees', 467:'4-maccabees',
}
GREEK = re.compile(r'[\u0370-\u03ff\u1f00-\u1fff\u0300-\u036f]+')
NOTES = re.compile(r'(<n>.*?</n>)', re.I | re.S)
STRONG = re.compile(r'<S>.*?</S>', re.I | re.S)
TAGS = re.compile(r'<[^>]*>')


def key(word):
    word = unicodedata.normalize('NFC', word).lower().replace('ς', 'σ')
    return ''.join(c for c in word if unicodedata.category(c)[0] in 'LM')


def parse_row(markup):
    out = []
    already_labelled = set()
    for part in NOTES.split(markup):
        if part.lower().startswith('<n>'):
            label = html.unescape(TAGS.sub('', part)).strip()
            if not out or len(out)-1 in already_labelled:
                return None
            if GREEK.search(label) or re.search(r'[\u0590-\u05ff]', label):
                return None
            out[-1][1] = label
            already_labelled.add(len(out)-1)
        else:
            clean = html.unescape(TAGS.sub(' ', STRONG.sub(' ', part)))
            for word in GREEK.findall(clean):
                if key(word):
                    out.append([word, ''])
    return out


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('sqlite', type=Path)
    args = parser.parse_args()
    base = json.loads(BASE_MANIFEST.read_text())
    books = {book['id']: book for book in base['books']}
    old_manifest = json.loads((OUTPUT / 'manifest.b85095c8b1.json').read_text())
    old_genesis = json.loads(gzip.decompress(
        (ROOT / old_manifest['books']['genesis']['file']).read_bytes()))
    draft = json.loads((OUTPUT / 'exodus-draft.542b309e63.json').read_text())
    module = sqlite3.connect('file:' + str(args.sqlite.resolve()) + '?mode=ro', uri=True)
    output = {'version': 1, 'source': 'Oleksii Vynokurov, bible.in.ua',
              'source_module_sha256': sha(args.sqlite), 'books': {}}
    report = {'module_sha256': sha(args.sqlite), 'books': {}, 'unmapped_site_books': []}
    for num, book_id in BOOKS.items():
        book = books[book_id]
        greek = json.loads(gzip.decompress((ROOT / book['file']).read_bytes()))
        site_verses = dict(greek['verses'])
        source = {(str(ch)+':'+str(v)): text for ch,v,text in module.execute(
            'SELECT chapter, verse, text FROM verses WHERE book_number=?', (num,))}
        verses = {}
        mismatch = no_ref = 0
        for ref, markup in source.items():
            tokens = site_verses.get(ref)
            if tokens is None:
                no_ref += 1
                continue
            labels = parse_row(markup)
            if (labels is None or len(labels) != len(tokens)
                    or any(key(a[0]) != key(b[0]) for a,b in zip(labels,tokens))):
                mismatch += 1
                continue
            verses[ref] = [[t[0], item[1], None] for t,item in zip(tokens,labels)]
        preserved_pdf = 0
        if book_id == 'genesis':
            for ref, labels in old_genesis['verses'].items():
                tokens = site_verses.get(ref)
                if ref in verses or not tokens or len(labels) != len(tokens):
                    continue
                if all(key(a[0]) == key(b[0]) for a,b in zip(labels,tokens)):
                    verses[ref] = labels
                    preserved_pdf += 1
        draft_refs = []
        orders = {}
        if book_id == 'exodus':
            if draft['base_file'] != book['file']:
                raise ValueError('Exodus draft targets a different Greek edition')
            for ref, labels in draft['verses'].items():
                tokens = site_verses.get(ref)
                order = draft.get('orders', {}).get(ref)
                if (not tokens or len(labels) != len(tokens)
                        or any(not label[1] or key(label[0]) != key(token[0])
                               for label, token in zip(labels, tokens))):
                    raise ValueError('Invalid Exodus draft alignment: ' + ref)
                if order is not None and sorted(order) != list(range(len(tokens))):
                    raise ValueError('Invalid Exodus draft display order: ' + ref)
                verses[ref] = labels
                draft_refs.append(ref)
                if order is not None:
                    orders[ref] = order
        counts = {'site_verses': len(site_verses), 'module_verses': len(source),
                  'accepted_verses': len(verses), 'module_mismatches': mismatch,
                  'module_without_site_reference': no_ref, 'pdf_only_verses': preserved_pdf,
                  'draft_verses': len(draft_refs),
                  'matched_tokens': sum(map(len, verses.values())),
                  'supplied_glosses': sum(bool(w[1]) for a in verses.values() for w in a),
                  'blank_source_glosses': sum(not w[1] for a in verses.values() for w in a)}
        report['books'][book_id] = counts
        if not verses:
            continue
        body = {'version': 1, 'kind': 'vynokurov-module',
                'base_file': book['file'], 'source_url': (
                    'https://www.bible.in.ua/underl/pdf/ENG/OT/Gen.pdf'
                    if preserved_pdf else None),
                'verses': verses, 'draft_refs': draft_refs, 'orders': orders}
        if draft_refs:
            body['draft_sources'] = draft['sources']
        raw = json.dumps(body, ensure_ascii=False, separators=(',',':')).encode('utf8')
        payload = gzip.compress(raw, compresslevel=9, mtime=0)
        filename = book_id + '.module.' + hashlib.sha256(payload).hexdigest()[:10] + '.json.gz'
        (OUTPUT / filename).write_bytes(payload)
        output['books'][book_id] = {'file': 'data/lxx-english/' + filename,
                                    'base_file': book['file'], 'kind': 'vynokurov-module',
                                    'bytes': len(payload), 'counts': counts}
        if preserved_pdf:
            output['books'][book_id]['source_url'] = body['source_url']
            output['books'][book_id]['coverage'] = old_manifest['books']['genesis']['coverage']
    report['unmapped_site_books'] = [x for x in books if x not in BOOKS.values()]
    report['totals'] = {field:sum(v[field] for v in report['books'].values()) for field in
                        ['site_verses','accepted_verses','module_mismatches',
                         'module_without_site_reference','matched_tokens',
                         'supplied_glosses','blank_source_glosses','pdf_only_verses',
                         'draft_verses']}
    (OUTPUT/'coverage.module.json').write_text(json.dumps(report, indent=2)+'\n')
    (OUTPUT/'manifest.unified-module1.json').write_text(json.dumps(output, indent=2)+'\n')
    print(json.dumps({'books':len(output['books']), **report['totals'],
                      'unmapped_site_books':report['unmapped_site_books']}, indent=2))


if __name__ == '__main__':
    main()
