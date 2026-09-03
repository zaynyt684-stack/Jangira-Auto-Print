(()=>{
  const KEY='jem_print_settings_v1';
  const $=(s,r=document)=>r.querySelector(s);
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const save=v=>{const n={...load(),...v};localStorage.setItem(KEY,JSON.stringify(n));return n};
  const base=window.fetch.bind(window);
  window.fetch=async (input,init={})=>{
    try{
      const url=typeof input==='string'?input:input?.url||'';
      if(/\/api\/print-requests\/[^/]+\/settings(?:\?|$)/.test(url)&&init.body&&typeof init.body==='string'){
        const body=JSON.parse(init.body), s=load();
        body.paperSize=s.paperSize||'A4';
        body.colorMode='BW';
        init={...init,body:JSON.stringify(body)};
      }
    }catch{}
    return base(input,init);
  };
  const enhance=()=>{
    const form=$('#print-form');if(!form)return;
    if(!form.elements.paperSize){
      const row=document.createElement('div');row.className='settings-extra-grid';row.innerHTML=`
        <label>Paper size<select name="paperSize"><option value="A4">A4 — Standard</option><option value="A5">A5 — Small</option><option value="Letter">Letter — US</option></select></label>
        <div class="mode-card"><span class="mode-icon">B/W</span><div><strong>Black &amp; White</strong><small>Brother DCP-L2520D · Mono laser</small></div><span class="mode-lock">Fixed</span></div>`;
      const actions=form.querySelector('.estimate');form.insertBefore(row,actions||form.firstChild);
    }
    const s=load();
    form.elements.paperSize.value=s.paperSize||'A4';
    const preview=$('#settings-preview');
    const refresh=()=>{
      const pages=String(form.elements.pages.value||'all').trim();
      const copies=Math.max(1,Math.min(100,+form.elements.copies.value||1));
      const paper=form.elements.paperSize.value;
      const side=form.elements.sides.value==='double'?'Double-sided':'Single-sided';
      const orientation=form.elements.orientation.value==='landscape'?'Landscape':'Portrait';
      if(preview)preview.textContent=`${paper} · ${orientation} · ${side} · ${copies} ${copies===1?'copy':'copies'} · ${pages==='all'?'All pages':pages}`;
      save({paperSize:paper});
    };
    form.querySelectorAll('input,select').forEach(e=>e.addEventListener('change',refresh));
    form.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',refresh));
    refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();