using Microsoft.AspNetCore.Mvc;
namespace JangiraEmitra.Api.Controllers;
[ApiController]
[Route("api/agent")]
public sealed class AgentController : ControllerBase
{
    [HttpGet("jobs")]
    public IActionResult Jobs() => Ok(Array.Empty<object>());
    [HttpPost("heartbeat")]
    public IActionResult Heartbeat([FromBody] HeartbeatRequest request) => Ok(new { ok = true, agentId = request.AgentId, serverUtc = DateTime.UtcNow });
    [HttpPost("jobs/{id}/status")]
    public IActionResult Status(string id, [FromBody] AgentStatusRequest request) => Ok(new { jobId = id, status = request.Status, accepted = true });
}
public sealed record HeartbeatRequest(string AgentId, string? PrinterName);
public sealed record AgentStatusRequest(string Status, string? Message);
