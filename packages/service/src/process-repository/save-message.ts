// ---
// relationships:
//   implements: process-repository
// ---
export function saveMessage(message: string, saveId: string): string {
  return `${message.trimEnd()}\n\nManifold-Save: ${saveId}\n`;
}
export function carriesSave(message: string, saveId: string): boolean {
  const trailer = message
    .trimEnd()
    .split(/\r?\n\r?\n/)
    .at(-1)!;
  return trailer.split(/\r?\n/).includes(`Manifold-Save: ${saveId}`);
}
