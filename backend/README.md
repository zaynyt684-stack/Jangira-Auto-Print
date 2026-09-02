# Jangira E-Mitra Backend

ASP.NET Core Web API (.NET 9) foundation for the Jangira E-Mitra online print system.

## Current flow

`Received → AwaitingPaymentVerification → Approved/Rejected → Queued → Printing → Completed`

Payment is intentionally separate from printing. A successful payment does **not** automatically start printing; the customer must send the print request and the operator must verify/approve it.

## Configuration

Set `ConnectionStrings:Default` and `Cors:Origins` through environment-specific configuration or deployment secrets. Never commit database passwords, Razorpay secrets, JWT secrets, or storage credentials.

## API

- `GET /health`
- `POST /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders/{id}/payment`
- `POST /api/orders/{id}/send-print-request`
- `POST /api/orders/{id}/approve`
- `POST /api/orders/{id}/reject`
