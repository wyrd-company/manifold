// ---
// relationships:
//   implements: operator-console
// ---
export interface CanvasHistory {
  undo: { before: string; after: string }[];
  redo: { before: string; after: string }[];
}
export function recordEdit(history: CanvasHistory, before: string, after: string): CanvasHistory {
  return before === after
    ? history
    : { undo: [...history.undo, { before, after }].slice(-100), redo: [] };
}
export function undo(history: CanvasHistory, text: string) {
  const pair = history.undo.at(-1);
  if (!pair || pair.after !== text)
    return { text, history: { undo: [], redo: [] } as CanvasHistory };
  return {
    text: pair.before,
    history: { undo: history.undo.slice(0, -1), redo: [...history.redo, pair] },
  };
}
export function redo(history: CanvasHistory, text: string) {
  const pair = history.redo.at(-1);
  if (!pair || pair.before !== text)
    return { text, history: { undo: [], redo: [] } as CanvasHistory };
  return {
    text: pair.after,
    history: { undo: [...history.undo, pair], redo: history.redo.slice(0, -1) },
  };
}
