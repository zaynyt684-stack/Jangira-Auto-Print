(()=>{
  const KEY='jem_print_settings_v1';
  const FLOW='jem_print_flow_v3';
  const $=(s,r=document)=>r.querySelector(s);
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const flow=()=>{try{return JSON.parse(localStorage.getItem(FLOW)||'{}')}catch{return{}}};
  const save=v=>{const n={...load(),...v};localStorage.setItem(KEY,JSON.stringify(n));return n};
  const base=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{try{const url=typeof input==='string'?input:input?.url||'';if(/\/api\/print-requests\/[^/]+\/settings(?:\?|$)/.test(url)&&init.body&&typeof init.body==='string'){const body=JSON.parse(init.body),s=load();body.paperSize=s.paperSize||'A4';body.colorMode='BW';init={...init,body:JSON.stringify(body)}}}catch{}return base(input,init)};
  const fire=el=>el.dispatchEvent(new Event('input',{bubbles:true}));
  const enhance=()=>{
    const form=$('#print-form');if(!form)return;
    if(!form.elements.paperSize){const row=document.createElement('div');row.className='settings-extra-grid';row.innerHTML=`<label>Paper size<select name="paperSize"><option value="A4">A4 — Standard</option><option value="A5">A5 — Small</option><option value="Letter">Letter — US</option></select></label><div class="mode-card"><span class="mode-icon">B/W</span><div><strong>Black &amp; White</strong><small>Brother DCP-L2520D · Mono laser</small></div><span class="mode-lock">Fixed</span></div>`;const actions=form.querySelector('.estimate');form.insertBefore(row,actions||form.firstChild)}
    const s=load(),f=flow(),count=Math.max(1,Number(f.pageCount||1));
    form.elements.paperSize.value=s.paperSize||'A4';
    const pagesInput=form.elements.pages;
    if(pagesInput&&!$('#page-selector')){
      const box=document.createElement('div');box.id='page-selector';box.style.cssText='margin-top:12px;padding:13px;border:1px solid #e5e0d6;border-radius:14px;background:#faf8f3';
      box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><strong style="font-size:12px">Quick page selection</strong><span id="page-selector-count" style="font-size:10px;color:#77736c;font-weight:800">${count} pages detected</span></div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" id="select-all-pages" class="skip-editor">All pages</button><input id="single-page-input" type="number" min="1" max="${count}" placeholder="Page no." style="width:110px;border:1px solid #ddd8ce;border-radius:10px;padding:10px;background:#fff"><button type="button" id="add-single-page" class="button primary" style="padding:10px 13px">Select page</button></div><div id="page-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;max-height:150px;overflow:auto"></div><small style="display:block;margin-top:9px;color:#77736c;line-height:1.45">Select one or more pages. You can also type ranges such as 1-4, 7, 9 below.</small>`;
      const rangeRow=form.querySelector('.range-row');if(rangeRow)rangeRow.insertAdjacentElement('afterend',box);else form.insertBefore(box,form.firstChild);
      const chips=$('#page-chips');
      const renderChips=()=>{chips.innerHTML='';const raw=String(pagesInput.value||'all').trim().toLowerCase();const selected=new Set();if(raw!=='all'){for(const part of raw.split(',')){if(/^\d+$/.test(part))selected.add(+part);else if(/^\d+\s*-\s*\d+$/.test(part)){let[a,b]=part.split('-').map(Number);if(a>b)[a,b]=[b,a];for(let i=a;i<=b&&i<=count;i++)selected.add(i)}}}const limit=Math.min(count,200);for(let i=1;i<=limit;i++){const b=document.createElement('button');b.type='button';b.textContent=i;b.dataset.page=i;b.style.cssText='min-width:34px;height:32px;border:1px solid #ddd8ce;border-radius:8px;background:'+(selected.has(i)?'#151513':'#fff')+';color:'+(selected.has(i)?'#fff':'#333')+';font-size:11px;font-weight:800;cursor:pointer';b.onclick=()=>{let set=new Set(selected);if(set.has(i))set.delete(i);else set.add(i);const nums=[...set].sort((a,b)=>a-b);pagesInput.value=nums.length?nums.join(','):'all';fire(pagesInput);renderChips()};chips.appendChild(b)}if(count>200){const more=document.createElement('span');more.textContent=`Use the page number box for pages 201–${count}.`;more.style.cssText='font-size:10px;color:#77736c;padding:8px';chips.appendChild(more)}};
      $('#select-all-pages').onclick=()=>{pagesInput.value='all';fire(pagesInput);renderChips()};
      $('#add-single-page').onclick=()=>{const n=Number($('#single-page-input').value);if(!Number.isInteger(n)||n<1||n>count)return;const raw=String(pagesInput.value||'all').trim().toLowerCase();let set=new Set();if(raw!=='all'){for(const part of raw.split(',')){if(/^\d+$/.test(part))set.add(+part);else if(/^\d+\s*-\s*\d+$/.test(part)){let[a,b]=part.split('-').map(Number);if(a>b)[a,b]=[b,a];for(let i=a;i<=b;i++)set.add(i)}}}set.add(n);pagesInput.value=[...set].sort((a,b)=>a-b).join(',');fire(pagesInput);renderChips();$('#single-page-input').value=''};
      renderChips();
      pagesInput.addEventListener('input',renderChips);
    }
    const preview=$('#settings-preview');
    const refresh=()=>{const pages=String(form.elements.pages.value||'all').trim();const copies=Math.max(1,Math.min(100,+form.elements.copies.value||1));const paper=form.elements.paperSize.value;const side=form.elements.sides.value==='double'?'Double-sided':'Single-sided';const orientation=form.elements.orientation.value==='landscape'?'Landscape':'Portrait';if(preview)preview.textContent=`${paper} · ${orientation} · ${side} · ${copies} ${copies===1?'copy':'copies'} · ${pages==='all'?'All pages':pages}`;save({paperSize:paper})};
    form.querySelectorAll('input,select').forEach(e=>e.addEventListener('change',refresh));form.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',refresh));refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
