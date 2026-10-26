import { ValidationError } from "./errors.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function assertIsoDate(value: string, field: string): void {
  if (!isIsoDate(value)) {
    throw new ValidationError(`${field} must be a real date in YYYY-MM-DD format, for example 2026-10-30. Got "${value}".`);
  }
}

/** Calendar date (YYYY-MM-DD) of an instant in the given IANA time zone. */
export function dateInZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function nowIso(now: Date): string {
  return now.toISOString();
}
