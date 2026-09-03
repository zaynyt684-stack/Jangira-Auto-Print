const cfg = window.JEM_CONFIG || {};
const API = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
const UPI_ID = 'barkatkhanhindal6-1@okaxis';
const UPI_NAME = 'Jangira E-Mitra';
const PRICE_PER_PAGE = 5;

const $ = (selector, root = document) => root.querySelector(selector);
const printForm = $('#print-form');
const fileInput = $('#file');
const fileStatus = $('#file-status');
const formMessage = $('#form-message');
const estimate = $('.estimate strong');
const paymentPanel = $('#payment-panel');
const paymentAmount = $('#payment-amount');
const upiQr = $('#upi-qr');
const upiIdEl = $('#upi-id');
const copyUpi = $('#copy-upi');
const utrInput = $('#utr');
const sendPrintRequest = $('#send-print-request');
const paymentMessage = $('#payment-message');
let pendingPayment = null;

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
  const fd = new FormData(printForm);
  const pageText = String(fd.get('pages') || 'all').trim();
  const pageCount = Number(window.JEM_PAGE_COUNT) || (pageText.toLowerCase() === 'all' ? 1 : parsePages(pageText));
  const selectedCount = parsePages(pageText, pageCount);
  const copies = Math.min(100, Math.max(1, Number(fd.get('copies') || 1)));
  return { fd, pageText, pageCount, selectedCount, copies, amount: selectedCount ? selectedCount * copies * PRICE_PER_PAGE : 0 };
}

function updateEstimate() {
  if (!printForm || !estimate) return;
  const { selectedCount, amount } = getSettings();
  estimate.textContent = selectedCount ? `₹${amount.toFixed(2)}` : 'Check page selection';
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

function makeUpiLink(amount) {
  const params = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: Number(amount).toFixed(2), cu: 'INR' });
  return `upi://pay?${params.toString()}`;
}

function makeQrUrl(upiLink) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(upiLink)}`;
}

function showPayment(amount, order = null) {
  pendingPayment = { amount, order };
  if (paymentAmount) paymentAmount.textContent = `₹${amount.toFixed(2)}`;
  if (upiIdEl) upiIdEl.textContent = UPI_ID;
  if (upiQr) {
    upiQr.src = makeQrUrl(makeUpiLink(amount));
    upiQr.dataset.upiLink = makeUpiLink(amount);
  }
  if (paymentPanel) {
    paymentPanel.hidden = false;
    paymentPanel.classList.add('visible');
    paymentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const input = document.createElement('input'); input.value = text; document.body.appendChild(input); input.select();
    const ok = document.execCommand('copy'); input.remove(); return ok;
  }
}

function setFile(file) {
  if (!file || !fileInput || !fileStatus) return;
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (file.size > 20 * 1024 * 1024) return setMessage('File size must be 20 MB or less.', 'error');
  if (file.type && !allowed.includes(file.type)) return setMessage('Only PDF, JPG, JPEG or PNG files are supported.', 'error');
  try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; } catch {}
  fileStatus.querySelector('span:last-child').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  fileStatus.classList.add('has-file');
  setMessage('Document ready. Choose your printer settings.', 'success');
  updateEstimate();
}

fileInput?.addEventListener('change', () => setFile(fileInput.files[0]));
printForm?.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateEstimate));
copyUpi?.addEventListener('click', async () => {
  const ok = await copyText(UPI_ID);
  copyUpi.textContent = ok ? 'Copied ✓' : 'Copy failed';
  setTimeout(() => { copyUpi.textContent = 'Copy'; }, 1500);
});

printForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const file = fileInput?.files?.[0];
  if (!file) return setMessage('Please select a PDF or image first.', 'error');
  if (file.size > 20 * 1024 * 1024) return setMessage('File size must be 20 MB or less.', 'error');
  const { fd, pageText, pageCount, selectedCount, copies, amount } = getSettings();
  if (!selectedCount) return setMessage('Please enter valid pages, for example 1-4, 7, 9.', 'error');

  const button = printForm.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Preparing payment…'; }
  setMessage(`Amount ₹${amount.toFixed(2)} calculated. Opening UPI payment…`, 'success');

  try {
    let order = null;
    if (API) {
      const payload = {
        fileName: file.name,
        pageCount: Number(pageCount) || 1,
        selectedPages: pageText,
        copies,
        colour: 'bw',
        sides: fd.get('sides') || 'single',
        orientation: fd.get('orientation') || 'portrait',
        amount
      };
      const response = await fetch(`${API}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create the print order.');
      order = data;
    }
    showPayment(amount, order);
    setMessage(`Payment amount ₹${amount.toFixed(2)} is ready. Scan the QR or open UPI on your phone.`, 'success');
  } catch (error) {
    setMessage(error.message || 'Could not prepare payment.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Continue to Payment →'; }
  }
});

sendPrintRequest?.addEventListener('click', async () => {
  const utr = String(utrInput?.value || '').trim();
  if (!pendingPayment) return setPaymentMessage('Please complete the order details first.', 'error');
  if (!utr || utr.length < 6) return setPaymentMessage('Please enter a valid UTR / transaction reference after payment.', 'error');

  sendPrintRequest.disabled = true;
  sendPrintRequest.dataset.originalText = sendPrintRequest.textContent;
  sendPrintRequest.textContent = 'Sending…';
  setPaymentMessage('Submitting your print request…', 'info');
  try {
    if (API && pendingPayment.order) {
      const id = pendingPayment.order.id || pendingPayment.order.orderId;
      if (id) {
        const payResponse = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true, utr })
        });
        const payData = await payResponse.json().catch(() => ({}));
        if (!payResponse.ok) throw new Error(payData.error || 'Payment confirmation failed.');
        const requestResponse = await fetch(`${API}/api/orders/${encodeURIComponent(id)}/send-print-request`, { method: 'POST' });
        const requestData = await requestResponse.json().catch(() => ({}));
        if (!requestResponse.ok) throw new Error(requestData.error || 'Could not send print request.');
        const number = requestData.orderNumber || pendingPayment.order.orderNumber || id;
        setPaymentMessage(`Request ${number} sent successfully. Payment is awaiting verification.`, 'success');
        sendPrintRequest.textContent = 'Request Sent ✓';
        return;
      }
    }
    setPaymentMessage(`Test payment recorded for ₹${pendingPayment.amount.toFixed(2)}. UTR: ${utr}. Backend verification will be connected next.`, 'success');
    sendPrintRequest.textContent = 'Test Request Sent ✓';
  } catch (error) {
    setPaymentMessage(error.message || 'Could not send the print request.', 'error');
  } finally {
    if (!sendPrintRequest.textContent.includes('✓')) {
      sendPrintRequest.disabled = false;
      sendPrintRequest.textContent = sendPrintRequest.dataset.originalText || 'I’ve Paid — Send Print Request →';
    }
  }
});

updateEstimate();
