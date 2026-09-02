using JangiraEmitra.Api.Models;
using JangiraEmitra.Api.Services;
using Microsoft.AspNetCore.Mvc;
namespace JangiraEmitra.Api.Controllers;
[ApiController]
[Route("api/pricing")]
public sealed class PricingController(PricingService pricing) : ControllerBase
{
    [HttpGet]
    public ActionResult<PricingOptions> Get() => Ok(new PricingOptions());
    [HttpPost("quote")]
    public IActionResult Quote(PriceRequest request)
    {
        try { return Ok(pricing.Quote(request.PageCount, request.SelectedPages, request.Copies, request.Colour, request.Sides)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }
}
public sealed record PriceRequest(int PageCount, string? SelectedPages, int Copies, string? Colour, string? Sides);
