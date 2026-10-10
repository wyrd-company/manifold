// ---
// relationships:
//   implements: operator-console
// ---
export function parseProjectReference(value: string) {
  const text = value.trim();
  let match = /^([a-zA-Z0-9-]+)\/(\d+)$/.exec(text);
  if (!match) {
    try {
      const url = new URL(text);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "github.com" ||
        url.port ||
        url.username ||
        url.password
      )
        return;
      match = /^\/(?:orgs|users)\/([a-zA-Z0-9-]+)\/projects\/(\d+)(?:\/.*)?$/.exec(url.pathname);
    } catch {
      return;
    }
  }
  if (!match) return;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) return;
  return { owner: match[1]!, number };
}
export function bindingName(owner: string, number?: number) {
  let value = owner
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!/^[a-z]/.test(value)) value = `project-${value}`;
  if (number !== undefined) value += `-${number}`;
  return value.slice(0, 64).replace(/-$/, "");
}
