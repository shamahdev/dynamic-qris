import { crc16 } from "../src/crc.js";

const MERCHANT_ACCOUNT_INFORMATION = "26";

function encode(id: string, value: string): string {
	return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function encodeChildren(id: string, children: string): string {
	return `${id}${children.length.toString().padStart(2, "0")}${children}`;
}

export function buildValidStaticQris(additionalData = ""): string {
	const merchantAccount = encodeChildren(
		MERCHANT_ACCOUNT_INFORMATION,
		encode("00", "ID.CO.QRIS.WWW") +
			encode("01", "ID1020024000000") +
			encode("03", "UMI"),
	);
	const content =
		encode("00", "01") +
		encode("01", "11") +
		merchantAccount +
		encode("52", "5499") +
		encode("53", "360") +
		encode("58", "ID") +
		encode("59", "TOKO DEMO QR") +
		encode("60", "JAKARTA UT") +
		encode("61", "99999") +
		additionalData;
	const body = `${content}6304`;
	return body + crc16(body);
}

export function buildAdditionalData(children: string): string {
	return encodeChildren("62", children);
}

export function buildAdditionalDataSubtag(id: string, value: string): string {
	return encode(id, value);
}
