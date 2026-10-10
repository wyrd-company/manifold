// ---
// relationships:
//   verifies: service-distribution
// ---
import assert from "node:assert/strict";
import { selectCut } from "./smoke-selection.mjs";
import { execFile } from "node:child_process";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const roles = ["manifold-service", "manifold-service.previous", "manifold-service.next"];
const scratches = ["manifold-service.staging", "manifold-service.discard"];
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

// NUL-delimited metadata checks paths independently of the operator's
// line-delimited listings. Native diff checks regular-file bytes separately.
async function metadata(directory) {
  const { stdout } = await run("find", [directory, "-printf", "%P\\0%y\\0%m\\0%l\\0"], {
    maxBuffer: 16 * 1024 * 1024,
  });
  const fields = stdout.split("\0");
  fields.pop();
  const records = [];
  for (let index = 0; index < fields.length; index += 4)
    records.push(fields.slice(index, index + 4));
  return records.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

export async function checkUpgrades({
  archive,
  temporary,
  deployment,
  configuration,
  tree,
  checkStart,
  start,
  mode = "full",
}) {
  assert(["short", "full"].includes(mode), "Smoke mode must be short or full");
  const directory = join(temporary, "recovery");
  const templates = join(temporary, "templates");
  const references = join(temporary, "references");
  const archives = new Map([["A", archive]]);
  const expectedTrees = new Map();
  const script = resolve(import.meta.dirname, "../../../dist/packages/manifold-upgrade.sh");
  const preserved = await tree(deployment);
  await mkdir(templates);
  await mkdir(references);
  for (const variant of ["A", "B", "F", "M", "K", "L", "O"]) {
    const source = join(templates, variant);
    await mkdir(source);
    await run("tar", ["-xzf", archive, "-C", source]);
    const install = join(source, "manifold-service");
    if (variant === "B") await writeFile(join(install, "added"), "new release\n");
    if (variant === "F") await writeFile(join(install, "dist/main.js"), "process.exit(1);\n");
    if (variant === "M") await chmod(join(install, "package.json"), 0o755);
    if (["K", "L"].includes(variant)) {
      await writeFile(join(install, "first"), "same bytes\n");
      await writeFile(join(install, "second"), "same bytes\n");
      await symlink(variant === "K" ? "first" : "second", join(install, "link"));
    }
    if (variant === "O") {
      await writeFile(join(install, "obsolete"), "old release\n");
      await mkdir(join(install, "obsolete-directory"));
    }
    expectedTrees.set(variant, await metadata(install));
    // Keep byte references separate from hard-linked fixture copies, so a
    // faulty script that edits a role cannot edit its own expected bytes.
    await run("cp", ["-a", "--reflink=auto", install, join(references, variant)]);
    if (variant !== "A") {
      const packed = join(templates, `${variant}.tar.gz`);
      await run("tar", ["-czf", packed, "-C", source, "manifold-service"]);
      archives.set(variant, packed);
    }
  }
  // Check the shipped script, including packaging's producer/consumer path.
  assert.equal(
    await readFile(script, "utf8"),
    await readFile(join(import.meta.dirname, "manifold-upgrade.sh"), "utf8"),
  );
  const bin = join(temporary, "interrupt-bin");
  await mkdir(bin);
  const log = join(temporary, "operations");
  const count = join(temporary, "operation-count");
  const realCommands = {};
  for (const command of ["mv", "rm", "rmdir", "mkdir", "tar"]) {
    realCommands[command] = (await run("sh", ["-c", `command -v ${command}`])).stdout.trim();
    // The wrapper kills only its direct parent, the shell spawned for this test.
    await writeFile(
      join(bin, command),
      `#!/bin/sh
set -eu
n=0
[ ! -f "$UPGRADE_COUNT" ] || n=$(cat "$UPGRADE_COUNT")
n=$((n + 1))
echo "$n" > "$UPGRADE_COUNT"
echo "${command} $*" >> "$UPGRADE_LOG"
if [ "$n" = "$UPGRADE_STOP" ] && [ "$UPGRADE_DURING" = 1 ] && [ '${command}' = rm ]; then
  target_index=0
  for target do
    case "$target" in -*) continue ;; esac
    if [ "$target_index" -lt "$UPGRADE_REMOVAL_TARGET" ]; then
      '${realCommands.rm || "/usr/bin/rm"}' -rf -- "$target"
      target_index=$((target_index + 1))
      continue
    fi
    if [ -d "$target" ]; then
      entry=$(find "$target" -mindepth 1 -print -quit)
      [ -z "$entry" ] || '${realCommands.rm || "/usr/bin/rm"}' -rf -- "$entry"
    fi
    kill -KILL "$PPID"
    exit 0
  done
  kill -KILL "$PPID"
  exit 0
fi
'${realCommands[command]}' "$@"
if [ "$n" = "$UPGRADE_STOP" ]; then
  if [ "$UPGRADE_DURING" = 1 ] && [ '${command}' = tar ]; then
    entry=$(find manifold-service.staging -type f -print -quit)
    [ -z "$entry" ] || '${realCommands.rm}' -f -- "$entry"
  fi
  kill -KILL "$PPID"
fi
`,
    );
    await chmod(join(bin, command), 0o755);
  }
  async function restore(state) {
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory);
    await cp(script, join(directory, "manifold-upgrade.sh"));
    for (let i = 0; i < roles.length; i++) {
      if (state.roles[i])
        await run("cp", [
          "-a",
          "-l",
          join(templates, state.roles[i], "manifold-service"),
          join(directory, roles[i]),
        ]);
    }
    for (let i = 0; i < scratches.length; i++) {
      if (state.scratch[i]) {
        await mkdir(join(directory, scratches[i]));
        await writeFile(join(directory, scratches[i], "partial"), "partial tree\n");
      }
    }
  }
  async function identify(path) {
    if (!(await exists(path))) return null;
    if (await exists(join(path, "obsolete"))) return "O";
    if (await exists(join(path, "added"))) return "B";
    if (await exists(join(path, "link")))
      return (await readlink(join(path, "link"))) === "first" ? "K" : "L";
    if (((await lstat(join(path, "package.json"))).mode & 0o7777) === 0o755) return "M";
    if ((await readFile(join(path, "dist/main.js"), "utf8")) === "process.exit(1);\n") return "F";
    return "A";
  }
  async function state() {
    const result = {
      roles: await Promise.all(roles.map((role) => identify(join(directory, role)))),
      scratch: await Promise.all(scratches.map((scratch) => exists(join(directory, scratch)))),
    };
    // A role must always hold a complete tree, even while scratch is partial.
    for (let i = 0; i < roles.length; i++) {
      if (result.roles[i])
        assert.deepEqual(
          await metadata(join(directory, roles[i])),
          expectedTrees.get(result.roles[i]),
          `Partial role: ${roles[i]}`,
        );
      if (result.roles[i])
        await run("diff", [
          "-r",
          "-q",
          "--no-dereference",
          join(references, result.roles[i]),
          join(directory, roles[i]),
        ]);
    }
    assert(result.roles.some(Boolean), "No complete install remains");
    return result;
  }
  async function recover(recovery, stop = 0, during = false, removalTarget = 0) {
    await writeFile(log, "");
    await writeFile(count, "0");
    let index = 0;
    let killed = false;
    const commands = [];
    for (const args of recovery) {
      try {
        await run("sh", [join(directory, "manifold-upgrade.sh"), ...args], {
          cwd: temporary,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            UPGRADE_LOG: log,
            UPGRADE_COUNT: count,
            UPGRADE_STOP: String(stop),
            UPGRADE_DURING: during ? "1" : "0",
            UPGRADE_REMOVAL_TARGET: String(removalTarget),
          },
        });
      } catch (error) {
        assert.equal(error.signal, "SIGKILL", `Unexpected script failure: ${error.stderr}`);
        assert(stop > 0);
        killed = true;
        break;
      }
      const operations = (await readFile(log, "utf8")).trim().split("\n").filter(Boolean);
      while (commands.length < operations.length) commands.push(args[0]);
      index++;
    }
    if (stop) assert(killed, `Stop ${stop} was not reached`);
    return {
      operations: (await readFile(log, "utf8")).trim().split("\n").filter(Boolean),
      index,
      commands,
    };
  }
  async function verify(expected) {
    assert.deepEqual((await state()).roles, expected, "Recovery reached the wrong installs");
    assert.deepEqual(
      (await readdir(directory)).sort(),
      ["manifold-upgrade.sh", ...roles.filter((_, i) => expected[i])].sort(),
      "Unexpected scratch or install entry",
    );
    assert.deepEqual(await tree(deployment), preserved, "Upgrade changed deployment");
  }
  async function startEnd(expected) {
    await verify(expected);
    await checkStart(join(directory, roles[0]), configuration);
    preserved.splice(0, preserved.length, ...(await tree(deployment)));
  }
  const prepare = (variant) => [["prepare", archives.get(variant)], ["swap"]];
  const initial = (current, previous = null, next = null) => ({
    roles: [current, previous, next],
    scratch: [false, false],
  });
  await restore(initial("O"));
  await recover(prepare("B"));
  await startEnd(["B", "O", null]);
  await recover(prepare("B"));
  await recover([["swap"]]);
  await startEnd(["B", "O", null]);
  await restore(initial("F", "A"));
  assert.equal(await start(join(directory, roles[0]), configuration).ended, 1);
  await recover([["rollback"]]);
  await recover([["rollback"]]);
  await startEnd(["A", null, null]);
  for (const [before, previous, variant] of [
    ["A", "B", "M"],
    ["K", "A", "L"],
  ]) {
    await restore(initial(before, previous));
    await recover(prepare(variant));
    await startEnd([variant, before, null]);
  }

  const worklist = [];
  const seen = new Set();
  function enqueue(origin, input, recovery, expected) {
    const key = JSON.stringify([origin, input]);
    if (seen.has(key)) return;
    seen.add(key);
    worklist.push({ origin, input, recovery, expected });
  }
  enqueue("upgrade", initial("A", "B"), prepare("M"), ["M", "A", null]);
  enqueue("repeat", initial("B", "A"), prepare("B"), ["B", "A", null]);
  enqueue("rollback", initial("F", "A"), [["rollback"]], ["A", null, null]);
  const covered = new Set();
  let stops = 0;
  const startedEnds = new Set();
  const selectedCuts = new Set();
  for (const [index, item] of worklist.entries()) {
    if (index % 10 === 0)
      console.log(
        `Upgrade sweep: ${index}/${worklist.length} recovery states, ${stops} stops checked.`,
      );
    await restore(item.input);
    const complete = await recover(item.recovery);
    await verify(item.expected);
    for (let operation = 0; operation < complete.operations.length; operation++) {
      const description = complete.operations[operation];
      const removalTargets = description.startsWith("rm ")
        ? description.split(" ").filter((argument) => argument.startsWith("manifold-service"))
        : [];
      const cuts = [{ during: false, removalTarget: 0 }];
      if (description.startsWith("tar ")) cuts.push({ during: true, removalTarget: 0 });
      for (const removalTarget of removalTargets.keys()) cuts.push({ during: true, removalTarget });
      for (const { during, removalTarget } of cuts) {
        // Determine the command from each invocation, rather than infer it from filesystem operations.
        const operationCommand = complete.commands[operation];
        const cut = during ? removalTargets[removalTarget] || "extraction" : "after";
        // The same shell operation serves distinct recovery paths. Keep those
        // paths separate while avoiding every repeated state in the full graph.
        let recovery = "";
        if (operation === 0) recovery = JSON.stringify([item.origin, item.input.scratch]);
        if (description === "mv -- manifold-service.next manifold-service.discard")
          recovery =
            operationCommand === "prepare"
              ? complete.operations
                  .slice(0, operation)
                  .includes("mv -- manifold-service.staging/manifold-service manifold-service.next")
                ? "equal-next"
                : "present-next"
              : item.input.roles[0]
                ? "current-present"
                : "current-absent";
        if (!selectCut(mode, selectedCuts, operationCommand, description, cut, recovery)) continue;
        await restore(item.input);
        const stopped = await recover(item.recovery, operation + 1, during, removalTarget);
        assert.equal(stopped.operations.at(-1), description);
        const stoppedState = await state();
        stops++;
        console.log(
          JSON.stringify({
            origin: item.origin,
            operation: description,
            cut: during ? removalTargets[removalTarget] || "extraction" : "after",
            state: stoppedState,
          }),
        );
        const command = item.recovery[stopped.index][0];
        covered.add(`${command}:${description}`);
        if (
          command === "prepare" &&
          description === "mv -- manifold-service.next manifold-service.discard" &&
          !stopped.operations.includes(
            "mv -- manifold-service.staging/manifold-service manifold-service.next",
          )
        )
          covered.add("present-next");
        if (
          command === "prepare" &&
          description === "mv -- manifold-service.next manifold-service.discard" &&
          stopped.operations.includes(
            "mv -- manifold-service.staging/manifold-service manifold-service.next",
          )
        )
          covered.add("equal-next");
        if (operation === 0) {
          for (let i = 0; i < scratches.length; i++) {
            if (item.input.scratch[i] && during && removalTargets[removalTarget] === scratches[i])
              covered.add(`cleanup:${scratches[i]}`);
          }
        }
        if (
          command === "rollback" &&
          description === "mv -- manifold-service.next manifold-service.discard" &&
          !stoppedState.roles[0]
        )
          covered.add("rollback-next-without-current");
        enqueue(item.origin, stoppedState, item.recovery, item.expected);
        if (item.origin === "upgrade" && command === "swap") {
          const expected =
            stoppedState.roles[0] && stoppedState.roles[2] ? stoppedState.roles : ["A", null, null];
          enqueue(
            `swap-rollback:${JSON.stringify(expected)}`,
            stoppedState,
            [["rollback"]],
            expected,
          );
        }
        await recover(item.recovery);
        await verify(item.expected);
      }
    }
    const endKey = JSON.stringify([item.origin, item.expected]);
    if (!startedEnds.has(endKey)) {
      await startEnd(item.expected);
      startedEnds.add(endKey);
    }
  }
  assert(covered.has("present-next"), "Present next discard was not interrupted");
  assert(covered.has("equal-next"), "Equal next discard was not interrupted");
  assert(
    covered.has("rollback-next-without-current"),
    "Rollback next discard with absent current was not interrupted",
  );
  for (const scratch of scratches) {
    assert(covered.has(`cleanup:${scratch}`), `Present ${scratch} cleanup was not swept`);
  }
  assert(
    worklist.some(
      (item) =>
        item.origin === "repeat" &&
        JSON.stringify(item.input.roles) === JSON.stringify(["B", "A", null]) &&
        !item.input.scratch[0] &&
        item.input.scratch[1],
    ),
    "Cleanup between the two scratch removals was not swept",
  );
  console.log(
    JSON.stringify({
      mode,
      operationCoverage: [...selectedCuts].map((key) => JSON.parse(key)).sort(),
    }),
  );
  console.log(
    `Upgrade smoke (${mode}) passed: six cases, ${worklist.length} recovery states, ${stops} SIGKILL stops, ${startedEnds.size} distinct origin/end starts; recovery-only operations covered.`,
  );
  return {
    mode,
    cases: 6,
    recoveryStates: worklist.length,
    stops,
    starts: startedEnds.size,
    operations: [...selectedCuts].map((key) => JSON.parse(key)),
  };
}
