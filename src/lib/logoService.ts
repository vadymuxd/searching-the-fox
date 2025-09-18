// Logo Service for fetching company logos from multiple sources
export class LogoService {
  private static cache = new Map<string, string>();

  // Generate company logo URLs from multiple sources with fallback strategy
  static generateLogoUrls(companyName: string, existingLogoUrl?: string, sourceSite?: string): string[] {
    const cacheKey = companyName.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return [this.cache.get(cacheKey)!];
    }

    const cleanCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const companyDomain = companyName.toLowerCase().replace(/\s+/g, '');
    const companySlug = companyName.toLowerCase().replace(/\s+/g, '-');
    const companyWords = companyName.toLowerCase().split(' ')[0]; // First word only
    
    // For Indeed jobs, skip the provided logo and go straight to fallbacks
    // because Indeed always provides its own logo, not the company logo
    const shouldUseExistingLogo = existingLogoUrl && sourceSite !== 'Indeed';
    
    const fallbackUrls = [
      shouldUseExistingLogo ? existingLogoUrl : null, // Skip Indeed's logo
      
      // Clearbit API (first priority - most reliable)
      `https://logo.clearbit.com/${companyDomain}.com`,
      `https://logo.clearbit.com/${cleanCompany}.com`,
      `https://logo.clearbit.com/${companySlug}.com`,
      `https://logo.clearbit.com/${companyWords}.com`,
      
      // Logo.dev service (second priority)
      `https://img.logo.dev/${companyDomain}.com?token=pk_X-1ZO13hT3iEkUUylGIShw`,
      `https://img.logo.dev/${cleanCompany}.com?token=pk_X-1ZO13hT3iEkUUylGIShw`,
      
      // Google favicons (reliable fallback)
      `https://www.google.com/s2/favicons?domain=${companyDomain}.com&sz=64`,
      `https://www.google.com/s2/favicons?domain=${cleanCompany}.com&sz=64`,
      `https://www.google.com/s2/favicons?domain=${companyWords}.com&sz=64`,
      
      // Alternative domains
      `https://logo.clearbit.com/${companyDomain}.co.uk`,
      `https://logo.clearbit.com/${companyDomain}.org`,
      `https://logo.clearbit.com/${companyDomain}.net`,
      `https://logo.clearbit.com/${companyDomain}.io`,
      
      // DuckDuckGo icons
      `https://icons.duckduckgo.com/ip3/${companyDomain}.com.ico`,
      `https://icons.duckduckgo.com/ip3/${cleanCompany}.com.ico`,
      
      // Brandfetch (moved back to later position)
      `https://assets.brandfetch.io/${companyDomain}.com`,
      `https://assets.brandfetch.io/${cleanCompany}.com`,
      
      // Alternative approaches for common company variations
      ...this.generateVariationUrls(companyName),
      
    ].filter(Boolean) as string[];

    return fallbackUrls;
  }

  // Generate URLs for common company name variations
  private static generateVariationUrls(companyName: string): string[] {
    const variations = [];
    const name = companyName.toLowerCase();
    
    // Handle common company suffixes
    const suffixes = ['inc', 'corp', 'ltd', 'llc', 'co', 'company', 'corporation', 'limited'];
    const baseName = name.replace(new RegExp(`\\b(${suffixes.join('|')})\\b`, 'g'), '').trim();
    
    if (baseName !== name) {
      const cleanBase = baseName.replace(/[^a-z0-9]/g, '');
      variations.push(
        `https://logo.clearbit.com/${cleanBase}.com`,
        `https://www.google.com/s2/favicons?domain=${cleanBase}.com&sz=64`,
      );
    }

    // Handle common patterns like "Company Ltd" -> "company"
    const firstWord = name.split(' ')[0];
    if (firstWord.length > 2) {
      variations.push(
        `https://logo.clearbit.com/${firstWord}.com`,
        `https://www.google.com/s2/favicons?domain=${firstWord}.com&sz=64`,
      );
    }

    return variations;
  }

  // Cache successful logo URL for future use
  static cacheLogoUrl(companyName: string, logoUrl: string): void {
    const cacheKey = companyName.toLowerCase();
    this.cache.set(cacheKey, logoUrl);
  }

  // Clear cache (useful for testing)
  static clearCache(): void {
    this.cache.clear();
  }

  // Try to fetch logo from LinkedIn-style company profile (experimental)
  static async fetchFromAlternativeSources(companyName: string): Promise<string | null> {
    try {
      // This is a conceptual approach - in practice, you might need to:
      // 1. Use a backend service to scrape LinkedIn company pages
      // 2. Use a paid API service that aggregates company data
      // 3. Maintain your own database of company logos
      
      // For now, we'll rely on the public APIs above
      const urls = this.generateLogoUrls(companyName);
      
      // Test the first few URLs to see if they're accessible
      for (const url of urls.slice(0, 3)) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            this.cacheLogoUrl(companyName, url);
            return url;
          }
        } catch {
          // Continue to next URL
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching logo from alternative sources:', error);
      return null;
    }
  }
}
