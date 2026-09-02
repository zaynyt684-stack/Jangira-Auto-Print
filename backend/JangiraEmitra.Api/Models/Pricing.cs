namespace JangiraEmitra.Api.Models;

public sealed class PricingOptions
{
    public decimal BwSinglePerPage { get; set; } = 2m;
    public decimal BwDoublePerPage { get; set; } = 1.5m;
    public decimal ColourSinglePerPage { get; set; } = 10m;
    public decimal ColourDoublePerPage { get; set; } = 8m;
}

public sealed record PriceQuote(int SelectedPageCount, int Copies, string Colour, string Sides, decimal PerPage, decimal Total);
