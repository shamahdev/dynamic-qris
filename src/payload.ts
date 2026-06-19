export type Tlv = {
	id: string;
	value: string;
};

export type ParsedPayload = {
	root: Tlv[];
};

export function parsePayload(payload: string): ParsedPayload {
	if (typeof payload !== "string" || payload.length === 0) {
		throw new Error("empty payload");
	}
	const root: Tlv[] = [];
	let cursor = 0;
	while (cursor < payload.length) {
		if (cursor + 4 > payload.length) {
			throw new Error("truncated tag header");
		}
		const id = payload.slice(cursor, cursor + 2);
		const lengthText = payload.slice(cursor + 2, cursor + 4);
		if (!/^\d{2}$/.test(lengthText)) {
			throw new Error("invalid tag length");
		}
		const length = Number.parseInt(lengthText, 10);
		const valueStart = cursor + 4;
		const valueEnd = valueStart + length;
		if (valueEnd > payload.length) {
			throw new Error("tag value exceeds payload");
		}
		root.push({ id, value: payload.slice(valueStart, valueEnd) });
		cursor = valueEnd;
	}
	return { root };
}

export function findTag(root: Tlv[], id: string): Tlv | undefined {
	return root.find((node) => node.id === id);
}

export function parseSubTlvs(value: string): Tlv[] {
	const result: Tlv[] = [];
	let cursor = 0;
	while (cursor < value.length) {
		if (cursor + 4 > value.length) {
			throw new Error("truncated subtag header");
		}
		const id = value.slice(cursor, cursor + 2);
		const lengthText = value.slice(cursor + 2, cursor + 4);
		if (!/^\d{2}$/.test(lengthText)) {
			throw new Error("invalid subtag length");
		}
		const length = Number.parseInt(lengthText, 10);
		const valueStart = cursor + 4;
		const valueEnd = valueStart + length;
		if (valueEnd > value.length) {
			throw new Error("subtag value exceeds payload");
		}
		result.push({ id, value: value.slice(valueStart, valueEnd) });
		cursor = valueEnd;
	}
	return result;
}

export function findSubTag(subTlvs: Tlv[], id: string): Tlv | undefined {
	return subTlvs.find((node) => node.id === id);
}

export function buildPayload(root: Tlv[]): string {
	return root
		.map((node) => {
			const length = node.value.length.toString().padStart(2, "0");
			return `${node.id}${length}${node.value}`;
		})
		.join("");
}
