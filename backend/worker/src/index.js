const ALLOWED_ORIGIN = "*";
const BUCKET = "print-files";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_COPIES = 100;
const PRICE_PER_PAGE = 5;

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Agent-Token",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    ...extra,
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(), "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function cleanName(name) {
  const base = String(name || "document").split(/[\\/]/).pop();
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "document";
}

function selectedPagesCount(value, pageCount) {
  const v = String(value || "all").trim().toLowerCase();
  if (!v || v === "all") return pageCount;
  const pages = new Set();
  for (const part of v.split(",").map(x => x.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n < 1 || n > pageCount) return null;
      pages.add(n);
      continue;
    }
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return null;
    let a = Number(m[1]), b = Number(m[2]);
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > pageCount) return null;
    for (let i = a; i <= b; i++) pages.add(i);
  }
  return pages.size || null;
}

function supa(env, path, options = {}) {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
}

async function supaJson(env, path, options = {}) {
  const r = await supa(env, path, options);
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

function agentOk(request, env) {
  const expected = env.AGENT_TOKEN;
  if (!expected) return false;
  const supplied = request.headers.get("X-Agent-Token") || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return supplied === expected;
}

async function getRequest(env, id) {
  const rows = await supaJson(env, `/rest/v1/print_requests?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows?.[0] || null;
}

async function updateRequest(env, id, patch) {
  return supaJson(env, `/rest/v1/print_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
}

async function event(env, requestId, eventType, message, actor = "system") {
  try {
    await supaJson(env, "/rest/v1/print_request_events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ request_id: requestId, event_type: eventType, message, actor }),
    });
  } catch (_) {}
}

async function createPrintRequest(request, env) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "file is required" }, 400);
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return json({ error: "File must be between 1 byte and 50 MB." }, 400);

  const originalFileName = cleanName(file.name);
  const mime = file.type || "application/octet-stream";
  if (!["application/pdf", "image/jpeg", "image/png"].includes(mime) && !/\.(pdf|jpe?g|png)$/i.test(originalFileName)) {
    return json({ error: "Only PDF, JPG, JPEG and PNG files are supported." }, 400);
  }

  const pageCount = Math.max(1, Math.min(10000, Number(form.get("pageCount") || 1)));
  const copies = Math.max(1, Math.min(MAX_COPIES, Number(form.get("copies") || 1)));
  const sides = String(form.get("sides") || "single").toLowerCase();
  const orientation = String(form.get("orientation") || "portrait").toLowerCase();
  const paperSize = String(form.get("paperSize") || "A4").toUpperCase();
  const colorMode = String(form.get("colorMode") || "BW").toUpperCase();
  const pageRange = String(form.get("pageRange") || "all").trim();
  const selectedCount = selectedPagesCount(pageRange, pageCount);

  if (!selectedCount || !["single", "double"].includes(sides) || !["portrait", "landscape"].includes(orientation)) {
    return json({ error: "Invalid print settings." }, 400);
  }

  const requestNumber = `JEM-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const id = crypto.randomUUID();
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${id}/original-${originalFileName}`;

  const upload = await supa(env, `/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: "POST",
    headers: { "Content-Type": mime, "x-upsert": "false" },
    body: file.stream(),
  });
  if (!upload.ok) return json({ error: "File upload failed.", details: await upload.text() }, 502);

  const amount = selectedCount * copies * PRICE_PER_PAGE;
  const row = {
    id, request_number: Number(`9${Date.now().toString().slice(-11)}`),
    customer_name: String(form.get("customerName") || "Customer").slice(0, 100),
    customer_phone: String(form.get("customerPhone") || "").slice(0, 30),
    file_path: storagePath, original_file_name: originalFileName, mime_type: mime, file_size: file.size,
    paper_size: paperSize, color_mode: colorMode, sides, copies, page_range: pageRange,
    payment_status: "PENDING", payment_method: "UPI", payment_amount: amount,
    status: "RECEIVED", printer_name: "Brother DCP-L2520D", print_attempts: 0, printed_copies: 0,
    delete_after: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
  };

  try {
    await supaJson(env, "/rest/v1/print_requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch (e) {
    await supa(env, `/storage/v1/object/${BUCKET}/${storagePath}`, { method: "DELETE" }).catch(() => {});
    return json({ error: "Could not create print request.", details: String(e.message).slice(0, 300) }, 502);
  }

  await event(env, id, "RECEIVED", "Print request received");
  return json({
    id, requestNumber, fileName: originalFileName, pageCount, selectedPageCount: selectedCount,
    copies, sides, orientation, paperSize, colorMode, amount, paymentStatus: "PENDING", status: "RECEIVED",
  }, 201);
}

async function submitPayment(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const order = await getRequest(env, id);
  if (!order) return json({ error: "Request not found" }, 404);
  if (!["RECEIVED", "PAYMENT_PENDING", "PENDING_PAYMENT"].includes(order.status)) return json({ error: "Payment cannot be submitted for this request." }, 409);
  const utr = String(body.utr || "").trim();
  if (utr.length < 6 || utr.length > 100) return json({ error: "Valid UTR is required." }, 400);
  await updateRequest(env, id, { payment_status: "PENDING", payment_method: "UPI", payment_id: utr, status: "PAYMENT_PENDING" });
  await event(env, id, "PAYMENT_SUBMITTED", `UTR submitted: ${utr.slice(0, 4)}****`, "customer");
  return json({ id, status: "PAYMENT_PENDING", paymentStatus: "PENDING" });
}

async function agentQueue(request, env) {
  if (!agentOk(request, env)) return json({ error: "Unauthorized agent" }, 401);
  const rows = await supaJson(env, `/rest/v1/print_requests?status=in.(PAYMENT_PENDING,WAITING_FOR_OPERATOR,REVIEWING,APPROVED,QUEUED_FOR_PRINTING,FAILED)&order=created_at.asc&limit=100&select=*`);
  return json({ requests: rows });
}

async function agentClaim(request, env, id) {
  if (!agentOk(request, env)) return json({ error: "Unauthorized agent" }, 401);
  const body = await request.json().catch(() => ({}));
  const operatorId = String(body.operatorId || "agent").slice(0, 100);
  const operatorName = String(body.operatorName || "Jangira Operator").slice(0, 100);
  const current = await getRequest(env, id);
  if (!current) return json({ error: "Request not found" }, 404);
  if (!["PAYMENT_PENDING", "WAITING_FOR_OPERATOR", "FAILED"].includes(current.status)) return json({ error: "Request is not claimable", status: current.status }, 409);
  const updated = await supaJson(env, `/rest/v1/print_requests?id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(current.status)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "REVIEWING", operator_id: operatorId, operator_name: operatorName, reviewed_at: new Date().toISOString() }),
  });
  if (!updated?.length) return json({ error: "Request was already claimed by another agent." }, 409);
  await event(env, id, "CLAIMED", "Request claimed for operator review", operatorName);
  return json(updated[0]);
}

async function agentDecision(request, env, id) {
  if (!agentOk(request, env)) return json({ error: "Unauthorized agent" }, 401);
  const body = await request.json().catch(() => ({}));
  const order = await getRequest(env, id);
  if (!order) return json({ error: "Request not found" }, 404);
  if (order.status !== "REVIEWING") return json({ error: "Request must be in REVIEWING state." }, 409);

  const action = String(body.action || "").toLowerCase();
  if (action === "reject") {
    const reason = String(body.reason || "Rejected by operator").slice(0, 500);
    await updateRequest(env, id, { status: "REJECTED", rejection_reason: reason, operator_note: String(body.note || "").slice(0, 1000), rejected_at: new Date().toISOString() });
    await event(env, id, "REJECTED", reason, order.operator_name || "operator");
    return json({ id, status: "REJECTED" });
  }

  if (action !== "approve") return json({ error: "action must be approve or reject" }, 400);
  const patch = {
    status: "QUEUED_FOR_PRINTING",
    operator_note: String(body.note || "").slice(0, 1000),
    edited_file_path: body.editedFilePath || order.edited_file_path || null,
    final_file_path: body.finalFilePath || order.final_file_path || null,
    approved_at: new Date().toISOString(),
  };
  const updated = await updateRequest(env, id, patch);
  await event(env, id, "APPROVED", "Request approved and queued for printing", order.operator_name || "operator");
  return json(updated?.[0] || { id, status: patch.status });
}

async function agentStatus(request, env, id) {
  if (!agentOk(request, env)) return json({ error: "Unauthorized agent" }, 401);
  const body = await request.json().catch(() => ({}));
  const order = await getRequest(env, id);
  if (!order) return json({ error: "Request not found" }, 404);
  const allowed = ["PRINTING", "COMPLETED", "FAILED", "CANCELLED"];
  const status = String(body.status || "").toUpperCase();
  if (!allowed.includes(status)) return json({ error: "Invalid print status" }, 400);
  const patch = { status };
  if (status === "PRINTING") patch.printing_started_at = new Date().toISOString();
  if (status === "COMPLETED") patch.completed_at = new Date().toISOString();
  if (status === "FAILED") patch.last_error = String(body.error || "Print failed").slice(0, 1000);
  if (body.printedCopies != null) patch.printed_copies = Math.max(0, Number(body.printedCopies) || 0);
  if (body.printAttempts != null) patch.print_attempts = Math.max(0, Number(body.printAttempts) || 0);
  const updated = await updateRequest(env, id, patch);
  await event(env, id, status, body.message || status, order.operator_name || "agent");
  return json(updated?.[0] || { id, status });
}

async function downloadFile(request, env, id, kind = "original") {
  if (!agentOk(request, env)) return json({ error: "Unauthorized agent" }, 401);
  const order = await getRequest(env, id);
  if (!order) return json({ error: "Request not found" }, 404);
  const path = kind === "final" ? order.final_file_path : kind === "edited" ? order.edited_file_path : order.file_path;
  if (!path) return json({ error: "File not available" }, 404);
  const r = await supa(env, `/storage/v1/object/${BUCKET}/${path}`);
  if (!r.ok) return json({ error: "File download failed" }, 502);
  return new Response(r.body, { status: 200, headers: cors({ "Content-Type": r.headers.get("Content-Type") || "application/octet-stream", "Content-Disposition": `attachment; filename="${cleanName(order.original_file_name)}"` }) });
}

async function cleanup(env) {
  const rows = await supaJson(env, `/rest/v1/print_requests?status=eq.COMPLETED&delete_after=lt.${encodeURIComponent(new Date().toISOString())}&select=id,file_path,edited_file_path,final_file_path&limit=100`);
  for (const row of rows || []) {
    for (const path of [row.file_path, row.edited_file_path, row.final_file_path].filter(Boolean)) {
      await supa(env, `/storage/v1/object/${BUCKET}/${path}`, { method: "DELETE" }).catch(() => {});
    }
    await updateRequest(env, row.id, { file_path: null, edited_file_path: null, final_file_path: null, original_deleted_at: new Date().toISOString(), edited_deleted_at: new Date().toISOString(), cleanup_completed_at: new Date().toISOString() }).catch(() => {});
  }
  return rows?.length || 0;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return json({ status: "ok", service: "Jangira AutoPrint Backend", storage: "Supabase" });
      if (url.pathname === "/api/print-requests" && request.method === "POST") return createPrintRequest(request, env);
      const m = url.pathname.match(/^\/api\/print-requests\/([^/]+)\/payment$/);
      if (m && request.method === "POST") return submitPayment(request, env, m[1]);
      const s = url.pathname.match(/^\/api\/print-requests\/([^/]+)$/);
      if (s && request.method === "GET") {
        const row = await getRequest(env, s[1]);
        if (!row) return json({ error: "Request not found" }, 404);
        return json({ id: row.id, requestNumber: row.request_number, fileName: row.original_file_name, copies: row.copies, sides: row.sides, pageRange: row.page_range, amount: row.payment_amount, paymentStatus: row.payment_status, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, queuePosition: null });
      }
      if (url.pathname === "/api/agent/queue" && request.method === "GET") return agentQueue(request, env);
      const claim = url.pathname.match(/^\/api\/agent\/requests\/([^/]+)\/claim$/);
      if (claim && request.method === "POST") return agentClaim(request, env, claim[1]);
      const decision = url.pathname.match(/^\/api\/agent\/requests\/([^/]+)\/decision$/);
      if (decision && request.method === "POST") return agentDecision(request, env, decision[1]);
      const printStatus = url.pathname.match(/^\/api\/agent\/requests\/([^/]+)\/status$/);
      if (printStatus && request.method === "POST") return agentStatus(request, env, printStatus[1]);
      const file = url.pathname.match(/^\/api\/agent\/requests\/([^/]+)\/file\/(original|edited|final)$/);
      if (file && request.method === "GET") return downloadFile(request, env, file[1], file[2]);
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: "Backend error", details: String(e?.message || e).slice(0, 500) }, 500);
    }
  },
  async scheduled(_controller, env) {
    await cleanup(env);
  },
};
