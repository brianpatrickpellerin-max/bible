// index worker: builds the word index, Hebrew/Greek spelling index and root index off the main thread
const DC="bible-data";let POS=null,NTR=0,done=0,ilDone=false,finished=false,lastSnap=-1;const A=new Map(),SNAPS=new Set([1,2,5,8,11,14,17]);
function gunzip(u){const ds=new DecompressionStream("gzip"),w=ds.writable.getWriter();w.write(u).catch(()=>{});w.close().catch(()=>{});return new Response(ds.readable).text();}
async function unpack(u){let txt;if(u[0]===0x1f&&u[1]===0x8b)txt=await gunzip(u);else txt=new TextDecoder().decode(u);return JSON.parse(txt);}
async function getJSON(url){let r=null;try{if(self.caches){const c=await caches.open(DC);r=await c.match(url);}}catch(e){r=null;}
  if(!r){r=await fetch(url);if(!r.ok)throw new Error("HTTP "+r.status);}return unpack(new Uint8Array(await r.arrayBuffer()));}
function merge(a,b){const o=new Int32Array(a.length+b.length);let i=0,j=0,k=0,last=-1;
  while(i<a.length||j<b.length){const v=(j>=b.length||(i<a.length&&a[i]<=b[j]))?a[i++]:b[j++];if(v!==last){o[k++]=v;last=v;}}return o.slice(0,k);}
function addTr(obj){const P=new Map();
  for(const r in obj){const i=POS.get(r);if(i===undefined)continue;const t=obj[r];if(!t)continue;const tk=t.toLowerCase().match(/[a-z']+/g);if(!tk)continue;const seen=new Set();
    for(const w of tk){if(seen.has(w))continue;seen.add(w);let p=P.get(w);if(!p){p=[];P.set(w,p);}p.push(i);}}
  for(const [w,p] of P){const b=Int32Array.from(p).sort();const a=A.get(w);A.set(w,a?merge(a,b):merge(new Int32Array(0),b));}
  done++;if(SNAPS.has(done)&&done<NTR)snap();}
function pack(map,type,extra){const words=[...map.keys()];const off=new Uint32Array(words.length+1);let tot=0;words.forEach((w,k)=>{off[k]=tot;tot+=map.get(w).length;});off[words.length]=tot;
  const post=new Int32Array(tot);words.forEach((w,k)=>post.set(map.get(w),off[k]));postMessage(Object.assign({type,words,off,post},extra||{}),[off.buffer,post.buffer]);}
function snap(){if(lastSnap===done)return;lastSnap=done;pack(A,"index",{ntr:done});}
function norm(s){return s.normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05C7]/g,"").replace(/[־׃׀·,.;:·’'\[\]()]/g,"").replace(/ς/g,"σ").toLowerCase().trim();}
let ILN=0;const O=new Map(),R=new Map();
function addIl(il,parts){
  for(const r in il){const i=POS.get(r);if(i===undefined)continue;for(const x of il[r]){const k=norm(x[0]);let a=O.get(k);if(!a){a=[];O.set(k,a);}if(a[a.length-1]!==i)a.push(i);
    const s=x[4];if(s){let b=R.get(s);if(!b){b=[];R.set(s,b);}if(b[b.length-1]!==i)b.push(i);}}}
  ILN++;if(parts&&ILN<parts)return;
  for(const m of [O,R])for(const [k,a] of m)m.set(k,Int32Array.from(a).sort());
  pack(O,"oindex");pack(R,"rindex");ilDone=true;}
function finish(){if(finished)return;finished=true;snap();postMessage({type:"done"});}
function maybeDone(){if(done>=NTR&&ilDone)finish();}
async function handle(m){
  if(m.cmd==="init"){POS=new Map(m.refs.map((r,i)=>[r,i]));NTR=m.ntr;return;}
  if(m.cmd==="tr"){addTr(await getJSON(m.url));if(done>=NTR){if(ilDone)finish();else snap();}return;}
  if(m.cmd==="il"){addIl(await getJSON(m.url),m.parts);maybeDone();return;}
  if(m.cmd==="finish"){finish();return;}
  if(m.cmd==="all"){const d=await unpack(new Uint8Array(m.bytes));m.bytes=null;POS=new Map(d.refs.map((r,i)=>[r,i]));NTR=d.order.length;
    const order=["KJV","WEB",...d.order.filter(n=>n!=="KJV"&&n!=="WEB")];
    for(const n of order){addTr(d.tr[n]);d.tr[n]=null;}snap();addIl(d.il);d.il=null;finish();}
}
let chain=Promise.resolve();
onmessage=e=>{chain=chain.then(()=>handle(e.data)).catch(err=>postMessage({type:"error",msg:String(err&&err.message||err)}));};
