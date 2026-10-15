/**
 * Integer paise (1 INR = 100 paise) for authoritative money math.
 * Never use IEEE floats for persisted financial values.
 */

const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const KM_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

export type ParseResult =
  | { ok: true; paise: bigint }
  | { ok: false; error: string };

export function parseMoneyInput(
  raw: string,
  fieldLabel = "Amount",
): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, paise: ZERO };
  }
  if (!MONEY_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: `${fieldLabel} must be a valid amount with up to 2 decimal places.`,
    };
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const paise =
    BigInt(whole) * HUNDRED + BigInt((fraction + "00").slice(0, 2));
  return { ok: true, paise };
}

export function parseKmInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, paise: ZERO }; // reuse shape: value * 100 for 2dp km
  }
  if (!KM_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: "Kilometres must be a valid number with up to 2 decimal places.",
    };
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const hundredths =
    BigInt(whole) * HUNDRED + BigInt((fraction + "00").slice(0, 2));
  return { ok: true, paise: hundredths };
}

/** Convert paise to a NUMERIC-compatible string, e.g. "1250.50". */
export function paiseToNumericString(paise: bigint): string {
  const negative = paise < ZERO;
  const abs = negative ? -paise : paise;
  const whole = abs / HUNDRED;
  const fraction = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function sumPaise(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, ZERO);
}

export function netProfitPaise(earnings: bigint, expenses: bigint): bigint {
  return earnings - expenses;
}

const inrExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPaise(paise: bigint): string {
  // Display-only: value is already quantized to integer paise (2 dp).
  return inrExact.format(Number(paiseToNumericString(paise)));
}

/** Display helper when value already comes from DB as number/string. */
export function formatInrExact(amount: number | string): string {
  const numeric =
    typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(numeric)) {
    return inrExact.format(0);
  }
  return inrExact.format(numeric);
}

export { ZERO as ZERO_PAISE };
