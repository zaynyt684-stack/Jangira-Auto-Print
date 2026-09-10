(()=>{
const FLOW='jem_print_flow_v3';
const load=()=>{try{return JSON.parse(localStorage.getItem(FLOW)||'{}')}catch{return{}}};
const selected=(s)=>{const range=String(s.pageText||'all').trim().toLowerCase();const total=Math.max(1,Number(s.pageCount||1));if(!range||range==='all')return total;const set=new Set();for(const part of range.split(',').map(x=>x.trim()).filter(Boolean)){if(/^\d+$/.test(part)){const n=Number(part);if(n>=1&&n<=total)set.add(n)}else{const m=part.match(/^(\d+)\s*-\s*(\d+)$/);if(m){let a=Number(m[1]),b=Number(m[2]);if(a>b)[a,b]=[b,a];for(let i=Math.max(1,a);i<=Math.min(total,b);i++)set.add(i)}}}return set.size||Number(s.selectedCount||total)};
const run=()=>{const s=load();if(!s.orderId)return;const n=selected(s),c=Math.max(1,Number(s.copies||1));const range=String(s.pageText||'all').trim()||'all';const label=range.toLowerCase()==='all'?`All ${n} pages`:`${range} · ${n} page${n===1?'':'s'}`;
 const amount=Number(s.amount??n*c*5);const amountEl=document.querySelector('#payment-amount');if(amountEl&&Number.isFinite(amount))amountEl.textContent=`₹${amount.toFixed(2)}`;
 const paymentSummary=document.querySelector('#payment-summary');if(paymentSummary)paymentSummary.textContent=`Pages: ${label} · ${c} ${c===1?'copy':'copies'}. Amount: ₹${amount.toFixed(2)}.`;
 const summaryPages=document.querySelector('#summary-pages');if(summaryPages)summaryPages.textContent=`${label} · ${c} ${c===1?'copy':'copies'}`;
};
document.addEventListener('DOMContentLoaded',()=>{run();const target=document.querySelector('#summary-pages');if(target&&window.MutationObserver){new MutationObserver(run).observe(target,{childList:true,characterData:true,subtree:true})}});
})();
