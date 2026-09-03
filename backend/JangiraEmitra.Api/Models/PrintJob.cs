namespace JangiraEmitra.Api.Models;

public enum PrintJobStatus { Queued, Downloading, Validating, Printing, Completed, Failed, Cancelled }

public sealed class PrintJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public string JobNumber { get; set; } = "";
    public int QueuePosition { get; set; }
    public PrintJobStatus Status { get; set; } = PrintJobStatus.Queued;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? ErrorMessage { get; set; }
}