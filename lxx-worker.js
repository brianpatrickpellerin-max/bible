importScripts('lxx-core.js');
const CACHE='bible-lxx-v1';
const PLUS_MANIFEST='data/lxx-plus/manifest.5f24124c1d.json';
  const PACK_MANIFEST='data/lxx/manifest.de6f6944de.json';
let manifest,lex,ready,books=new Map(),latest=0;
async function get(url){
  const c=await caches.open(CACHE);let r=await c.match(url);
  if(!r){r=await fetch(url);if(!r.ok)throw Error('Download failed: '+url);await c.put(url,r.clone());}
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
    const rows=[],forms={},parsing={},bookCounts={};let occurrences=0;
    for(let k=0;k<selected.length;k++){
      const b=selected[k];let d=books.get(b.id);if(!d){d=await get(b.file);books.set(b.id,d);}if(id!==latest)return;
      for(const [ref,tokens] of d.verses){const hit=LXXCore.matches(tokens,q,lex);if(hit){rows.push({book:b.id,ref,text:tokens.map(t=>t[0]).join(' '),hits:hit.length});occurrences+=hit.length;
        if(q.terms.length)for(const i of hit){const t=tokens[i];forms[t[0]]=(forms[t[0]]||0)+1;const p=lex.morphs[t[2]];parsing[p]=(parsing[p]||0)+1;bookCounts[b.id]=(bookCounts[b.id]||0)+1;}}}
      postMessage({type:'progress',id,done:k+1,total:selected.length});
      await new Promise(r=>setTimeout(r,0));if(id!==latest)return;
    }
    postMessage({type:'results',id,rows,occurrences,query:q,forms,parsing,bookCounts});
  }catch(e){if(id===latest)postMessage({type:'error',id,message:String(e.message||e)});}
};
