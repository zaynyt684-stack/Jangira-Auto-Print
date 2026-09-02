const cfg = window.JEM_CONFIG || {};
const API = String(cfg.API_BASE_URL || '').replace(/\/$/, '');

const $ = (selector, root = document) => root.querySelector(selector);
const printForm = $('#print-form');
const fileInput = $('#file');
const fileStatus = $('#file-status');
const formMessage = $('#form-message');
const estimate = $('.estimate strong');

const PRICE_PER_PAGE = 5;

function parsePages(value, pageCount) {
  const text = String(value || 'all').trim().toLowerCase();
  if (!text || text === 'all') return pageCount || 1;
  const selected = new Set();
  for (const part of text.split(',')) {
    const p = part.trim();
    if (/^\d+$/.test(p)) selected.add(Number(p));
    else if (/^\d+\s*-\s*\d+$/.test(p)) {
      let [a, b] = p.split('-').map(Number);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) selected.add(i);
    }
  }
  if (!selected.size) return null;
  if (pageCount) for (const n of selected) if (n < 1 || n > pageCount) return null;
  return selected.size;
}

function updateEstimate() {
  if (!printForm || !estimate) return;
  const pages = parsePages($('[name="pages"]', printForm)?.value, window.JEM_PAGE_COUNT || 1);
  const copies = Math.min(100, Math.max(1, Number($('[name="copies"]', printForm)?.value || 1)));
  if (!pages) { estimate.textContent = 'Check page selection'; return; }
  const amount = pages * copies * PRICE_PER_PAGE;
  estimate.textContent = `₹${amount.toFixed(2)}`;
}

function setMessage(text, type = '') {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.dataset.type = type;
}

function setFile(file) {
  if (!file || !fileInput || !fileStatus) return;
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (file.size > 20 * 1024 * 1024) return setMessage('File size must be 20 MB or less.', 'error');
  if (file.type && !allowed.includes(file.type)) return setMessage('Only PDF, JPG, JPEG or PNG files are supported.', 'error');
  try {
    const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files;
  } catch {}
  fileStatus.querySelector('span:last-child').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  fileStatus.classList.add('has-file');
  setMessage('Document ready. Choose your printer settings.', 'success');
  updateEstimate();
}

fileInput?.addEventListener('change', () => setFile(fileInput.files[0]));
printForm?.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateEstimate));

printForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const file = fileInput?.files?.[0];
  if (!file) return setMessage('Please select a PDF or image first.', 'error');
  if (file.size > 20 * 1024 * 1024) return setMessage('File size must be 20 MB or less.', 'error');
  const fd = new FormData(printForm);
  const pageText = fd.get('pages') || 'all';
  const pageCount = window.JEM_PAGE_COUNT || (String(pageText).toLowerCase() === 'all' ? 1 : parsePages(pageText));
  const selectedCount = parsePages(pageText, pageCount);
  if (!selectedCount) return setMessage('Please enter valid pages, for example 1-4, 7, 9.', 'error');

  if (!API) return setMessage('Your document and settings are ready. Backend submission will be connected next.', 'info');

  const button = printForm.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Preparing…'; }
  setMessage('Creating your print request…', 'info');
  try {
    const copies = Number(fd.get('copies') || 1);
    const payload = {
      fileName: file.name,
      pageCount: Number(pageCount) || 1,
      selectedPages: pageText,
      copies,
      colour: 'bw',
      sides: fd.get('sides') || 'single',
      orientation: fd.get('orientation') || 'portrait',
      amount: selectedCount * copies * PRICE_PER_PAGE
    };
    const response = await fetch(`${API}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not create the print request.');
    const orderId = data.orderNumber || data.orderId || data.id;
    setMessage(`Print request ${orderId || 'created'} is ready.`, 'success');
  } catch (error) {
    setMessage(error.message || 'Could not create the print request right now.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Continue →'; }
  }
});

updateEstimate();
