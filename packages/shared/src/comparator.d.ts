// ---
// relationships:
//   implements: comparator-contract
// ---
export type Comparator = (input: ComparatorInput) => ComparatorSelection | null;
export interface ComparatorInput {
  readonly population: readonly ComparatorTask[];
  readonly holders: readonly ComparatorHolder[];
  readonly balances: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly random: () => number;
}
export interface ComparatorTask {
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly age: number;
  readonly dependencies: "blocked" | "clear";
  readonly criticalPath: number;
  readonly item: string;
}
export interface ComparatorHolder {
  readonly id: string;
  readonly item: string;
}
export interface ComparatorSelection {
  readonly task: string;
  readonly reservations?: readonly ComparatorReservation[];
}
export interface ComparatorReservation {
  readonly account: string;
  readonly amount: number;
}
