# Jangira AutoPrint Cloudflare Worker Backend

This Worker is the public API gateway for the Jangira E-Mitra print flow. It keeps the Supabase service-role key on the server and stores uploaded documents in the private `print-files` bucket.

## Secrets

Configure these in Cloudflare Worker Secrets; never put them in GitHub or frontend JavaScript:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENT_TOKEN`

`AGENT_TOKEN` is a dedicated secret used only by the Windows Jangira Agent.

## Deploy

From `backend/worker` with Wrangler installed:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put AGENT_TOKEN
wrangler deploy
```

The existing Supabase project must contain the `print_requests` and `print_request_events` tables and the private `print-files` storage bucket.

## Public customer API

- `POST /api/print-requests` — multipart upload and request creation
- `GET /api/print-requests/{id}` — customer-safe status
- `POST /api/print-requests/{id}/payment` — submit UPI UTR for operator verification
- `GET /health` — health check

## Agent API

All Agent endpoints require `X-Agent-Token` or `Authorization: Bearer <AGENT_TOKEN>`.

- `GET /api/agent/queue`
- `POST /api/agent/requests/{id}/claim`
- `POST /api/agent/requests/{id}/decision`
- `POST /api/agent/requests/{id}/status`
- `GET /api/agent/requests/{id}/file/original`
- `GET /api/agent/requests/{id}/file/edited`
- `GET /api/agent/requests/{id}/file/final`

The backend is authoritative for status. The Agent should claim a job before review/printing and must not print an unapproved request.

## Cleanup

The scheduled Worker runs every 15 minutes and removes storage objects for completed requests after their `delete_after` timestamp. It then clears the file paths from the database while retaining the audit/status record.
