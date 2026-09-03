using JangiraEmitra.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JangiraEmitra.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<PrintJob> PrintJobs => Set<PrintJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Order>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.OrderNumber).IsUnique();
            e.Property(x => x.OrderNumber).HasMaxLength(32).IsRequired();
            e.Property(x => x.Amount).HasPrecision(10, 2);
            e.Property(x => x.Status).HasConversion<string>();
            e.Property(x => x.PaymentStatus).HasConversion<string>();
        });

        modelBuilder.Entity<PrintJob>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.OrderId).IsUnique();
            e.HasIndex(x => new { x.Status, x.CreatedAtUtc });
            e.HasIndex(x => x.JobNumber).IsUnique();
            e.Property(x => x.JobNumber).HasMaxLength(40).IsRequired();
            e.Property(x => x.Status).HasConversion<string>();
        });
    }
}