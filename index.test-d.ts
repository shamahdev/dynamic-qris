import { expectAssignable, expectType } from "tsd";
import type {
	GenerateOptions,
	GenerateResult,
	MerchantAccountMetadata,
	Metadata,
	QrisErrorCode,
	ValidationResult,
} from "./dist/index.js";
import {
	generateDynamicQris,
	MAX_AMOUNT,
	MIN_AMOUNT,
	type QrisGenerationError,
	validateQrisPayload,
} from "./dist/index.js";

const payload =
	"00020101021126440014ID.CO.QRIS.WWW0115ID10200240000000303UMI5204549953033605802ID5912TOKO DEMO QR6010JAKARTA UT61059999963045380";

const result = generateDynamicQris(payload, { amount: 25_000 });
expectType<GenerateResult>(result);
expectType<number>(result.amount);
expectType<number>(result.feeAmount);
expectType<number>(result.payableAmount);
expectType<string>(result.payload);
expectType<Metadata>(result.metadata);

const fixedFeeOptions: GenerateOptions = {
	amount: 25_000,
	fee: { type: "fixed", value: 500 },
};
expectType<GenerateResult>(generateDynamicQris(payload, fixedFeeOptions));

const percentageFeeOptions: GenerateOptions = {
	amount: 25_000,
	fee: { type: "percentage", value: 1.5, rounding: "ceil" },
};
generateDynamicQris(payload, percentageFeeOptions);

generateDynamicQris(payload, {
	amount: 25_000,
	additionalData: { referenceLabel: "INV-001", terminalLabel: "POS-01" },
});

const validation = validateQrisPayload(payload);
expectType<ValidationResult>(validation);
if (validation.valid) {
	expectType<"static" | "pre-amount">(validation.kind);
	expectType<Metadata>(validation.metadata);
	expectType<MerchantAccountMetadata | undefined>(
		validation.metadata.merchantAccount,
	);
} else {
	expectType<QrisErrorCode>(validation.error.code);
}

try {
	generateDynamicQris(payload, { amount: 1 });
} catch (error) {
	expectType<QrisGenerationError>(error as QrisGenerationError);
}

expectAssignable<number>(MIN_AMOUNT);
expectAssignable<number>(MAX_AMOUNT);

generateDynamicQris(payload, {
	// @ts-expect-error
	amount: "invalid",
});
generateDynamicQris(payload, {
	amount: 25_000,
	// @ts-expect-error
	fee: { type: "invalid" },
});
