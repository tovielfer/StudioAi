import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { getSumitConfig, isSumitConfigured, SumitConfig } from '../config/billing';

export interface SumitCustomer {
  name: string;
  email: string;
  externalId: string;
}

export interface SumitChargeParams {
  /** SingleUseToken produced client-side by payments.js (the og-token field). */
  singleUseToken: string;
  amountIls: number;
  description: string;
  customer: SumitCustomer;
  /** Stable per-order id — blocks a duplicate charge if the call is retried. */
  uniqueIdentifier: string;
}

/** A permanent (vaulted) card we charge against without re-collecting details. */
export interface SumitSavedCard {
  cardToken: string;
  citizenId: string | null;
  expMonth: string | null;
  expYear: string | null;
}

export interface SumitSavedChargeParams {
  savedCard: SumitSavedCard;
  amountIls: number;
  description: string;
  customer: SumitCustomer;
  uniqueIdentifier: string;
}

export interface SumitChargeResult {
  ok: boolean;
  paymentId: string | null;
  documentId: string | null;
  /** SUMIT customer id — needed to fetch/save the vaulted card afterwards. */
  customerId: string | null;
  raw: unknown;
  /** User-facing error message from SUMIT when the charge fails. */
  errorMessage?: string;
}

/** A card SUMIT has vaulted for the customer, ready for future token charges. */
export interface SumitPaymentMethod {
  cardToken: string;
  last4: string | null;
  brand: string | null;
  expMonth: string | null;
  expYear: string | null;
  citizenId: string | null;
}

/**
 * Thin wrapper over the SUMIT (OfficeGuy) Billing API.
 *
 * Two charge paths, both keeping raw card data off our server:
 *  - {@link charge}: one-off charge against a browser-created SingleUseToken.
 *  - {@link chargeSavedCard}: charge a previously vaulted card by its permanent
 *    token (used for one-click repeat purchases).
 *
 * Docs: https://app.sumit.co.il/developers/api/  (POST /billing/payments/charge/)
 */
@Injectable()
export class SumitService {
  private readonly logger = new Logger(SumitService.name);

  isConfigured(): boolean {
    return isSumitConfigured();
  }

  /** One-off charge against a single-use token from payments.js. */
  async charge(params: SumitChargeParams): Promise<SumitChargeResult> {
    const cfg = this.requireConfig();
    const body = this.baseChargeBody(cfg, params);
    body.SingleUseToken = params.singleUseToken;
    return this.executeCharge(cfg, body, params.uniqueIdentifier);
  }

  /**
   * Charge a previously saved card by its permanent token. SUMIT/Shva require
   * the cardholder's citizen id (taken from the saved record, never client
   * input) to authorise a token charge.
   */
  async chargeSavedCard(
    params: SumitSavedChargeParams,
  ): Promise<SumitChargeResult> {
    const cfg = this.requireConfig();
    const body = this.baseChargeBody(cfg, params);
    body.PaymentMethod = {
      Type: 1, // 1 = credit card
      CreditCard_Token: params.savedCard.cardToken,
      CreditCard_CitizenID: params.savedCard.citizenId ?? undefined,
      CreditCard_ExpirationMonth: params.savedCard.expMonth ?? undefined,
      CreditCard_ExpirationYear: params.savedCard.expYear ?? undefined,
    };
    return this.executeCharge(cfg, body, params.uniqueIdentifier);
  }

  /**
   * Fetches the customer's active vaulted card (if any) so we can persist a
   * reusable token after a first successful charge. Returns null when SUMIT has
   * no saved method — saving is then silently skipped (never blocks a purchase).
   */
  async getSavedCard(customerId: string): Promise<SumitPaymentMethod | null> {
    const cfg = this.requireConfig();
    const url = `${cfg.baseUrl}/billing/paymentmethods/getforcustomer/`;
    const body = {
      Credentials: { CompanyID: cfg.companyId, APIKey: cfg.apiKey },
      CustomerID: customerId,
    };

    let json: SumitPaymentMethodResponse;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      json = (await res.json()) as SumitPaymentMethodResponse;
    } catch (err) {
      this.logger.warn(
        `SUMIT getforcustomer failed (customer=${customerId}): ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }

    const method = json?.Data?.PaymentMethod;
    const token = method?.CreditCard_Token;
    if (!method || !token) return null;

    return {
      cardToken: token,
      last4: this.extractLast4(method),
      brand: method.CreditCard_Brand ?? method.CreditCard_Type ?? null,
      expMonth: this.toStr(method.CreditCard_ExpirationMonth),
      expYear: this.toStr(method.CreditCard_ExpirationYear),
      citizenId: this.toStr(method.CreditCard_CitizenID),
    };
  }

  /** Removes the customer's active vaulted card in SUMIT. Best-effort. */
  async removeSavedCard(customerId: string): Promise<void> {
    const cfg = this.requireConfig();
    const url = `${cfg.baseUrl}/billing/paymentmethods/remove/`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Credentials: { CompanyID: cfg.companyId, APIKey: cfg.apiKey },
          CustomerID: customerId,
        }),
      });
    } catch (err) {
      this.logger.warn(
        `SUMIT paymentmethods/remove failed (customer=${customerId}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private requireConfig(): SumitConfig {
    const cfg = getSumitConfig();
    if (!isSumitConfigured(cfg)) {
      throw new ServiceUnavailableException('Payment gateway is not configured');
    }
    return cfg;
  }

  /** Shared charge body (customer + items + document flags), minus the auth. */
  private baseChargeBody(
    cfg: SumitConfig,
    params: {
      amountIls: number;
      description: string;
      customer: SumitCustomer;
      uniqueIdentifier: string;
    },
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      Credentials: { CompanyID: cfg.companyId, APIKey: cfg.apiKey },
      Customer: {
        Name: params.customer.name,
        EmailAddress: params.customer.email,
        ExternalIdentifier: params.customer.externalId,
        // 2 = find-or-create by ExternalIdentifier (no duplicate customers).
        SearchMode: 2,
      },
      Items: [
        {
          Item: { Name: params.description },
          Quantity: 1,
          UnitPrice: params.amountIls,
        },
      ],
      // Prices are stored in ILS including VAT; let SUMIT use the company VAT.
      VATIncluded: true,
      UniqueIdentifier: params.uniqueIdentifier,
    };

    if (cfg.issueDocument) {
      // 1 = InvoiceAndReceipt (חשבונית מס/קבלה).
      body.DocumentType = 1;
      body.SendDocumentByEmail = true;
    }

    return body;
  }

  private async executeCharge(
    cfg: SumitConfig,
    body: Record<string, unknown>,
    uniqueIdentifier: string,
  ): Promise<SumitChargeResult> {
    const url = `${cfg.baseUrl}/billing/payments/charge/`;

    let json: SumitResponse;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      json = (await res.json()) as SumitResponse;
    } catch (err) {
      this.logger.error(
        `SUMIT charge request failed: ${err instanceof Error ? err.message : err}`,
      );
      throw new ServiceUnavailableException('Payment gateway unreachable');
    }

    const ok = this.isSuccess(json);
    const payment = json?.Data?.Payment;
    const result: SumitChargeResult = {
      ok,
      paymentId: payment?.ID != null ? String(payment.ID) : null,
      documentId:
        json?.Data?.DocumentID != null ? String(json.Data.DocumentID) : null,
      customerId:
        json?.Data?.CustomerID != null ? String(json.Data.CustomerID) : null,
      raw: json,
    };

    if (!ok) {
      // A declined card carries its reason in Payment.StatusDescription; the
      // request-level UserErrorMessage is only set for request/validation errors.
      result.errorMessage =
        json?.UserErrorMessage ||
        payment?.StatusDescription ||
        'התשלום נדחה. בדוק את פרטי הכרטיס ונסי שוב.';
      this.logger.warn(
        `SUMIT charge declined (uid=${uniqueIdentifier}): ${result.errorMessage}`,
      );
    }

    return result;
  }

  /**
   * SUMIT wraps responses in `{ Status, UserErrorMessage, Data }` where Status 0
   * means the request succeeded. The actual payment validity lives in
   * `Data.Payment` (`ValidPayment` true, or a Status of "0"/"000").
   */
  private isSuccess(json: SumitResponse | undefined): boolean {
    if (!json || json.Status !== 0) return false;
    const payment = json.Data?.Payment;
    if (!payment) return false;
    if (typeof payment.ValidPayment === 'boolean') return payment.ValidPayment;
    const status = String(payment.Status ?? '');
    return status === '0' || status === '000';
  }

  private extractLast4(method: SumitVaultedMethod): string | null {
    const digits = this.toStr(method.CreditCard_LastDigits);
    if (digits) return digits.slice(-4);
    const mask = this.toStr(method.CreditCard_Number) ?? this.toStr(method.CardMask);
    if (mask) {
      const onlyDigits = mask.replace(/\D/g, '');
      if (onlyDigits.length >= 4) return onlyDigits.slice(-4);
    }
    return null;
  }

  private toStr(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  }
}

interface SumitResponse {
  Status?: number;
  UserErrorMessage?: string | null;
  Data?: {
    Payment?: {
      ID?: number | string;
      Status?: number | string;
      StatusDescription?: string;
      ValidPayment?: boolean;
    };
    DocumentID?: number | string;
    CustomerID?: number | string;
  };
}

interface SumitVaultedMethod {
  CreditCard_Token?: string;
  CreditCard_LastDigits?: number | string;
  CreditCard_Number?: string;
  CardMask?: string;
  CreditCard_Brand?: string;
  CreditCard_Type?: string;
  CreditCard_ExpirationMonth?: number | string;
  CreditCard_ExpirationYear?: number | string;
  CreditCard_CitizenID?: number | string;
}

interface SumitPaymentMethodResponse {
  Status?: number;
  UserErrorMessage?: string | null;
  Data?: {
    PaymentMethod?: SumitVaultedMethod | null;
  };
}
