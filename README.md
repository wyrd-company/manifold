# Manifold

Manifold is a process workflow engine for agentic work. A person describes their
process as blueprints, declarative state machines kept in a git repository
separate from Manifold, and Manifold runs them, starting agent threads on T3 Code
at the points that need judgment and keeping a GitHub Project in step with where
every issue is.

## Packages

- `packages/service`: the Manifold service: the engine, the store, the GitHub, T3
  Code, and apprise-api integrations, and the host of the console.
- `packages/host-cli`: the host CLI, a Bun binary installed on each environment.
- `packages/shared`: types, JSON Schemas written in YAML, and utilities that the
  service and the host CLI share.
- `packages/console`: the operator console, the web user interface to the service.

## Development

Install [Task](https://taskfile.dev), pnpm (the version in `packageManager` in
`package.json`), and Node (the version in `.node-version`). Then:

```sh
task install
task check
```

`task check` checks formatting, lints, type-checks, and runs the tests of every
package. CI runs the same command. `task build` builds every package and
compiles the host CLI for the current platform into `packages/host-cli/dist/`.
`task --list` shows the other tasks.
