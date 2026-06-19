import type { QrisError } from "./errors.js";
import { MAX_AMOUNT, MIN_AMOUNT, makeError } from "./errors.js";
import type { CustomerFee, RoundingStrategy } from "./types.js";

export function assertAmount(amount: number): QrisError | null {
	if (typeof amount !== "number" || !Number.isFinite(amount)) {
		return makeError("INVALID_AMOUNT", "amount must be a finite number");
	}
	if (!Number.isInteger(amount)) {
		return makeError("INVALID_AMOUNT", "amount must be an integer");
	}
	if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
		return makeError(
			"INVALID_AMOUNT",
			`amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`,
		);
	}
	return null;
}

export function validateFee(fee: CustomerFee | undefined): QrisError | null {
	if (!fee) return null;
	if (fee.type !== "fixed" && fee.type !== "percentage") {
		return makeError(
			"INVALID_FEE",
			`unknown fee type: ${String((fee as { type: string }).type)}`,
		);
	}
	if (
		typeof fee.value !== "number" ||
		!Number.isFinite(fee.value) ||
		fee.value <= 0
	) {
		return makeError(
			"INVALID_FEE",
			"fee value must be a positive finite number",
		);
	}
	if (fee.type === "percentage") {
		if (fee.value > 100) {
			return makeError("INVALID_FEE", "percentage fee cannot exceed 100");
		}
		const rounding: RoundingStrategy = fee.rounding ?? "ceil";
		if (rounding !== "ceil" && rounding !== "floor" && rounding !== "round") {
			return makeError(
				"INVALID_FEE",
				`unknown rounding strategy: ${String(rounding)}`,
			);
		}
	}
	return null;
}

export function computeFeeAmount(
	amount: number,
	fee: CustomerFee | undefined,
): number {
	if (!fee) return 0;
	if (fee.type === "fixed") return Math.round(fee.value);
	const rounding: RoundingStrategy = fee.rounding ?? "ceil";
	const raw = (amount * fee.value) / 100;
	if (rounding === "ceil") return Math.ceil(raw);
	if (rounding === "floor") return Math.floor(raw);
	return Math.round(raw);
}

export function assertPayableAmount(payable: number): QrisError | null {
	if (payable < MIN_AMOUNT || payable > MAX_AMOUNT) {
		return makeError(
			"PAYABLE_AMOUNT_OUT_OF_RANGE",
			`payable amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`,
		);
	}
	return null;
}
