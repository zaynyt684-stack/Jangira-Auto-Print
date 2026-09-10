(()=>{
const DB='jem_editor_v1',STORE='files',FLOW='jem_print_flow_v3',PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',PDFWORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const open=()=>new Promise((r,j)=>{const x=indexedDB.open(DB,1);x.onupgradeneeded=()=>x.result.createObjectStore(STORE);x.onsuccess=()=>r(x.result);x.onerror=()=>j(x.error)});
const put=f=>open().then(db=>new Promise((r,j)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(f,'source');t.oncomplete=r;t.onerror=()=>j(t.error)}));
const flow=()=>{try{return JSON.parse(localStorage.getItem(FLOW)||'{}')}catch{return{}}};
const saveFlow=v=>localStorage.setItem(FLOW,JSON.stringify({...flow(),...v}));
const api=()=>String((window.JEM_CONFIG||{}).API_BASE_URL||'').replace(/\/$/,'');
let pdfPromise;
const loadPdfJs=()=>{if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);if(pdfPromise)return pdfPromise;pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=PDFJS;s.onload=()=>window.pdfjsLib?(window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFWORKER,resolve(window.pdfjsLib)):reject(Error('PDF engine unavailable.'));s.onerror=()=>reject(Error('Could not load PDF analysis engine.'));document.head.appendChild(s)});return pdfPromise};
const countPdf=async f=>{if(!/\.pdf$/i.test(f.name))return 1;const p=await loadPdfJs();return (await p.getDocument({data:await f.arrayBuffer()}).promise).numPages};
const setMsg=t=>{const x=document.querySelector('#form-message');if(x)x.textContent=t};
const analyze=async file=>{const n=await countPdf(file);localStorage.setItem('jem_pdf_page_count',String(n));localStorage.setItem('jem_pdf_page_fingerprint',`${file.name}|${file.size}|${file.lastModified}`);const p=document.querySelector('#analyzer-pages');if(p)p.textContent=`${n} page${n===1?'':'s'}`;return n};
const uploadDirect=async button=>{const file=document.querySelector('#file')?.files?.[0];if(!file){setMsg('Please select a document first.');return}button.disabled=true;try{const n=await analyze(file),base=api();if(!base)throw Error('Print service is temporarily unavailable.');setMsg('Uploading document…');const fd=new FormData();fd.append('file',file);fd.append('pageCount',String(n));fd.append('copies','1');fd.append('sides','single');fd.append('orientation','portrait');fd.append('paperSize','A4');fd.append('colorMode','BW');fd.append('pageRange','all');const res=await fetch(base+'/api/print-requests',{method:'POST',body:fd});const text=await res.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={error:text}}if(!res.ok)throw Error(d.error||`Upload failed (HTTP ${res.status}).`);const id=d.orderId||d.id;if(!id)throw Error('Server did not return a request ID.');saveFlow({orderId:id,orderNumber:d.requestNumber||id,fileName:d.fileName||file.name,fileSize:file.size,pageCount:Number(d.pageCount||n),status:d.status||'RECEIVED',paymentStatus:d.paymentStatus||'PENDING',amount:Number(d.amount||n*5),fileFingerprint:`${file.name}|${file.size}|${file.lastModified}`});sessionStorage.removeItem('jem_skip_editor');location.assign('./settings.html')}catch(e){button.disabled=false;setMsg(e.message||'Upload failed. Please try again.')}};
document.addEventListener('click',async e=>{
 const skip=e.target.closest('#continue-without-editor');
 if(skip){e.preventDefault();e.stopImmediatePropagation();if(skip.disabled)return;await uploadDirect(skip);return}
 const edit=e.target.closest('#to-step-2');
 if(!edit)return;
 e.preventDefault();e.stopImmediatePropagation();if(edit.disabled)return;
 const file=document.querySelector('#file')?.files?.[0];if(!file){setMsg('Please select a document first.');return}
 try{edit.disabled=true;setMsg('Opening Document Editor…');const n=await analyze(file);await put(file);saveFlow({fileName:file.name,fileSize:file.size,pageCount:n,fileFingerprint:`${file.name}|${file.size}|${file.lastModified}`,editorPending:true});location.assign('./editor.html')}catch(err){edit.disabled=false;setMsg(err.message||'Could not prepare the document. Please try again.')}
},true);
})();