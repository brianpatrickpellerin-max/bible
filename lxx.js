/* Optional Septuagint layer: native references, independent tokens and caches. */
window.createLXX=function(api){
  'use strict';
  const C=LXXCore,$=id=>document.getElementById(id),esc=api.esc,CACHE='bible-lxx-v1';
  const PLUS_MANIFEST='data/lxx-plus/manifest.5f24124c1d.json';
  const ENGLISH_MANIFEST='data/lxx-english/manifest.b85095c8b1.json';
  let englishManifest=null;
  const PACK_MANIFEST='data/lxx/manifest.de6f6944de.json';
  let active=false,mode='interlinear',manifest=null,plus=null,lex=null,reverse=null,pending=null,worker=null,seq=0,operation=0,current=null,lastResults=null,downloadBusy=false;
  const loaded=new Map(),waits=new Map();
  let gapResults=null;
  let scope='ot',bookFilter='',accents=false;
  try{active=localStorage.getItem('bl_lxx')==='1'&&(!location.hash||location.hash.startsWith('#lxx/'));mode=localStorage.getItem('bl_lxx_mode')||mode;}catch(e){}
  function save(){try{localStorage.setItem('bl_lxx',active?'1':'0');localStorage.setItem('bl_lxx_mode',mode);}catch(e){}badge();}
  function badge(){let el=$('lxxbadge');if(!el){el=document.createElement('div');el.id='lxxbadge';el.className='sub';el.style.cssText='text-align:center;margin:8px auto 0;font-size:calc(var(--fs)*.68)';$('top').appendChild(el);}
    el.innerHTML=`<a href="#" data-lxx-action="${active?'menu':'enter'}">${active?'Greek Old Testament · '+(mode==='greek'?'Greek text':mode==='contextual'?'Source English':'Interlinear'):'Greek Old Testament'}</a>`;}
  async function get(url){
    let c=null,r=null;try{c=await caches.open(CACHE);r=await c.match(url);}catch(e){}
    if(!r){r=await fetch(url);if(!r.ok)throw Error('Could not download the Greek data. Connect and try again.');if(c)await c.put(url,r.clone());}
    const bytes=new Uint8Array(await r.arrayBuffer());
    const text=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }
  function ready(){return pending||(pending=(async()=>{
    manifest=await get(PACK_MANIFEST);lex=await get(manifest.lexicon);plus=await get(PLUS_MANIFEST);
    if(plus.base_lexicon!==manifest.lexicon)throw Error('Greek dictionary versions do not match. Reload while online.');
    C.supplement(lex,await get(plus.dictionary));englishManifest=await get(ENGLISH_MANIFEST).catch(()=>({books:{},unavailable:true}));return manifest;
  })().catch(e=>{pending=null;throw e;}));}
  function book(id){return manifest.books.find(b=>b.id===id);}
  async function data(id){if(loaded.has(id))return loaded.get(id);const b=book(id);if(!b)throw Error('Unknown Greek book.');const d=await get(b.file);d.extra=plus.books[id]?await get(plus.books[id]):{links:{},reviewed:{},brenton:{}};d.byref=new Map(d.verses.map(v=>[v[0],v[1]]));
    const en=englishManifest.books[id];if(en&&en.base_file===b.file){d.english=await get(en.file).catch(()=>null);if(d.english&&d.english.base_file!==b.file)throw Error('English source and Greek text versions differ.');}
    loaded.set(id,d);return d;}
  const key=(b,r)=>b+' '+r;
  function split(k){const m=String(k||'').match(/^(.*) (\d+:\d+[a-z]*)$/);return m?{book:m[1],ref:m[2]}:current;}
  function name(b,r){return book(b).name+' '+r;}
  function activate(){active=true;save();}
  function deactivate(){active=false;current=null;operation++;seq++;save();}
  function state(t,ref){api.setView({t,ref,lxx:true});}
  function push(s,url,replace){history[replace?'replaceState':'pushState']({lxx:s},'',url);}
  function busy(text){state('busy');$('out').innerHTML=`<div class="msg">${esc(text||'Opening Greek Old Testament…')}</div>`;}
  function fail(e){state('none');$('out').innerHTML=`<div class="msg">${esc(e.message||String(e))}</div><a class="link" data-lxx-action="menu">Greek Old Testament options</a>`;}
  const run=fn=>Promise.resolve().then(fn).catch(fail);
  function text(tokens){return tokens.map(t=>t[0]).join(' ');}
  function refLink(b,r,label){return `<a class="li" href="#lxx/${b}/${encodeURIComponent(r)}" data-lxx-book="${esc(b)}" data-lxx-ref="${esc(r)}"><span class="t">${esc(label||name(b,r))}</span></a>`;}
  function words(tokens,interlinear,reviewed){return `<div class="${interlinear?'il':'vt'} lxxwords" dir="ltr">`+tokens.map((t,i)=>`<span class="w" data-lxx-word="${i}"><span class="o">${esc(t[0])}</span>${interlinear?`<span class="g">${esc(reviewed&&reviewed[i]||lex.lemmas[t[1]].short||lex.lemmas[t[1]].gloss||'—')}</span>`:''}</span>`).join(' ')+`</div>`;}
  async function show(k,noPush){
    const id=++operation,p=split(k);if(!p)return;activate();api.closeSheet();busy();await ready();const d=await data(p.book);if(id!==operation)return;
    const tokens=d.byref.get(p.ref);if(!tokens)throw Error('That reference is not present in this Greek text. Use Books to choose its native chapter.');
    const reviewed=d.extra.reviewed[p.ref],candidate=d.english&&d.english.verses[p.ref];
    const english=candidate&&candidate.length===tokens.length&&candidate.every((x,i)=>C.surfaceKey(x[0])===C.surfaceKey(tokens[i][0]))?candidate:null;
    current={...p,tokens,reviewed,english,englishSource:d.english};state('verse',key(p.book,p.ref));
    if(!noPush)push(p,'#lxx/'+p.book+'/'+encodeURIComponent(p.ref));
    $('q').value=name(p.book,p.ref);
    const glosses=mode==='contextual'?(english?Object.fromEntries(english.map((x,i)=>[i,x[1]])):null):reviewed;
    let h=`<div class="verse lxxverse">${words(tokens,mode!=='greek',glosses)}<div class="vref" data-lxx-action="chapter">${esc(name(p.book,p.ref))}</div><div class="vtr">Septuagint · Rahlfs 1935</div>`;
    if(mode==='contextual')h+=english?`<div class="note">English interlinear · Oleksii Vynokurov · dictionary fallback for blank source glosses</div><a class="link" href="${esc(d.english.source_url)}#page=${english[0][2]}" target="_blank" rel="noopener">English source PDF · page ${english[0][2]}</a>`:'<div class="note">No matching source English is supplied for this verse. Dictionary glosses are shown.</div>';
    else if(mode!=='greek')h+=`<div class="note">${reviewed?'Source-reviewed word glosses; dictionary fallback where absent':'Dictionary glosses'} · Greek word order</div>`;
    if(book(p.book).partial)h+='<div class="note">Variant passages supplied by the source; this is not a separate complete Joshua text.</div>';
    h+=`<a class="link" data-lxx-action="compare">Compare Hebrew / English</a><a class="link" data-lxx-action="brenton">Brenton English Septuagint</a><div id="lxxcomparison"></div><div id="lxxbrenton"></div></div>`;
    h+=`<div class="seg"><a class="it" data-lxx-action="prev">Previous</a><a class="it" data-lxx-action="menu">Options</a><a class="it" data-lxx-action="next">Next</a></div>`;
    $('out').innerHTML=h;scrollTo(0,0);
  }
  async function chapter(k,noPush){
    const id=++operation,p=split(k);if(!p)return;activate();api.closeSheet();busy();await ready();const d=await data(p.book);if(id!==operation)return;
    const ch=p.ref.split(':')[0],rows=d.verses.filter(v=>v[0].split(':')[0]===ch);if(!rows.length)throw Error('This chapter is not present in this Greek text.');
    current={book:p.book,ref:rows[0][0]};state('chapter',key(p.book,rows[0][0]));
    if(!noPush)push({...current,chapter:true},'#lxx/'+p.book+'/'+encodeURIComponent(rows[0][0])+'/chapter');
    $('out').innerHTML=`<div class="chap"><h2>${esc(book(p.book).name+' '+ch)}</h2>`+rows.map(([r,t])=>`<p data-lxx-book="${p.book}" data-lxx-ref="${r}"><sup>${esc(r.split(':')[1])}</sup>${esc(text(t))}</p>`).join('')+'<div class="sub" style="margin-top:28px">Septuagint · Rahlfs 1935 · tap a verse for word study</div></div><div class="seg"><a class="it" data-lxx-action="chapter-prev">Previous chapter</a><a class="it" data-lxx-action="chapter-next">Next chapter</a></div>';scrollTo(0,0);
  }
  async function moveChapter(direction){
    if(!current)return;const b=book(current.book),ch=current.ref.split(':')[0],i=b.chapters.indexOf(ch),next=b.chapters[i+direction];
    if(next!==undefined)return chapter(key(b.id,next+':1'));
    const nb=manifest.books[manifest.books.indexOf(b)+direction];if(nb)return chapter(key(nb.id,direction>0?nb.first:nb.last));
  }
  function step(k,d){const p=split(k);const b=p&&loaded.get(p.book);if(!b)return null;const i=b.verses.findIndex(v=>v[0]===p.ref),v=b.verses[i+d];if(v)return key(p.book,v[0]);const bi=manifest.books.findIndex(b=>b.id===p.book),next=manifest.books[bi+d];return next?key(next.id,d>0?next.first:next.last):null;}
  async function move(d){if(!current)return;const next=step(key(current.book,current.ref),d);if(next)await show(next);}
  async function books(){api.closeSheet();await ready();activate();api.openSheet('<div class="st">Greek Old Testament · Rahlfs 1935</div><div class="grid bk">'+manifest.books.map(b=>`<a class="it" data-lxx-choose="${b.id}">${esc(b.name)}</a>`).join('')+'</div>','books');}
  async function chapters(id){await ready();const b=book(id);api.openSheet(`<div class="st">${esc(b.name)}</div><div class="grid">`+b.chapters.map(c=>`<a class="it" data-lxx-chapter="${id}" data-lxx-ch="${c}">${c==='0'?'Prologue':c}</a>`).join('')+'</div>','chapters');}
  async function fromMT(ref){
    await ready();if(!reverse)reverse=await get(manifest.mapping);const pairs=reverse[ref]||[];
    if(!pairs.length){api.openSheet(`<div class="st">${esc(api.refName(ref))}</div><div class="row">No Greek counterpart is listed in the source mapping.</div><a class="it" data-lxx-action="books">Browse Greek books</a>`,'lxxmapping');return;}
    if(pairs.length===1)return show(key(...pairs[0]));
    api.openSheet(`<div class="st">Greek counterparts of ${esc(api.refName(ref))}</div>`+pairs.map(([b,r])=>refLink(b,r)).join(''),'lxxmapping');
  }
  async function select(newMode,ref){
    mode=newMode||mode;save();if(active&&current)return show(key(current.book,current.ref));
    if(ref)return fromMT(ref);activate();api.home();badge();
  }
  function mt(ref){deactivate();api.closeSheet();$('q').value=api.refName(ref);api.show(ref);}
  async function compare(){
    if(!current)return;const p={...current},id=operation;const d=await data(p.book),m=d.mapping[p.ref];const box=$('lxxcomparison');if(!box)return;
    if(!m||!m.refs.length){box.innerHTML='<div class="note">No Hebrew counterpart is listed for this Greek passage.</div>';return;}
    box.innerHTML='<div class="note">Opening corresponding passages…</div>';await api.waitFor('il').catch(()=>{});if(id!==operation)return;
    box.innerHTML=m.refs.map(r=>{const a=api.mtText(r);return `<div class="cmpv">${a.original?`<div class="vt" dir="rtl">${esc(a.original)}</div>`:''}<div class="vt">${esc(a.text||'No text available for this reference.')}</div><a class="vref" data-lxx-mt="${esc(r)}">${esc(api.refName(r))}</a><div class="vtr">${esc(a.name)}</div></div>`;}).join('')+`<div class="note">Verse correspondence from the source mapping${m.flag?' · '+esc(m.flag.replace(/-/g,' ')):''}. This does not establish individual word equivalence.</div>`;
  }
  async function brenton(){
    if(!current)return;api.closeSheet();const p={...current},id=operation,d=await data(p.book);if(id!==operation)return;
    const box=$('lxxbrenton');if(!box)return;const value=d.extra.brenton[p.ref];
    box.innerHTML=`<div class="cmpv"><div class="vtr">Brenton English Septuagint (1851) · ${esc(name(p.book,p.ref))}</div><div class="vt">${esc(value||'No Brenton verse with this reference is supplied for this text.')}</div><div class="note">Companion edition with its own wording and verse divisions. The same reference does not guarantee an exact correspondence with Rahlfs. This is not a word-by-word gloss.</div></div>`;
  }
  function menu(){
    api.openSheet('<div class="st">Greek Old Testament</div>'+[['interlinear','Greek with word glosses'],['contextual','Greek with source English'],['greek','Greek text']].map(([k,l])=>`<a class="it${mode===k?' on':''}" data-lxx-mode="${k}">${l}</a>`).join('')+
      '<a class="it" data-lxx-action="english-sources">Source English coverage</a>'+(current?'<a class="it" data-lxx-action="chapter">Open chapter</a><a class="it" data-lxx-action="compare">Compare Hebrew / English</a><a class="it" data-lxx-action="brenton">Brenton English Septuagint</a><a class="it" data-lxx-action="copy">Copy Greek verse</a><a class="it" data-lxx-action="image">Share as image</a>':'')+
      '<div class="gap"></div><a class="it" data-lxx-action="books">Books</a><a class="it" data-lxx-action="settings">Search and display settings</a><a class="it" data-lxx-action="download">Download complete Greek pack</a><a class="it" data-lxx-action="gaps">Unresolved dictionary words</a><a class="it" data-lxx-action="sources">Sources and coverage</a><a class="it" data-lxx-action="leave">Hebrew / English translations</a>','tr');
  }
  async function settings(){await ready();api.openSheet('<div class="st">Text size</div><div class="seg"><a class="it" data-lxx-size="-2">Smaller</a><a class="it" data-lxx-size="2">Larger</a></div><div class="st">Search in</div>'+[['ot','Greek Old Testament'],['both','Greek Old and New Testaments'],['nt','Greek New Testament']].map(([k,l])=>`<a class="it${scope===k?' on':''}" data-lxx-scope="${k}">${l}</a>`).join('')+
    `<label class="it">One Greek OT book <select id="lxxbookfilter" aria-label="Greek book search filter"><option value="">All Greek OT texts</option>${manifest.books.map(b=>`<option value="${b.id}"${b.id===bookFilter?' selected':''}>${esc(b.name)}</option>`).join('')}</select></label>`+
    `<a class="it" data-lxx-action="accents">Exact accents: ${accents?'on':'off'}</a><div class="note">Search Greek spelling or a quoted phrase. Use lemma:λόγος or G3056 for a dictionary word. Combine pos:verb morph:aor morph:ind for grammar in the Greek OT. Plain English searches dictionary glosses.</div><a class="it" data-lxx-action="menu">Back</a>`,'set');
    $('lxxbookfilter').onchange=e=>{bookFilter=e.target.value;};
  }
  function getWorker(){if(worker)return worker;worker=new Worker('lxx-worker.js');worker.onmessage=e=>{
    const m=e.data;if(m.id!==seq)return;if(m.type==='progress'){const el=$('lxxprogress');if(el)el.textContent=`Searching ${m.done} of ${m.total} Greek OT texts…`;return;}
    const w=waits.get(m.id);if(!w)return;waits.delete(m.id);m.type==='error'?w.reject(Error(m.message)):w.resolve(m);
  };worker.onerror=()=>{for(const w of waits.values())w.reject(Error('Greek search could not start. Reload the page and try again.'));waits.clear();worker.terminate();worker=null;};return worker;}
  async function ntSearch(q){
    await api.waitFor('il');const rows=[],byCode=new Map();
    lex.lemmas.forEach(l=>l.entries.forEach(e=>{const code=C.strong(e.strong);if(!code)return;if(!byCode.has(code))byCode.set(code,new Set());byCode.get(code).add(C.normal(l.lemma));}));
    const greek=/[\u0370-\u03ff\u1f00-\u1fff]/;
    for(const [r,t] of Object.entries(api.data.il)){
      if(!t.length||!greek.test(t[0][0]))continue;let hits=0;
      for(const w of t){const code=C.strong(w[4]||''),lemmas=byCode.get(code)||new Set();
        if(q.terms.every(([k,v])=>k==='strong'?code===C.strong(v):k==='lemma'?lemmas.has(C.normal(v)):false))hits++;}
      if(q.terms.length&&!hits)continue;
      const raw=t.map(w=>q.greek?w[0]:(w[1]||'')).join(' '),stream=C.words(raw,q.accents);
      if(q.words.length){if(q.phrase){let yes=false;for(let i=0;i<=stream.length-q.words.length;i++)if(q.words.every((w,j)=>stream[i+j]===w)){yes=true;break;}if(!yes)continue;}else if(!q.words.every(w=>stream.includes(w)))continue;}
      rows.push({mt:r,text:t.map(w=>w[0]).join(' '),hits:q.terms.length?hits:0});
    }
    return rows;
  }
  async function search(query,noPush,study){
    const id=++operation;current=null;activate();api.closeSheet();busy('Searching Greek Scripture…');await ready();if(id!==operation)return;
    const q=C.query(query,accents);if(!q.words.length&&!q.terms.length)throw Error('Type a Greek word, an English gloss or a dictionary search.');
    $('q').value=query;
    if(!noPush)push({query,study:!!study},'#lxx/search/'+encodeURIComponent(query));
    $('out').innerHTML='<div class="msg" id="lxxprogress">Preparing Greek search…</div>';
    const searchScope=study?'both':scope,appliedBook=study?'':bookFilter,ntPromise=searchScope!=='ot'?ntSearch(q):Promise.resolve([]);
    let result={rows:[],occurrences:0};
    if(searchScope!=='nt'){
      for(const old of waits.values())old.resolve({cancelled:true});waits.clear();
      const n=++seq;result=await new Promise((resolve,reject)=>{waits.set(n,{resolve,reject});getWorker().postMessage({type:'search',id:n,query,book:appliedBook,accents,english:mode==='contextual',englishManifest:ENGLISH_MANIFEST});});
    }
    const nt=await ntPromise;if(id!==operation||result.cancelled)return;
    state('phrase');lastResults={query,rows:result.rows.concat(nt),shown:0};
    const n=result.rows.length,ntn=nt.length;
    let header=`<div class="study"><div class="big">${esc(query)}</div><div class="stat">${n} Greek OT verses${searchScope!=='ot'?' · '+ntn+' Greek NT verses':''}</div>`;
    if(mode==='contextual'&&q.words.length&&!q.greek)header+='<div class="note">Greek OT English search covers imported source English only. Passages without matching source English are excluded. Choose Greek with word glosses to search dictionary meanings.</div>';
    if(q.terms.length&&searchScope!=='nt')header+=`<div class="sub">${result.occurrences} matching Greek OT words · alternate texts counted separately</div>`;
    if(q.terms.length&&result.forms){
      const details=(label,entries)=>'<details class="note"><summary>'+label+'</summary>'+entries.map(([w,n])=>`<div class="row">${esc(w)} · ${n}</div>`).join('')+'</details>';
      header+=details('Spelling forms',Object.entries(result.forms).sort((a,b)=>b[1]-a[1]));
      header+=details('Grammatical forms',Object.entries(result.parsing).sort((a,b)=>b[1]-a[1]).map(([p,n])=>[expandParsing(p),n]));
      header+=details('Occurrences by book',Object.entries(result.bookCounts).map(([b,n])=>[book(b).name,n]));
    }
    if(appliedBook)header+=`<div class="sub">Greek OT filter: ${esc(book(appliedBook).name)}</div>`;
    if(q.terms.some(t=>t[0]==='morph'||t[0]==='pos')&&searchScope!=='ot')header+='<div class="note">Grammar filters apply to Greek OT data; Greek NT grammar search is not available here.</div>';
    header+='<a class="link" data-lxx-action="settings">Search settings</a></div>';
    $('out').innerHTML=header+'<div id="lxxresults"></div><a class="link" id="lxxmore" data-lxx-action="more">More results</a>';
    more();scrollTo(0,0);
  }
  function more(){if(!lastResults)return;const r=lastResults,rows=r.rows.slice(r.shown,r.shown+50);r.shown+=rows.length;
    $('lxxresults').insertAdjacentHTML('beforeend',rows.map(x=>x.mt?`<a class="li" data-lxx-mt="${esc(x.mt)}"><span class="t">${esc(x.text)}</span><span class="r">${esc(api.refName(x.mt))} · Greek NT</span></a>`:`<a class="li" data-lxx-book="${x.book}" data-lxx-ref="${esc(x.ref)}"><span class="t">${esc(x.text)}</span><span class="r">${esc(name(x.book,x.ref))} · Greek OT</span></a>`).join(''));
    $('lxxmore').style.display=r.shown<r.rows.length?'block':'none';if(!r.rows.length)$('lxxresults').innerHTML='<div class="msg">No matching Greek verses.</div>';
  }
  async function gaps(noPush){
    const id=++operation;current=null;activate();api.closeSheet();busy('Opening dictionary coverage…');
    await ready();const report=await get(plus.coverage);if(id!==operation)return;
    state('phrase');if(!noPush)push({gaps:true},'#lxx/gaps');$('q').value='';
    gapResults={rows:Object.entries(report.remaining_lemmas).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),shown:0};
    $('out').innerHTML=`<div class="study"><div class="big">Unresolved Greek words</div><div class="stat">${report.counts.remaining_unmatched_lemmas.toLocaleString()} lemmas · ${report.counts.remaining_unmatched_word_records.toLocaleString()} word records</div><div class="note">No dictionary entry has been matched for these source lemmas. Tap a word to examine its Scripture occurrences. Counts include alternate texts separately. A missing match does not mean the Greek word has no known meaning.</div></div><div id="lxxgaps"></div><a class="link" id="lxxgapsmore" data-lxx-action="gaps-more">More words</a>`;
    moreGaps();scrollTo(0,0);
  }
  function moreGaps(){
    if(!gapResults||!$('lxxgaps'))return;const r=gapResults,rows=r.rows.slice(r.shown,r.shown+100);r.shown+=rows.length;
    $('lxxgaps').insertAdjacentHTML('beforeend',rows.map(([lemma,n])=>`<a class="li" data-lxx-lemma="${esc(lemma)}"><span class="t">${esc(lemma)}</span><span class="r">${n.toLocaleString()} word records</span></a>`).join(''));
    $('lxxgapsmore').style.display=r.shown<r.rows.length?'block':'none';
  }
  function expandParsing(s){const dict={fem:'feminine',masc:'masculine',neut:'neuter',nom:'nominative',gen:'genitive',dat:'dative',acc:'accusative',voc:'vocative',sg:'singular',pl:'plural',du:'dual',pres:'present',aor:'aorist',imperf:'imperfect',perf:'perfect',plup:'pluperfect',fut:'future',ind:'indicative',subj:'subjunctive',opt:'optative',imperat:'imperative',inf:'infinitive',part:'participle',act:'active',mid:'middle',pass:'passive'};return s.replace(/\b\w+\b/g,x=>dict[x]||x);}
  function quality(q){return typeof q==='number'?'Automated link · stability '+q.toFixed(4):q==='source-reviewed'?'Source-reviewed link':'Convention rule · '+q.replace(/^rule:/,'');}
  function validLink(link){const w=(api.data.il[link[1]]||[])[link[2]];return w&&C.hebrew(w[0])===link[4]?w:null;}
  async function word(i){const p=current,t=p&&p.tokens&&p.tokens[i];if(!t)return;const id=operation,l=lex.lemmas[t[1]];
    const d=await data(p.book),links=(d.extra.links[p.ref]||[]).filter(x=>x[0]===i);
    if(links.length)await api.waitFor('il');if(id!==operation)return;
    const counterparts=links.map(x=>{const w=validLink(x);return w?`<div class="row"><span dir="rtl">${esc(w[0])}</span> · ${esc(w[1]||'—')}<div class="sub">${esc(quality(x[3]))}</div><a data-lxx-mt="${esc(x[1])}">${esc(api.refName(x[1]))}</a></div>`:'';}).join('');
    api.openSheet(`<div class="wd"><div class="o">${esc(t[0])}</div><div class="lbl">Dictionary word</div><div class="row">${esc(l.lemma)}</div>`+
      (p.reviewed&&p.reviewed[i]?`<div class="lbl">Source-reviewed word gloss</div><div class="row">${esc(p.reviewed[i])}</div>`:'')+
      (p.english?`<div class="lbl">English interlinear · Oleksii Vynokurov</div><div class="row">${esc(p.english[i][1]||'The source leaves this word without an English gloss.')}</div><a class="link" href="${esc(p.englishSource.source_url)}#page=${p.english[i][2]}" target="_blank" rel="noopener">Source PDF · page ${p.english[i][2]}</a>`:'')+
      `<div class="lbl">Dictionary glosses</div><div class="row">${esc(l.gloss||'No dictionary entry matched. No meaning has been supplied.')}</div><div class="lbl">Parsing</div><div class="row">${esc(expandParsing(lex.morphs[t[2]])||'Not supplied')}</div><div class="sub">Source analysis · ${esc(lex.confidence[t[3]])} confidence · ${esc(lex.sources[t[4]].replace(/_/g,' '))}</div>`+
      l.entries.map(e=>`<div class="lbl">${esc(e.id)} · ${esc(e.head)}</div><div class="row">${esc(e.definition)}</div>`+(e.source?`<div class="sub">${esc(e.source)}</div>`:'')).join('')+
      `<div class="lbl">Hebrew counterparts</div>${counterparts||'<div class="row">No usable word link is supplied. This alone does not establish an omission.</div>'}<div class="note">Hebrew glosses describe the Hebrew words. Automated stability measures reproducibility, not correctness. A word link does not make two words interchangeable.</div></div>`+`<a class="it" data-lxx-lemma="${esc(l.lemma)}">Every occurrence of this dictionary word · Greek OT and NT</a><a class="it" data-lxx-spelling="${esc(t[0])}">Same spelling</a>`,'word');
  }
  async function hebrewLinks(ref,index){
    const id=operation;api.closeSheet();await ready();await api.waitFor('il');if(!reverse)reverse=await get(manifest.mapping);
    const rows=[];for(const [b,r] of reverse[ref]||[]){const d=await data(b);for(const x of d.extra.links[r]||[]){
      if(x[1]!==ref||x[2]!==index||!validLink(x))continue;
      const t=(d.byref.get(r)||[])[x[0]];if(t)rows.push(refLink(b,r,t[0]+' · '+name(b,r))+`<div class="sub">${esc(quality(x[3]))}</div>`);
    }}
    if(id!==operation)return;api.openSheet(`<div class="st">Greek counterparts · ${esc(api.refName(ref))}</div>`+rows.join('')+(rows.length?'':'<div class="row">No usable word link is supplied for this Hebrew word.</div>')+'<div class="note">Source word links, including automated alignments. A word link does not establish identical meaning.</div>','lxxlinks');
  }
  async function sources(){await ready();api.openSheet(`<div class="st">Greek Old Testament · Rahlfs 1935</div><div class="row">${manifest.books.length} text files · ${manifest.counts.verses.toLocaleString()} verse records · ${manifest.counts.tokens.toLocaleString()} word records. Alternative texts have separate identities.</div><div class="row">Greek transcription and morphology: Seth Kushniryk / Open Scriptorium, derived from the Eliran Wong digital edition. Morphology includes automated and reviewed analysis; confidence is retained on every word.</div><a class="it" href="https://github.com/OpenScriptorium/lxx-morph" target="_blank" rel="noopener">Morphology source</a><div class="row">Dictionary: STEPBible TBESG, based on work at Tyndale House Cambridge. Glosses describe dictionary words; they are not verified contextual translations. Missing entries remain blank.</div><a class="it" href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener">Dictionary and mapping sources</a><div class="row">Verse mapping and word links: Open Scriptorium, incorporating STEPBible TVTMS. Word links retain their automated stability, convention-rule or source-reviewed status. Hebrew token positions were checked against Open Scriptures Hebrew Bible and this website.</div><div class="row">Additional dictionary headwords: STEPBible TIPNR name equivalents and LSJ9 / Francisco Riordan, CC BY 4.0. Name equivalents are not etymological meanings. Brenton English Septuagint (1851), public domain, is a companion edition.</div><div class="row">Enrichment: ${plus.counts.word_links.toLocaleString()} word links · ${plus.counts.source_reviewed_gloss_tokens.toLocaleString()} source-reviewed word glosses · ${plus.counts.remaining_unmatched_word_records.toLocaleString()} word records still lack a matched dictionary entry.</div><a class="it" href="data/lxx-plus/coverage.json" target="_blank">Enrichment coverage and source checks</a><a class="it" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0 · data licence</a><a class="it" href="data/lxx/coverage.json" target="_blank">Coverage and unresolved dictionary entries</a><a class="it" href="LXX-SOURCES.md" target="_blank">Source revisions and conversion details</a>`,'lxxsources');}
  async function englishSources(){await ready();api.openSheet('<div class="st">English interlinear · Oleksii Vynokurov</div><div class="row">Source English is available for matching Greek passages in the books below. Other passages show dictionary glosses. This import checks Greek word sequences and PDF label positions; it does not independently verify every translation.</div>'+Object.entries(englishManifest.books).map(([id,b])=>`<div class="row">${esc(book(id).name)} · ${b.counts.accepted_verses.toLocaleString()} matching verses · ${b.counts.supplied_glosses.toLocaleString()} English glosses</div><a class="it" href="${esc(b.source_url)}" target="_blank" rel="noopener">${esc(book(id).name)} · source PDF</a><a class="it" href="${esc(b.coverage)}" target="_blank">Matching and excluded passages</a>`).join('')+'<div class="note">Square brackets are supplied by the translator. Blank source glosses fall back to the dictionary. Redistribution requires attribution and non-commercial use. The source reserves ML training and evaluation rights.</div><a class="it" href="https://www.bible.in.ua/underl/SUPP/use_en.htm" target="_blank" rel="noopener">Source terms</a>','englishsources');}
  async function download(){
    if(downloadBusy){api.toast('The Greek download is already running');return;}downloadBusy=true;api.closeSheet();
    try{await ready();englishManifest=await get(ENGLISH_MANIFEST);const urls=[PACK_MANIFEST,PLUS_MANIFEST,ENGLISH_MANIFEST,'data/lxx/coverage.json',plus.coverage,manifest.lexicon,plus.dictionary,manifest.mapping,...manifest.books.map(b=>b.file),...Object.values(plus.books),...Object.values(englishManifest.books).flatMap(b=>[b.file,b.coverage])];
      api.openSheet(`<div class="st">Download Greek Old Testament</div><div class="row">${((manifest.bytes+plus.bytes+Object.values(englishManifest.books).reduce((n,b)=>n+b.bytes,0))/1048576).toFixed(1)} MB compressed · Greek texts, dictionaries, word links, source English and Brenton English</div><div id="lxxdownload" class="row">Preparing…</div>`,'lxxdownload');
      const cache=await caches.open(CACHE);let i=0,done=0;
      const task=async()=>{while(i<urls.length){const u=urls[i++];await get(u);done++;const el=$('lxxdownload');if(el)el.textContent=`${done} of ${urls.length} files verified`;}};
      await Promise.all([task(),task()]);for(const u of urls)if(!await cache.match(u))throw Error('The download could not be saved completely. Free some storage and try again.');
      for(const [id,d] of loaded){const b=englishManifest.books[id];if(b&&b.base_file===book(id).file)d.english=await get(b.file);}
      let offlineShell=false;try{const reg=await navigator.serviceWorker.ready;offlineShell=!!(reg.active&&navigator.serviceWorker.controller);}catch(e){}
      const el=$('lxxdownload');if(el)el.textContent=offlineShell?'Greek pack complete. Reopen from your Home Screen and test in airplane mode.':'Greek pack saved. Reload online once to activate offline website support.';
      if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
    }finally{downloadBusy=false;}
  }
  async function copy(){if(!current||!current.tokens)return;const s=text(current.tokens)+'\n'+name(current.book,current.ref)+' · LXX';try{await navigator.clipboard.writeText(s);api.toast('Copied');}catch(e){prompt('Copy this:',s);}}
  async function image(){if(!current||!current.tokens)return;const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#f2f2f2';ctx.textAlign='center';let lines=[],size=62;
    for(;size>=20;size-=2){ctx.font=size+'px sans-serif';lines=[];let line='';for(const w of text(current.tokens).split(' ')){if(line&&ctx.measureText(line+' '+w).width>900){lines.push(line);line=w;}else line+=(line?' ':'')+w;}if(line)lines.push(line);if(lines.length*size*1.5<740)break;}
    let y=150+(740-lines.length*size*1.5)/2;for(const l of lines){ctx.fillText(l,540,y);y+=size*1.5;}ctx.font='30px sans-serif';ctx.fillText(name(current.book,current.ref),540,945);ctx.font='24px sans-serif';ctx.fillText('Septuagint · Rahlfs 1935',540,995);
    const blob=await new Promise(r=>canvas.toBlob(r));if(!blob)throw Error('Could not create verse image.');const f=new File([blob],'septuagint-verse.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]}).catch(()=>{});}else{const url=URL.createObjectURL(blob);api.openSheet('<img id="lxxshare" alt="Greek verse image"><a class="it" id="lxxsave" download="septuagint-verse.png">Save picture</a>','share');$('lxxshare').src=url;$('lxxsave').href=url;setTimeout(()=>URL.revokeObjectURL(url),120000);}
  }
  async function render(q,noPush){
    q=q.replace(/^lxx\s+/i,'').trim();await ready();
    const m=q.match(/^(.+?)\s+(\d+)(?::(\d+[a-z]*))?$/i);
    if(m){const wanted=C.normal(m[1]);const matches=manifest.books.filter(b=>[b.id,b.name,b.prefix,...aliases(b.id)].some(n=>C.normal(n)===wanted));const b=matches[0];
      if(b){const ref=m[2]+':'+(m[3]||'1');if(m[3])return show(key(b.id,ref),noPush);return chapter(key(b.id,ref),noPush);}}
    return search(q,noPush);
  }
  function aliases(id){return {'joshua-vaticanus-b':['Joshua','Josh'],'judges':['Judges','Judg'],'esther-greek':['Esther','Esth'],'psalms-lxx':['Psalms','Psalm','Ps'],'job-lxx':['Job'],'jeremiah-lxx':['Jeremiah','Jer'],'daniel':['Daniel','Dan'],'song-of-solomon':['Song of Songs','Song'],'1-samuel':['1Sam'],'2-samuel':['2Sam'],'1-kings':['1Kgs'],'2-kings':['2Kgs'],'1-chronicles':['1Chr'],'2-chronicles':['2Chr']}[id]||[];}
  function restore(){const hash=location.hash.slice(1);if(!hash.startsWith('lxx/'))return false;
    activate();const parts=hash.split('/');if(parts[1]==='gaps')run(()=>gaps(true));else if(parts[1]==='search')run(()=>search(decodeURIComponent(parts.slice(2).join('/')),true,!!(history.state&&history.state.lxx&&history.state.lxx.study)));
    else if(parts[2])run(()=>parts[3]==='chapter'?chapter(key(parts[1],decodeURIComponent(parts[2])),true):show(key(parts[1],decodeURIComponent(parts[2])),true));return true;}
  // Capture extension controls before the original app's gesture/click handlers.
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-lxx-action],[data-lxx-book],[data-lxx-choose],[data-lxx-chapter],[data-lxx-mode],[data-lxx-word],[data-lxx-lemma],[data-lxx-spelling],[data-lxx-mt],[data-lxx-size],[data-lxx-scope]');if(!a)return;
    e.preventDefault();e.stopImmediatePropagation();
    run(async()=>{
      if(a.dataset.lxxBook)return show(key(a.dataset.lxxBook,a.dataset.lxxRef));
      if(a.dataset.lxxChoose)return chapters(a.dataset.lxxChoose);
      if(a.dataset.lxxChapter)return chapter(key(a.dataset.lxxChapter,a.dataset.lxxCh+':1'));
      if(a.dataset.lxxMode){mode=a.dataset.lxxMode;save();api.closeSheet();return current?show(key(current.book,current.ref),true):undefined;}
      if(a.dataset.lxxWord!==undefined)return word(+a.dataset.lxxWord);
      if(a.dataset.lxxLemma)return search('lemma:'+a.dataset.lxxLemma,false,true);
      if(a.dataset.lxxSpelling)return search(a.dataset.lxxSpelling);
      if(a.dataset.lxxMt)return mt(a.dataset.lxxMt);
      if(a.dataset.lxxSize){api.setFs(api.curFs()+ +a.dataset.lxxSize);return;}
      if(a.dataset.lxxScope){scope=a.dataset.lxxScope;return settings();}
      const act=a.dataset.lxxAction;
      if(act==='english-sources')return englishSources();
      if(act==='gaps')return gaps();if(act==='gaps-more')return moreGaps();
      if(act==='enter')return select();if(act==='menu')return menu();if(act==='books')return books();if(act==='settings')return settings();
      if(act==='chapter')return current&&chapter(key(current.book,current.ref));if(act==='compare'){api.closeSheet();return compare();}
      if(act==='brenton')return brenton();if(act==='chapter-prev')return moveChapter(-1);if(act==='chapter-next')return moveChapter(1);
      if(act==='prev')return move(-1);if(act==='next')return move(1);if(act==='more')return more();if(act==='sources')return sources();
      if(act==='download')return download();if(act==='copy')return copy();if(act==='image')return image();if(act==='accents'){accents=!accents;return settings();}
      if(act==='leave'){const p=current;const d=p&&loaded.get(p.book),m=d&&d.mapping[p.ref];deactivate();if(m&&m.refs.length)return mt(m.refs[0]);api.home();api.translations();}
    });
  },true);
  window.addEventListener('popstate',e=>{if(location.hash.startsWith('#lxx/')){e.stopImmediatePropagation();restore();}else{deactivate();}},true);
  badge();
  return {get active(){return active;},get current(){return current;},render:(q,n)=>run(()=>render(q,n)),show:(k,n)=>run(()=>show(k,n)),chapter:(k,n)=>run(()=>chapter(k,n)),books:()=>run(books),chapters:id=>run(()=>chapters(id)),select:(m,r)=>run(()=>select(m,r)),menu,settings:()=>run(settings),step,moveChapter:d=>run(()=>moveChapter(d)),restore,deactivate,hebrewLinks:(r,i)=>run(()=>hebrewLinks(r,i)),fromMT:r=>run(()=>fromMT(r)),study:code=>run(()=>search(code,false,true)),status:()=>({active,loaded:loaded.size,ready:!!manifest,current:current&&{book:current.book,ref:current.ref},results:lastResults&&lastResults.rows.length}),download:()=>run(download)};
};
