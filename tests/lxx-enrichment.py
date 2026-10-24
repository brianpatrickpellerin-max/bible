"""Validate shipped coordinates, provenance, counts and English extraction."""
import collections,gzip,hashlib,json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
def load(p):
    b=(root/p).read_bytes()
    if p.endswith('.gz'):
        assert hashlib.sha256(b).hexdigest()[:10] in p,p
        b=gzip.decompress(b)
    return json.loads(b)
base=load('data/lxx/manifest.json');m=load('data/lxx-plus/manifest.json')
assert m['base_lexicon']==base['lexicon']
lex=load(base['lexicon']);supp=load(m['dictionary']);il={}
for f in (root/'data').glob('il*.gz'):il.update(json.loads(gzip.decompress(f.read_bytes())))
hn=lambda s:''.join(re.findall('[א-ת]',s))
total=0;glosses=0;qualities=collections.Counter();brenton=0
for b in base['books']:
    if b['id'] not in m['books']:continue
    source=dict(load(b['file'])['verses']);d=load(m['books'][b['id']])
    for r,links in d['links'].items():
        for i,mt,h,q,letters in links:
            assert 0<=i<len(source[r]);assert hn(il[mt][h][0])==letters
            assert isinstance(q,(str,float,int))
            if isinstance(q,(float,int)):assert .9<=q<=1
            else:assert q=='source-reviewed' or q.startswith('rule:')
            qualities['statistical' if isinstance(q,(float,int)) else q]+=1;total+=1
    for r,words in d['reviewed'].items():
        for i,g in words.items():assert 0<=int(i)<len(source[r]) and isinstance(g,str);glosses+=1
    for r,t in d['brenton'].items():
        assert '\\' not in t,(b['id'],r,t)
        assert t.strip();brenton+=1
    if b['id']=='genesis':assert d['brenton']['1:1']=='In the beginning God made the heaven and the earth.'
for i,l in supp.items():
    assert not lex['lemmas'][int(i)]['entries']
    assert all(e['source'] and e['definition'] for e in l['entries'])
assert total==m['counts']['word_links'];assert glosses==m['counts']['source_reviewed_gloss_tokens']
by_lemma={l['lemma']:i for i,l in enumerate(lex['lemmas'])}
assert supp[str(by_lemma['ὀστοῦν'])]['entries'][0]['strong']=='G3747'
assert supp[str(by_lemma['κρεμάννυμι'])]['entries'][0]['strong']=='G2910'
assert m['counts']['tbesg_alias_lemmas_added']==40
assert supp[str(by_lemma['Κῦρος'])]['gloss']=='Cyrus'
assert str(by_lemma['φύλαξ']) not in supp  # "also" is not a definition
assert load(m['coverage'])['counts']==m['counts']
print('PASS:',total,'validated word links;',glosses,'source glosses;',len(supp),'supplemental headwords;',brenton,'companion verses.',dict(qualities))
