/* Shared search rules. Display spelling is never normalised or rewritten. */
(function(root){
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ς/g,'σ').toLowerCase();
  const words=(s,accents)=> (accents?String(s||'').normalize('NFC').toLowerCase():fold(s)).match(/[\p{L}\p{N}]+/gu)||[];
  const normal=s=>fold(s).replace(/[^\p{L}\p{N}]/gu,'');
  function query(text,accents){
    text=text.trim(); const terms=[];
    text=text.replace(/\b(lemma|strong|morph|pos):(?:"([^"]+)"|(\S+))/giu,(_,kind,a,b)=>{terms.push([kind.toLowerCase(),a||b]);return ' ';});
    const g=text.trim().match(/^(?:root\s*)?(G\d+[a-z]*)$/i);
    if(g){terms.push(['strong',g[1].toUpperCase()]);text='';}
    const quoted=/^["“][\s\S]*["”]$/.test(text.trim());
    return {terms,words:words(text.replace(/["“”]/g,''),accents),greek:/[\u0370-\u03ff\u1f00-\u1fff]/.test(text),phrase:quoted,accents:!!accents};
  }
  const strong=s=>String(s).replace(/^G0*(\d+)/i,(_,n)=>'G'+Number(n)).toUpperCase();
  function matches(tokens,q,lex){
    // Structured filters must apply to the same token, not unrelated words in a verse.
    const hit=[];
    tokens.forEach((t,i)=>{
      const l=lex.lemmas[t[1]]||{lemma:'',entries:[]};
      if(q.terms.every(([k,v])=>k==='lemma'?normal(l.lemma)===normal(v):k==='strong'?l.entries.some(e=>strong(e.strong)===strong(v)||strong(e.id)===strong(v)):k==='pos'?words(lex.morphs[t[2]])[0]===fold(v):words(v).every(x=>words(lex.morphs[t[2]]).includes(x))))hit.push(i);
    });
    if(q.terms.length&&!hit.length)return null;
    if(q.words.length){
      const per=tokens.map(t=>words(q.greek?t[0]:(lex.lemmas[t[1]]||{}).gloss,q.accents));
      const stream=per.flat();
      if(q.phrase){let found=false;for(let i=0;i<=stream.length-q.words.length;i++)if(q.words.every((w,j)=>stream[i+j]===w)){found=true;break;}if(!found)return null;}
      else if(!q.words.every(w=>stream.includes(w)))return null;
      return per.map((a,i)=>q.words.some(w=>a.includes(w))?i:-1).filter(i=>i>=0);
    }
    return hit;
  }
  const api={fold,words,normal,query,strong,matches};root.LXXCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
