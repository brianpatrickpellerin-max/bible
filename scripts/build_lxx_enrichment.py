#!/usr/bin/env python3
"""Add word alignment, source-reviewed glosses and supplementary dictionaries.

python scripts/build_lxx_enrichment.py LXX_SOURCE OSHB_SOURCE TIPNR LSJ_DEFS BRENTON_ZIP TBESG
No Hebrew gloss is used as a translation of Greek. Statistical links are
kept distinct from source-reviewed links and from lexical definitions.
"""
import collections, gzip, hashlib, html, json, pathlib, re, subprocess, sys, unicodedata, xml.etree.ElementTree as ET, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE,HEBREW,NAMES,LSJ,BRENTON=map(pathlib.Path,sys.argv[1:6])
TBESG=pathlib.Path(sys.argv[6])
OUT=ROOT/'data/lxx-plus';OUT.mkdir(exist_ok=True)
def read(p):return json.loads(gzip.decompress((ROOT/p).read_bytes()))
def pack(name,obj):
    b=gzip.compress(json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
    p='data/lxx-plus/'+name+'.'+hashlib.sha256(b).hexdigest()[:10]+'.json.gz';(ROOT/p).write_bytes(b);return p,len(b)
def hn(s):return ''.join(re.findall('[א-ת]',s))
def gn(s):return ''.join(c for c in unicodedata.normalize('NFD',s) if not unicodedata.combining(c)).replace('ς','σ')
def nfc(s):return unicodedata.normalize('NFC',s)
def plain(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
manifest=json.loads((ROOT/'data/lxx/manifest.json').read_text());lex=read(manifest['lexicon']);il={}
for f in (ROOT/'data').glob('il*.gz'):il.update(json.loads(gzip.decompress(f.read_bytes())))
books={b['id']:read(b['file']) for b in manifest['books']}
tokens={b:{r:t for r,t in d['verses']} for b,d in books.items()}
mtbook={'genesis':'Gen','exodus':'Exod','leviticus':'Lev','numbers':'Num','deuteronomy':'Deut','joshua':'Josh','judges':'Judg','ruth':'Ruth','1-samuel':'1Sam','2-samuel':'2Sam','1-kings':'1Kgs','2-kings':'2Kgs','1-chronicles':'1Chr','2-chronicles':'2Chr','ezra':'Ezra','nehemiah':'Neh','esther':'Esth','job':'Job','psalms':'Ps','proverbs':'Prov','ecclesiastes':'Eccl','song-of-solomon':'Song','isaiah':'Isa','jeremiah':'Jer','lamentations':'Lam','ezekiel':'Ezek','daniel':'Dan','hosea':'Hos','joel':'Joel','amos':'Amos','obadiah':'Obad','jonah':'Jonah','micah':'Mic','nahum':'Nah','habakkuk':'Hab','zephaniah':'Zeph','haggai':'Hag','zechariah':'Zech','malachi':'Mal'}
def mtref(s):
    b,r=s.rsplit(' ',1);return mtbook[b]+' '+r
def osis(s):
    b,c,v=s.split('.');return b+' '+c+':'+v
vm={v.attrib['wlc']:v.attrib['kjv'] for v in ET.parse(HEBREW/'wlc/VerseMap.xml').findall('.//{*}verse') if v.attrib['type']=='full'}
proof={};proofcounts=collections.Counter()
for file in (HEBREW/'wlc').glob('*.xml'):
    if file.name=='VerseMap.xml':continue
    for v in ET.parse(file).findall('.//{*}verse'):
        if 'osisID' not in v.attrib:continue
        r=osis(vm.get(v.attrib['osisID'],v.attrib['osisID']))
        source=[hn(''.join(w.itertext())) for w in v.findall('{*}w')]
        local=[hn(w[0]) for w in il.get(r,[])]
        if source and source==local:proof[r]=source;proofcounts['exact_source_token_sequences']+=1
        else:proofcounts['source_sequences_not_used']+=1
extra={b:{'links':{},'reviewed':{},'brenton':{}} for b in books};stats=collections.Counter()
# TIPNR name forms, not AI-generated biographical summaries.
greeknames=collections.defaultdict(set)
for line in NAMES.read_text(encoding='utf-8-sig').splitlines():
    x=line.split('\t')
    if len(x)<4 or not x[0].startswith('– ') or 'combined' in x[0].lower():continue
    match=re.search(r'([HG])0*(\d+)[a-zA-Z]*=([^+]+)$',x[2])
    if not match:continue
    name=x[1].split('@')[0].split('|')[0].replace('_',' ')
    if not re.fullmatch(r"[A-Za-z][A-Za-z '\-]*",name):continue
    lang,num,form=match.groups()
    if lang=='G' and re.search('[Α-Ωα-ω]',form):greeknames[gn(form)].add(name)
# Source-reviewed alignment overrides are used only with exact Greek words
# and a Hebrew coordinate sequence verified against OSHB and the local IL.
reviewed={}
for row in json.loads((SOURCE/'db/seeds/mt_alignment/eval_300.json').read_text()):
    b=row['grk_book'];r=mtref(row['ref']);refs=row['grk_refs']
    flat=[(ref,i,t) for ref in refs for i,t in enumerate(tokens[b].get(ref,[]))]
    if r not in proof or len(row['heb'])!=len(proof[r]):continue
    if [t[2][0] for t in flat]!=[w['surface'] for w in row['grk']]:continue
    reviewed[(b,r,tuple(refs))]=row
    for (ref,i,t),gloss in zip(flat,row['grk_glosses']):
        extra[b]['reviewed'].setdefault(ref,{})[str(i)]=gloss
        stats['source_reviewed_gloss_tokens']+=1
with gzip.open(SOURCE/'db/seeds/mt_alignment/word_links.jsonl.gz','rt') as stream:
    for line in stream:
        row=json.loads(line);b=row['grk_book'];r=mtref(row['ref']);refs=row['grk_refs']
        if r not in proof:stats['alignment_records_skipped_token_mismatch']+=1;continue
        flat=[(ref,i,t) for ref in refs for i,t in enumerate(tokens[b].get(ref,[]))]
        if not flat:continue
        audit=reviewed.get((b,r,tuple(refs)))
        links=audit['links'] if audit else row['links']
        accepted=0
        for link in links:
            h,g=link['h'],link['g']
            if not(0<=h<len(proof[r]) and 0<=g<len(flat)):stats['invalid_links_rejected']+=1;continue
            if audit:
                if link.get('conf')!='high':continue
                quality='source-reviewed'
            elif 'stability' in link:
                if link['stability']<.9:continue
                quality=link['stability']
            else:
                # Convention links (article, conjunction, etc.) are explicit.
                quality='rule:'+link.get('rule','unknown')
            ref,i,t=flat[g];hw=il[r][h]
            extra[b]['links'].setdefault(ref,[]).append([i,r,h,quality,hn(hw[0])]);accepted+=1
            stats['word_links']+=1
        if accepted:stats['aligned_passages']+=1
supplement={};lsj=json.loads(LSJ.read_text());lsj={nfc(k):v for k,v in lsj.items()}
# Explicit forms documented in TBESG entries, not a general middle-to-active
# rule. Preserve the source lemma and every sense of the cited entry.
aliases={'ὀστοῦν':'ὀστέον','χειμάρρους':'χείμαρρος','πετεινόν':'πετεινός',
 'διανοέομαι':'διανοέω','σιδηροῦς':'σιδήρεος','ἀργυροῦς':'ἀργύρεος',
 'διαπορεύομαι':'διαπορεύω','κρεμάννυμι':'κρεμάω','προπορεύομαι':'προπορεύω',
 'ἱλαστήριον':'ἱλαστήριος','περιζώννυμαι':'περιζώννυμι','ἀνδρίζομαι':'ἀνδρίζω',
 'ἕνεκεν':'ἕνεκα','ἡττάω':'ἡσσάομαι','σοφίζομαι':'σοφίζω'}
aliases.update({'ἀντίγραφον':'ἀντίγραφος','ἀντιλήμπτωρ':'ἀντιλήπτωρ',
 'κατανύσσομαι':'κατανύσσω','διπλόος':'διπλοῦς','λινοῦς':'λίνεος',
 'ἀντίλημψις':'ἀντίληψις','χαρίζομαι':'χαρίζω','ἅπτομαι':'ἅπτω',
 'ἐπαναπαύομαι':'ἐπαναπαύω','ὑποκρίνομαι':'ὑποκρίνω','δίδραχμον':'δίδραχμος',
 'παραλία':'παράλιος','περίστυλον':'περίστυλος','πολιτεύομαι':'πολιτεύω',
 'δωρέομαι':'δωρέω','ὀρεινή':'ὀρεινός','νῶτος':'νῶτον','θεμέλιον':'θεμέλιος',
 'χνοῦς':'χνόος','ἐγχειρίδιον':'ἐγχειρίδιος','νεομηνία':'νουμηνία',
 'μεσονύκτιον':'μεσονύκτιος','χειρόγραφον':'χειρόγραφος','ὕσσωπον':'ὕσσωπος',
 'ζυγόν':'ζυγός'})
# Individually inspected complete short LSJ definitions; length alone cannot
# distinguish a real meaning (e.g. "ray") from an OCR stub (e.g. "also").
short_complete=set('Κῦρος δυσμενής ἐπικράτεια ἀκτίς συνεθίζω παλαιστής πλάστιγξ κραδαίνω βοήθημα ἐγκαθίημι κατοπτεύω οἰκητήριος προσαπόλλυμι ἀπέχθεια νεανικός κοσμοποιία αὐθέντης δεῖμα ἀξία κάλυψις ὑπορράπτω'.split())
byhead=collections.defaultdict(dict)
if hashlib.sha256(TBESG.read_bytes()).hexdigest()!=manifest['lexicon_sha256']:
    raise ValueError('TBESG input must match the pinned base dictionary revision')
for line in TBESG.read_text(encoding='utf-8-sig').splitlines():
    x=line.split('\t')
    if len(x)<8 or not re.fullmatch(r'G\d+[A-Za-z]*',x[0]):continue
    entry={'id':x[2].strip(),'head':x[3],'gloss':plain(x[6]),'definition':plain(x[7]),'strong':'G'+str(int(re.match(r'G(\d+)',x[0])[1]))}
    byhead[nfc(entry['head'])][entry['id']]=entry
for i,l in enumerate(lex['lemmas']):
    if l['entries']:continue
    head=l['lemma'];entries=[]
    ns=greeknames.get(gn(head),set())
    # Passage alignment cannot establish a dictionary name identity.
    if head in aliases:
        target=aliases[head];found=list(byhead[nfc(target)].values())
        if not found:raise ValueError('Missing explicit TBESG alias target: '+target)
        entries=[dict(e,source='STEPBible TBESG; explicit headword equivalent '+target) for e in found]
        stats['tbesg_alias_lemmas_added']+=1
    elif ns:
        label=' / '.join(sorted(ns))
        entries=[{'id':'name:'+str(i),'head':head,'gloss':label,'definition':'Biblical name equivalent: '+label+'. This identifies spelling equivalents, not the etymological meaning of the name.','strong':'','source':'STEPBible TIPNR'}]
        stats['name_lemmas_added']+=1
    else:
        definition=lsj.get(nfc(head),'')
        # Exact case-sensitive headwords only. A bare cross-reference or OCR
        # stub is not promoted to an English meaning. Never use an unaccented
        # proper name to select an unrelated classical common-word sense.
        if definition and (len(definition)>8 or head in short_complete) and not re.match(r'^(Att\.|Dor\.|Ep\.|Aeol\.|Ion\.|cf\.|v\.|=|etc\b|heterocl\.|contr\.)',definition):
            entries=[{'id':'LSJ9:'+head,'head':head,'gloss':definition,'definition':definition,'strong':'','source':'LSJ9 / Francisco Riordan, CC BY 4.0'}];stats['lsj_lemmas_added']+=1
    if entries:
        gloss=' / '.join(e['gloss'] for e in entries)
        supplement[str(i)]={'entries':entries,'gloss':gloss,'short':gloss if len(gloss)<=72 else gloss[:69].rsplit(' ',1)[0]+'…'}
# Public-domain Brenton is a separately identified companion edition, never
# used to replace or fabricate a contextual gloss for a Rahlfs word.
brenton={};sourcebooks={}
with zipfile.ZipFile(BRENTON) as z:
    for filename in z.namelist():
        if not filename.lower().endswith(('.usfm','.sfm')):continue
        s=z.read(filename).decode('utf-8-sig');bid=re.search(r'\\id\s+(\S+)',s)
        if not bid:continue
        bid=bid[1];verses={};chapter=None
        current=None;raw={}
        for line in s.splitlines():
            c=re.match(r'\\c\s+(\d+)',line)
            if c:chapter=c[1];current=None;continue
            v=re.match(r'\\v\s+(\d+[a-z]*(?:-\d+[a-z]*)?)\s+(.*)',line)
            if v and chapter:
                current=chapter+':'+v[1];raw[current]=v[2];continue
            if current and line and not re.match(r'\\(?:s[1-5]?|ms[1-3]?|r|d|sp|cl|cd|qa|rem)\s',line):raw[current]+=' '+line
        for ref,value in raw.items():
            value=re.sub(r'\\([fx])\s.*?\\\1\*','',value,flags=re.S)
            value=re.sub(r'\\w\s+([^|]+)\|.*?\\w\*',r'\1',value)
            value=re.sub(r'\\[a-z][a-z0-9]*\*?','',value);value=plain(value)
            if value:verses[ref]=value
        if verses:brenton[bid]=verses
brids={'genesis':'GEN','exodus':'EXO','leviticus':'LEV','numbers':'NUM','deuteronomy':'DEU','joshua-vaticanus-b':'JOS','judges':'JDG','ruth':'RUT','1-samuel':'1SA','2-samuel':'2SA','1-kings':'1KI','2-kings':'2KI','1-chronicles':'1CH','2-chronicles':'2CH','2-esdras':'EZR','1-esdras':'1ES','esther-greek':'ESG','judith':'JDT','tobit':'TOB','1-maccabees':'1MA','2-maccabees':'2MA','3-maccabees':'3MA','4-maccabees':'4MA','psalms-lxx':'PSA','proverbs':'PRO','ecclesiastes':'ECC','song-of-solomon':'SNG','job-lxx':'JOB','wisdom':'WIS','sirach':'SIR','hosea':'HOS','amos':'AMO','micah':'MIC','joel':'JOL','obadiah':'OBA','jonah':'JON','nahum':'NAM','habakkuk':'HAB','zephaniah':'ZEP','haggai':'HAG','zechariah':'ZEC','malachi':'MAL','isaiah':'ISA','jeremiah-lxx':'JER','baruch':'BAR','lamentations':'LAM','letter-of-jeremiah':'LJE','ezekiel':'EZK','daniel-theodotion':'DAG','susanna-theodotion':'SUS','bel-and-the-dragon-theodotion':'BEL'}
for b,bid in brids.items():
    extra[b]['brenton']=brenton.get(bid,{})
    sourcebooks[b]=bid
stats['brenton_books']=sum(bool(d['brenton']) for d in extra.values());stats['brenton_verse_records']=sum(len(d['brenton']) for d in extra.values())
files={};total=0
for b,obj in extra.items():
    if not any(obj.values()):continue
    p,n=pack(b,obj);files[b]=p;total+=n
sp,n=pack('dictionary',supplement);total+=n
missing=collections.Counter()
for b,rows in tokens.items():
    for ref,ws in rows.items():
        for t in ws:
            if not lex['lemmas'][t[1]]['entries'] and str(t[1]) not in supplement:missing[lex['lemmas'][t[1]]['lemma']]+=1
stats['remaining_unmatched_word_records']=sum(missing.values());stats['remaining_unmatched_lemmas']=len(missing)
report={'counts':dict(stats),'hebrew_sequence_checks':dict(proofcounts),'remaining_lemmas':dict(missing.most_common()),'sources':{'morphology_revision':manifest['commit'],'hebrew_revision':subprocess.check_output(['git','-C',str(HEBREW),'rev-parse','HEAD'],text=True).strip(),'proper_names_sha256':hashlib.sha256(NAMES.read_bytes()).hexdigest(),'lsj_sha256':hashlib.sha256(LSJ.read_bytes()).hexdigest(),'brenton_archive_sha256':hashlib.sha256(BRENTON.read_bytes()).hexdigest()},'notes':['Word links require exact Hebrew token-sequence equality after OSHB verse-number conversion. Runtime also verifies linked Hebrew letters.','Statistical links retain stability >= 0.9; this is alignment reproducibility, not a probability of correctness. Convention-rule and source-reviewed links are labelled separately.','Name equivalents are not etymological meanings. LSJ supplement requires an exact case-sensitive headword.','Brenton is a companion edition in its own reference system, not a word-by-word translation of Rahlfs.','Source-reviewed English word glosses cover the accepted subset of the upstream 300-verse evaluation dataset. They are not extrapolated to unreviewed passages.']}
coverage_raw=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
(OUT/'coverage.json').write_text(coverage_raw)
coverage_path='data/lxx-plus/coverage.'+hashlib.sha256(coverage_raw.encode()).hexdigest()[:10]+'.json'
(ROOT/coverage_path).write_text(coverage_raw)
meta={'version':1,'base_lexicon':manifest['lexicon'],'dictionary':sp,'coverage':coverage_path,'books':files,'bytes':total,'counts':dict(stats),'brenton_ids':sourcebooks}
raw=json.dumps(meta,ensure_ascii=False,indent=2)+'\n';mp='data/lxx-plus/manifest.'+hashlib.sha256(raw.encode()).hexdigest()[:10]+'.json';(ROOT/mp).write_text(raw);(OUT/'manifest.json').write_text(raw)
for f in ['lxx.js','lxx-worker.js']:
    p=ROOT/f;s=p.read_text();s=re.sub(r"const PLUS_MANIFEST='[^']*';",f"const PLUS_MANIFEST='{mp}';",s);p.write_text(s)
print(json.dumps({'counts':dict(stats),'proof':dict(proofcounts),'compressed_bytes':total,'manifest':mp},indent=2))
