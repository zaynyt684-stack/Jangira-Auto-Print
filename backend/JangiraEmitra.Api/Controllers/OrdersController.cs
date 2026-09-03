using JangiraEmitra.Api.Data;
using JangiraEmitra.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JangiraEmitra.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(AppDbContext db) : ControllerBase
{
    private const decimal PricePerPage = 5m;

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FileName)) return BadRequest(new { error = "File name is required." });
        if (request.Copies is < 1 or > 100 || request.PageCount < 1) return BadRequest(new { error = "Invalid print options." });
        if (!string.Equals(request.Sides, "single", StringComparison.OrdinalIgnoreCase) && !string.Equals(request.Sides, "double", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { error = "Invalid sides option." });
        if (!string.Equals(request.Orientation, "portrait", StringComparison.OrdinalIgnoreCase) && !string.Equals(request.Orientation, "landscape", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { error = "Invalid orientation option." });

        var selectedPages = string.IsNullOrWhiteSpace(request.SelectedPages) ? "all" : request.SelectedPages.Trim();
        var selectedCount = CountSelectedPages(selectedPages, request.PageCount);
        if (selectedCount is null or < 1) return BadRequest(new { error = "Invalid page selection." });

        var number = $"JEM-{DateTime.UtcNow.Year}-{Random.Shared.Next(1, 999999):D6}";
        while (await db.Orders.AnyAsync(x => x.OrderNumber == number)) number = $"JEM-{DateTime.UtcNow.Year}-{Random.Shared.Next(1, 999999):D6}";

        var amount = selectedCount.Value * request.Copies * PricePerPage;
        var order = new Order
        {
            OrderNumber = number,
            FileName = request.FileName.Trim(),
            PageCount = request.PageCount,
            SelectedPages = selectedPages,
            Copies = request.Copies,
            Sides = request.Sides!.ToLowerInvariant(),
            Orientation = request.Orientation!.ToLowerInvariant(),
            Amount = amount,
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(2)
        };

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = order.OrderNumber }, ToDto(order, selectedCount.Value));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        var selectedCount = CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount;
        return Ok(ToDto(order, selectedCount));
    }

    [HttpPost("{id}/payment")]
    public async Task<IActionResult> Payment(string id, PaymentRequest request)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.ExpiresAtUtc < DateTime.UtcNow && order.PaymentStatus == PaymentStatus.Pending)
        {
            order.PaymentStatus = PaymentStatus.Expired;
            order.Status = OrderStatus.PaymentExpired;
            await db.SaveChangesAsync();
            return BadRequest(new { error = "Payment window expired." });
        }
        if (request.Paid) order.PaymentStatus = PaymentStatus.Paid;
        await db.SaveChangesAsync();
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    [HttpPost("{id}/send-print-request")]
    public async Task<IActionResult> SendPrintRequest(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.PaymentStatus != PaymentStatus.Paid) return BadRequest(new { error = "Payment must be marked paid before sending the print request." });
        order.Status = OrderStatus.AwaitingPaymentVerification;
        await db.SaveChangesAsync();
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    [HttpPost("{id}/approve")]
    public Task<IActionResult> Approve(string id) => Transition(id, OrderStatus.Approved);

    [HttpPost("{id}/reject")]
    public Task<IActionResult> Reject(string id) => Transition(id, OrderStatus.Rejected);

    private async Task<IActionResult> Transition(string id, OrderStatus next)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.Status != OrderStatus.AwaitingPaymentVerification) return BadRequest(new { error = "Order is not awaiting verification." });
        order.Status = next;
        await db.SaveChangesAsync();
        return Ok(ToDto(order, CountSelectedPages(order.SelectedPages, order.PageCount) ?? order.PageCount));
    }

    private static int? CountSelectedPages(string value, int pageCount)
    {
        var text = (value ?? "all").Trim().ToLowerInvariant();
        if (text == "all" || text.Length == 0) return pageCount;
        var selected = new HashSet<int>();
        foreach (var raw in text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
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

    private static object ToDto(Order o, int selectedCount) => new
    {
        o.OrderNumber,
        o.FileName,
        o.PageCount,
        o.SelectedPages,
        selectedPageCount = selectedCount,
        o.Copies,
        colour = "bw",
        o.Sides,
        o.Orientation,
        pricePerPage = PricePerPage,
        o.Amount,
        paymentStatus = o.PaymentStatus.ToString(),
        status = o.Status.ToString(),
        o.CreatedAtUtc,
        o.ExpiresAtUtc
    };
}

public sealed record CreateOrderRequest(string FileName, int PageCount, string? SelectedPages, int Copies, string? Sides, string? Orientation);
public sealed record PaymentRequest(bool Paid);
