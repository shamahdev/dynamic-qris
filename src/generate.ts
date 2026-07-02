import {
	assertAmount,
	assertPayableAmount,
	computeFeeAmount,
	validateFee,
} from "./amount.js";
import { crc16 } from "./crc.js";
import { QrisGenerationError } from "./errors.js";
import { buildPayload, parseTlvs, type Tlv } from "./payload.js";
import type { GenerateOptions, GenerateResult, Metadata } from "./types.js";
import {
	findExistingAmountTag,
	rebuildRootWithAmount,
	validateAdditionalData,
	validateQrisPayload,
} from "./validation.js";

/**
 * Generates a dynamic QRIS payload by inserting the payable amount and recalculating CRC16.
 *
 * The input payload must be valid QRIS. Static payloads are accepted by default; pre-amount
 * payloads require `mode: "replace"` so existing transaction amounts are not overwritten by
 * accident. When a customer fee is provided, tag 54 receives `amount + feeAmount`.
 *
 * @throws {QrisGenerationError} When payload validation, amount validation, fee validation, or
 * additional-data validation fails.
 */
export function generateDynamicQris(
	payload: string,
	options: GenerateOptions,
): GenerateResult {
	const mode = options.mode ?? "strict";

	const validation = validateQrisPayload(payload);
	if (!validation.valid) {
		throw new QrisGenerationError(validation.error);
	}

	const metadata: Metadata = validation.metadata;

	let root: Tlv[];
	try {
		root = parseTlvs(payload);
	} catch (cause) {
		throw new QrisGenerationError({
			code: "INVALID_PAYLOAD",
			message: `malformed payload: ${(cause as Error).message}`,
		});
	}

	const existingAmount = findExistingAmountTag(root);
	if (existingAmount && mode === "strict") {
		throw new QrisGenerationError({
			code: "AMOUNT_ALREADY_PRESENT",
			message:
				"payload already contains transaction amount; use mode: 'replace' to overwrite",
		});
	}

	const amountError = assertAmount(options.amount);
	if (amountError) throw new QrisGenerationError(amountError);

	const feeError = validateFee(options.fee);
	if (feeError) throw new QrisGenerationError(feeError);

	const additionalDataError = validateAdditionalData(options.additionalData);
	if (additionalDataError) throw new QrisGenerationError(additionalDataError);

	const feeAmount = computeFeeAmount(options.amount, options.fee);
	const payableAmount = options.amount + feeAmount;

	const payableError = assertPayableAmount(payableAmount);
	if (payableError) throw new QrisGenerationError(payableError);

	const nextRoot = rebuildRootWithAmount(
		root,
		payableAmount,
		options.additionalData,
	);
	const content = buildPayload(nextRoot);
	const crcBody = content + "6304";
	const crc = crc16(crcBody);
	const dynamicPayload = `${crcBody}${crc}`;

	return {
		payload: dynamicPayload,
		amount: options.amount,
		feeAmount,
		payableAmount,
		metadata,
	};
}
