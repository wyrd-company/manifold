---
relationships:
  implements: live-github-environment
---

# Live GitHub test environment

This tooling runs the assembled service against GitHub in the `mmenm` test
organization. It is separate from application code. One environment exists per
organization at a time. Two machines adopt the same marked resources; replacing
a lost hook secret on one invalidates the other's secret.

Use Linux, Node 24, pnpm, Task, and OpenSSH. Install dependencies with `task install`.
The GitHub App installation must reach both private test repositories. The PAT
needs `repo`, `project`, and `admin:org_hook`; teardown also needs `delete_repo`
(or equivalent fine-grained permissions). The tooling reports missing access and
does not change access grants.

Credentials stay in these files:

| File                    | Used by                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `~/gh_manifold_pat`     | Provision, hook configuration, smoke, teardown                |
| `~/pinggy_access_token` | OpenSSH tunnel configuration                                  |
| `~/manifold-app.env`    | Numeric `APP_ID` and `INSTALLATION_ID`; `CLIENT_ID` is unused |
| `~/manifold-app.pem`    | App preflight and service installation tokens                 |

Override paths with `PAT_FILE`, `PINGGY_TOKEN_FILE`, `APP_ENV_FILE`, and
`APP_PRIVATE_KEY_FILE`. Never put credential values in command arguments or
configuration overlays. Scripts read them at run time and report no values.

| Target                                                   | Operation                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `task live:provision`                                    | Converge repositories, seed issues, Project, inactive hook, content, and configuration                                                    |
| `task live:provision CONTENT=/path/to/content`           | Use other process content; point all GitHub Project bindings at the test Project                                                          |
| `task live:start`                                        | Build and run service plus restricted tunnel in the foreground                                                                            |
| `task live:start ANSWERS=1 OVERLAY=/path/to/overlay.yml` | Also pass escalation answers; merge extra service sections                                                                                |
| `task live:start SERVICE_PORT=<port>`                    | Listen on that loopback port on every start, so clients keep one service URL                                                              |
| `task live:smoke`                                        | Verify delivery, intake, sweep, tunnel paths, and credential scan                                                                         |
| `task live:project-config`                               | Apply to a fresh Project, rename an option with the PAT, observe drift, revert, and probe duplicate field names; delete the fresh Project |
| `task live:stop`                                         | Ask the supervisor to stop; recover recorded children after supervisor failure                                                            |
| `task live:teardown`                                     | Remove marked resources; refuse while a supervisor answers                                                                                |

To check an extracted service archive, set `SERVICE_ENTRY=/path/to/manifold-service/dist/main.js`
when starting the supervisor directly with `node testing/live-github/src/start.ts`.
It starts that entry with one configuration argument and keeps the same tunnel,
child cleanup, and smoke checks.

Run start in one terminal and smoke in another. Run teardown after stop: it
removes the marked hook and Project, and deletes the marked repositories with
the PAT's repository deletion permission; a second run reports each resource
absent. Stop may report shutdown pending;
leave the supervisor to finish and run stop again. It owns child cleanup while
its control socket is held.

The state directory is `$XDG_STATE_HOME/manifold-live-github`, or
`~/.local/state/manifold-live-github`. It is outside the worktree, mode `0700`;
files use `0600`. A state path that resolves inside the worktree is refused. `resources.json` records ids, `hook.secret` holds the generated
hook secret, and `hook.secret.pending` permits recovery across a hook-secret
update. `service.yml` uses only App credentials, `service/` holds the clone,
database, and service log, and `tunnel/` holds transient OpenSSH configuration,
known hosts, and log. `children.json` records process ids and Linux start times;
`control.sock` identifies the supervisor. Smoke reports stay in `smoke/` after
teardown. Provision and teardown can resume after a partial run. Unmarked
resources are foreign and remain untouched.

The hook URL is set in GitHub at every start and tunnel reconnect:
`<tunnel URL>/webhooks/github?owner-marker=<marker>`. The marker is stripped
before forwarding. There is no new service public URL setting. With `ANSWERS=1`,
the tunnel base URL reaches the service as `escalations.publicUrl`, so ntfy links
and answer buttons reach that tunnel. Generated process repository, store,
loopback HTTP, GitHub source, and App credential sections win over an overlay.

The forwarder passes only `POST /webhooks/github`. With answers enabled, it also
passes `GET /escalations/{id}` including its key query and
`POST /escalations/{id}/answer`, for a 22-character URL-safe id. All other paths
and methods are refused with `404` and `x-live-forwarder: refused`, including the
API, console, extra segments, encoded paths, and escalation lists. The service
listens on loopback, on an ephemeral port unless `SERVICE_PORT` names one.
Forwarder logs omit query strings.

`task check` runs the tooling tests against a recorded stateful GitHub fake and
local HTTP servers and child programs, with no credentials or GitHub calls.
Live smoke is separate. It leaves its sample issues for teardown, checks a signed
Project delivery in GitHub and the service database, then checks intake through
the API. It disables the hook for a second item so the sweep must discover it,
and restores the hook on every outcome. Its credential scan checks generated
files, the smoke log, and tracked or unignored worktree files, including encoded
credential forms. The hook secret and OpenSSH configuration are credential files
and are excluded. Scan failures name only the file and credential name.
