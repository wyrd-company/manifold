---
relationships:
  references:
    - service-distribution
    - service-configuration
    - service-configuration.example
    - github-event-source
    - t3code-environment-source
    - escalations
    - host-cli-usage
    - host-cli-mcp
    - host-cli-hook
    - default-process
    - accounts-declaration
    - task-metadata-declaration
    - retention-configuration
---

# Operator setup

## 1. What you will have

Run a service that takes in an issue from a test GitHub Project. Use one Linux
service host, one GitHub organization, and a T3 Code environment for agent work.
Keep the install directory separate from the deployment directory that holds
configuration, credentials, and state. Run the checks in each section before
continuing. Commands below use a POSIX shell.

## 2. Prerequisites

- A Linux x64 or arm64 host with glibc and Node 24.11 or later.
- A build machine with Node, the pnpm version in `package.json`, Task, and a
  checkout of Manifold at the commit under acceptance.
- A GitHub organization you administer, a test repository for issues, and an
  organization Project. Use disposable test data.
- A stable released T3 Code server on each environment and a checkout of the
  repository in which agents work.
- An ntfy account or server if you want notifications.
- Your own reverse proxy or tunnel for GitHub deliveries and phone answers.

The service host needs Node and the archive. It needs no package manager.
The host CLI is a Bun binary; its environment needs no Bun installation.

## 3. Build and install

Build the service archive and host CLI binaries from a checkout for user
acceptance testing (UAT). Nothing is published before UAT, including release
assets, registry packages, images, and workflow artifacts.

In the Manifold checkout, build for your service host:

```sh
task package:service ARCH=x64
# For a Linux arm64 host instead:
# task package:service ARCH=arm64
task package:smoke
# Compile host CLI targets for each environment:
task build:targets
```

`package:smoke` starts the archive for the build machine's architecture. Run it
on the matching machine. CI builds and starts both Linux architectures.
The archive is `dist/packages/manifold-service-<version>-linux-<arch>.tar.gz`;
`<version>` is the service package's version. Copy it to the service host.

Choose an empty install directory, for example `/opt/example-service`, and a
separate deployment directory, for example `/srv/example-deployment`. Extract
into the empty install directory:

```sh
mkdir -p /opt/example-service
tar -xzf /path/to/manifold-service-<version>-linux-<arch>.tar.gz -C /opt/example-service
mkdir -p /srv/example-deployment/credentials /srv/example-deployment/state
chmod 700 /srv/example-deployment/credentials
cp docs/specifications/service-configuration.example.yml /srv/example-deployment/service.yml
```

Check: the install has `manifold-service/package.json`, `dist/`, and
`node_modules/`. The deployment has `service.yml`, `credentials/`, and `state/`.
No credential belongs in the install directory. Relative configuration paths
resolve against `service.yml`, regardless of the service's working directory.

## 4. Create and install the GitHub App

Grant the full approved App permission set below. The descriptions name the
access each grant allows; each module uses the grants its operations need.

| Scope        | Permission                    | Access                                                                   |
| ------------ | ----------------------------- | ------------------------------------------------------------------------ |
| Repository   | Metadata: read                | Read repository metadata; GitHub includes this with every App.           |
| Repository   | Contents: read and write      | Clone and pull the process repository; save blueprints from the console. |
| Repository   | Issues: read and write        | Read and update issues and their relationships.                          |
| Repository   | Pull requests: read and write | Read and update pull requests.                                           |
| Repository   | Webhooks: read and write      | Manage repository hooks, read deliveries, and request redelivery.        |
| Organization | Issue fields: read and write  | Read and manage organization issue field definitions.                    |
| Organization | Issue types: read and write   | Read and manage organization issue types.                                |
| Organization | Projects: read and write      | Read Projects and update their items and fields.                         |
| Organization | Webhooks: read and write      | Manage organization hooks, read deliveries, and request redelivery.      |

See [GitHub's App permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)
for the permission scopes and operations they allow.

In the organization's developer settings, create a GitHub App. Keep its own
webhook inactive and select no App webhook events. Manifold reads deliveries
from the separate hook created in section 7.

Install the App on the organization with access to the process repository and
the repositories whose issues the test Project holds. Record the App id from
its settings page and the installation id from the installation settings URL.
The configuration uses these two ids; it does not use the App client id.
Generate the App private key and save the downloaded file as
`credentials/github-app.pem` in the deployment directory. Set mode 0600.

Check: the installation includes each test repository. No credential value is
printed in a terminal, copied into a URL, committed, or placed in a task note.

## 5. Create the process repository

Install the host CLI first. Copy the binary for each machine from
`packages/host-cli/dist/linux-x64/manifold-host`, `linux-arm64/manifold-host`,
`darwin-arm64/manifold-host`, or `windows-x64/manifold-host.exe` to its `PATH`.
The build uses `task build:targets`. Check that `manifold-host --help` lists
the commands, and that `manifold-host usage push --help` lists its flags.

Copy the checkout's `examples/starter/` into a new process repository owned by
your organization. Keep credentials out of it. Create the test GitHub Project,
and note its owner and number from the Project URL.

On each environment, run `t3 project add /path/to/task-checkout`. Record the
T3code project's id from the `Added project <id>` output. For an existing
project, use its record in the T3 Code client or an authenticated project snapshot. Use the same environment name in every declaration.

Replace the starter's commented placeholders:

- `bindings.yml`: test Project owner and number, environment name, and T3code
  project id used by intake.
- `task-metadata.yml`: the Project's lifecycle field and its options. Include
  `In Progress` and `Done`, which the bundled blueprint uses. A new Project's
  `Status` field includes `Todo`, `In Progress`, and `Done`.
- `decision-models/intake.yml`: set `data.model.instanceId` to the provider
  instance configured in T3 Code and `data.model.model` to a model available
  through that environment's account. The starter values are placeholders.
- `accounts.yml`: each account's `unit`, `kind` (`api` or `subscription`), and
  `capacity`. Set `amount` in the account's unit, a UTC `reset` instant, and
  `every` with exactly one of `hours`, `days`, or `months`. Amounts have at most
  six decimal places; a monthly reset must be on day 28 or earlier in UTC.
  Set each `usage` entry's environment and provider to the ones you run.

Capacity is declared in the process repository, not service configuration.
The starter's intake names `blueprints/task.yml`, a bundled blueprint. A file
committed at that path replaces it, including when that file fails lint.

From the process repository root, run:

```sh
manifold-host manifest lint
manifold-host portfolio lint
manifold-host usage lint
manifold-host task-metadata lint
manifold-host blueprint lint --repository .
manifold-host comparator lint comparators/estimate.ts
```

Check: each command exits successfully with no findings. Commit and push the
process repository. Use its smart HTTP GitHub URL in `service.yml`.

## 6. Expose only the public endpoints

The API has no authentication. Your deployment controls who can reach it.
The public proxy forwards exactly these endpoints, with `{id}` one path segment:

| Method | Path                       | Use                                                  |
| ------ | -------------------------- | ---------------------------------------------------- |
| POST   | `/webhooks/github`         | Signed GitHub hook deliveries.                       |
| GET    | `/escalations/{id}`        | Answer page, authorized by its escalation key.       |
| POST   | `/escalations/{id}/answer` | Answer submission, authorized by its escalation key. |

The proxy answers all other paths and methods itself. Do not forward prefixes.
Keep `/api/`, `/console/`, `/api/usage/push`, `/api/agent-tools/calls`, and
`/api/agent-tools/notices` off the public network. A test tunnel follows the same rule and enables only the
endpoints the test exercises.

A Caddy example for your public hostname:

```caddyfile
service.example.com {
    @webhook {
        method POST
        path /webhooks/github
    }
    @answerPage {
        method GET
        path_regexp answerPage ^/escalations/[^/]+$
    }
    @answer {
        method POST
        path_regexp answer ^/escalations/[^/]+/answer$
    }
    route {
        reverse_proxy @webhook 127.0.0.1:7480
        reverse_proxy @answerPage 127.0.0.1:7480
        reverse_proxy @answer 127.0.0.1:7480
        respond 404
    }
}
```

Check from outside the host: `/console/` and `/api/actors` return the proxy's
404; a GET to `/webhooks/github` returns 404. The webhook POST reaches Manifold
and rejects an unsigned request with a 4xx. Set `escalations.publicUrl` to this
public base URL, with no endpoint suffix.

### Private service access

For environments on the service host, keep `http.host: 127.0.0.1` and use
`http://127.0.0.1:7480` as the private service URL. For environments on another
machine, set `http.host` to the service host's private LAN or VPN address, for
example:

```yaml
http:
  # A private-network address assigned to the service host.
  host: 192.168.50.10
  # The service port on that address.
  port: 7480
```

Use `http://192.168.50.10:7480` for the host CLI's `--service` value on each
remote environment and for the console at `/console/`. The usage push reaches
`/api/usage/push`; the MCP plugin reaches `/api/agent-tools/calls`, and its hook
reaches `/api/agent-tools/notices`. These paths
and the console never go through the public proxy. Replace the loopback
upstream in each Caddy forwarding rule above with the configured private bind
address. Keep its three endpoint rules unchanged.

Check from each remote environment: `GET /console/` on the private service URL
returns HTML. From the public URL, `/console/`, `/api/usage/push`,
`/api/agent-tools/calls`, and `/api/agent-tools/notices` receive the proxy's 404.

## 7. Create the organization hook

In organization settings, create a webhook with payload URL
`<public-base-url>/webhooks/github`, content type `application/json`, and SSL
verification enabled. Generate its secret into
`credentials/example-org-hook.secret` with mode 0600. Enter it through a secure
credential workflow in GitHub; keep the value out of shell history and logs.

Select these hook events: `issues`, `issue_dependencies`, `sub_issues`,
`projects_v2_item`, `projects_v2`, and `push`. In the GitHub UI their labels are
Issues, Issue dependencies, Sub-issues, Projects v2 items, Projects v2, and Pushes.
Record the hook id from its settings URL under `github.owners.<owner>.hooks`.

Check after service start: GitHub's recent delivery log shows accepted signed
deliveries. A disabled hook, a mismatched secret, or a missing event stops the
corresponding event stream. Repository hooks use the same payload URL and
secret-file convention; use one only where the binding requires it.

## 8. Configure T3 Code

The server defaults to port 3773. If it was started with `--port`, use that port.
For each environment, issue a pairing token on that environment, then exchange
it for exactly `orchestration:read` and `orchestration:operate`. Do not use
`t3 auth session issue`: it issues the administrative scope set.

This pipeline requires Node on the environment. Run it from the deployment
directory, or write to the corresponding credential path on the service host.
Use the same T3 Code data directory as the running server (`--base-dir` when
needed). Neither token is printed:

```sh
umask 077
t3 auth pairing create --json | node --input-type=module -e '
import { writeFile } from "node:fs/promises";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const pairing = JSON.parse(input);
const response = await fetch("http://127.0.0.1:3773/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: pairing.credential,
    subject_token_type: "urn:t3:params:oauth:token-type:environment-bootstrap",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: "orchestration:read orchestration:operate"
  })
});
if (!response.ok) throw new Error(`Token exchange failed (${response.status})`);
const result = await response.json();
if (typeof result.access_token !== "string") throw new Error("Missing access token");
await writeFile("credentials/workstation.token", result.access_token, { mode: 0o600 });
'
chmod 600 credentials/workstation.token
```

Set `environments.workstation.url` to the server URL reachable from the service
host and its `credential` to `workstation-token`. After the service starts,
check the connection on the console's Environments screen. The default token lifetime is 30 days. Set a
reminder to renew before expiry by repeating the exchange into the same file.
The source rereads that file on each connection attempt. Pairing tokens expire
in five minutes by default; exchange immediately. Tokens must belong to the
server whose URL you configure.

## 9. Configure ntfy

Choose a destination posture:

| Posture       | Use                                                                                   | Credential                                      |
| ------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `open`        | A public topic with no access control; anyone who knows it can publish and subscribe. | None.                                           |
| `reserved`    | A topic reserved to your ntfy account.                                                | `ntfy-token`, allowed to publish to that topic. |
| `self-hosted` | Your server enforces the topic's access control.                                      | `ntfy-token`, allowed to publish to that topic. |

Write the token to `credentials/ntfy.token`, mode 0600, for the latter two.
Set the destination's `server`, `topic`, `posture`, and `credential`. Name a
destination `default` for service escalations. Set `escalations.publicUrl` to
the public proxy base URL. Subscribe from the device that will answer questions.

Check: a test escalation arrives with an answer link or action buttons. The
public proxy must allow both escalation endpoints for phone answers.

## 10. Configure and start

Set every commented value in `service.yml`: repository URL and branch, clone
and store paths, bind address and port, credential paths and App ids, owner and
hook id, environment URL, destination, and public base URL. `{}` sections use
schema defaults.

Run the one start command:

```sh
node /opt/example-service/manifold-service/dist/main.js /srv/example-deployment/service.yml
```

Check the JSON log's `started` event and bound address. On the private service
URL, `GET /console/` serves the console. `start-failed` reports configuration
issues; fix them before continuing.

An optional systemd service runs the same command:

```ini
[Unit]
Description=Manifold service
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/example-deployment
ExecStart=/usr/bin/node /opt/example-service/manifold-service/dist/main.js /srv/example-deployment/service.yml
KillSignal=SIGTERM
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Run it as the operator account that owns the deployment files. Check
`journalctl -u manifold.service` for `started`. Manifold ships no service manager.

### Store retention

The `retention` section of `service.yml` sets how long the store keeps rows
it no longer needs, in days, or `forever`:

- `historyDays`: after an actor ends, its consumed events and its commands.
  Past it, the Actor page shows the actor's summary, end, and timeline of
  state visits, and no sequence.
- `sourceEventDays`: a record of each accepted source event, by event source,
  with `default` for every source not named. Past it, a repeated delivery of
  that event is accepted as new.
- `gateEvaluationDays`: each gate comparator evaluation. Past it, the grant
  cannot be replayed.

The service removes rows past their window about every hour, starting five
minutes after it starts, and logs `retention-pruned` with the counts. A
running actor's history, pending events, held tokens, and open escalations
are always kept. A removed row is not restored when a window grows.

## 11. Push usage from each environment

Install that environment's host CLI binary as in section 5. After each decode
run, push provider session usage:

```sh
manifold-host usage push --service http://127.0.0.1:7480 --environment workstation
```

Use the private service URL chosen in section 6 and the environment's declared
name. The service attributes actuals to the task's thread. Late pushes delay
actuals; repeated pushes converge without counting calls twice.

A push reads the session files of every provider it finds and maps each
session to its thread through the T3 Code server's database. Point each at the
directories this environment's T3 Code server and providers use:

| Source             | Read from                                           |
| ------------------ | --------------------------------------------------- |
| T3 Code thread map | `--t3-home`, else `T3CODE_HOME`, else `~/.t3`       |
| Claude             | `CLAUDE_CONFIG_DIR`, else `~/.claude`               |
| Codex              | `CODEX_HOME`, else `~/.codex`                       |
| Cursor             | `~/.cursor`                                         |
| Grok               | `GROK_HOME`, else `~/.grok`                         |
| OpenCode           | `OPENCODE_DATA_DIR`, else `$XDG_DATA_HOME/opencode` |

A session pushed before its thread is in that database is not attributed to a
task. Run the push with the same homes as the T3 Code server, the first time
too. `--state-dir` keeps what the push has sent, by default
`$XDG_STATE_HOME/manifold-host`; use one per environment on a host that runs
more than one.

An operator-managed systemd timer can run it every ten minutes. Adapt the
binary path, provider user's working directory, URL, and environment name:

```ini
# manifold-usage.service
[Unit]
Description=Push provider usage

[Service]
Type=oneshot
WorkingDirectory=/path/to/task-checkout
ExecStart=/usr/local/bin/manifold-host usage push --service http://127.0.0.1:7480 --environment workstation
```

```ini
# manifold-usage.timer
[Unit]
Description=Push provider usage every ten minutes

[Timer]
OnCalendar=*:0/10
Unit=manifold-usage.service

[Install]
WantedBy=timers.target
```

Run the service as the provider user so it finds that user's session files.
Enable the timer with your service manager. Check its journal for a successful
push and the task's actuals in the console. Manifold installs no scheduler.

## 11a. Register the harness plugin

Register the MCP server `manifold` in each provider used on the environment:

```sh
manifold-host mcp --service http://127.0.0.1:7480 --environment workstation
```

Use [the host CLI MCP specification](../specifications/host-cli-mcp.yml) for each
provider's configuration file and registration snippet. It owns those snippets;
the guide does not duplicate them. Register in the scope that the task's agent
will load. Check that the provider lists `handoff`, `escalate`, and
`get-messages`. Tool calls reach `/api/agent-tools/calls` on the private service
URL.

Register the plugin's hook beside it, so an agent learns of new messages during
its turn:

```sh
manifold-host hook post-tool-use --service http://127.0.0.1:7480 --environment workstation --provider codex
```

Use [the host CLI hook specification](../specifications/host-cli-hook.yml) for
each provider's hook configuration and for the OpenCode plugin file. Codex runs
the hook only after you trust it in Codex. The hook runs as the provider user
and reads T3 Code's data directory, `T3CODE_HOME` or `~/.t3`, so set
`--t3-home` when T3 Code keeps its data elsewhere. Hooks reach
`/api/agent-tools/notices` on the private service URL.

## 12. Check intake

Create a generic test issue in the test repository and add it to the bound
Project. Read the issue's GraphQL node id from GitHub. Find its actor,
`task:<issue-node-id>`, in the console or `GET /api/actors` on the private URL.
Check that its blueprint is `blueprints/task.yml` and its portfolio item matches
intake. Keep that actor id as acceptance evidence; do not record credentials.

The assembled foundation integration test uses fake GitHub, T3 Code, Git HTTP,
and ntfy services to exercise intake and recovery with generic process
declarations. The archive
smoke verifies a standalone service and proxy-facing responses; it does not
claim real GitHub or real T3 Code acceptance. For live acceptance, use the shared
live test environment with the wave orchestrator's coordination, then repeat
this section against its Project and record the actor returned by the API.

## 13. When something is wrong

| Observation                      | Check                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `start-failed`                   | Fix the reported configuration paths; make every credential and hook secret file readable. |
| `pull-failed`                    | Repository URL, branch, network, and App installation access.                              |
| `github-error`                   | App grants, Project owner, hook id, and GitHub availability.                               |
| Hook delivery returns 401 or 404 | Hook secret file, owner and hook declaration, and proxy method/path rule.                  |
| `portfolio-rejected`             | Lint the process declarations and account capacity.                                        |
| `portfolio-warnings`             | Declare each allocated account in `accounts.yml`, or correct its name in `portfolio.yml`.  |
| `blueprint-invalid`              | Lint the local blueprint override; an invalid override still replaces the bundle.          |
| T3 Code connection fails         | Server URL, token file, token expiry, and the two scopes.                                  |
| No notification                  | Destination name, ntfy posture and token, and subscription.                                |

## 14. Stop, restart, upgrade, and rollback

Send SIGTERM to the service process or stop its systemd unit. Check `stopped`
and exit 0. Restart with the command from section 10. Configuration and state
stay on disk.

### Upgrade

Upgrade replaces the entire install; never extract over an install.
`manifold-upgrade.sh`, built beside the archive in `dist/packages/`, does each
directory change. It needs a POSIX `sh` and GNU `tar`, `find`, `sort`, `cmp`,
`diff`, `mv`, `rm`, `rmdir`, and `mkdir`, which a glibc Linux host has from its
base packages. It works in the directory that holds it, whatever your
working directory is.

1. Copy the new archive and the `manifold-upgrade.sh` built with it to the
   service host. Put the script in the install directory, beside
   `manifold-service/`.
2. With the service running, prepare the new install:

   ```sh
   sh /opt/example-service/manifold-upgrade.sh prepare /path/to/manifold-service-<version>-linux-<arch>.tar.gz
   ```

   Check: `manifold-service.next/` holds the new install. If the script reports
   that the archive is already the current install, the upgrade is done; start
   the service if it is stopped. The archive is the current install when every
   path matches in kind, permission bits, link target, and file bytes.

3. Stop the service.
4. Make the new install current:

   ```sh
   sh /opt/example-service/manifold-upgrade.sh swap
   ```

   Check: `manifold-service/` is the new install and
   `manifold-service.previous/` is the install it replaced.

5. Start with the same configuration and check `started`.

The install directory then holds `manifold-service/` and
`manifold-service.previous/`. The previous install stays until the next upgrade
replaces it, so you can roll back to it at any time until then.

### Rollback

Roll back when the new install does not start or does not work:

1. Stop the service.
2. Return to the previous install:

   ```sh
   sh /opt/example-service/manifold-upgrade.sh rollback
   ```

   Check: `manifold-service/` is the previous install and
   `manifold-service.previous/` is absent.

3. Start and check `started`.

If `swap` has not yet replaced the current install, `rollback` changes nothing
and says so; start the service. If there is no previous install, it changes
nothing and says so.

Rollback returns the install only. If the newer install's start moved the store
to a later schema step, the previous install refuses that store: the
`start-failed` message names the schema owner, the store's version, and the
version the install supports. To keep a store you can roll back to, copy the
store file and the `-wal` and `-shm` files beside it while the service is
stopped at upgrade step 3.

### If a command stops

If `prepare`, `swap`, or `rollback` stops before it ends (a closed session, a
killed process, a power cut), run the same command again. To recover an
interrupted upgrade, run it again from `prepare`, or roll it back. Each command
reads which install directories are present, so a command run again, or run
after it completed, ends with one working `manifold-service/` and keeps the
previous install. `manifold-service/`, `manifold-service.previous/`, and
`manifold-service.next/` each hold a whole install or are absent. Only
`manifold-service.staging/` and `manifold-service.discard/` hold partial trees,
and each command removes them first. These commands touch no deployment
configuration or state. The archive smoke stops each command at every rename
and removal, and checks that running it again ends with a service that starts.
