// ---
// relationships:
//   implements: operator-console
// ---
import { cx, type CxOptions } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
export function cn(...classes: CxOptions) {
  return twMerge(cx(classes));
}
