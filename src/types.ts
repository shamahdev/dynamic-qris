/** Rounding strategy used when a percentage customer fee produces fractional rupiah. */
export type RoundingStrategy = "ceil" | "floor" | "round";

/**
 * Customer-paid convenience charge added on top of the base transaction amount.
 * Fixed fees are rounded to the nearest rupiah; percentage fees use `ceil` by default.
 */
export type CustomerFee =
	| { type: "fixed"; value: number }
	| { type: "percentage"; value: number; rounding?: RoundingStrategy };

/** Controls how generation handles QRIS payloads that already contain tag 54 amount. */
export type GenerationMode = "strict" | "replace";

/** Optional tag 62 additional-data labels to embed into the generated QRIS payload. */
export type AdditionalDataOptions = {
	/** Merchant-facing transaction reference, such as an invoice ID or order ID. */
	referenceLabel?: string;
	/** POS terminal, cashier, outlet device, or source identifier. */
	terminalLabel?: string;
};

/** Best-effort metadata extracted from QRIS merchant account information. */
export type MerchantAccountMetadata = {
	/** EMV globally unique identifier, commonly the QRIS domain identifier. */
	globallyUniqueIdentifier?: string;
	/** Merchant PAN or account identifier encoded by the QRIS issuer. */
	merchantPan?: string;
	/** Optional merchant identifier when present in the account template. */
	merchantId?: string;
	/** Merchant criteria or category hint from the account template. */
	merchantCriteria?: string;
};

/** Best-effort metadata extracted from additional merchant account information. */
export type AdditionalMerchantMetadata = {
	/** EMV globally unique identifier for the additional merchant template. */
	globallyUniqueIdentifier?: string;
	/** Additional merchant PAN or account identifier. */
	merchantPan?: string;
	/** Merchant criteria from the additional merchant template. */
	merchantCriteria?: string;
};

/** Best-effort metadata extracted from tag 62 additional data fields. */
export type AdditionalDataMetadata = {
	/** Bill number label, tag 62.01. */
	billNumber?: string;
	/** Mobile number label, tag 62.02. */
	mobileNumber?: string;
	/** Store label, tag 62.03. */
	storeLabel?: string;
	/** Loyalty number label, tag 62.04. */
	loyaltyNumber?: string;
	/** Merchant-facing transaction reference, tag 62.05. */
	referenceLabel?: string;
	/** Customer label, tag 62.06. */
	customerLabel?: string;
	/** POS terminal or source identifier, tag 62.07. */
	terminalLabel?: string;
	/** Purpose of transaction label, tag 62.08. */
	purposeOfTransaction?: string;
	/** Additional consumer data request, tag 62.09. */
	additionalConsumerData?: string;
};

/**
 * Best-effort merchant-facing fields extracted from a valid QRIS payload.
 * Missing fields are omitted and never make validation or generation fail.
 */
export type Metadata = {
	/** Payload format indicator, tag 00. */
	payloadFormat?: string;
	/** Point of initiation method, tag 01. */
	pointOfInitiation?: string;
	/** Merchant account information, usually tag 26 for QRIS. */
	merchantAccount?: MerchantAccountMetadata;
	/** Additional merchant account information, tag 51 when present. */
	additionalMerchant?: AdditionalMerchantMetadata;
	/** Merchant category code, tag 52. */
	merchantCategoryCode?: string;
	/** Transaction currency code, tag 53. */
	currency?: string;
	/** Country code, tag 58. */
	countryCode?: string;
	/** Merchant display name, tag 59. */
	merchantName?: string;
	/** Merchant city, tag 60. */
	merchantCity?: string;
	/** Postal code, tag 61. */
	postalCode?: string;
	/** Additional data labels, tag 62. */
	additionalData?: AdditionalDataMetadata;
};

/** Options for generating a dynamic QRIS payload. */
export type GenerateOptions = {
	/** Base transaction amount in integer rupiah, before any customer fee. */
	amount: number;
	/** Whether to reject or replace an existing transaction amount. Defaults to `"strict"`. */
	mode?: GenerationMode;
	/** Optional customer-paid fee added to `amount` before writing tag 54. */
	fee?: CustomerFee;
	/** Optional tag 62 labels to embed or replace in the generated payload. */
	additionalData?: AdditionalDataOptions;
};

/** Result returned after generating a dynamic QRIS payload. */
export type GenerateResult = {
	/** Generated QRIS payload string with recalculated CRC16 checksum. */
	payload: string;
	/** Base transaction amount requested by the caller. */
	amount: number;
	/** Computed customer fee amount in rupiah. */
	feeAmount: number;
	/** Total amount written to QRIS tag 54. */
	payableAmount: number;
	/** Best-effort metadata extracted from the input payload. */
	metadata: Metadata;
};

/** Non-throwing validation result for user-submitted QRIS payloads. */
export type ValidationResult =
	/** Valid payload. `kind` distinguishes reusable static payloads from pre-amount payloads. */
	| { valid: true; kind: "static" | "pre-amount"; metadata: Metadata }
	/** Invalid payload with typed machine-readable error code. */
	| {
			valid: false;
			error: { code: import("./errors.js").QrisErrorCode; message: string };
	  };
