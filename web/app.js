const cfg = window.JEM_CONFIG || {};
const API = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
const UPI_ID = 'barkatkhanhindal6-1@okaxis';
const UPI_NAME = 'Jangira E-Mitra';
const PRICE_PER_PAGE = 5;
const STORE_KEY = 'jem_print_flow_v1';

const $ = (s, r = document) => r.querySelector(s);
const fileInput = $('#file');
const fileStatus = $('#file-status');
const formMessage = $('#form-message');
const estimate = $('#estimate-price') || $('.estimate strong');
const paymentAmount = $('#payment-amount');
const upiQr = $('#upi-qr');
const upiAppLink = $('#upi-app-link');
const utrInput = $('#utr');
const requestMessage = $('#request-message');
const sendPrintRequest = $('#send-print-request');

let state = loadState();

function loadState() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; } }
function saveState(patch) { state = { ...state, ...patch }; localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function clearState() { state = {}; localStorage.removeItem(STORE_KEY); }
function page(n) { return `${n}.html`; }
function go(n) { window.location.href = page(n); }
function msg(el, text, type='') { if (!el) return; el.textContent = text; el.dataset.type = type; }

function parsePages(value, pageCount) {
  const text = String(value || 'all').trim().toLowerCase();
  if (!text || text === 'all') return pageCount || 1;
  const selected = new Set();
  for (const part of text.split(',')) {
    const p = part.trim();
    if (/^\d+$/.test(p)) selected.add(Number(p));
    else if (/^\d+\s*-\s*\d+$/.test(p)) {
      let [a,b] = p.split('-').map(Number); if (a > b) [a,b] = [b,a];
      for (let i=a;i<=b;i++) selected.add(i);
    }
  }
  if (!selected.size) return null;
  if (pageCount) for (const n of selected) if (n < 1 || n > pageCount) return null;
  return selected.size;
}
function settingsFromForm() {
  const form = $('#print-form');
  const fd = new FormData(form);
  const pageText = String(fd.get('pages') || 'all').trim();
  const pageCount = Number(state.pageCount) || Number(window.JEM_PAGE_COUNT) || (pageText.toLowerCase() === 'all' ? 1 : parsePages(pageText));
  const selectedCount = parsePages(pageText, pageCount);
  const copies = Math.min(100, Math.max(1, Number(fd.get('copies') || 1)));
  const sides = fd.get('sides') || 'single';
  const orientation = fd.get('orientation') || 'portrait';
  return { pageText, pageCount, selectedCount, copies, sides, orientation, amount: selectedCount ? selectedCount * copies * PRICE_PER_PAGE : 0 };
}
function updateEstimate() {
  if (!estimate || !$('#print-form')) return;
  const s = settingsFromForm(); estimate.textContent = s.selectedCount ? `₹${s.amount.toFixed(2)}` : 'Check page selection';
}
function makeNote(s, fileName) { return `Jangira Print | ${fileName || 'Document'} | Pages: ${s.pageText.toLowerCase()==='all'?'All pages':s.pageText} | Copies: ${s.copies} | ${s.sides==='double'?'Double-sided':'Single-sided'} | ${s.orientation==='landscape'?'Landscape':'Portrait'}`; }
function makeUpiLink(amount, note) { return `upi://pay?${new URLSearchParams({pa:UPI_ID,pn:UPI_NAME,tn:note,am:Number(amount).toFixed(2),cu:'INR'}).toString()}`; }
function makeQrUrl(link) { return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(link)}`; }
function renderSummary() {
  const fileName = state.fileName || 'Document';
  const amount = Number(state.amount || 0);
  const pages = state.pageText || 'all';
  const copies = Number(state.copies || 1);
  if ($('#summary-amount')) $('#summary-amount').textContent = `₹${amount.toFixed(2)}`;
  if ($('#summary-file')) $('#summary-file').textContent = fileName;
  if ($('#summary-pages')) $('#summary-pages').textContent = `${pages} · ${copies} ${copies===1?'copy':'copies'}`;
  if ($('#summary-mode')) $('#summary-mode').textContent = `${state.sides==='double'?'Double':'Single'} · ${state.orientation==='landscape'?'Landscape':'Portrait'}`;
}

// STEP 1: upload
function initUpload() {
  if (!fileInput) return;
  const setFile = file => {
    if (!file) return;
    const allowed = ['application/pdf','image/jpeg','image/png'];
    if (file.size > 20*1024*1024) return msg(formMessage,'File size must be 20 MB or less.','error');
    if (file.type && !allowed.includes(file.type)) return msg(formMessage,'Only PDF, JPG, JPEG or PNG files are supported.','error');
    try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; } catch {}
    if (fileStatus) { fileStatus.querySelector('span:last-child').textContent = `${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`; fileStatus.classList.add('has-file'); }
    saveState({ fileName:file.name, fileSize:file.size });
    const next = $('#to-step-2'); if (next) next.disabled = false;
    msg(formMessage,'Document ready. Continue to printer settings.','success');
  };
  fileInput.addEventListener('change',()=>setFile(fileInput.files[0]));
  const d = $('.dropzone');
  if (d) {
    ['dragover','dragenter'].forEach(e=>d.addEventListener(e,x=>{x.preventDefault();d.classList.add('dragging')}));
    ['dragleave','drop'].forEach(e=>d.addEventListener(e,x=>{x.preventDefault();d.classList.remove('dragging')}));
    d.addEventListener('drop',x=>x.dataTransfer.files.length && setFile(x.dataTransfer.files[0]));
  }
  if (state.fileName && fileStatus) { fileStatus.querySelector('span:last-child').textContent = state.fileName; fileStatus.classList.add('has-file'); if ($('#to-step-2')) $('#to-step-2').disabled=false; }
  $('#to-step-2')?.addEventListener('click',()=> state.fileName ? go(2) : msg(formMessage,'Please select a document first.','error'));
}

// STEP 2: settings + order creation
function initSettings() {
  const form = $('#print-form'); if (!form) return;
  const selected = $('#selected-file'); if (selected) selected.querySelector('span:last-child').textContent = state.fileName || 'No document selected';
  if (!state.fileName) { msg($('#form-message'),'Please upload a document first.','error'); setTimeout(()=>go(1),500); return; }
  if (state.copies) form.elements.copies.value=state.copies;
  if (state.sides) form.elements.sides.value=state.sides;
  if (state.orientation) form.elements.orientation.value=state.orientation;
  if (state.pageText) form.elements.pages.value=state.pageText;
  form.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',updateEstimate)); updateEstimate();
  form.addEventListener('submit',async e=>{
    e.preventDefault(); const s=settingsFromForm();
    if (!s.selectedCount) return msg($('#form-message'),'Please enter valid pages, for example 1-4, 7, 9.','error');
    const button=form.querySelector('button[type=submit]'); if(button){button.disabled=true;button.textContent='Preparing payment…';}
    try {
      let order=null;
      if (API) {
        const r=await fetch(`${API}/api/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName:state.fileName,pageCount:s.pageCount||1,selectedPages:s.pageText,copies:s.copies,colour:'bw',sides:s.sides,orientation:s.orientation,amount:s.amount})});
        const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||'Could not create the print order.'); order=data;
      }
      saveState({...s,orderId:order?.id||order?.orderId||null,orderNumber:order?.orderNumber||null}); go(3);
    } catch(err){ msg($('#form-message'),err.message||'Could not prepare payment.','error'); }
    finally{if(button){button.disabled=false;button.textContent='Continue to Payment →';}}
  });
}

// STEP 3: UPI
function initPayment() {
  if (!paymentAmount) return;
  if (!state.fileName || !state.amount) { setTimeout(()=>go(2),0); return; }
  const note=makeNote(state,state.fileName), link=makeUpiLink(state.amount,note);
  paymentAmount.textContent=`₹${Number(state.amount).toFixed(2)}`; if(upiQr) upiQr.src=makeQrUrl(link); if(upiAppLink) upiAppLink.href=link;
  if($('#payment-summary')) $('#payment-summary').textContent=`${state.fileName} · ${state.pageText||'all'} · ${state.copies||1} ${(state.copies||1)===1?'copy':'copies'}`;
  $('#to-step-4')?.addEventListener('click',()=>go(4));
}

// STEP 4: confirmation
function initConfirm() {
  if (!sendPrintRequest) return;
  if (!state.fileName || !state.amount) { setTimeout(()=>go(2),0); return; }
  renderSummary();
  sendPrintRequest.addEventListener('click',async()=>{
    const utr=String(utrInput?.value||'').trim();
    if(!utr || utr.length<6) return msg(requestMessage,'Please enter a valid UTR / transaction reference.','error');
    sendPrintRequest.disabled=true; sendPrintRequest.textContent='Sending…'; msg(requestMessage,'Submitting your print request…','info');
    try {
      if(API && state.orderId){
        const p=await fetch(`${API}/api/orders/${encodeURIComponent(state.orderId)}/payment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paid:true,utr})});
        const pd=await p.json().catch(()=>({})); if(!p.ok) throw new Error(pd.error||'Payment confirmation failed.');
        const r=await fetch(`${API}/api/orders/${encodeURIComponent(state.orderId)}/send-print-request`,{method:'POST'}); const rd=await r.json().catch(()=>({})); if(!r.ok) throw new Error(rd.error||'Could not send print request.');
        saveState({utr,status:rd.status||'AwaitingPaymentVerification',orderNumber:rd.orderNumber||state.orderNumber});
      } else saveState({utr,status:'Received'});
      go(5);
    } catch(err){msg(requestMessage,err.message||'Could not send the print request.','error');sendPrintRequest.disabled=false;sendPrintRequest.textContent='Send Print Request →';}
  });
}

// STEP 5: status + optional polling
async function refreshStatus() {
  if (!state.orderId || !API) return;
  try { const r=await fetch(`${API}/api/orders/${encodeURIComponent(state.orderId)}`); if(!r.ok)return; const o=await r.json(); saveState({status:o.status,paymentStatus:o.paymentStatus,orderNumber:o.orderNumber||state.orderNumber}); renderStatus(); } catch {}
}
function renderStatus(){
  const status=String(state.status||'Received');
  const title={Received:'Request received',AwaitingPaymentVerification:'Payment submitted for verification',Approved:'Payment approved',Queued:'Waiting in print queue',Downloading:'Preparing document',Validating:'Validating document',Printing:'Printing in progress',Completed:'Print completed',Rejected:'Request rejected',Failed:'Print failed',Cancelled:'Request cancelled'}[status]||'Request received';
  const text={AwaitingPaymentVerification:'Your payment is waiting for operator verification.',Approved:'Payment verified. Your print is approved.',Queued:'Your job is in the print queue.',Printing:'Your document is being printed now.',Completed:'Your document has been printed successfully.'}[status]||'Your print request has been submitted.';
  if($('#request-status-title'))$('#request-status-title').textContent=title;if($('#request-status-text'))$('#request-status-text').textContent=text;
  if($('#request-number'))$('#request-number').textContent=`Request ${state.orderNumber||state.orderId||'received'} · Status: ${status}`;
  renderSummary();
  const map=['Received','AwaitingPaymentVerification','Approved','Queued','Downloading','Validating','Printing','Completed']; const idx=map.indexOf(status); document.querySelectorAll('.status-steps div').forEach((el,i)=>el.classList.toggle('active',i<=Math.min(Math.max(idx,0),3)));
}
function initStatus(){ if(!state.fileName){go(1);return;} renderStatus(); refreshStatus(); if(state.orderId&&API) setInterval(refreshStatus,5000); }

// Backward compatibility for the old index page: keep it functional but send each step to its dedicated page.
if (location.pathname.endsWith('/index.html') || location.pathname.endsWith('/')) {
  const start=document.querySelector('.hero .button.primary'); if(start) start.href='./upload.html';
}
initUpload(); initSettings(); initPayment(); initConfirm(); initStatus();
