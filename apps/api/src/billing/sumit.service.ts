import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { getSumitConfig, isSumitConfigured } from '../config/billing';

export interface SumitChargeParams {
  /** SingleUseToken produced client-side by payments.js (the og-token field). */
  singleUseToken: string;
  amountIls: number;
  description: string;
  customer: { name: string; email: string; externalId: string };
  /** Stable per-order id — blocks a duplicate charge if the call is retried. */
  uniqueIdentifier: string;
}

export interface SumitChargeResult {
  ok: boolean;
  paymentId: string | null;
  documentId: string | null;
  raw: unknown;
  /** User-facing error message from SUMIT when the charge fails. */
  errorMessage?: string;
}

/**
 * Thin wrapper over the SUMIT (OfficeGuy) Billing API. Performs a one-off charge
 * against a SingleUseToken that was created in the browser by payments.js, so
 * raw card data never reaches our server.
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
    const cfg = getSumitConfig();
    if (!isSumitConfigured(cfg)) {
      throw new ServiceUnavailableException('Payment gateway is not configured');
    }

    const body: Record<string, unknown> = {
      Credentials: { CompanyID: cfg.companyId, APIKey: cfg.apiKey },
      Customer: {
        Name: params.customer.name,
        EmailAddress: params.customer.email,
        ExternalIdentifier: params.customer.externalId,
        // 2 = find-or-create by ExternalIdentifier (no duplicate customers).
        SearchMode: 2,
      },
      SingleUseToken: params.singleUseToken,
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
      documentId: json?.Data?.DocumentID != null ? String(json.Data.DocumentID) : null,
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
        `SUMIT charge declined (uid=${params.uniqueIdentifier}): ${result.errorMessage}`,
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
  };
}
