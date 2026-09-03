const cfg = window.JEM_CONFIG || {};
const API = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
const UPI_ID = 'barkatkhanhindal6-1@okaxis';
const UPI_NAME = 'Jangira E-Mitra';
const PRICE_PER_PAGE = 5;

const $ = (selector, root = document) => root.querySelector(selector);
const fileInput = $('#file');
const fileStatus = $('#file-status');
const formMessage = $('#form-message');
const estimate = $('.estimate strong');
const paymentAmount = $('#payment-amount');
const upiQr = $('#upi-qr');
const upiAppLink = $('#upi-app-link');
const utrInput = $('#utr');
const requestMessage = $('#request-message');
const sendPrintRequest = $('#send-print-request');
let pendingPayment = null;

const steps = [1, 2, 3, 4, 5];
function showStep(number) {
  steps.forEach(n => {
    const el = document.getElementById(`step-${n}`);
    if (el) el.hidden = n !== number;
  });
  document.getElementById(`step-${number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

function getSettings() {
  const form = $('#print-form');
  const fd = new FormData(form);
  const pageText = String(fd.get('pages') || 'all').trim();
  const pageCount = Number(window.JEM_PAGE_COUNT) || (pageText.toLowerCase() === 'all' ? 1 : parsePages(pageText));
  const selectedCount = parsePages(pageText, pageCount);
  const copies = Math.min(100, Math.max(1, Number(fd.get('copies') || 1)));
  const sides = fd.get('sides') || 'single';
  const orientation = fd.get('orientation') || 'portrait';
  return { fd, pageText, pageCount, selectedCount, copies, sides, orientation, amount: selectedCount ? selectedCount * copies * PRICE_PER_PAGE : 0 };
}

function updateEstimate() {
  if (!estimate) return;
  const { selectedCount, amount } = getSettings();
  estimate.textContent = selectedCount ? `₹${amount.toFixed(2)}` : 'Check page selection';
}

function setMessage(text, type = '') {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.dataset.type = type;
}

function setRequestMessage(text, type = '') {
  if (!requestMessage) return;
  requestMessage.textContent = text;
  requestMessage.dataset.type = type;
}

function makePaymentNote(settings, fileName) {
  const pages = settings.pageText.toLowerCase() === 'all' ? 'All pages' : settings.pageText;
  return `Jangira Print | ${fileName || 'Document'} | Pages: ${pages} | Copies: ${settings.copies} | ${settings.sides === 'double' ? 'Double-sided' : 'Single-sided'} | ${settings.orientation === 'landscape' ? 'Landscape' : 'Portrait'}`;
}

function makeUpiLink(amount, note) {
  const params = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, tn: note, am: Number(amount).toFixed(2), cu: 'INR' });
  return `upi://pay?${params.toString()}`;
}

function makeQrUrl(upiLink) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(upiLink)}`;
}

function preparePayment(amount, settings, fileName, order = null) {
  const note = makePaymentNote(settings, fileName);
  const upiLink = makeUpiLink(amount, note);
  pendingPayment = { amount, order, note, upiLink, settings, fileName };
  if (paymentAmount) paymentAmount.textContent = `₹${amount.toFixed(2)}`;
  if (upiQr) upiQr.src = makeQrUrl(upiLink);
  if (upiAppLink) upiAppLink.href = upiLink;
  $('#summary-amount').textContent = `₹${amount.toFixed(2)}`;
  $('#summary-file').textContent = fileName || 'Document';
  $('#summary-pages').textContent = `${settings.pageText} · ${settings.copies} ${settings.copies === 1 ? 'copy' : 'copies'}`;
  $('#summary-mode').textContent = `${settings.sides === 'double' ? 'Double' : 'Single'} · ${settings.orientation === 'landscape' ? 'Landscape' : 'Portrait'}`;
}

function setFile(file) {
  if (!file || !fileInput || !fileStatus) return;
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (file.size > 20 * 1024 * 1024) return setMessage('File size must be 20 MB or less.', 'error');
  if (file.type && !allowed.includes(file.type)) return setMessage('Only PDF, JPG, JPEG or PNG files are supported.', 'error');
  try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; } catch {}
  fileStatus.querySelector('span:last-child').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  fileStatus.classList.add('has-file');
  const next = $('#to-step-2');
  if (next) next.disabled = false;
  setMessage('Document ready. Continue to printer settings.', 'success');
}

fileInput?.addEventListener('change', () => setFile(fileInput.files[0]));

$('#to-step-2')?.addEventListener('click', () => {
  if (!fileInput?.files?.[0]) return setMessage('Please select a document first.', 'error');
  showStep(2);
  updateEstimate();
});
$('#back-to-step-1')?.addEventListener('click', () => showStep(1));
$('#back-to-step-2')?.addEventListener('click', () => showStep(2));
$('#back-to-step-3')?.addEventListener('click', () => showStep(3));

$('#print-form')?.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateEstimate));

$('#print-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const file = fileInput?.files?.[0];
  if (!file) return showStep(1);
  const settings = getSettings();
  if (!settings.selectedCount) return setMessage('Please enter valid pages, for example 1-4, 7, 9.', 'error');

  const button = $('#print-form button[type="submit"]');
  if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Preparing payment…'; }
  try {
    let order = null;
    if (API) {
      const payload = { fileName: file.name, pageCount: Number(settings.pageCount) || 1, selectedPages: settings.pageText, copies: settings.copies, colour: 'bw', sides: settings.sides, orientation: settings.orientation, amount: settings.amount };
      const response = await fetch(`${API}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create the print order.');
      order = data;
    }
    preparePayment(settings.amount, settings, file.name, order);
    showStep(3);
  } catch (error) {
    setMessage(error.message || 'Could not prepare payment.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Continue to Payment →'; }
  }
});

$('#to-step-4')?.addEventListener('click', () => {
  if (!pendingPayment) return showStep(2);
  showStep(4);
  utrInput?.focus();
});

sendPrintRequest?.addEventListener('click', async () => {
  const utr = String(utrInput?.value || '').trim();
  if (!pendingPayment) return setRequestMessage('Please complete the payment step first.', 'error');
  if (!utr || utr.length < 6) return setRequestMessage('Please enter a valid UTR / transaction reference.', 'error');

  sendPrintRequest.disabled = true;
  sendPrintRequest.dataset.originalText = sendPrintRequest.textContent;
  sendPrintRequest.textContent = 'Sending…';
  setRequestMessage('Submitting your print request…', 'info');
  try {
    if (API && pendingPayment.order) {
      const id = pendingPayment.order.id || pendingPayment.order.orderId;
      if (id) {
        const payResponse = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true, utr }) });
        const payData = await payResponse.json().catch(() => ({}));
        if (!payResponse.ok) throw new Error(payData.error || 'Payment confirmation failed.');
        const requestResponse = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/send-print-request`, { method: 'POST' });
        const requestData = await requestResponse.json().catch(() => ({}));
        if (!requestResponse.ok) throw new Error(requestData.error || 'Could not send print request.');
        const number = requestData.orderNumber || pendingPayment.order.orderNumber || id;
        $('#request-status-title').textContent = 'Payment submitted for verification';
        $('#request-status-text').textContent = 'Your print request is waiting for operator payment verification.';
        $('#request-number').textContent = `Request ${number} received successfully.`;
        showStep(5);
        return;
      }
    }
    $('#request-status-title').textContent = 'Request received';
    $('#request-status-text').textContent = 'Test mode: your payment details and print request were captured. Backend verification will be connected next.';
    $('#request-number').textContent = `Test request created · Amount ₹${pendingPayment.amount.toFixed(2)} · UTR ${utr}`;
    showStep(5);
  } catch (error) {
    setRequestMessage(error.message || 'Could not send the print request.', 'error');
  } finally {
    if (!$('#step-5')?.hidden) {
      sendPrintRequest.textContent = 'Request Sent ✓';
    } else {
      sendPrintRequest.disabled = false;
      sendPrintRequest.textContent = sendPrintRequest.dataset.originalText || 'Send Print Request →';
    }
  }
});

$('#new-print')?.addEventListener('click', () => {
  if (fileInput) fileInput.value = '';
  if (fileStatus) { fileStatus.classList.remove('has-file'); fileStatus.querySelector('span:last-child').textContent = 'No document selected'; }
  if ($('#to-step-2')) $('#to-step-2').disabled = true;
  $('#print-form')?.reset();
  if (utrInput) utrInput.value = '';
  pendingPayment = null;
  updateEstimate();
  showStep(1);
});

updateEstimate();
