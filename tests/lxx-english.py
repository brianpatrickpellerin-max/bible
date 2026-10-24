"""Check every shipped English coordinate against the pinned Greek edition."""
import gzip,hashlib,json,pathlib,re,unicodedata
root=pathlib.Path(__file__).resolve().parents[1]
def load(p):
    raw=(root/p).read_bytes()
    if p.endswith('.gz'):
        assert hashlib.sha256(raw).hexdigest()[:10] in p
        raw=gzip.decompress(raw)
    return json.loads(raw)
def normal(s):return ''.join(c for c in unicodedata.normalize('NFC',s).casefold() if c.isalpha() or unicodedata.combining(c))
m=load('data/lxx-english/manifest.json');base={b['id']:b for b in load('data/lxx/manifest.json')['books']}
for bid,b in m['books'].items():
    assert b['base_file']==base[bid]['file'];d=load(b['file']);greek=dict(load(b['base_file'])['verses']);r=load(b['coverage'])
    assert d['base_file']==b['base_file'] and d['pdf_sha256']==r['pdf_sha256']
    assert not r['pairing_errors'];supplied=blank=0
    for ref,words in d['verses'].items():
        assert ref not in r['rejected']
        assert [normal(x[0]) for x in words]==[normal(x[0]) for x in greek[ref]]
        for surface,gloss,page in words:
            assert isinstance(gloss,str) and 4<=page<=205
            supplied+=bool(gloss);blank+=not bool(gloss)
    assert supplied==b['counts']['supplied_glosses'] and blank==b['counts']['blank_source_glosses']
    assert len(d['verses'])==b['counts']['accepted_verses']
    if bid=='genesis':
        assert d['verses']['1:1'][1][1]=='[the] beginning'
        assert d['verses']['1:1'][3][1]==''  # preserve the omitted source article
        assert '1:31' in d['verses']  # chapter title is not part of this verse
    print('PASS',bid,':',len(d['verses']),'matching verses;',supplied,'English glosses;',blank,'preserved blank labels')
