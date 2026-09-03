using JangiraEmitra.Api.Data;
using JangiraEmitra.Api.Models;
using JangiraEmitra.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JangiraEmitra.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(AppDbContext db, PrintQueueService queue) : ControllerBase
{
    private const decimal PricePerPage = 5m;

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FileName)) return BadRequest(new { error = "File name is required." });
        if (request.Copies is < 1 or > 100 || request.PageCount is < 1 or > 10000) return BadRequest(new { error = "Invalid print options." });
        if (request.Sides is not ("single" or "double")) return BadRequest(new { error = "Invalid sides option." });
        if (request.Orientation is not ("portrait" or "landscape")) return BadRequest(new { error = "Invalid orientation option." });
        var selectedPages = string.IsNullOrWhiteSpace(request.SelectedPages) ? "all" : request.SelectedPages.Trim();
        var selectedCount = CountSelectedPages(selectedPages, request.PageCount);
        if (selectedCount is null or < 1) return BadRequest(new { error = "Invalid page selection." });
        var number = $"JEM-{DateTime.UtcNow.Year}-{Random.Shared.Next(1, 999999):D6}";
        while (await db.Orders.AnyAsync(x => x.OrderNumber == number)) number = $"JEM-{DateTime.UtcNow.Year}-{Random.Shared.Next(1, 999999):D6}";
        var order = new Order { OrderNumber = number, FileName = Path.GetFileName(request.FileName.Trim()), PageCount = request.PageCount, SelectedPages = selectedPages, Copies = request.Copies, Sides = request.Sides, Orientation = request.Orientation, Amount = selectedCount.Value * request.Copies * PricePerPage, ExpiresAtUtc = DateTime.UtcNow.AddMinutes(2) };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = order.OrderNumber }, ToDto(order, selectedCount.Value));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    [HttpPost("{id}/payment")]
    public async Task<IActionResult> Payment(string id, PaymentRequest request)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.ExpiresAtUtc < DateTime.UtcNow && order.PaymentStatus == PaymentStatus.Pending) { order.PaymentStatus = PaymentStatus.Expired; order.Status = OrderStatus.PaymentExpired; await db.SaveChangesAsync(); return BadRequest(new { error = "Payment window expired." }); }
        if (request.Paid) order.PaymentStatus = PaymentStatus.Paid;
        await db.SaveChangesAsync();
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    [HttpPost("{id}/send-print-request")]
    public async Task<IActionResult> SendPrintRequest(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.PaymentStatus != PaymentStatus.Paid) return BadRequest(new { error = "Payment must be verified before sending the print request." });
        order.Status = OrderStatus.AwaitingPaymentVerification;
        await db.SaveChangesAsync();
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.Status != OrderStatus.AwaitingPaymentVerification) return BadRequest(new { error = "Order is not awaiting verification." });
        order.Status = OrderStatus.Approved;
        await db.SaveChangesAsync();
        var job = await queue.EnqueueAsync(order);
        return Ok(new { order = ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount), printJob = job });
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> Reject(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.Status != OrderStatus.AwaitingPaymentVerification) return BadRequest(new { error = "Order is not awaiting verification." });
        order.Status = OrderStatus.Rejected;
        await db.SaveChangesAsync();
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    [HttpGet("{id}/queue")]
    public async Task<IActionResult> Queue(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        var job = await db.PrintJobs.SingleOrDefaultAsync(x => x.OrderId == order.Id);
        return Ok(job is null ? new { queued = false } : new { queued = true, job });
    }

    private static int? CountSelectedPages(string value, int pageCount)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Equals("all", StringComparison.OrdinalIgnoreCase)) return pageCount;
        var selected = new HashSet<int>();
        foreach (var raw in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(raw, out var single)) { if (single < 1 || single > pageCount) return null; selected.Add(single); continue; }
            var parts = raw.Split('-', StringSplitOptions.TrimEntries);
            if (parts.Length != 2 || !int.TryParse(parts[0], out var a) || !int.TryParse(parts[1], out var b)) return null;
            if (a > b) (a, b) = (b, a);
            if (a < 1 || b > pageCount) return null;
            for (var i = a; i <= b; i++) selected.Add(i);
        }
        return selected.Count == 0 ? null : selected.Count;
    }

    private static object ToDto(Order o, int selectedCount) => new { o.OrderNumber, o.FileName, o.PageCount, o.SelectedPages, selectedPageCount = selectedCount, o.Copies, colour = "bw", o.Sides, o.Orientation, pricePerPage = PricePerPage, o.Amount, paymentStatus = o.PaymentStatus.ToString(), status = o.Status.ToString(), o.CreatedAtUtc, o.ExpiresAtUtc };
}

public sealed record CreateOrderRequest(string FileName, int PageCount, string SelectedPages, int Copies, string Sides, string Orientation);
public sealed record PaymentRequest(bool Paid);