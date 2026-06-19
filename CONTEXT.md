# Domain Glossary

This document captures the domain language used by the `dynamic-qris` library.
It contains only definitions; implementation details belong in source code and
architectural decision records.

## QRIS Payload

A raw EMV/QRIS string encoded inside a QR code. It is the textual payload the
library operates on, not the QR image itself.

## Static QRIS

A QRIS payload without a transaction amount. Static QRIS can be reused for
arbitrary customer-entered amounts.

## Pre-Amount QRIS

A QRIS payload that already carries a transaction amount. It is still valid
EMV/QRIS but is not considered "static" for the purposes of dynamic
conversion.

## Dynamic QRIS

A QRIS payload produced from a static or pre-amount QRIS payload by inserting
a requested transaction amount and recalculating the CRC16 checksum.

## Customer Fee

An optional customer-paid convenience charge added on top of the base
transaction amount. It may represent a tip, admin fee, or service fee depending
on merchant context, and is encoded via the QRIS convenience fee fields.

### Fixed Customer Fee

A customer fee expressed as an exact rupiah amount, e.g. Rp500.

### Percentage Customer Fee

A customer fee expressed as a percentage of the base transaction amount, e.g.
1.5%. Fractional rupiah results are rounded using a caller-selected
strategy (`ceil` by default).

## Payable Amount

The total amount the customer is expected to pay after the base amount and
any customer fee are combined. Both the base amount and the payable amount
must remain within the documented rupiah limits.

## Metadata

Optional merchant-facing fields extracted from a QRIS payload for caller
convenience, such as merchant identity, merchant account fields, country,
city, currency, postal code, and additional data labels. Metadata extraction
is best-effort and never required for dynamic QRIS correctness.

## Reference Label

An optional additional data label used for a merchant-facing transaction
reference, such as an invoice ID, order ID, or payment reference.

## Terminal Label

An optional additional data label used to identify the POS terminal, cashier,
outlet device, or source that created the QRIS payload.
