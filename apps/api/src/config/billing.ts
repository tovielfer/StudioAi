/**
 * Central billing configuration. Decouples the internal "credit" unit from the
 * USD provider cost so prices can be shown and sold in ILS.
 *
 * The credit cost of a generation is derived at the *best* (largest-package)
 * rate: `credits = ceil(sellUsd * USD_ILS / CREDIT_VALUE_ILS)`, where
 * `sellUsd = providerCostUsd * margin`. Smaller packages grant fewer credits
 * per shekel, so the per-generation credit cost stays fixed while a small-pack
 * buyer effectively pays more per credit (extra profit).
 *
 * All three values are env-overridable so pricing can be tuned without code
 * changes; the defaults reproduce the locked plan decisions.
 */
export interface BillingConfig {
  /** USD -> ILS exchange rate used to convert provider cost to shekels. */
  usdIls: number;
  /** Default sell margin over provider cost (sell = cost * margin). */
  targetMargin: number;
  /** Shekel value of one credit at the best (largest-package) rate. */
  creditValueIls: number;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBillingConfig(): BillingConfig {
  return {
    usdIls: num(process.env.USD_ILS, 3.7),
    targetMargin: num(process.env.TARGET_MARGIN, 2.0),
    creditValueIls: num(process.env.CREDIT_VALUE_ILS, 0.01),
  };
}

/** Converts a sell price in USD into whole credits (rounded up). */
export function usdToCredits(sellUsd: number, cfg = getBillingConfig()): number {
  return Math.ceil((sellUsd * cfg.usdIls) / cfg.creditValueIls);
}

/** Shekel value of a credit amount at the best rate. */
export function creditsToIls(credits: number, cfg = getBillingConfig()): number {
  return Math.round(credits * cfg.creditValueIls * 100) / 100;
}

/**
 * SUMIT (OfficeGuy) payment-gateway configuration.
 *
 * The secret `apiKey` is server-only and must never reach the browser. The
 * `companyId` + `apiPublicKey` are safe for the client (used by payments.js for
 * card tokenization) and are exposed to the web app via NEXT_PUBLIC_* vars.
 */
export interface SumitConfig {
  baseUrl: string;
  companyId: number;
  apiKey: string;
  /** When true, the charge also issues a tax invoice/receipt (DocumentType). */
  issueDocument: boolean;
}

export function getSumitConfig(): SumitConfig {
  return {
    baseUrl: (process.env.SUMIT_API_BASE || 'https://api.sumit.co.il').replace(
      /\/+$/,
      '',
    ),
    companyId: Number(process.env.SUMIT_COMPANY_ID) || 0,
    apiKey: process.env.SUMIT_API_KEY || '',
    issueDocument: process.env.SUMIT_ISSUE_DOCUMENT !== 'false',
  };
}

/** True only when the gateway has the credentials it needs to charge. */
export function isSumitConfigured(cfg = getSumitConfig()): boolean {
  return cfg.companyId > 0 && cfg.apiKey.length > 0;
}
