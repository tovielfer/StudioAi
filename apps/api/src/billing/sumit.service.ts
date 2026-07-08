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

export interface SumitSavedChargeParams {
  /** SUMIT customer id saved from a previous successful charge. */
  customerId: string;
  /** SUMIT payment-method (token) id saved from a previous successful charge. */
  paymentMethodId: string;
  amountIls: number;
  description: string;
  customer: SumitCustomer;
  uniqueIdentifier: string;
}

export interface SumitChargeResult {
  ok: boolean;
  paymentId: string | null;
  documentId: string | null;
  /** SUMIT customer id — persist to charge this customer again later. */
  customerId: string | null;
  /** Reusable payment-method (token) id — persist to charge the saved card. */
  paymentMethodId: string | null;
  /** Masked last digits of the saved card, for display only (may be null). */
  cardLast4: string | null;
  /** Card brand of the saved card, for display only (may be null). */
  cardBrand: string | null;
  raw: unknown;
  /** User-facing error message from SUMIT when the charge fails. */
  errorMessage?: string;
}

/**
 * Thin wrapper over the SUMIT (OfficeGuy) Billing API.
 *
 * Two flows are supported, both via POST /billing/payments/charge/:
 *  - `charge`: a one-off charge against a SingleUseToken created in the browser
 *    by payments.js, so raw card data never reaches our server. SUMIT stores the
 *    payment method as a reusable token on the customer, whose ids we return.
 *  - `chargeSaved`: a follow-up charge that reuses the saved CustomerID +
 *    PaymentMethodID (no SingleUseToken), for "buy again with saved card".
 *
 * Docs: https://app.sumit.co.il/developers/api/  (POST /billing/payments/charge/)
 */
@Injectable()
export class SumitService {
  private readonly logger = new Logger(SumitService.name);

  isConfigured(): boolean {
    return isSumitConfigured();
  }

  async charge(params: SumitChargeParams): Promise<SumitChargeResult> {
    const cfg = this.requireConfig();
    const body = this.baseBody(cfg, params);
    body.SingleUseToken = params.singleUseToken;
    return this.post(cfg, body, params.uniqueIdentifier);
  }

  /**
   * Charges the card previously saved for this customer. Uses the SUMIT
   * CustomerID + PaymentMethodID captured from an earlier `charge` instead of a
   * SingleUseToken, so the user does not have to re-enter card details.
   */
  async chargeSaved(params: SumitSavedChargeParams): Promise<SumitChargeResult> {
    const cfg = this.requireConfig();
    const body = this.baseBody(cfg, params);
    body.CustomerID = params.customerId;
    body.PaymentMethodID = params.paymentMethodId;
    return this.post(cfg, body, params.uniqueIdentifier);
  }

  private requireConfig(): SumitConfig {
    const cfg = getSumitConfig();
    if (!isSumitConfigured(cfg)) {
      throw new ServiceUnavailableException('Payment gateway is not configured');
    }
    return cfg;
  }

  /** Fields shared by both the token and saved-card charge requests. */
  private baseBody(
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

  private async post(
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
    const method = payment?.PaymentMethod ?? json?.Data?.PaymentMethod;

    const result: SumitChargeResult = {
      ok,
      paymentId: payment?.ID != null ? String(payment.ID) : null,
      documentId: json?.Data?.DocumentID != null ? String(json.Data.DocumentID) : null,
      customerId: this.extractCustomerId(json),
      paymentMethodId: method?.ID != null ? String(method.ID) : null,
      cardLast4: method?.CreditCard_LastDigits ?? method?.Last4Digits ?? null,
      cardBrand: method?.CreditCard_Brand ?? method?.Brand ?? null,
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

  /** Customer id can arrive under Data.Customer.ID or Data.Payment.CustomerID. */
  private extractCustomerId(json: SumitResponse | undefined): string | null {
    const id = json?.Data?.Customer?.ID ?? json?.Data?.Payment?.CustomerID;
    return id != null ? String(id) : null;
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
}

interface SumitPaymentMethod {
  ID?: number | string;
  CreditCard_LastDigits?: string;
  Last4Digits?: string;
  CreditCard_Brand?: string;
  Brand?: string;
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
      CustomerID?: number | string;
      PaymentMethod?: SumitPaymentMethod;
    };
    Customer?: { ID?: number | string };
    PaymentMethod?: SumitPaymentMethod;
    DocumentID?: number | string;
  };
}
