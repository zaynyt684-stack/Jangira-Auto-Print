namespace JangiraEmitra.Api.Models;

public enum OrderStatus { Received, AwaitingPaymentVerification, Approved, Rejected, Queued, Downloading, Validating, Printing, Completed, Failed, Cancelled, PaymentExpired }
public enum PaymentStatus { Pending, Paid, Failed, Expired }

public sealed class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OrderNumber { get; set; } = "";
    public string FileName { get; set; } = "";
    public int PageCount { get; set; }
    public string SelectedPages { get; set; } = "all";
    public int Copies { get; set; } = 1;
    public string Colour { get; set; } = "bw";
    public string Sides { get; set; } = "single";
    public string Orientation { get; set; } = "portrait";
    public decimal Amount { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public OrderStatus Status { get; set; } = OrderStatus.Received;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAtUtc { get; set; }
}
