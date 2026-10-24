#!/usr/bin/env python3
"""Import one explicitly downloaded English interlinear PDF. No site crawling.

Requires PyMuPDF. Usage: build_lxx_pdf_english.py PDF BOOK_ID SOURCE_URL
Text-object pairing is accepted only with matching coordinates and a complete
Greek token-sequence match to the pinned website book. Blank source glosses
remain blank; they are never inferred from neighboring words.
"""
import collections,gzip,hashlib,json,pathlib,re,sys,unicodedata
import fitz
ROOT=pathlib.Path(__file__).resolve().parents[1]
pdf=pathlib.Path(sys.argv[1]);bid=sys.argv[2];url=sys.argv[3]
base=json.loads((ROOT/'data/lxx/manifest.json').read_text())
book=next(b for b in base['books'] if b['id']==bid)
greek=dict(json.loads(gzip.decompress((ROOT/book['file']).read_bytes()))['verses'])
def normal(s):
    return ''.join(c for c in unicodedata.normalize('NFC',s).casefold() if c.isalpha() or unicodedata.combining(c))
def text(span):return ''.join(chr(c[0]) for c in span['chars'])
chapter=None;verse=None;rows={};last=None;errors=[]
for pi,page in enumerate(fitz.open(pdf)):
    spans=page.get_texttrace()
    for si,span in enumerate(spans):
        s=text(span).strip();size=round(span['size'],2);box=span['bbox']
        # Chapter headings emit the Greek title, the English title and then
        # the large chapter number. Do not append that Greek title to the
        # preceding chapter's final verse.
        following=spans[si+1:si+3]
        if size==13 and len(following)==2 and text(following[0]).strip()==book['name'].split(' (')[0] and round(following[1]['size'],2)==16:
            verse=None;last=None;continue
        if size==16 and re.fullmatch(r'\d+',s):chapter=s;verse=None;last=None;continue
        if size==8 and abs(box[0]-56)<.1 and box[1]<790 and re.fullmatch(r'\d+[a-z]*',s) and chapter:
            verse=chapter+':'+s;last=None
            if verse in rows:errors.append(['duplicate-reference',verse,pi+1])
            rows.setdefault(verse,[]);continue
        if size==13 and re.search(r'[\u0370-\u03ff\u1f00-\u1fff]',s) and verse:
            item={'surface':s,'gloss':'','page':pi+1,'box':box,'english_boxes':[]}
            rows[verse].append(item);last=item;continue
        if size==10 and last and box[1]>last['box'][1] and box[1]-last['box'][1]<32:
            # The publisher emits each English label immediately after its
            # Greek word. Require centered placement, not nearest-word guesses.
            center=lambda b:(b[0]+b[2])/2
            if abs(center(box)-center(last['box']))>2:
                errors.append(['off-center-english',verse,pi+1,s]);last=None;continue
            last['gloss']+=(' ' if last['gloss'] else '')+s
            last['english_boxes'].append(box)
        else:last=None
accepted={};rejected={};counts=collections.Counter()
badrefs={e[1] for e in errors}
for ref,items in rows.items():
    expected=greek.get(ref)
    if ref in badrefs:rejected[ref]='PDF pairing ambiguity';continue
    if expected is None:rejected[ref]='Reference absent from website Greek';continue
    if [normal(x['surface']) for x in items]!=[normal(t[0]) for t in expected]:
        rejected[ref]='Greek token-sequence mismatch';continue
    accepted[ref]=[[x['surface'],x['gloss'],x['page']] for x in items]
    counts['accepted_verses']+=1;counts['matched_tokens']+=len(items)
    counts['supplied_glosses']+=sum(bool(x['gloss']) for x in items)
    counts['blank_source_glosses']+=sum(not x['gloss'] for x in items)
if not accepted:raise ValueError('No matching Greek passages; nothing imported')
out=ROOT/'data/lxx-english';out.mkdir(exist_ok=True)
payload={'book':bid,'base_file':book['file'],'source_url':url,
 'author':'Oleksii Vynokurov','terms':'https://www.bible.in.ua/underl/SUPP/use_en.htm',
 'license':'Attributed non-commercial redistribution; no ML training or evaluation',
 'pdf_sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'verses':accepted}
raw=gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
path='data/lxx-english/'+bid+'.'+hashlib.sha256(raw).hexdigest()[:10]+'.json.gz';(ROOT/path).write_bytes(raw)
report={'counts':dict(counts),'rejected':rejected,'pairing_errors':errors,
 'website_verses_without_source':sorted(set(greek)-set(rows)),
 'normalization':'NFC, case folding and punctuation removal only; accents retained',
 'source_url':url,'pdf_sha256':payload['pdf_sha256']}
report_raw=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
rp='data/lxx-english/'+bid+'-coverage.'+hashlib.sha256(report_raw.encode()).hexdigest()[:10]+'.json';(ROOT/rp).write_text(report_raw)
manifest_path=out/'manifest.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'version':1,'books':{}}
manifest['books'][bid]={'file':path,'base_file':book['file'],'coverage':rp,'source_url':url,'bytes':len(raw),'counts':dict(counts)}
mr=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n';mp='data/lxx-english/manifest.'+hashlib.sha256(mr.encode()).hexdigest()[:10]+'.json';(ROOT/mp).write_text(mr);manifest_path.write_text(mr)
p=ROOT/'lxx.js';js=p.read_text();js=re.sub(r"const ENGLISH_MANIFEST='[^']*';",f"const ENGLISH_MANIFEST='{mp}';",js);p.write_text(js)
print(json.dumps({'manifest':mp,'counts':dict(counts),'rejected':len(rejected),'errors':errors[:8]},ensure_ascii=False,indent=2))
