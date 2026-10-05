// ---
// relationships:
//   verifies: agent-tools
// ---
import { recoveryService } from "./recovery-service.ts";
import type { RecoveryConfiguration } from "./recovery-service.ts";
const config = JSON.parse(process.argv[2]!) as RecoveryConfiguration;
const service = await recoveryService(config);
process.send?.({ kind: "ready" });
process.on("message", (value: unknown) => {
  const message = value as { kind: string; escalationId?: string; tool?: string; args?: unknown };
  void (async () => {
    if (message.kind === "call")
      process.send?.({ kind: "call", result: await service.call(message.tool!, message.args) });
    if (message.kind === "answer") {
      service.escalations.answer(message.escalationId!, { text: "Upper shelf" }, "api");
      process.send?.({ kind: "answered" });
    }
    if (message.kind === "snapshot")
      process.send?.({ kind: "snapshot", snapshot: service.snapshot() });
    if (message.kind === "stop") {
      await service.stop();
      process.exit(0);
    }
  })().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
});
