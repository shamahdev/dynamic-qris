/** Smallest accepted base or payable amount in integer rupiah. */
export const MIN_AMOUNT = 10_000;
/** Largest accepted base or payable amount in integer rupiah. */
export const MAX_AMOUNT = 10_000_000;

/** Machine-readable error code returned by validation and generation failures. */
export type QrisErrorCode =
	| "INVALID_PAYLOAD"
	| "INVALID_CRC"
	| "INVALID_AMOUNT"
	| "AMOUNT_ALREADY_PRESENT"
	| "PAYABLE_AMOUNT_OUT_OF_RANGE"
	| "INVALID_FEE"
	| "INVALID_ADDITIONAL_DATA";

/** Structured QRIS domain error used by validation results and generation errors. */
export type QrisError = {
	/** Machine-readable failure reason. */
	code: QrisErrorCode;
	/** Human-readable diagnostic message. */
	message: string;
};

/** Error thrown by `generateDynamicQris` when payload, amount, fee, or labels are invalid. */
export class QrisGenerationError extends Error {
	/** Machine-readable failure reason. */
	readonly code: QrisErrorCode;

	constructor(error: QrisError) {
		super(error.message);
		this.name = "QrisGenerationError";
		this.code = error.code;
	}
}

export function makeError(code: QrisErrorCode, message: string): QrisError {
	return { code, message };
}
