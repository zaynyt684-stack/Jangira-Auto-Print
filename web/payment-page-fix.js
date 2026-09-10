(()=>{
const FLOW='jem_print_flow_v3',PRICE=5;
const load=()=>{try{return JSON.parse(localStorage.getItem(FLOW)||'{}')}catch{return{}}};
const save=p=>localStorage.setItem(FLOW,JSON.stringify({...load(),...p}));
const parse=(value,total)=>{
  const v=String(value||'all').trim().toLowerCase();
  if(!v||v==='all')return total;
  const set=new Set();
  for(const raw of v.split(',')){
    const part=raw.trim();
    if(/^\d+$/.test(part)){
      const n=Number(part); if(n<1||n>total)return null; set.add(n); continue;
    }
    const m=part.match(/^(\d+)\s*-\s*(\d+)$/);
    if(!m)return null;
    let a=Number(m[1]),b=Number(m[2]);
    if(a>b)[a,b]=[b,a];
    if(a<1||b>total)return null;
    for(let i=a;i<=b;i++)set.add(i);
  }
  return set.size||null;
};
const run=()=>{
  const s=load();
  if(!s.orderId)return;
  const total=Math.max(1,Number(s.pageCount)||1);
  const range=String(s.pageText||'all').trim()||'all';
  const selected=parse(range,total);
  if(!selected)return;
  const copies=Math.max(1,Math.min(100,Number(s.copies)||1));
  const amount=selected*copies*PRICE;
  const amountEl=document.querySelector('#payment-amount');
  if(amountEl)amountEl.textContent=`₹${amount.toFixed(2)}`;
  const summary=document.querySelector('#payment-summary');
  const label=range.toLowerCase()==='all'?`All ${selected} pages`:`${range} · ${selected} ${selected===1?'page':'pages'}`;
  if(summary)summary.textContent=`Pages: ${label} · ${copies} ${copies===1?'copy':'copies'}. Amount: ₹${amount.toFixed(2)}.`;
  const upi=document.querySelector('#upi-app-link');
  if(upi){
    const note=`Jangira Print | ${s.fileName||'Document'} | Pages: ${range.toLowerCase()==='all'?'All pages':range} | Copies: ${copies} | ${s.sides==='double'?'Double-sided':'Single-sided'} | ${s.orientation==='landscape'?'Landscape':'Portrait'}`;
    upi.href=`upi://pay?${new URLSearchParams({pa:'barkatkhanhindal6-1@okaxis',pn:'Jangira E-Mitra',tn:note,am:amount.toFixed(2),cu:'INR'})}`;
  }
  save({selectedCount:selected,amount});
};
document.addEventListener('DOMContentLoaded',run);
})();
