#!/usr/bin/env python3
"""Build the optional LXX pack from pinned, attributed CC BY sources.

Usage: python scripts/build_lxx.py /path/to/lxx-morph /path/to/TBESG.txt
Input morphology: OpenScriptorium/lxx-morph (or its SourceHut mirror).
Dictionary glosses are lexical aids, not a context-sensitive translation.
"""
import collections, gzip, hashlib, html, json, pathlib, re, subprocess, sys, unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE, LEX = map(pathlib.Path, sys.argv[1:])
OUT = ROOT / 'data/lxx'
OUT.mkdir(parents=True, exist_ok=True)
def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if not unicodedata.combining(c)).replace('ς','σ').strip()
def plain(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', s))).strip()
def write(name, data):
    raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()
    gz=gzip.compress(raw,mtime=0)
    path=f'data/lxx/{name}.{hashlib.sha256(gz).hexdigest()[:10]}.json.gz'
    (ROOT/path).write_bytes(gz)
    return path,len(gz)
lexrows=[]; exact=collections.defaultdict(list); folded=collections.defaultdict(list)
for line in LEX.read_text(encoding='utf-8-sig').splitlines():
    x=line.split('\t')
    if len(x)<8 or not re.fullmatch(r'G\d+[A-Za-z]*',x[0]): continue
    row={'id':x[2].strip(),'head':x[3],'gloss':plain(x[6]),'definition':plain(x[7]),'strong':'G'+str(int(re.match(r'G(\d+)',x[0])[1]))}
    n=len(lexrows);lexrows.append(row)
    for head in re.split(r',\s*|\s+/\s+',x[3]):
        exact[unicodedata.normalize('NFC',head)].append(n);folded[norm(head)].append(n)
lemmas=[]; lemmaids={}; morphs=[]; mids={}; confs=[]; sources=[]
# Explicit dictionary-headword equivalents, checked against the cited TBESG
# entries. Do not generalise -ομαι to -ω (e.g. δέομαι and δέω are distinct).
aliases={'πορεύομαι':'πορεύω','ἐντέλλομαι':'ἐντέλλω','ἀπόλλυμι':'ἀπολλύω',
         'φοβέομαι':'φοβέω','ἀποκρίνομαι':'ἀποκρίνω','ἐκπορεύομαι':'ἐκπορεύω',
         'εἰσπορεύομαι':'εἰσπορεύω','ἐμπίπλημι':'ἐμπίμπλημι','δείκνυμι':'δεικνύω',
         'ἐπιλανθάνομαι':'ἐπιλανθάνω','ἀμφότεροι':'ἀμφότερος',
         'χρυσοῦς':'χρύσεος','χαλκοῦς':'χάλκεος'}
def pool(a,v):
    if v not in a:a.append(v)
    return a.index(v)
def lemma(s):
    if s in lemmaids:return lemmaids[s]
    lookup=aliases.get(s,s)
    ids=exact.get(unicodedata.normalize('NFC',lookup)) or folded.get(norm(lookup)) or []
    ids=list(dict.fromkeys(ids))
    entries=[lexrows[i] for i in ids]
    # Keep all candidates; never silently choose a homograph's meaning.
    rec={'lemma':s,'entries':entries,'gloss':' / '.join(dict.fromkeys(e['gloss'] for e in entries if e['gloss']))}
    glosses=list(dict.fromkeys(e['gloss'] for e in entries if e['gloss']))
    headings=list(dict.fromkeys(g.split(':',1)[0].strip() for g in glosses))
    # A shared dictionary heading is compact enough for the interlinear;
    # every disambiguated entry remains available in the word sheet.
    rec['short']=headings[0] if len(headings)==1 else rec['gloss']
    if lookup!=s:rec['matched_headword']=lookup
    lemmaids[s]=len(lemmas);lemmas.append(rec);return len(lemmas)-1
order='genesis exodus leviticus numbers deuteronomy joshua-vaticanus-b joshua judges judges-vaticanus-b ruth 1-samuel 2-samuel 1-kings 2-kings 1-chronicles 2-chronicles 1-esdras 2-esdras esther-greek judith tobit tobit-sinaiticus 1-maccabees 2-maccabees 3-maccabees 4-maccabees psalms-lxx odes proverbs ecclesiastes song-of-solomon job-lxx wisdom sirach psalms-of-solomon hosea amos micah joel obadiah jonah nahum habakkuk zephaniah haggai zechariah malachi isaiah jeremiah-lxx baruch lamentations letter-of-jeremiah ezekiel daniel daniel-theodotion susanna susanna-theodotion bel-and-the-dragon bel-and-the-dragon-theodotion'.split()
names={'joshua-vaticanus-b':'Joshua (B)','joshua':'Joshua (A variant passages)','judges':'Judges (A)','judges-vaticanus-b':'Judges (B)','psalms-lxx':'Psalms','job-lxx':'Job','jeremiah-lxx':'Jeremiah','esther-greek':'Esther (Greek)','tobit-sinaiticus':'Tobit (Sinaiticus)','daniel':'Daniel (Old Greek)','daniel-theodotion':'Daniel (Theodotion)','susanna-theodotion':'Susanna (Theodotion)','bel-and-the-dragon-theodotion':'Bel and the Dragon (Theodotion)'}
mtbook={'genesis':'Gen','exodus':'Exod','leviticus':'Lev','numbers':'Num','deuteronomy':'Deut','joshua':'Josh','judges':'Judg','ruth':'Ruth','1-samuel':'1Sam','2-samuel':'2Sam','1-kings':'1Kgs','2-kings':'2Kgs','1-chronicles':'1Chr','2-chronicles':'2Chr','ezra':'Ezra','nehemiah':'Neh','esther':'Esth','job':'Job','psalms':'Ps','proverbs':'Prov','ecclesiastes':'Eccl','song-of-solomon':'Song','isaiah':'Isa','jeremiah':'Jer','lamentations':'Lam','ezekiel':'Ezek','daniel':'Dan','hosea':'Hos','joel':'Joel','amos':'Amos','obadiah':'Obad','jonah':'Jonah','micah':'Mic','nahum':'Nah','habakkuk':'Hab','zephaniah':'Zeph','haggai':'Hag','zechariah':'Zech','malachi':'Mal'}
maps=collections.defaultdict(dict)
for line in (SOURCE/'db/seeds/mt_alignment/verse_pairs.jsonl').read_text().splitlines():
    x=json.loads(line); prefix=mtbook.get(x.get('mt_book'))
    maps[x['grk_book']][x['grk_ref']]={'refs':[prefix+' '+r for r in x['mt_refs']] if prefix else [],'method':x['method'],**({'flag':x['flag']} if 'flag' in x else {})}
books=[]; totals=collections.Counter(); unresolved=collections.Counter();confidence=collections.Counter()
for slug in order:
    data=json.loads((SOURCE/f'db/seeds/lxx_morph/{slug}.json').read_text());verses=[];seen=set()
    for v in data:
        ref=v['ref'].rsplit(' ',1)[-1]
        assert re.fullmatch(r'\d+:\d+[a-z]*',ref),(slug,ref)
        assert ref not in seen,(slug,ref);seen.add(ref);tokens=[]
        for w in v['words']:
            surface=w['surface'];le=w.get('lemma') or surface;li=lemma(le)
            mo=((w.get('pos') or '')+' '+(w.get('parsing') or '')).strip()
            if mo not in mids:mids[mo]=len(morphs);morphs.append(mo)
            conf=w.get('confidence') or 'unknown';confidence[conf]+=1
            tokens.append([surface,li,mids[mo],pool(confs,conf),pool(sources,w.get('source') or 'unknown')])
            if not lemmas[li]['entries']:unresolved[le]+=1
        verses.append([ref,tokens]);totals['tokens']+=len(tokens)
    def key(v):
        c,n=re.match(r'(\d+):(\d+)',v[0]).groups();suffix=re.sub(r'^\d+:\d+','',v[0]);return int(c),int(n),suffix
    verses.sort(key=key);chapters=list(dict.fromkeys(v[0].split(':')[0] for v in verses))
    path,size=write(slug,{'verses':verses,'mapping':maps[slug]})
    books.append({'id':slug,'name':names.get(slug,slug.replace('-',' ').title()),'prefix':data[0]['ref'].rsplit(' ',1)[0],'file':path,'bytes':size,'verses':len(verses),'tokens':sum(len(v[1]) for v in verses),'chapters':chapters,'first':verses[0][0],'last':verses[-1][0], 'partial':slug=='joshua'})
    totals['verses']+=len(verses)
lexfile,lexsize=write('lexicon',{'lemmas':lemmas,'morphs':morphs,'confidence':confs,'sources':sources})
rev={}
for b in books:
    for ref,m in maps[b['id']].items():
        for r in m['refs']:rev.setdefault(r,[]).append([b['id'],ref])
mapfile,mapsize=write('mapping',rev)
commit=subprocess.check_output(['git','-C',str(SOURCE),'rev-parse','HEAD'],text=True).strip()
manifest={'version':1,'edition':'Rahlfs 1935','source':'https://github.com/OpenScriptorium/lxx-morph','commit':commit,'license':'CC BY 4.0','lexicon':lexfile,'mapping':mapfile,'books':books,'bytes':sum(b['bytes'] for b in books)+lexsize+mapsize,'counts':dict(totals),'lexicon_sha256':hashlib.sha256(LEX.read_bytes()).hexdigest()}
manifest_text=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'
(OUT/'manifest.json').write_text(manifest_text)
manifest_path='data/lxx/manifest.'+hashlib.sha256(manifest_text.encode()).hexdigest()[:10]+'.json'
(ROOT/manifest_path).write_text(manifest_text)
for filename in ['lxx.js','lxx-worker.js']:
    file=ROOT/filename
    if file.exists():file.write_text(re.sub(r"const PACK_MANIFEST='[^']+';",f"const PACK_MANIFEST='{manifest_path}';",file.read_text()))
keep={lexfile,mapfile,manifest_path,*(b['file'] for b in books)}
for file in OUT.iterdir():
    rel=str(file.relative_to(ROOT))
    if (file.name.endswith('.json.gz') or re.fullmatch(r'manifest\.[a-f0-9]+\.json',file.name)) and rel not in keep:file.unlink()
report={'source_commit':commit,'text_files':len(books),**dict(totals),'dictionary_lemmas':len(lemmas),'tokens_without_dictionary_entry':sum(unresolved.values()),'lemmas_without_dictionary_entry':len(unresolved),'confidence':dict(confidence),'compressed_bytes':manifest['bytes'],'unresolved_lemmas':dict(unresolved.most_common()),'notes':['All 59 final source text files included; .auto intermediate files excluded.','Joshua A contains variant passages only in upstream; it is labelled accordingly.','Glosses are dictionary aids, not a verified inflected or contextual translation.','Verse mappings are upstream mappings; no word alignment is inferred.','Alternative texts have separate identifiers; counts include them.']}
(OUT/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='unresolved_lemmas'},ensure_ascii=False,indent=2))
