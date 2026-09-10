(()=>{
  const FLOW='jem_print_flow_v3';
  const DB='jem_editor_v1',STORE='files';
  const isUpload=/\/upload\.html(?:$|\?)/i.test(location.pathname);
  const read=()=>{try{return JSON.parse(localStorage.getItem(FLOW)||'{}')}catch{return{}}};
  const clearFlow=()=>{localStorage.removeItem(FLOW);localStorage.removeItem('jem_pdf_page_count');sessionStorage.removeItem('jem_skip_editor')};
  const clearEditor=async()=>{try{const r=indexedDB.open(DB,1);r.onsuccess=()=>{try{r.result.transaction(STORE,'readwrite').objectStore(STORE).delete('source')}catch{}}}catch{}};
  const validFlow=s=>!!(s&&s.orderId&&s.fileName&&Number(s.pageCount)>0);
  if(isUpload){clearFlow();clearEditor();window.addEventListener('pageshow',()=>{clearFlow();clearEditor()});}
  document.addEventListener('DOMContentLoaded',()=>{
    if(isUpload){
      const edit=document.querySelector('#to-step-2'),direct=document.querySelector('#continue-without-editor');
      if(edit){edit.disabled=true;edit.setAttribute('aria-disabled','true')}
      if(direct){direct.disabled=true;direct.setAttribute('aria-disabled','true')}
      return;
    }
    if(/\/settings\.html(?:$|\?)/i.test(location.pathname)){
      const s=read();
      if(!validFlow(s)){clearFlow();clearEditor();location.replace('./upload.html');return}
      const file=document.querySelector('#selected-file');if(file)file.classList.add('has-file');
    }
  });
  window.JEM_FLOW_GUARD={validFlow,read,clearFlow};
})();
