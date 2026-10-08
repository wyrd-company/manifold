<!--
relationships:
  verifies: [retention, actor-history]
-->

# Retention and ended history UAT data

Run from a source checkout with dependencies installed and the shared package built
(`pnpm --filter @wyrd-company/manifold-shared build`). Start the fresh installation
once to initialize its store, then stop the service. Keep it stopped while this
command runs:

```sh
node testing/uat/seed-retention.mjs --store /path/to/data/state.sqlite --service-stopped
```

The tool requires an existing initialized store and an explicit stopped-service
acknowledgement. The acknowledgement is an operator assertion; the tool cannot
check a service running on another host. Use only the UAT installation's store.
The insert is one transaction. It changes no existing actor, credential,
binding, or allocation. Repeating the command adds no further rows.

`--history-days`, `--source-days`, and `--gate-days` take positive whole days and
must match the installation's retention windows. Defaults are 90, 30, and 30.
`--now` accepts an ISO timestamp for reproducible fixture data. With a `forever`
window, the corresponding synthetic expired rows remain; there is no expiry to
exercise for that window. Run `--help` for all arguments.

The generated actors are `uat-retention-expired` and `uat-retention-recent`, each
with two state visits, a consumed event, a command, and an ended output. The
source is `uat-retention`; the gate is `uat-retention#waiting`. The expired actor
ended one day past the history window. The expired source event and evaluation
are one day past their windows. Recent rows use the supplied current time.
All values are synthetic and contain no credentials.

Restart the service. Read both ended actors through Actors before the first
prune run (five minutes after service start). After that pass, read the expired
actor's pruning notice and retained visits and output. Its event and command
payloads are gone. The recent actor's full history remains. The expired source
event and gate evaluation are gone; their recent counterparts remain.

The integration test `UAT seed preserves existing rows and one prune run
removes exactly expired rows` runs the script against a populated fixture store,
checks repeat execution, and checks the exact removed and retained rows.

## Project creation and messages

Copy `testing/uat/blueprints/project-and-message.yml` to
`blueprints/project-and-message.yml` in the starter process repository. Set its
`machine.context.recipientIssue` to the GitHub node ID of an issue whose task
actor is waiting on an agent thread. Set `machine.context.workspaceRoot` to an
unused absolute directory on the bound T3 Code environment. The blueprint
creates that directory and project; use a disposable UAT directory.

Create a second issue on the same bound Project. In
`decision-models/intake.yml`, set the default rule's `blueprint` expression to:

```text
task.issue.nodeId = "example-sender-node-id" ? "blueprints/project-and-message.yml" : "blueprints/task.yml"
```

Replace `example-sender-node-id` with the second issue's GitHub node ID. Keep the
rule's model fields. Commit and push these files before adding the second issue
to the Project. Lint the copy first:

```sh
manifold-host blueprint lint /path/to/process/blueprints/project-and-message.yml
```

The first issue continues to use the starter blueprint. The second issue's task
actor creates a T3 Code project named `Sample workspace`, then sends
`The parcel label changed.` to the first issue's task actor and ends. Read the
`project-create` command in the sender's Actor history and the new project in
the T3 Code environment. Ask the recipient agent to call `get-messages`; it
reads the update once during its pass. Check the recipient's Actor history for
the routed message event. The acceptance test uses this same blueprint and
checks the compiled host CLI's lint result.
