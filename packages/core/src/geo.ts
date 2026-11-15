import { ApexRequestContext } from "@apex14/http";
import type { Handler } from "./types.js";

export interface GeoSteerOptions {
  regions: Record<string, (ctx: ApexRequestContext) => any | Promise<any>>;
  fallback: (ctx: ApexRequestContext) => any | Promise<any>;
}

export class ApexGeoEngine {
  public getCountry(ctx: ApexRequestContext): string {
    return (
      ctx.headers["cf-ipcountry"] ||
      ctx.headers["x-vercel-ip-country"] ||
      ctx.headers["x-country-code"] ||
      ctx.headers["x-geo-country"] ||
      "UNKNOWN"
    ).toUpperCase();
  }

  public getRegion(ctx: ApexRequestContext): string {
    const directRegion = ctx.headers["x-region"] || ctx.headers["x-geo-region"];
    if (directRegion) return directRegion.toLowerCase();

    const country = this.getCountry(ctx);
    // Asian countries
    if (["ID", "SG", "MY", "TH", "VN", "PH", "JP", "KR", "CN", "IN", "AU"].includes(country)) {
      return "asia";
    }
    // European countries
    if (["GB", "DE", "FR", "NL", "IE", "ES", "IT", "SE", "CH", "PL"].includes(country)) {
      return "europe";
    }
    // Americas
    if (["US", "CA", "MX", "BR", "AR"].includes(country)) {
      return "americas";
    }

    return "default";
  }

  public steer(options: GeoSteerOptions): Handler {
    return async (ctx: ApexRequestContext) => {
      const region = this.getRegion(ctx);
      const country = this.getCountry(ctx);

      // 1. Try exact country match (e.g. "id", "sg")
      if (options.regions[country.toLowerCase()]) {
        return await options.regions[country.toLowerCase()]!(ctx);
      }

      // 2. Try regional match (e.g. "asia", "europe")
      if (options.regions[region]) {
        return await options.regions[region]!(ctx);
      }

      // 3. Fallback
      return await options.fallback(ctx);
    };
  }
}

export const geo = new ApexGeoEngine();
