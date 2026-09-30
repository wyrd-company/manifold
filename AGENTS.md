# Working in this repository

Manifold is a process workflow engine for agentic work. A person describes their process as blueprints, declarative state machines in a git repository of their own, and Manifold runs them. It starts agent threads on T3 Code at the points that need judgment, gives those agents tools to hand off, escalate, and read messages, and keeps a GitHub Project in step with where every issue is. The engine does the mechanical work. Agents do the judgment work. No agent orchestrates.

Manifold requires GitHub Projects and T3 Code. Everything else about how a user works is theirs to decide in blueprints.

## What makes Manifold special?

Manifold allows a developer to manage several things at once using their own workflow.

### 1. Process is configuration, not (only) code.

Runtime configuration is the heart of Manifold. Processes are not static, unchanging, things. They evolve, react, learn. Manifold does not get in the way of that process. The user's processes are configured and stored in git-backed file storage, in human, and agent, friendly YAML. A user interface enhances the editing, monitoring, and understanding experience.

### 2. Built for solo devs to small teams to work with agents

Managing multiple agent sessions, following a process, and doing so across multiple projects while staying aware of usage budgets is what distinguishes Manifold from typical tools.

### 3. Manifold is the glue

Manifold is not meant to work alone. It glues common and useful systems together to make the sum greater than the parts. T3Code server provides an abstraction for coding agent harnesses/providers as well as an interactive chat surface. GitHub provides task storage and another user interface surface. Apprise, through apprise-api, provides user notification and alerting. Webhook handling allows Manifold to listen and react.

### 4. We never lose our place

Nothing important lives solely in memory. State is stored on disk, and a service interruption and resume picks up where it left off.

### 5. Throwing tokens at orchestration is the easy answer, we choose the right one.

At its heart Manifold is built on the philosophy that where an agent isn't needed, it shouldn't be used. Most processes are mechanical, but agents and humans are tied in to apply reasoning when needed. We enable creating workflows that aren't simplistic brute force solutions.

## Principles

- **Software should be simple, intuitive, and elegant.** Good code adds no more, or less, complexity than it needs, is right where you would expect to find it in the repo, just clicks when you read it, and makes you appreciate the beauty of the right solution to the right problem. Simplifying the complex, while retaining the intent, is a dopamine hit.
- **Ambition isn't a risk, it is a necessity.** The obvious answers and solutions are plentiful. The ones that change the way you work or think are the ones that stand apart. This requires pushing past what is "normal" and common and trying bold things and finding what works.
- **Follow every rule. Every rule was made to be broken.** Every document and the repo documentation is meant to guide and provide clarity. But software _wants_ to change as users and developers learn more about the problem they are trying to solve. Draw within the lines is the default posture, but helping identify when the lines are wrong and collaborating loudly with the users to draw the new lines is when you are helping the most.
- **Evolution is inevitable.** Any process must be able to learn and evolve. If every change requires a new build, a new release, and a new install, then evolution is held back. The friction to try new things is too hard. Build a system that can evolve naturally with as little friction as possible.
- **The environment changes too.** Manifold must assume it will have to take on new dependency versions, adopt new techniques. The agentic development world is moving fast and faster. Agility is no longer an option, it is a requirement. Manifold must assume dependent services will update without a Manifold release. We accept sometimes that means an upgrade of T3Code or a coding agent harness will cause issues. Rollback, update Manifold, and redeploy is the answer, but we have to allow the upgrades to happen for all the times it will not break anything.
- **Align with existing terms when possible.** As we adopt/integrate with 3rd party systems, libraries, or services, adopt their terms whenever possible, and only invent new terms related to them when that creates clarity.
- **The product is the experience.** Every technical decision either helps or hurts it. When implementation convenience conflicts with user delight, choose delight.

## Core constraints

- **A blueprint is the only source of a state machine.** Manifold's defaults ship as blueprints it bundles. Code implements what states invoke and never defines a machine.
- **Manifold must work with stable released T3Code server, no forks.** We rely on no upstream change being merged. It doesn't mean we won't try, but until it is shipped Manifold does not assume any desired change exists.
- **Operator interactions, in or out of Manifold, are events that actors subscribe to.**
- **Everything lives in one of three places.** The user's process repository holds what the user declares: blueprints, schemas, templates, decision models, portfolio, and bindings by name. Save is commit and push. Manifold's store holds what Manifold observes and remembers: actor state, event queues, ledgers, usage, ephemeral credentials. Service configuration holds what is host-local: where the process repository is and the credentials behind each name the repository uses. Nothing important lives only in memory.
- **YAML is the configuration and format.** JSON Schema, written in YAML, describes
  every declared shape.
- **Typescript on Node, ESM**
- **CLIs are Bun binaries.** Built using `--compile` targeting Linux x64/arm64, macOS arm, and Windows x64

## A small glossary

We need to be on the same page with terminology. When communicating, use this language:

- **account** a user profile that provides access to an artificial intelligence platform, tracks usage limits or subscription billing such as Anthropic, Cursor, GitHub, OpenAI, Opencode, OpenRouter, Command Code, X-AI, etc.
- **actor** a state machine, promise, callback, observer, or transition instance.
- **actual** exact usage posted from provider session data.
- **agent** means the coding agent a user runs inside T3 Code. Depending on context, that may also include you.
- **allocation** a percentage of a parent's capacity guaranteed to a portfolio item, with an optional ceiling. Guarantees under one parent total at most 100% at every level and need not total 100%; the remainder is unallocated and an item may borrow from it up to its ceiling, never from a sibling.
- **available balance** allocation less usage counted as it arrives, per portfolio item and account. A reservation holds its full amount until that actor's posted usage consumes it.
- **binding** a declaration in the process repository that ties a GitHub Project or a T3code project to Manifold by name: its environment and the portfolio item it attaches to.
- **blueprint** a declarative, static schema (YAML) specifying states, transitions, and structure of a state machine.
- **board** a KANBAN board
- **callback** an imperative actor that runs until its state exits, receiving and sending events.
- **capacity** what an account can spend in a window, in the account's native unit, observed from usage for subscriptions.
- **client** means the web, desktop, or mobile UI for T3Code.
- **comparator** a pure TypeScript function in the process repository, run in a sandbox by a gate, that picks the next task from the population, with optional reservations, or none.
- **console** the web user interface to Manifold
- **environment** means one running T3 server and the machine, filesystem, provider credentials, and state it owns.
- **estimate** a task's expected usage, produced by the user's process.
- **gate** a Manifold implementation declared on a blueprint state that runs the comparator over the tasks waiting there and hands out one token at a time.
- **intake** the decision model Manifold evaluates once when an issue is discovered, yielding the blueprint its actor runs and the portfolio item the task belongs to.
- **issue** a way to track tasks related to a repository on GitHub
- **parent** a task with subtasks
- **portfolio item** a distinct item that is assigned a percentage of account usage budget
- **project** an adaptable table, board, and roadmap that integrates with your issues and pull requests on GitHub to help you plan and track your work
- **promise** an invoked implementation actor that finishes once, with an output or an error.
- **provider** means the agent runtime or harness T3 Code talks to, such as Codex, Claude, Cursor, Grok, or OpenCode.
- **reservation** an estimate held against a portfolio item's available balance from a task's release until settlement.
- **service** the running Manifold service
- **session** the entire end-to-end conversation or workflow containing multiple agent turns
- **settle** when no more activity is occuring on a thread
- **settlement** retiring a reservation and posting the actual when a task actor ends.
- **state machine** a declarative stateful actor, built from a blueprint.
- **task** a specific piece of work that needs to be completed, documented as an issue and executed as an actor
- **thread** means the durable conversation and work history for a T3code project.
- **token** the event a gate hands to one task actor that lets it take the guarded transition out of the gated state; it is held until returned where the blueprint declares.
- **turn** a single, complete cycle of work executed by an agent in response to a user prompt
- **T3code project** means an environment-local workspace record rooted at a directory.
- **variance** actual less estimate.
- **you** means the agent reading this file and changing Manifold Code.

## Thar be dragons

<!-- this will include manifold specific footguns, but only those that can't be prevented in another way. This section should remain small, every entry must earn its keep and be approved by a user. -->

- **Killing by pattern.** Never pkill -f, pgrep | kill, or kill a PID you found by matching a name, path, or worktree string. Your own agent process has this worktree's path in its argv, and this machine runs several other dev servers at once. Kill only a PID you captured at spawn, or the owner of your port from ss -H -ltnp after confirming /proc/<pid>/cwd is your worktree.

## How it works

<!-- tbd. A five sentence max paragraph that describes how Manifold works. Update as implementation lands. -->

## Where code lives

- `packages/service` the Manifold service: engine, store, integrations, and the host of the console.
- `packages/host-cli` the host CLI, a Bun binary installed on each environment.
- `packages/shared` types, schemas, and utilities the service and host CLI share.
- `packages/console` the operator console. No framework chosen yet.

## Where the design lives

- `docs/` contains documentation for Manifold
- `DESIGN.md` at the repository root is the visual design of the operator
  console. It stays at the root, where design tools look for it, and holds
  how screens look, never what Manifold does.

## Miscellany

- Inferred types over annotations. `any` is the enemy.
- Security is important, but should not be over-indexed on, especially before version 1.0.0.
- Do not commit implementation plans, research notes, or agent scratch files. Keep temporary working material outside the worktree.
- Most code changes do not need an internal documentation change. Agents can read the code.
- Verify using the smallest proof that the change works. Run the tests you touched, targeted lint and typecheck for the scope you changed. `task check` is what CI runs and CI owns the full suite.
- An empty database is a bad test.
- Design **deep modules**: a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface.
- Place validation, type narrowing, and error handling at system boundaries. Trust internal code unconditionally. Business logic lives in pure functions; the shell is thin and mechanical.
- Explore alternative interfaces: spin up parallel sub-agents to design the interface several radically different ways, then compare on depth, locality, and seam placement.
- Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.
- Red before green. Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- Data structures first. Get the data shape right before writing logic. The right shape makes downstream code obvious. Define core types early, trace every access pattern, and choose structures that match the dominant paths.
- Scaffold first. If something helps every later phase, do it first. Ask "does every subsequent phase benefit from this existing?" CI, linting, test infrastructure, and shared types are scaffold.
- Design operations so they converge to the correct state regardless of how many times they run or where they start from. Every state-mutating operation should answer: "What happens if this runs twice? What happens if the previous run crashed halfway?"
- Maintainability is the work a reader must do to understand code. Track two axes: **Layers to trace.** How many indirections sit between the question and the answer. **State to hold.** How much hidden or mutable context the reader must keep in their head.
