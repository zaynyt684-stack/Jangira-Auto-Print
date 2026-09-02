using JangiraEmitra.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
namespace JangiraEmitra.Api.Services;
public sealed class OrderStatusNotifier(IHubContext<OrderHub> hub)
{
    public Task NotifyAsync(string orderNumber, string status) => hub.Clients.Group($"order:{orderNumber}").SendAsync("orderStatusChanged", new { orderNumber, status });
}
