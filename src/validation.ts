import { crc16 } from "./crc.js";
import type { QrisError } from "./errors.js";
import { makeError } from "./errors.js";
import {
	findSubTag,
	findTag,
	parsePayload,
	parseSubTlvs,
	type Tlv,
} from "./payload.js";
import type {
	AdditionalDataMetadata,
	AdditionalDataOptions,
	AdditionalMerchantMetadata,
	MerchantAccountMetadata,
	Metadata,
	ValidationResult,
} from "./types.js";

const AMOUNT_TAG = "54";
const ADDITIONAL_DATA_TAG = "62";
const CRC_TAG = "63";
const REFERENCE_LABEL_TAG = "05";
const TERMINAL_LABEL_TAG = "07";
const MAX_TLV_VALUE_LENGTH = 99;

/**
 * Validates a QRIS payload without throwing for normal invalid input.
 *
 * A valid result includes best-effort metadata and a `kind` value:
 * `"static"` when tag 54 amount is absent, or `"pre-amount"` when tag 54 is present.
 */
export function validateQrisPayload(payload: string): ValidationResult {
	if (typeof payload !== "string" || payload.length === 0) {
		return {
			valid: false,
			error: makeError("INVALID_PAYLOAD", "payload must be a non-empty string"),
		};
	}

	if (payload.length < 8) {
		return {
			valid: false,
			error: makeError("INVALID_PAYLOAD", "payload too short"),
		};
	}

	const last4 = payload.slice(-4);
	if (!/^[0-9A-F]{4}$/.test(last4)) {
		return {
			valid: false,
			error: makeError("INVALID_PAYLOAD", "payload must end with 4-hex CRC"),
		};
	}

	const body = payload.slice(0, -4);
	const expectedCrc = last4;
	const actualCrc = crc16(body);
	if (actualCrc !== expectedCrc) {
		return {
			valid: false,
			error: makeError(
				"INVALID_CRC",
				`CRC mismatch: expected ${expectedCrc}, got ${actualCrc}`,
			),
		};
	}

	let root: Tlv[];
	try {
		({ root } = parsePayload(payload));
	} catch (cause) {
		return {
			valid: false,
			error: makeError(
				"INVALID_PAYLOAD",
				`malformed payload: ${(cause as Error).message}`,
			),
		};
	}

	const crcTag = findTag(root, CRC_TAG);
	if (!crcTag || crcTag.value.length !== 4) {
		return {
			valid: false,
			error: makeError("INVALID_PAYLOAD", "missing or malformed CRC tag"),
		};
	}

	const hasAmount = Boolean(findTag(root, AMOUNT_TAG));
	const metadata = extractMetadataFromRoot(root);
	return {
		valid: true,
		kind: hasAmount ? "pre-amount" : "static",
		metadata,
	};
}

export function extractMetadata(payload: string): Metadata {
	try {
		const { root } = parsePayload(payload);
		return extractMetadataFromRoot(root);
	} catch {
		return {};
	}
}

function extractMetadataFromRoot(root: Tlv[]): Metadata {
	const metadata: Metadata = {};

	const payloadFormat = findTag(root, "00");
	if (payloadFormat) metadata.payloadFormat = payloadFormat.value;

	const pointOfInitiation = findTag(root, "01");
	if (pointOfInitiation) metadata.pointOfInitiation = pointOfInitiation.value;

	const merchantAccountTag = findTag(root, "26");
	if (merchantAccountTag) {
		const sub = tryParseSubTlvs(merchantAccountTag.value);
		if (sub) {
			const account: MerchantAccountMetadata = {};
			const guid = findSubTag(sub, "00");
			const pan = findSubTag(sub, "01");
			const id = findSubTag(sub, "02");
			const criteria = findSubTag(sub, "03");
			if (guid) account.globallyUniqueIdentifier = guid.value;
			if (pan) account.merchantPan = pan.value;
			if (id) account.merchantId = id.value;
			if (criteria) account.merchantCriteria = criteria.value;
			metadata.merchantAccount = account;
		}
	}

	const additionalMerchantTag = findTag(root, "51");
	if (additionalMerchantTag) {
		const sub = tryParseSubTlvs(additionalMerchantTag.value);
		if (sub) {
			const merchant: AdditionalMerchantMetadata = {};
			const guid = findSubTag(sub, "00");
			const pan = findSubTag(sub, "02");
			const criteria = findSubTag(sub, "03");
			if (guid) merchant.globallyUniqueIdentifier = guid.value;
			if (pan) merchant.merchantPan = pan.value;
			if (criteria) merchant.merchantCriteria = criteria.value;
			metadata.additionalMerchant = merchant;
		}
	}

	const merchantCategoryCode = findTag(root, "52");
	if (merchantCategoryCode)
		metadata.merchantCategoryCode = merchantCategoryCode.value;

	const currency = findTag(root, "53");
	if (currency) metadata.currency = currency.value;

	const countryCode = findTag(root, "58");
	if (countryCode) metadata.countryCode = countryCode.value;

	const merchantName = findTag(root, "59");
	if (merchantName) metadata.merchantName = merchantName.value;

	const merchantCity = findTag(root, "60");
	if (merchantCity) metadata.merchantCity = merchantCity.value;

	const postalCode = findTag(root, "61");
	if (postalCode) metadata.postalCode = postalCode.value;

	const additionalDataTag = findTag(root, "62");
	if (additionalDataTag) {
		const sub = tryParseSubTlvs(additionalDataTag.value);
		if (sub) {
			const data: AdditionalDataMetadata = {};
			const billNumber = findSubTag(sub, "01");
			const mobileNumber = findSubTag(sub, "02");
			const storeLabel = findSubTag(sub, "03");
			const loyaltyNumber = findSubTag(sub, "04");
			const referenceLabel = findSubTag(sub, "05");
			const customerLabel = findSubTag(sub, "06");
			const terminalLabel = findSubTag(sub, "07");
			const purposeOfTransaction = findSubTag(sub, "08");
			const additionalConsumerData = findSubTag(sub, "09");
			if (billNumber) data.billNumber = billNumber.value;
			if (mobileNumber) data.mobileNumber = mobileNumber.value;
			if (storeLabel) data.storeLabel = storeLabel.value;
			if (loyaltyNumber) data.loyaltyNumber = loyaltyNumber.value;
			if (referenceLabel) data.referenceLabel = referenceLabel.value;
			if (customerLabel) data.customerLabel = customerLabel.value;
			if (terminalLabel) data.terminalLabel = terminalLabel.value;
			if (purposeOfTransaction)
				data.purposeOfTransaction = purposeOfTransaction.value;
			if (additionalConsumerData)
				data.additionalConsumerData = additionalConsumerData.value;
			metadata.additionalData = data;
		}
	}

	return metadata;
}

function tryParseSubTlvs(value: string): Tlv[] | undefined {
	if (value.length === 0) return [];
	try {
		return parseSubTlvs(value);
	} catch {
		return undefined;
	}
}

export function findExistingAmountTag(root: Tlv[]): Tlv | undefined {
	return findTag(root, AMOUNT_TAG);
}

export function buildAmountTag(value: number): Tlv {
	return { id: AMOUNT_TAG, value: String(value) };
}

export function validateAdditionalData(
	additionalData: AdditionalDataOptions | undefined,
): QrisError | null {
	if (!additionalData) return null;
	return (
		validateAdditionalDataValue("referenceLabel", additionalData.referenceLabel) ??
		validateAdditionalDataValue("terminalLabel", additionalData.terminalLabel)
	);
}

export function rebuildRootWithAmount(
	root: Tlv[],
	payableAmount: number,
	additionalData?: AdditionalDataOptions,
): Tlv[] {
	const withoutAmountAndCrc = root.filter(
		(node) => node.id !== AMOUNT_TAG && node.id !== CRC_TAG,
	);
	const withAdditionalData = rebuildRootWithAdditionalData(
		withoutAmountAndCrc,
		additionalData,
	);
	const merchantNameIndex = withoutAmountAndCrc.findIndex(
		(node) => node.id === "59",
	);
	const insertIndex =
		merchantNameIndex >= 0 ? merchantNameIndex : withAdditionalData.length;
	withAdditionalData.splice(insertIndex, 0, buildAmountTag(payableAmount));
	return withAdditionalData;
}

function rebuildRootWithAdditionalData(
	root: Tlv[],
	additionalData: AdditionalDataOptions | undefined,
): Tlv[] {
	if (
		!additionalData ||
		(additionalData.referenceLabel === undefined &&
			additionalData.terminalLabel === undefined)
	) {
		return [...root];
	}

	const nextRoot = root.filter((node) => node.id !== ADDITIONAL_DATA_TAG);
	const existingAdditionalData = findTag(root, ADDITIONAL_DATA_TAG);
	const subtags = existingAdditionalData
		? tryParseSubTlvs(existingAdditionalData.value) ?? []
		: [];
	const nextSubtags = upsertAdditionalDataSubtags(subtags, additionalData);
	if (nextSubtags.length === 0) return nextRoot;

	const additionalDataTag: Tlv = {
		id: ADDITIONAL_DATA_TAG,
		value: buildSubPayload(nextSubtags),
	};
	const postalCodeIndex = nextRoot.findIndex((node) => node.id === "61");
	const insertIndex =
		postalCodeIndex >= 0 ? postalCodeIndex + 1 : nextRoot.length;
	nextRoot.splice(insertIndex, 0, additionalDataTag);
	return nextRoot;
}

function upsertAdditionalDataSubtags(
	subtags: Tlv[],
	additionalData: AdditionalDataOptions,
): Tlv[] {
	const nextSubtags = subtags.filter(
		(node) => node.id !== REFERENCE_LABEL_TAG && node.id !== TERMINAL_LABEL_TAG,
	);
	if (additionalData.referenceLabel !== undefined) {
		nextSubtags.push({
			id: REFERENCE_LABEL_TAG,
			value: additionalData.referenceLabel,
		});
	}
	if (additionalData.terminalLabel !== undefined) {
		nextSubtags.push({ id: TERMINAL_LABEL_TAG, value: additionalData.terminalLabel });
	}
	return nextSubtags.sort((left, right) => left.id.localeCompare(right.id));
}

function validateAdditionalDataValue(
	name: keyof AdditionalDataOptions,
	value: string | undefined,
): QrisError | null {
	if (value === undefined) return null;
	if (typeof value !== "string" || value.length === 0) {
		return makeError(
			"INVALID_ADDITIONAL_DATA",
			`${name} must be a non-empty string`,
		);
	}
	if (value.length > MAX_TLV_VALUE_LENGTH) {
		return makeError(
			"INVALID_ADDITIONAL_DATA",
			`${name} cannot exceed ${MAX_TLV_VALUE_LENGTH} characters`,
		);
	}
	return null;
}

function buildSubPayload(subtags: Tlv[]): string {
	return subtags
		.map((node) => {
			const length = node.value.length.toString().padStart(2, "0");
			return `${node.id}${length}${node.value}`;
		})
		.join("");
}

export function payloadValidationError(payload: string): QrisError | null {
	const result = validateQrisPayload(payload);
	return result.valid ? null : result.error;
}
