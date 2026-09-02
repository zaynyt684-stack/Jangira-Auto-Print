using JangiraEmitra.Api.Data;
using JangiraEmitra.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JangiraEmitra.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        if (request.Copies is < 1 or > 100 || request.PageCount < 1) return BadRequest(new { error = "Invalid print options." });
        var number = $"JEM-{DateTime.UtcNow.Year}-{Random.Shared.Next(1, 999999):D6}";
        while (await db.Orders.AnyAsync(x => x.OrderNumber == number)) number = $"JEM-{DateTime.UtcNow.Year}-{Random.Shared.Next(1, 999999):D6}";
        var order = new Order { OrderNumber = number, FileName = request.FileName, PageCount = request.PageCount, SelectedPages = request.SelectedPages ?? "all", Copies = request.Copies, Colour = request.Colour ?? "bw", Sides = request.Sides ?? "single", Orientation = request.Orientation ?? "portrait", Amount = request.Amount, ExpiresAtUtc = DateTime.UtcNow.AddMinutes(2) };
        db.Orders.Add(order); await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = order.OrderNumber }, ToDto(order));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        return Ok(ToDto(order));
    }

    [HttpPost("{id}/payment")]
    public async Task<IActionResult> Payment(string id, PaymentRequest request)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.ExpiresAtUtc < DateTime.UtcNow && order.PaymentStatus == PaymentStatus.Pending) { order.PaymentStatus = PaymentStatus.Expired; order.Status = OrderStatus.PaymentExpired; await db.SaveChangesAsync(); return BadRequest(new { error = "Payment window expired." }); }
        if (request.Paid) order.PaymentStatus = PaymentStatus.Paid;
        await db.SaveChangesAsync();
        return Ok(ToDto(order));
    }

    [HttpPost("{id}/send-print-request")]
    public async Task<IActionResult> SendPrintRequest(string id)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.OrderNumber == id);
        if (order is null) return NotFound(new { error = "Order not found." });
        if (order.PaymentStatus != PaymentStatus.Paid) return BadRequest(new { error = "Payment must be marked paid before sending the print request." });
        order.Status = OrderStatus.AwaitingPaymentVerification; await db.SaveChangesAsync();
        return Ok(ToDto(order));
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
        order.Status = next; await db.SaveChangesAsync(); return Ok(ToDto(order));
    }

    private static object ToDto(Order o) => new { o.OrderNumber, o.FileName, o.PageCount, o.SelectedPages, o.Copies, o.Colour, o.Sides, o.Orientation, o.Amount, paymentStatus = o.PaymentStatus.ToString(), status = o.Status.ToString(), o.CreatedAtUtc, o.ExpiresAtUtc };
}

public sealed record CreateOrderRequest(string FileName, int PageCount, string? SelectedPages, int Copies, string? Colour, string? Sides, string? Orientation, decimal Amount);
public sealed record PaymentRequest(bool Paid);
