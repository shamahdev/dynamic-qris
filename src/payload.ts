export type Tlv = {
	id: string;
	value: string;
};

export function parseTlvs(value: string): Tlv[] {
	const result: Tlv[] = [];
	let cursor = 0;
	while (cursor < value.length) {
		if (cursor + 4 > value.length) {
			throw new Error("truncated TLV header");
		}
		const id = value.slice(cursor, cursor + 2);
		const lengthText = value.slice(cursor + 2, cursor + 4);
		if (!/^\d{2}$/.test(lengthText)) {
			throw new Error("invalid TLV length");
		}
		const length = Number.parseInt(lengthText, 10);
		const valueStart = cursor + 4;
		const valueEnd = valueStart + length;
		if (valueEnd > value.length) {
			throw new Error("TLV value exceeds payload");
		}
		result.push({ id, value: value.slice(valueStart, valueEnd) });
		cursor = valueEnd;
	}
	return result;
}

export function findTag(root: Tlv[], id: string): Tlv | undefined {
	return root.find((node) => node.id === id);
}

export function buildPayload(root: Tlv[]): string {
	return root
		.map((node) => {
			const length = node.value.length.toString().padStart(2, "0");
			return `${node.id}${length}${node.value}`;
		})
		.join("");
}
