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
pruning pass (five minutes after service start). After that pass, read the expired
actor's pruning notice and retained visits and output. Its event and command
payloads are gone. The recent actor's full history remains. The expired source
event and gate evaluation are gone; their recent counterparts remain.

The integration test `UAT seed preserves existing rows and one pruning pass
removes exactly expired rows` runs the script against a populated fixture store,
checks repeat execution, and checks the exact removed and retained rows.
