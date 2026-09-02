const cfg = window.JEM_CONFIG || {};
const API = String(cfg.API_BASE_URL || '').replace(/\/$/, '');

const $ = (selector, root = document) => root.querySelector(selector);
const printForm = $('#print-form');
const fileInput = $('#file');
const fileStatus = $('#file-status');
const formMessage = $('#form-message');
const estimate = $('.estimate strong');
const trackForm = $('#track-form');
const trackResult = $('#track-result');

const PRICES = { bw: 2, color: 10, single: 0, double: 1 };

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
  const colour = $('[name="colour"]', printForm)?.value || 'bw';
  const sides = $('[name="sides"]', printForm)?.value || 'single';
  if (!pages) { estimate.textContent = 'Check page selection'; return; }
  const amount = (pages * copies * (PRICES[colour] || 0)) + (sides === 'double' ? pages * copies * PRICES.double : 0);
  estimate.textContent = `₹${amount.toFixed(2)} provisional`;
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
  setMessage('Document ready. Choose your print settings.', 'success');
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
  if (!API) return setMessage('The print backend is not connected yet. Your settings are ready; payment and submission will activate when the backend is configured.', 'info');

  const button = printForm.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Preparing request…'; }
  setMessage('Creating your print request…', 'info');
  try {
    const payload = {
      fileName: file.name,
      pageCount: Number(pageCount) || 1,
      selectedPages: pageText,
      copies: Number(fd.get('copies') || 1),
      colour: fd.get('colour') || 'bw',
      sides: fd.get('sides') || 'single',
      orientation: fd.get('orientation') || 'portrait'
    };
    const response = await fetch(`${API}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not create the order.');
    const orderId = data.orderNumber || data.orderId || data.id;
    setMessage(`Order ${orderId || 'created'} is ready. Payment integration will appear here next; nothing has been marked as paid automatically.`, 'success');
    if (orderId) { localStorage.setItem('JEM_LAST_ORDER', orderId); if ($('#order-id')) $('#order-id').value = orderId; }
  } catch (error) {
    setMessage(error.message || 'Could not create the order right now.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Continue to payment →'; }
  }
});

function statusClass(status) { return String(status || '').toLowerCase().replace(/[^a-z]+/g, '-'); }
function renderStatus(data) {
  if (!trackResult) return;
  const status = data.status || 'Received';
  const payment = data.paymentStatus || 'Pending';
  const labels = ['Received', 'AwaitingPaymentVerification', 'Approved', 'Queued', 'Downloading', 'Validating', 'Printing', 'Completed'];
  const index = Math.max(0, labels.indexOf(status));
  const active = ['Rejected', 'Failed', 'Cancelled', 'PaymentExpired'].includes(status) ? -1 : index;
  const steps = labels.map((label, i) => `<span class="track-step ${i <= active ? 'active' : ''}">${label.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>`).join('');
  trackResult.hidden = false;
  trackResult.className = `status ${statusClass(status)}`;
  trackResult.innerHTML = `<strong>${status.replace(/([a-z])([A-Z])/g, '$1 $2')}</strong><small>Payment: ${payment}</small><div class="live-steps">${steps}</div>`;
}

async function fetchOrder(id) {
  if (!API) { if (trackResult) { trackResult.hidden = false; trackResult.textContent = `Tracking backend is not connected yet. Order: ${id}`; } return; }
  try {
    const response = await fetch(`${API}/api/orders/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Order could not be found.');
    renderStatus(data);
  } catch (error) {
    if (trackResult) { trackResult.hidden = false; trackResult.className = 'status error'; trackResult.textContent = error.message || 'Order could not be found right now.'; }
  }
}

trackForm?.addEventListener('submit', e => { e.preventDefault(); const id = $('#order-id')?.value.trim(); if (id) fetchOrder(id); });
const lastOrder = localStorage.getItem('JEM_LAST_ORDER');
if ($('#order-id') && lastOrder) $('#order-id').value = lastOrder;
updateEstimate();
