export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY = /token|secret|password|passwd|api[-_]?key|apikey|authorization|cookie|credential|private[-_]?key/i;
const SECRET_VALUE = /\b(sk-(ant-)?[A-Za-z0-9_-]{16,}|ntn_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{12,})/g;

/**
 * Returns a deep copy with secrets removed:
 * - any value under a key that looks sensitive (token, password, api_key, ...)
 * - any string that looks like a known key format, wherever it appears
 */
export function redact<T>(value: T, depth = 0): T {
  if (depth > 10) return REDACTED as T;
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE, REDACTED) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out as T;
  }
  return value;
}
