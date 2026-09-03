const cfg = window.JEM_CONFIG || {};
const API = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
const UPI_ID = 'barkatkhanhindal6-1@okaxis';

const $ = (selector, root = document) => root.querySelector(selector);
const printForm = $('#print-form');
const fileInput = $('#file');
const fileStatus = $('#file-status');
const formMessage = $('#form-message');
const estimate = $('.estimate strong');
const paymentPanel = $('#payment-panel');
const paymentAmount = $('#payment-amount');
const paymentMessage = $('#payment-message');
const utrInput = $('#utr');
const upiAppLink = $('#upi-app-link');
const copyUpiButton = $('#copy-upi');
const sendPrintButton = $('#send-print-request');

const PRICE_PER_PAGE = 5;
let currentOrderId = null;
let currentAmount = 0;

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

function setPaymentMessage(text, type = '') {
  if (!paymentMessage) return;
  paymentMessage.textContent = text;
  paymentMessage.dataset.type = type;
}

function buildUpiUri(amount) {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: 'Jangira E-Mitra',
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: currentOrderId ? `Print Order ${currentOrderId}` : 'Jangira Print'
  });
  return `upi://pay?${params.toString()}`;
}

function showPayment(amount, orderId = null) {
  currentAmount = Number(amount) || 0;
  currentOrderId = orderId;
  if (paymentAmount) paymentAmount.textContent = `₹${currentAmount.toFixed(2)}`;
  const uri = buildUpiUri(currentAmount);
  if (upiAppLink) upiAppLink.href = uri;
  const qr = $('#upi-qr');
  if (qr) {
    qr.innerHTML = '';
    if (window.QRCode) {
      new QRCode(qr, { text: uri, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    } else {
      qr.textContent = 'QR library could not load. Use the UPI button below.';
    }
  }
  if (paymentPanel) {
    paymentPanel.hidden = false;
    paymentPanel.classList.add('visible');
    paymentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function copyUpi() {
  try {
    await navigator.clipboard.writeText(UPI_ID);
    setPaymentMessage('UPI ID copied.', 'success');
  } catch {
    setPaymentMessage(`UPI ID: ${UPI_ID}`, 'info');
  }
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
copyUpiButton?.addEventListener('click', copyUpi);

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

  if (!API) {
    const amount = selectedCount * Number(fd.get('copies') || 1) * PRICE_PER_PAGE;
    showPayment(amount);
    return setMessage('Payment amount prepared. Backend order submission will be connected next.', 'info');
  }

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
    const amount = Number(data.amount ?? payload.amount);
    setMessage(`Order ${orderId || 'created'}. Complete the UPI payment below.`, 'success');
    showPayment(amount, orderId);
  } catch (error) {
    setMessage(error.message || 'Could not create the print request right now.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Continue →'; }
  }
});

sendPrintButton?.addEventListener('click', async () => {
  const utr = String(utrInput?.value || '').trim();
  if (!utr) return setPaymentMessage('Please enter the UTR / transaction ID after payment.', 'error');
  if (!API || !currentOrderId) return setPaymentMessage('Backend order submission is not connected yet. Payment details are ready.', 'info');
  sendPrintButton.disabled = true;
  setPaymentMessage('Submitting your payment reference…', 'info');
  try {
    const paid = await fetch(`${API}/api/orders/${encodeURIComponent(currentOrderId)}/payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true, utr })
    });
    const paidData = await paid.json().catch(() => ({}));
    if (!paid.ok) throw new Error(paidData.error || 'Payment reference could not be submitted.');
    const request = await fetch(`${API}/api/orders/${encodeURIComponent(currentOrderId)}/send-print-request`, { method: 'POST' });
    const requestData = await request.json().catch(() => ({}));
    if (!request.ok) throw new Error(requestData.error || 'Print request could not be sent.');
    setPaymentMessage('Payment reference submitted. Your print request is now awaiting verification.', 'success');
    sendPrintButton.textContent = 'Request Sent ✓';
  } catch (error) {
    setPaymentMessage(error.message || 'Could not submit the payment reference.', 'error');
    sendPrintButton.disabled = false;
  }
});

updateEstimate();
