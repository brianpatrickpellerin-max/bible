"""Validate the shipped corpus and, optionally, its pinned source conversion."""
import gzip, hashlib, json, pathlib, re, sys
root=pathlib.Path(__file__).resolve().parents[1]
def read(p):return json.loads(gzip.decompress((root/p).read_bytes()))
m=json.loads((root/'data/lxx/manifest.json').read_text());lex=read(m['lexicon']);rev=read(m['mapping'])
assert len(m['books'])==59
counts={'tokens':0,'verses':0};indices={}
for b in m['books']:
    d=read(b['file']);refs=[v[0] for v in d['verses']];assert len(refs)==len(set(refs))==b['verses']
    indices[b['id']]=set(refs)
    assert hashlib.sha256((root/b['file']).read_bytes()).hexdigest()[:10] in b['file']
    for ref,tokens in d['verses']:
        assert re.fullmatch(r'\d+:\d+[a-z]*',ref)
        for surface,l,p,c,s in tokens:
            assert surface and 0<=l<len(lex['lemmas']) and 0<=p<len(lex['morphs'])
            assert 0<=c<len(lex['confidence']) and 0<=s<len(lex['sources'])
        counts['tokens']+=len(tokens)
    counts['verses']+=len(refs)
    if len(sys.argv)>1:
        raw=json.loads((pathlib.Path(sys.argv[1])/f"db/seeds/lxx_morph/{b['id']}.json").read_text())
        original={v['ref'].rsplit(' ',1)[-1]:v['words'] for v in raw}
        assert set(original)==set(refs)
        for ref,tokens in d['verses']:
            assert [t[0] for t in tokens]==[w['surface'] for w in original[ref]]
            assert [lex['lemmas'][t[1]]['lemma'] for t in tokens]==[w.get('lemma') or w['surface'] for w in original[ref]]
assert counts==m['counts'],(counts,m['counts'])
for pairs in rev.values():
    for b,r in pairs:assert r in indices[b],(b,r)
assert ['psalms-lxx','22:1'] in rev['Ps 23:1']
assert ['jeremiah-lxx','38:36'] in rev['Jer 31:35']
print('PASS:',len(m['books']),'texts;',counts,'; source spelling/order/lemmas retained; mappings resolve.')
