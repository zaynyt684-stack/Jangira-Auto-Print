using JangiraEmitra.Api.Models;
namespace JangiraEmitra.Api.Services;
public sealed class PricingService(IConfiguration configuration)
{
    public PriceQuote Quote(int pageCount, string? selectedPages, int copies, string? colour, string? sides)
    {
        if (pageCount < 1 || pageCount > 10000) throw new ArgumentOutOfRangeException(nameof(pageCount));
        if (copies is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(copies));
        var selected = PageSelectionParser.Count(selectedPages, pageCount);
        var c = (colour ?? "bw").Trim().ToLowerInvariant();
        var s = (sides ?? "single").Trim().ToLowerInvariant();
        if (c is not ("bw" or "color")) throw new ArgumentException("Colour must be bw or color.");
        if (s is not ("single" or "double")) throw new ArgumentException("Sides must be single or double.");
        var options = configuration.GetSection("Pricing").Get<PricingOptions>() ?? new PricingOptions();
        var perPage = c == "color" ? (s == "double" ? options.ColourDoublePerPage : options.ColourSinglePerPage) : (s == "double" ? options.BwDoublePerPage : options.BwSinglePerPage);
        return new PriceQuote(selected, copies, c, s, perPage, decimal.Round(selected * copies * perPage, 2));
    }
}
public static class PageSelectionParser
{
    public static int Count(string? value, int maxPage)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Equals("all", StringComparison.OrdinalIgnoreCase)) return maxPage;
        var pages = new HashSet<int>();
        foreach (var raw in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (raw.Contains('-'))
            {
                var parts = raw.Split('-', 2, StringSplitOptions.TrimEntries);
                if (!int.TryParse(parts[0], out var start) || !int.TryParse(parts[1], out var end) || start < 1 || end < start || end > maxPage) throw new ArgumentException("Invalid page range.");
                for (var i = start; i <= end; i++) pages.Add(i);
            }
            else if (int.TryParse(raw, out var page) && page >= 1 && page <= maxPage) pages.Add(page);
            else throw new ArgumentException("Invalid page selection.");
        }
        return pages.Count;
    }
}
