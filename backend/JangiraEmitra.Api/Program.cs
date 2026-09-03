using Microsoft.EntityFrameworkCore;
using JangiraEmitra.Api.Data;
using JangiraEmitra.Api.Hubs;
using JangiraEmitra.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<PricingService>();
builder.Services.AddScoped<OrderStatusNotifier>();
builder.Services.AddScoped<PrintQueueService>();
builder.Services.AddSignalR();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddPolicy("web", p => p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>()).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.UseHttpsRedirection();
app.UseCors("web");
app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Jangira E-Mitra API" }));
app.Run();