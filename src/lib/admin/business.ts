/**
 * Issuer details printed on quotes and invoices.
 *
 * ⚠️ TRN: UAE VAT-registered businesses must show their Tax Registration
 * Number on tax invoices. Fill it in once registered; while it is empty the
 * documents print without the TRN line.
 */
export const BUSINESS = {
  name: "SULOAI",
  tagline: "Automation & AI for Supply Chain",
  addressLines: ["Dubai", "United Arab Emirates"],
  email: "suloai.automation@gmail.com",
  website: "suloai.com",
  trn: "", // e.g. "100123456700003"
  paymentTerms: "Payment due within 30 days of the invoice date.",
  bankDetails: "", // e.g. "Emirates NBD · IBAN AE00 0000 0000 0000 0000 000"
} as const;

/**
 * UAE: only a VAT-registered business may issue a *tax* invoice or charge VAT,
 * and a tax invoice must show the supplier's TRN. So the document is titled
 * "Tax Invoice" only once a TRN is configured above; until then it is an
 * "Invoice", and the editor warns before VAT is added.
 */
export const IS_VAT_REGISTERED = BUSINESS.trn.trim().length > 0;
export const INVOICE_TITLE = IS_VAT_REGISTERED ? "Tax Invoice" : "Invoice";
