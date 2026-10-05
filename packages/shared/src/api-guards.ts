// ---
// relationships:
//   implements: [tasks-api, escalation-contract]
// ---
export const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const string = (v: unknown): v is string => typeof v === "string";
export const nonempty = (v: unknown) => string(v) && v.length > 0;
export const integer = (v: unknown) => typeof v === "number" && Number.isInteger(v);
export const natural = (v: unknown) => integer(v) && Number(v) >= 0;
export const boolean = (v: unknown) => typeof v === "boolean";
export const array = (guard: (v: unknown) => boolean) => (v: unknown) =>
  Array.isArray(v) && v.every(guard);
export const oneOf =
  (...values: readonly unknown[]) =>
  (v: unknown) =>
    values.includes(v);
export const uri = (v: unknown) => string(v) && /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(v);
export function shape(
  v: unknown,
  required: Record<string, (v: unknown) => boolean>,
  optional: Record<string, (v: unknown) => boolean> = {},
): boolean {
  return (
    record(v) &&
    Object.entries(required).every(([k, guard]) => Object.hasOwn(v, k) && guard(v[k])) &&
    Object.keys(v).every(
      (k) => Object.hasOwn(required, k) || (Object.hasOwn(optional, k) && optional[k]!(v[k])),
    )
  );
}

/** RFC 3339 timestamps at the JSON boundary, including their calendar date. */
export function dateTime(value: unknown): boolean {
  if (!string(value)) return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[tT](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[zZ]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      value,
    );
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}
