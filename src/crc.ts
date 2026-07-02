export function crc16(payload: string): string {
	let crc = 0xffff;
	for (let i = 0; i < payload.length; i += 1) {
		crc ^= payload.charCodeAt(i) << 8;
		for (let j = 0; j < 8; j += 1) {
			crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
		}
	}
	return crc.toString(16).toUpperCase().padStart(4, "0");
}
