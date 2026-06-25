import type { GenerateOptions, RoundingStrategy } from "@shamah/dynamic-qris";
import { generateDynamicQris, QrisGenerationError } from "@shamah/dynamic-qris";
import jsQR from "jsqr";
import QRCode from "qrcode";

const form = {
	payload: document.getElementById("payload") as HTMLTextAreaElement,
	amount: document.getElementById("amount") as HTMLInputElement,
	mode: document.getElementById("mode") as HTMLSelectElement,
	feeType: document.getElementById("fee-type") as HTMLSelectElement,
	feeValue: document.getElementById("fee-value") as HTMLInputElement,
	feeRounding: document.getElementById("fee-rounding") as HTMLSelectElement,
	feeRoundingLabel: document.getElementById(
		"fee-rounding-label",
	) as HTMLLabelElement,
	refLabel: document.getElementById("ref-label") as HTMLInputElement,
	terminalLabel: document.getElementById("terminal-label") as HTMLInputElement,
	generate: document.getElementById("generate") as HTMLButtonElement,
	fileInput: document.getElementById("file-input") as HTMLInputElement,
	btnUpload: document.getElementById("btn-upload") as HTMLButtonElement,
	btnExample: document.getElementById("btn-example") as HTMLButtonElement,
	scanStatus: document.getElementById("scan-status") as HTMLSpanElement,
};

const output = {
	error: document.getElementById("error") as HTMLDivElement,
	result: document.getElementById("result") as HTMLDivElement,
	qrCanvas: document.getElementById("qr-canvas") as HTMLCanvasElement,
	qrInputCanvas: document.getElementById(
		"qr-input-canvas",
	) as HTMLCanvasElement,
	outBase: document.getElementById("out-base") as HTMLSpanElement,
	outFee: document.getElementById("out-fee") as HTMLSpanElement,
	outPayable: document.getElementById("out-payable") as HTMLSpanElement,
	outPayload: document.getElementById("out-payload") as HTMLPreElement,
	outMetadata: document.getElementById("out-metadata") as HTMLPreElement,
	copy: document.getElementById("copy") as HTMLButtonElement,
	codeSnippet: document.getElementById("code-snippet") as HTMLElement,
	placeholder: document.getElementById("output-placeholder") as HTMLElement,
};

const K_MERCHANT_PAYLOAD =
	"00020101021126570011ID.DANA.WWW011893600915388545957702098854595770303UMI51440014ID.CO.QRIS.WWW0215ID10254021598060303UMI5204737253033605802ID5913TemenBaik.com6010Kota Bogor6105161156304BE5F";

function showError(msg: string) {
	output.error.textContent = msg;
	output.error.hidden = false;
	output.result.hidden = true;
	output.placeholder.hidden = true;
}

function hideError() {
	output.error.hidden = true;
}

function fmtRupiah(n: number) {
	return `Rp${n.toLocaleString("id-ID")}`;
}

function buildCodeSnippet() {
	const p = form.payload.value.trim();
	const payload = p.length > 60 ? `${p.slice(0, 60)}…` : p;
	const lines: string[] = [
		`import { generateDynamicQris } from "@shamah/dynamic-qris";`,
		``,
		`const payload =`,
		`  "${payload}";`,
		``,
		`const result = generateDynamicQris(payload, {`,
		`  amount: ${form.amount.value || "25000"},`,
	];
	if (form.mode.value !== "strict") {
		lines.push(`  mode: "${form.mode.value}",`);
	}
	const feeType = form.feeType.value;
	if (feeType === "fixed") {
		lines.push(
			`  fee: { type: "fixed", value: ${form.feeValue.value || "500"} },`,
		);
	} else if (feeType === "percentage") {
		const r = form.feeRounding.value;
		const rounding = r !== "ceil" ? `, rounding: "${r}"` : "";
		lines.push(
			`  fee: { type: "percentage", value: ${form.feeValue.value || "1.5"}${rounding} },`,
		);
	}
	const refLabel = form.refLabel.value.trim();
	const terminalLabel = form.terminalLabel.value.trim();
	if (refLabel || terminalLabel) {
		lines.push(`  additionalData: {`);
		if (refLabel) lines.push(`    referenceLabel: "${refLabel}",`);
		if (terminalLabel) lines.push(`    terminalLabel: "${terminalLabel}",`);
		lines.push(`  },`);
	}
	lines.push(`});`);
	return lines.join("\n");
}

function highlightCode(text: string): string {
	const html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	return html
		.replace(
			/(import|const|from|as|type|if|else|return)\b/g,
			"<span class='h-kw'>$1</span>",
		)
		.replace(/\b(generateDynamicQris)\b/g, "<span class='h-fn'>$1</span>")
		.replace(/"([^"]*)"/g, "<span class='h-str'>\"$1\"</span>")
		.replace(/\b(\d+)\b/g, "<span class='h-num'>$1</span>")
		.replace(/\b([\w]+)(?=\s*:\s)/gm, "<span class='h-prop'>$1</span>")
		.replace(/([{}()[\],;])/g, "<span class='h-punc'>$1</span>");
}

function handleInputChange() {
	output.codeSnippet.innerHTML = highlightCode(buildCodeSnippet());
}

function buildOptions(): GenerateOptions {
	const options: GenerateOptions = {
		amount: Number(form.amount.value),
		mode: form.mode.value as GenerateOptions["mode"],
	};

	const feeType = form.feeType.value;
	if (feeType === "fixed") {
		options.fee = { type: "fixed", value: Number(form.feeValue.value) };
	} else if (feeType === "percentage") {
		options.fee = {
			type: "percentage",
			value: Number(form.feeValue.value),
			rounding: form.feeRounding.value as RoundingStrategy,
		};
	}

	const refLabel = form.refLabel.value.trim();
	const terminalLabel = form.terminalLabel.value.trim();
	if (refLabel || terminalLabel) {
		options.additionalData = {};
		if (refLabel) options.additionalData.referenceLabel = refLabel;
		if (terminalLabel) options.additionalData.terminalLabel = terminalLabel;
	}

	return options;
}

async function renderQRTo(canvas: HTMLCanvasElement, payload: string) {
	try {
		await QRCode.toCanvas(canvas, payload, {
			width: 160,
			margin: 2,
			errorCorrectionLevel: "M",
		});
	} catch {
		const ctx = canvas.getContext("2d");
		if (ctx) {
			canvas.width = 160;
			canvas.height = 160;
			ctx.fillStyle = "#f8d7da";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "#dc3545";
			ctx.font = "14px monospace";
			ctx.textAlign = "center";
			ctx.fillText("QR render failed", canvas.width / 2, canvas.height / 2);
		}
	}
}

function handleGenerate() {
	hideError();

	const payload = form.payload.value.trim();
	if (!payload) {
		showError("No QRIS payload provided.");
		return;
	}

	let options: GenerateOptions;
	try {
		options = buildOptions();
	} catch {
		showError("Invalid form values.");
		return;
	}

	try {
		const result = generateDynamicQris(payload, options);

		output.result.hidden = false;
		output.placeholder.hidden = true;
		output.outBase.textContent = fmtRupiah(result.amount);
		output.outFee.textContent = fmtRupiah(result.feeAmount);
		output.outPayable.textContent = fmtRupiah(result.payableAmount);
		output.outPayload.textContent = result.payload;
		output.outMetadata.textContent = JSON.stringify(result.metadata, null, 2);

		renderQRTo(output.qrInputCanvas, payload);
		renderQRTo(output.qrCanvas, result.payload);
	} catch (err: unknown) {
		if (err instanceof QrisGenerationError) {
			showError(`[${err.code}] ${err.message}`);
		} else {
			showError(String(err));
		}
	}
}

async function handleCopy() {
	const text = output.outPayload.textContent ?? "";
	try {
		await navigator.clipboard.writeText(text);
		output.copy.textContent = "Copied!";
		output.copy.classList.add("copied");
		setTimeout(() => {
			output.copy.textContent = "Copy";
			output.copy.classList.remove("copied");
		}, 2000);
	} catch {
		output.copy.textContent = "Failed";
		setTimeout(() => {
			output.copy.textContent = "Copy";
		}, 2000);
	}
}

function handleFeeTypeChange() {
	const type = form.feeType.value;
	form.feeValue.parentElement!.hidden = type === "none";
	form.feeRoundingLabel.hidden = type !== "percentage";
}

function setScanStatus(msg: string, ok: boolean) {
	form.scanStatus.textContent = msg;
	form.scanStatus.className = ok
		? "scan-status scan-status--ok"
		: "scan-status scan-status--err";
	setTimeout(() => {
		form.scanStatus.textContent = "";
	}, 4000);
}

function decodeFromImage(img: HTMLImageElement): string | null {
	const canvas = document.createElement("canvas");
	const maxDim = 1024;
	let w = img.naturalWidth;
	let h = img.naturalHeight;
	if (w > maxDim || h > maxDim) {
		const scale = maxDim / Math.max(w, h);
		w = Math.round(w * scale);
		h = Math.round(h * scale);
	}
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(img, 0, 0, w, h);
	const imageData = ctx.getImageData(0, 0, w, h);
	const code = jsQR(imageData.data, w, h);
	return code ? code.data : null;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error("Failed to load image"));
			img.src = reader.result as string;
		};
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

async function handleFileUpload(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	setScanStatus("Scanning…", true);
	try {
		const img = await loadImageFromFile(file);
		const payload = decodeFromImage(img);
		if (payload) {
			form.payload.value = payload;
			setScanStatus("QR scanned from file!", true);
		} else {
			setScanStatus("No QR code found in image.", false);
		}
	} catch {
		setScanStatus("Failed to read image file.", false);
	} finally {
		input.value = "";
	}
}

// --- init ---
form.payload.value = K_MERCHANT_PAYLOAD;
form.amount.value = "25000";
form.generate.addEventListener("click", handleGenerate);
form.feeType.addEventListener("change", handleFeeTypeChange);
output.copy.addEventListener("click", handleCopy);
form.fileInput.addEventListener("change", handleFileUpload);
form.btnUpload.addEventListener("click", () => form.fileInput.click());
form.btnExample.addEventListener("click", () => {
	form.payload.value = K_MERCHANT_PAYLOAD;
	handleInputChange();
});

const formInputs = [
	form.payload,
	form.amount,
	form.mode,
	form.feeType,
	form.feeValue,
	form.feeRounding,
	form.refLabel,
	form.terminalLabel,
];
for (const el of formInputs) {
	el.addEventListener("input", handleInputChange);
	el.addEventListener("change", handleInputChange);
}
handleInputChange();

const copyInstall = document.getElementById(
	"copy-install",
) as HTMLButtonElement;
const copyCode = document.getElementById("copy-code") as HTMLButtonElement;

copyInstall.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText("npm install @shamah/dynamic-qris");
		copyInstall.textContent = "Copied!";
		copyInstall.classList.add("copied");
		setTimeout(() => {
			copyInstall.textContent = "Copy";
			copyInstall.classList.remove("copied");
		}, 2000);
	} catch {
		copyInstall.textContent = "Failed";
		setTimeout(() => {
			copyInstall.textContent = "Copy";
		}, 2000);
	}
});

copyCode.addEventListener("click", async () => {
	const text = buildCodeSnippet();
	try {
		await navigator.clipboard.writeText(text);
		copyCode.textContent = "Copied!";
		copyCode.classList.add("copied");
		setTimeout(() => {
			copyCode.textContent = "Copy";
			copyCode.classList.remove("copied");
		}, 2000);
	} catch {
		copyCode.textContent = "Failed";
		setTimeout(() => {
			copyCode.textContent = "Copy";
		}, 2000);
	}
});
