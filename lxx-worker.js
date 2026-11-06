importScripts('lxx-core.js');
const CACHE='bible-lxx-v1';
const PLUS_MANIFEST='data/lxx-plus/manifest.5f24124c1d.json';
  const PACK_MANIFEST='data/lxx/manifest.de6f6944de.json';
let manifest,lex,ready,books=new Map(),englishBooks=new Map(),latest=0;
async function get(url){
  let c=null,r=null;try{if(self.caches){c=await caches.open(CACHE);r=await c.match(url);}}catch(e){}
  if(!r){r=await fetch(url);if(!r.ok)throw Error('Download failed: '+url);if(c)try{await c.put(url,r.clone());}catch(e){}}
  const bytes=new Uint8Array(await r.arrayBuffer());
  const text=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
async function init(){
  manifest=await get(PACK_MANIFEST);lex=await get(manifest.lexicon);
  const plus=await get(PLUS_MANIFEST);
  if(plus.base_lexicon!==manifest.lexicon)throw Error('Greek dictionary versions do not match. Reload while online.');
  LXXCore.supplement(lex,await get(plus.dictionary));
}
onmessage=async e=>{
  const m=e.data;if(m.type!=='search')return;latest=m.id;const id=m.id;
  try{
    await (ready||(ready=init().catch(e=>{ready=null;throw e;})));if(id!==latest)return;
    const q=LXXCore.query(m.query,m.accents);const selected=manifest.books.filter(b=>!m.book||b.id===m.book);
    const sourceEnglish=m.english&&q.words.length&&!q.greek;
    // Obtain the source English even for original-language and dictionary
    // searches so a result can be displayed without a Greek verse line.
    const englishMeta=m.english?await get(m.englishManifest):null;
    const rows=[],forms={},parsing={},bookCounts={};let occurrences=0;
    for(let k=0;k<selected.length;k++){
      if(sourceEnglish&&!englishMeta.books[selected[k].id])continue;
      const b=selected[k];let d=books.get(b.id);if(!d){d=await get(b.file);books.set(b.id,d);}if(id!==latest)return;
      let english=null;const en=englishMeta&&englishMeta.books[b.id];
      if(en&&en.base_file===b.file){english=englishBooks.get(en.file);if(!english){english=await get(en.file);englishBooks.set(en.file,english);}if(english.base_file!==b.file)throw Error('English source and Greek text versions differ.');}
      for(const [ref,tokens] of d.verses){
        const candidate=english&&english.verses[ref];
        const labels=candidate&&candidate.length===tokens.length&&candidate.every((x,i)=>LXXCore.surfaceKey(x[0])===LXXCore.surfaceKey(tokens[i][0]))?candidate:null;
        if(sourceEnglish&&!labels)continue;
        const order=labels&&LXXCore.validOrder((english.orders||{})[ref],tokens.length);
        const hit=LXXCore.matches(tokens,q,lex,sourceEnglish?labels.map(x=>x[1]):null,order);if(hit){const englishWords=labels?labels.map(x=>x[1]||''):[];rows.push({book:b.id,ref,englishWords,displayOrder:order,draft:!!labels&&(english.kind==='assistant-draft'||(english.draft_refs||[]).includes(ref)),english:englishWords.join(' '),hits:hit.length});occurrences+=hit.length;
        if(q.terms.length)for(const i of hit){const t=tokens[i];forms[t[0]]=(forms[t[0]]||0)+1;const p=lex.morphs[t[2]];parsing[p]=(parsing[p]||0)+1;bookCounts[b.id]=(bookCounts[b.id]||0)+1;}}}
      postMessage({type:'progress',id,done:k+1,total:selected.length});
      await new Promise(r=>setTimeout(r,0));if(id!==latest)return;
    }
    postMessage({type:'results',id,rows,occurrences,query:q,forms,parsing,bookCounts});
  }catch(e){if(id===latest)postMessage({type:'error',id,message:String(e.message||e)});}
};
