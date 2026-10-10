// ---
// relationships:
//   implements: operator-console
// ---
const group = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function sign(amount: number, signed = false) {
  return amount < 0 ? "−" : signed && amount > 0 ? "+" : "";
}
function dollars(value: bigint, places: number, trim = false) {
  const scale = 10n ** BigInt(places);
  let decimals = (value % scale).toString().padStart(places, "0");
  if (trim) decimals = decimals.replace(/0+$/, "").padEnd(2, "0");
  return `$${group((value / scale).toString())}.${decimals}`;
}
export function formatAmount(
  amount: number,
  unit: string | undefined,
  options?: { readonly signed?: boolean },
): string {
  const magnitude = BigInt(Math.abs(amount));
  const prefix = sign(amount, options?.signed);
  if (unit !== "usd") return prefix + group(magnitude.toString());
  if (magnitude >= 1000000n) return prefix + dollars((magnitude + 5000n) / 10000n, 2);
  const rounded = (magnitude + 50n) / 100n;
  if (magnitude > 0n && rounded === 0n) return prefix + "<$0.0001";
  return prefix + dollars(rounded, 4, true);
}
export function formatAmountExact(amount: number, unit: string | undefined): string {
  return (
    sign(amount) +
    (unit === "usd" ? dollars(BigInt(Math.abs(amount)), 6) : group(Math.abs(amount).toString()))
  );
}
export function formatPercent(percent: number): string {
  return `${Number(percent.toFixed(2))}%`;
}
