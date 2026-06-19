import { describe, expect, it } from "vitest";
import {
	generateDynamicQris,
	QrisGenerationError,
	validateQrisPayload,
} from "../src/index.js";
import {
	buildAdditionalData,
	buildAdditionalDataSubtag,
	buildValidStaticQris,
} from "./fixtures.js";

describe("validateQrisPayload", () => {
	it("accepts a well-formed static payload", () => {
		const payload = buildValidStaticQris();
		const result = validateQrisPayload(payload);
		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.kind).toBe("static");
			expect(result.metadata.payloadFormat).toBe("01");
			expect(result.metadata.pointOfInitiation).toBe("11");
			expect(result.metadata.merchantAccount?.globallyUniqueIdentifier).toBe(
				"ID.CO.QRIS.WWW",
			);
			expect(result.metadata.merchantAccount?.merchantPan).toBe(
				"ID1020024000000",
			);
			expect(result.metadata.merchantAccount?.merchantCriteria).toBe("UMI");
			expect(result.metadata.merchantCategoryCode).toBe("5499");
			expect(result.metadata.currency).toBe("360");
			expect(result.metadata.countryCode).toBe("ID");
			expect(result.metadata.merchantName).toBe("TOKO DEMO QR");
			expect(result.metadata.merchantCity).toBe("JAKARTA UT");
			expect(result.metadata.postalCode).toBe("99999");
			expect(result.metadata.merchantAccount?.merchantId).toBeUndefined();
			expect(result.metadata.additionalMerchant).toBeUndefined();
			expect(result.metadata.additionalData).toBeUndefined();
		}
	});

	it("rejects empty payload", () => {
		const result = validateQrisPayload("");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.code).toBe("INVALID_PAYLOAD");
		}
	});

	it("rejects bad CRC", () => {
		const payload = buildValidStaticQris();
		const tampered = `${payload.slice(0, -4)}0000`;
		const result = validateQrisPayload(tampered);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.code).toBe("INVALID_CRC");
		}
	});

	it("rejects malformed length", () => {
		const result = validateQrisPayload("00XX00");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.code).toBe("INVALID_PAYLOAD");
		}
	});
});

describe("generateDynamicQris", () => {
	it("generates dynamic payload with valid CRC", () => {
		const payload = buildValidStaticQris();
		const result = generateDynamicQris(payload, { amount: 25_000 });
		expect(result.amount).toBe(25_000);
		expect(result.feeAmount).toBe(0);
		expect(result.payableAmount).toBe(25_000);
		expect(result.payload).toContain("540525000");
		const validate = validateQrisPayload(result.payload);
		expect(validate.valid).toBe(true);
	});

	it("rejects pre-amount payload in strict mode", () => {
		const staticPayload = buildValidStaticQris();
		const seeded = generateDynamicQris(staticPayload, {
			amount: 25_000,
		}).payload;
		expect(() => generateDynamicQris(seeded, { amount: 30_000 })).toThrow(
			QrisGenerationError,
		);
		try {
			generateDynamicQris(seeded, { amount: 30_000 });
		} catch (error) {
			expect((error as QrisGenerationError).code).toBe(
				"AMOUNT_ALREADY_PRESENT",
			);
		}
	});

	it("replaces pre-amount payload in replace mode", () => {
		const staticPayload = buildValidStaticQris();
		const seeded = generateDynamicQris(staticPayload, {
			amount: 25_000,
		}).payload;
		const result = generateDynamicQris(seeded, {
			amount: 30_000,
			mode: "replace",
		});
		expect(result.amount).toBe(30_000);
		expect(validateQrisPayload(result.payload).valid).toBe(true);
	});

	it("rejects amount below minimum", () => {
		const payload = buildValidStaticQris();
		expect(() => generateDynamicQris(payload, { amount: 9_999 })).toThrow(
			QrisGenerationError,
		);
	});

	it("rejects amount above maximum", () => {
		const payload = buildValidStaticQris();
		expect(() => generateDynamicQris(payload, { amount: 10_000_001 })).toThrow(
			QrisGenerationError,
		);
	});

	it("rejects non-integer amount", () => {
		const payload = buildValidStaticQris();
		expect(() => generateDynamicQris(payload, { amount: 25_000.5 })).toThrow(
			QrisGenerationError,
		);
	});

	it("applies fixed customer fee", () => {
		const payload = buildValidStaticQris();
		const result = generateDynamicQris(payload, {
			amount: 20_000,
			fee: { type: "fixed", value: 500 },
		});
		expect(result.feeAmount).toBe(500);
		expect(result.payableAmount).toBe(20_500);
		expect(result.payload).toContain("540520500");
	});

	it("applies percentage customer fee with ceil rounding by default", () => {
		const payload = buildValidStaticQris();
		const result = generateDynamicQris(payload, {
			amount: 20_000,
			fee: { type: "percentage", value: 1.5 },
		});
		expect(result.feeAmount).toBe(300);
		expect(result.payableAmount).toBe(20_300);
		expect(result.payload).toContain("540520300");
	});

	it("rounds percentage fee with floor override", () => {
		const payload = buildValidStaticQris();
		const result = generateDynamicQris(payload, {
			amount: 10_001,
			fee: { type: "percentage", value: 1.5, rounding: "floor" },
		});
		expect(result.feeAmount).toBe(150);
	});

	it("rejects percentage fee that pushes payable over max", () => {
		const payload = buildValidStaticQris();
		expect(() =>
			generateDynamicQris(payload, {
				amount: 10_000_000,
				fee: { type: "percentage", value: 1 },
			}),
		).toThrow(QrisGenerationError);
	});

	it("rejects fixed fee that pushes payable over max", () => {
		const payload = buildValidStaticQris();
		expect(() =>
			generateDynamicQris(payload, {
				amount: 10_000_000,
				fee: { type: "fixed", value: 500 },
			}),
		).toThrow(QrisGenerationError);
	});

	it("always returns metadata", () => {
		const payload = buildValidStaticQris();
		const result = generateDynamicQris(payload, { amount: 15_000 });
		expect(result.metadata).toBeDefined();
		expect(result.metadata.merchantName).toBe("TOKO DEMO QR");
		expect(result.metadata.merchantCity).toBe("JAKARTA UT");
		expect(result.metadata.countryCode).toBe("ID");
		expect(result.metadata.payloadFormat).toBe("01");
		expect(result.metadata.currency).toBe("360");
		expect(result.metadata.postalCode).toBe("99999");
	});

	it("adds reference and terminal labels to additional data", () => {
		const payload = buildValidStaticQris();
		const result = generateDynamicQris(payload, {
			amount: 15_000,
			additionalData: {
				referenceLabel: "INV-001",
				terminalLabel: "POS-01",
			},
		});
		expect(result.payload).toContain("62210507INV-0010706POS-01");

		const validation = validateQrisPayload(result.payload);
		expect(validation.valid).toBe(true);
		if (validation.valid) {
			expect(validation.metadata.additionalData?.referenceLabel).toBe(
				"INV-001",
			);
			expect(validation.metadata.additionalData?.terminalLabel).toBe("POS-01");
		}
	});

	it("preserves existing additional data while replacing provided labels", () => {
		const existingAdditionalData = buildAdditionalData(
			buildAdditionalDataSubtag("03", "STORE-1") +
				buildAdditionalDataSubtag("05", "OLD-REF"),
		);
		const payload = buildValidStaticQris(existingAdditionalData);
		const result = generateDynamicQris(payload, {
			amount: 15_000,
			additionalData: { referenceLabel: "NEW-REF" },
		});

		const validation = validateQrisPayload(result.payload);
		expect(validation.valid).toBe(true);
		if (validation.valid) {
			expect(validation.metadata.additionalData?.storeLabel).toBe("STORE-1");
			expect(validation.metadata.additionalData?.referenceLabel).toBe("NEW-REF");
		}
	});

	it("rejects empty additional data labels", () => {
		const payload = buildValidStaticQris();
		expect(() =>
			generateDynamicQris(payload, {
				amount: 15_000,
				additionalData: { referenceLabel: "" },
			}),
		).toThrow(QrisGenerationError);
	});

	it("rejects percentage fee exceeding 100", () => {
		const payload = buildValidStaticQris();
		expect(() =>
			generateDynamicQris(payload, {
				amount: 20_000,
				fee: { type: "percentage", value: 150 },
			}),
		).toThrow(QrisGenerationError);
	});
});
