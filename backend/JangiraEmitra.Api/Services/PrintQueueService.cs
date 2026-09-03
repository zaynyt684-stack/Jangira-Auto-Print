using JangiraEmitra.Api.Data;
using JangiraEmitra.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JangiraEmitra.Api.Services;

public sealed class PrintQueueService(AppDbContext db)
{
    public async Task<PrintJob> EnqueueAsync(Order order)
    {
        var existing = await db.PrintJobs.SingleOrDefaultAsync(x => x.OrderId == order.Id);
        if (existing is not null) return existing;

        var position = await db.PrintJobs.CountAsync(x => x.Status == PrintJobStatus.Queued) + 1;
        var job = new PrintJob
        {
            OrderId = order.Id,
            JobNumber = $"PJ-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(100000, 999999)}",
            QueuePosition = position
        };
        db.PrintJobs.Add(job);
        order.Status = OrderStatus.Queued;
        await db.SaveChangesAsync();
        return job;
    }

    public async Task<List<PrintJob>> GetQueuedAsync(int take = 25) =>
        await db.PrintJobs.Where(x => x.Status == PrintJobStatus.Queued)
            .OrderBy(x => x.CreatedAtUtc).Take(Math.Clamp(take, 1, 100)).ToListAsync();
}