const CRC_TABLE: readonly number[] = (() => {
	const table: number[] = [];
	for (let i = 0; i < 256; i += 1) {
		let crc = i << 8;
		for (let j = 0; j < 8; j += 1) {
			crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
		}
		table.push(crc);
	}
	return table;
})();

export function crc16(payload: string): string {
	let crc = 0xffff;
	for (let i = 0; i < payload.length; i += 1) {
		const byte = payload.charCodeAt(i) & 0xff;
		const index = ((crc >> 8) ^ byte) & 0xff;
		const tableValue = CRC_TABLE[index] ?? 0;
		crc = ((crc << 8) ^ tableValue) & 0xffff;
	}
	return crc.toString(16).toUpperCase().padStart(4, "0");
}
