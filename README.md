<div align="center">

# dynamic-qris

**Zero-dependency, ~3.7 kB gzip, type-safe dynamic QRIS generator for TypeScript.**

[Install](#install) • [Quick Start](#quick-start) • [Demo](#demo) • [Features](#features) • [API](#api) • [Comparison](#comparison)

</div>

`dynamic-qris` converts static QRIS payload strings into dynamic QRIS payloads with a transaction amount, optional customer fee, optional reference labels, and a fresh CRC16 checksum. It focuses on the core payload transformation only: no QR image rendering, no gateway API calls, no CLI, and no runtime dependencies.

QRIS is Indonesia's national QR payment standard from Bank Indonesia. See the official Bank Indonesia QRIS page for the current definition and rules: https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kanal-layanan/qris/default.aspx

## Demo

Try it live: **[dynamic-qris-demo.vercel.app](https://dynamic-qris-demo.vercel.app/)**

## Features

- **Fee-aware**: supports fixed and percentage customer fees with configurable rounding.
- **Metadata included**: extracts merchant-facing metadata on successful validation and generation.
- **Tag 62 labels**: writes `referenceLabel` and `terminalLabel` while preserving other additional data fields.
- **Type-safe API**: TypeScript declarations, discriminated validation results, typed error codes, and JSDoc.

## Install

```bash
npm install @shamah/dynamic-qris
```

Works with Node.js `>=18` and both ESM and CommonJS consumers.

```ts
import { generateDynamicQris } from "@shamah/dynamic-qris";
```

```js
const { generateDynamicQris } = require("@shamah/dynamic-qris");
```

## Quick Start

```ts
import { generateDynamicQris } from "@shamah/dynamic-qris";

// Merchant static QRIS payload.
const staticPayload =
  "00020101021126440014ID.CO.QRIS.WWW0115ID10200240000000303UMI5204549953033605802ID5912TOKO DEMO QR6010JAKARTA UT61059999963045380";

const result = generateDynamicQris(staticPayload, {
  amount: 75_000,
  fee: { type: "percentage", value: 1.5 },
  additionalData: {
    referenceLabel: "INV-2026-001",
    terminalLabel: "POS-01",
  },
});

console.log(result.payload); // dynamic QRIS payload string
console.log(result.payableAmount); // base amount + customer fee
console.log(result.metadata.merchantName);
```

## What It Does

1. Validates the input QRIS payload and CRC16 checksum.
3. Calculates optional customer fee.
4. Writes payable amount into QRIS tag `54`.
5. Writes optional reference labels into tag `62`.
6. Recalculates CRC16 and returns a new payload string.

> [!IMPORTANT]
> `amount` is the base transaction amount. If you pass a fee, tag `54` receives `payableAmount = amount + feeAmount` so the QRIS payload matches the total customer should pay.

## API

### `generateDynamicQris(payload, options)`

Generates a dynamic QRIS payload from a static or pre-amount QRIS payload.

```ts
const result = generateDynamicQris(payload, {
  amount: 25_000,
  mode: "strict",
  fee: { type: "fixed", value: 500 },
  additionalData: { referenceLabel: "ORDER-001" },
});
```

| Option | Type | Description |
| --- | --- | --- |
| `amount` | `number` | Base amount in integer rupiah, `10_000` to `10_000_000`. |
| `mode` | `"strict" \| "replace"` | Defaults to `"strict"`. Use `"replace"` to overwrite an existing tag `54` amount. |
| `fee` | `CustomerFee` | Optional customer-paid fee added before writing tag `54`. |
| `additionalData` | `AdditionalDataOptions` | Optional tag `62` labels to embed or replace. |

Returns:

```ts
type GenerateResult = {
  payload: string;
  amount: number;
  feeAmount: number;
  payableAmount: number;
  metadata: Metadata;
};
```

Throws `QrisGenerationError` with a typed `code` when validation fails.

### `validateQrisPayload(payload)`

Validates a QRIS payload without throwing for normal invalid input.

```ts
const result = validateQrisPayload(payload);

if (result.valid) {
  console.log(result.kind); // "static" | "pre-amount"
  console.log(result.metadata);
} else {
  console.error(result.error.code, result.error.message);
}
```

## Customer Fees

Customer fees are optional customer-paid convenience charges. They may represent admin fees, service fees, or tips depending on merchant context.

```ts
generateDynamicQris(payload, {
  amount: 50_000,
  fee: { type: "fixed", value: 1_000 },
});

generateDynamicQris(payload, {
  amount: 50_000,
  fee: { type: "percentage", value: 1.5 }, // ceil by default
});

generateDynamicQris(payload, {
  amount: 50_000,
  fee: { type: "percentage", value: 1.5, rounding: "floor" },
});
```

Both `amount` and `payableAmount` must stay within `10_000` to `10_000_000` rupiah.

## Reference Labels

Use `additionalData` to embed merchant-facing transaction context in tag `62`.

```ts
generateDynamicQris(payload, {
  amount: 75_000,
  additionalData: {
    referenceLabel: "INV-001", // tag 62.05
    terminalLabel: "POS-01", // tag 62.07
  },
});
```

- `referenceLabel`: invoice ID, order ID, or payment reference.
- `terminalLabel`: POS terminal, cashier, outlet device, or source identifier.

Existing tag `62` fields are preserved. Provided labels replace matching existing labels.

## Metadata

Metadata extraction is best-effort and never required for generation correctness. Successful generation and validation always return a `metadata` object, though fields may be empty or partial.

```ts
type Metadata = {
  payloadFormat?: string; // tag 00
  pointOfInitiation?: string; // tag 01
  merchantAccount?: MerchantAccountMetadata; // tag 26
  additionalMerchant?: AdditionalMerchantMetadata; // tag 51
  merchantCategoryCode?: string; // tag 52
  currency?: string; // tag 53
  countryCode?: string; // tag 58
  merchantName?: string; // tag 59
  merchantCity?: string; // tag 60
  postalCode?: string; // tag 61
  additionalData?: AdditionalDataMetadata; // tag 62
};
```

## Error Codes

| Code | Meaning |
| --- | --- |
| `INVALID_PAYLOAD` | Payload is empty, truncated, malformed, or missing required CRC shape. |
| `INVALID_CRC` | CRC16 checksum does not match. |
| `INVALID_AMOUNT` | Amount is not a finite integer in the accepted rupiah range. |
| `INVALID_FEE` | Fee type, value, or rounding strategy is invalid. |
| `INVALID_ADDITIONAL_DATA` | Reference or terminal label is empty or too long for TLV encoding. |
| `AMOUNT_ALREADY_PRESENT` | Payload already contains tag `54`; use `mode: "replace"` to overwrite. |
| `PAYABLE_AMOUNT_OUT_OF_RANGE` | Amount plus fee is outside the accepted rupiah range. |

## Comparison

`@shamah/dynamic-qris` intentionally stays focused on safe local payload generation. It is not a payment gateway SDK and does not try to own QR rendering.

| Package | Best fit | Runtime deps | Type-safe API | Payload only | QR image output | Gateway APIs |
| --- | --- | ---: | --- | --- | --- | --- |
| [`@shamah/dynamic-qris`](https://www.npmjs.com/package/@shamah/dynamic-qris) | Small typed core for apps that already have a QR renderer or payment flow. | 🎉 `0` | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| [`@agungjsp/qris-dinamis`](https://github.com/agungjsp/Dynamic-QRIS) | Generate QRIS strings and QR image files/base64 with template support. | `2` | ⚠️ Limited | ❌ No | ✅ Yes | ❌ No |
| [`@fhylabs/qris-dynamic`](https://github.com/FhyLabs/qris-dynamic) | Simple dynamic QRIS string/base64 generation across CJS, ESM, and browser builds. | `4` | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| [`qris-saurus`](https://github.com/creasico/qris-saurus) | Broad SDK with TLV utilities, provider detection, rendering, CLI, and gateway adapters. | `1` | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |

Choose `@shamah/dynamic-qris` when you want a tiny, auditable, type-safe QRIS payload generator that composes with the rest of your stack.

## Development

```bash
npm install
npm test
npm run build
npm run test:types
```

Useful scripts:

| Command | Description |
| --- | --- |
| `npm test` | Run Vitest unit tests. |
| `npm run build` | Build ESM, CJS, and declaration files with tsup. |
| `npm run test:types` | Run tsd type tests against built declarations. |
| `npm run lint` | Run TypeScript with `--noEmit`. |
