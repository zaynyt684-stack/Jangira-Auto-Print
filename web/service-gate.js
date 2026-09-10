(()=>{
  const API=(window.JEM_CONFIG&&window.JEM_CONFIG.API_BASE_URL)||'';
  const STATUS_URL=`${API}/api/service-status`;
  const INTERVAL=20000;
  const TIMEOUT=7000;
  let online=false, busy=false, timer=null;
  const isRequestPage=()=>/upload\.html$|settings\.html$|payment\.html$/.test(location.pathname);
  const controls=()=>Array.from(document.querySelectorAll('button, a.button, input[type=file], .dropzone'));
  function ensureOverlay(){
    if(document.getElementById('jem-service-offline')) return;
    const el=document.createElement('div'); el.id='jem-service-offline';
    el.innerHTML='<div class="jem-offline-card"><div class="jem-offline-dot">●</div><h2>Print Service Offline</h2><p>Jangira AutoPrint is currently unavailable. New print requests are temporarily disabled.</p><small id="jem-offline-note">Please try again shortly.</small><button type="button" id="jem-service-retry">Check Again</button></div>';
    document.body.appendChild(el);
    const s=document.createElement('style'); s.textContent='#jem-service-offline{position:fixed;inset:0;z-index:10000;background:rgba(12,12,11,.82);display:none;place-items:center;padding:24px}#jem-service-offline.show{display:grid}.jem-offline-card{max-width:430px;width:100%;background:#1b1b19;color:#fff;border:1px solid #34332f;border-radius:22px;padding:32px;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.35)}.jem-offline-dot{font-size:26px;color:#b86b58}.jem-offline-card h2{margin:10px 0 8px;font-size:24px}.jem-offline-card p{color:#bdb9b0;line-height:1.55;margin:0 0 8px}.jem-offline-card small{color:#918d85}.jem-offline-card button{margin-top:20px;border:1px solid #5b574f;background:#272622;color:#fff;border-radius:10px;padding:11px 18px;font-weight:800;cursor:pointer}.jem-service-disabled{pointer-events:none!important;opacity:.45!important}'; document.head.appendChild(s);
    document.getElementById('jem-service-retry').onclick=check;
  }
  function setState(v){
    online=v;
    ensureOverlay();
    document.getElementById('jem-service-offline').classList.toggle('show',!v);
    controls().forEach(x=>{
      if(x.matches('input[type=file]')) x.disabled=!v;
      else if(x.tagName==='BUTTON') x.disabled=!v;
      x.classList.toggle('jem-service-disabled',!v);
    });
    document.documentElement.dataset.serviceOnline=v?'true':'false';
    document.dispatchEvent(new CustomEvent('jem-service-status',{detail:{online:v}}));
  }
  async function check(){
    if(busy||!isRequestPage()) return online;
    busy=true;
    const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),TIMEOUT);
    try{
      const r=await fetch(`${STATUS_URL}?t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'},signal:ac.signal});
      if(!r.ok) throw new Error(`status ${r.status}`);
      const d=await r.json();
      const ok=d.online===true || d.status==='online' || d.available===true;
      setState(ok);
      return ok;
    }catch(e){ setState(false); return false; }
    finally{clearTimeout(t);busy=false;}
  }
  window.JEMServiceGate={check,isOnline:()=>online};
  function boot(){if(!isRequestPage())return;ensureOverlay();check();timer=setInterval(check,INTERVAL);window.addEventListener('online',check);window.addEventListener('offline',()=>setState(false));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
