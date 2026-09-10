(()=>{
  // Manual service switch only. No Windows agent/heartbeat/printer-status dependency.
  const API=(window.JEM_CONFIG&&window.JEM_CONFIG.API_BASE_URL)||'';
  const STATUS_URL=`${API}/api/service-status`;
  let online=false,busy=false,timer=null;
  const isRequestPage=()=>/upload\.html$|settings\.html$|payment\.html$/.test(location.pathname);
  const controls=()=>Array.from(document.querySelectorAll('button, a.button, input[type=file], .dropzone'));
  function ensureOverlay(){
    if(document.getElementById('jem-service-offline'))return;
    const el=document.createElement('div');el.id='jem-service-offline';
    el.innerHTML='<div class="jem-offline-card"><div class="jem-offline-dot">●</div><h2>Print Service Closed</h2><p>Jangira AutoPrint is currently closed. Please try again later.</p><button type="button" id="jem-service-retry">Check Again</button></div>';
    document.body.appendChild(el);
    const s=document.createElement('style');s.textContent='#jem-service-offline{position:fixed;inset:0;z-index:10000;background:rgba(12,12,11,.82);display:none;place-items:center;padding:24px}.jem-offline-card{max-width:430px;width:100%;background:#1b1b19;color:#fff;border:1px solid #34332f;border-radius:22px;padding:32px;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.35)}.jem-offline-dot{font-size:26px;color:#b86b58}.jem-offline-card h2{margin:10px 0 8px;font-size:24px}.jem-offline-card p{color:#bdb9b0;line-height:1.55}.jem-offline-card button{margin-top:14px;border:1px solid #5b574f;background:#272622;color:#fff;border-radius:10px;padding:11px 18px;font-weight:800;cursor:pointer}.jem-service-disabled{pointer-events:none!important;opacity:.45!important}';document.head.appendChild(s);
    document.getElementById('jem-service-retry').onclick=check;
  }
  function setState(v){
    online=!!v;ensureOverlay();
    document.getElementById('jem-service-offline').style.display=online?'none':'grid';
    controls().forEach(x=>{if(x.matches('input[type=file]'))x.disabled=!online;else if(x.tagName==='BUTTON')x.disabled=!online;x.classList.toggle('jem-service-disabled',!online)});
    document.documentElement.dataset.serviceOnline=online?'true':'false';
    document.dispatchEvent(new CustomEvent('jem-service-status',{detail:{online}}));
  }
  async function check(){
    if(busy||!isRequestPage())return online;busy=true;
    try{const r=await fetch(`${STATUS_URL}?t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error();const d=await r.json();setState(d.online===true||d.status==='online'||d.available===true);return online}catch(e){setState(false);return false}finally{busy=false}
  }
  window.JEMServiceGate={check,isOnline:()=>online};
  function boot(){if(!isRequestPage())return;ensureOverlay();check();timer=setInterval(check,1000);window.addEventListener('online',check);window.addEventListener('offline',()=>setState(false));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
