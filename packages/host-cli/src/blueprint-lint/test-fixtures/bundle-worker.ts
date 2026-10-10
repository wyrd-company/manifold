// ---
// relationships:
//   verifies: host-cli-blueprint-lint
// ---
import { blueprintLintCommand } from "../command.ts";
export const parcelBlueprint = `
schemas:
  input: true
  output: true
  context: true
  events: {}
  actors:
    github-card-move: { input: true, output: true }
machine:
  initial: packing
  states:
    packing:
      invoke: { src: github-card-move, input: { status: Packed }, onDone: done }
    done: { type: final }
`;
if (import.meta.main)
  process.exitCode = await blueprintLintCommand(process.argv.slice(2), {
    files: new Map([["blueprints/parcel.yml", parcelBlueprint]]),
  });
