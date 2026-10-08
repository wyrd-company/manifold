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

Manifold is not meant to work alone. It glues common and useful systems together to make the sum greater than the parts. T3Code server provides an abstraction for coding agent harnesses/providers as well as an interactive chat surface. GitHub provides task storage and another user interface surface. ntfy provides user notification and alerting, and its action buttons let the user answer an escalation from the notification. Webhook handling allows Manifold to listen and react.

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
- **actor host** the service module that creates, restores, and saves state machine actors for the router, and derives each actor's subscription.
- **actor history** what Manifold keeps of what one actor did, for as long as the store keeps it: its state visits, the routed events it received with their payloads, the T3 Code commands it sent, and its end.
- **actual** exact usage recorded for a task actor from provider session data.
- **agent** means the coding agent a user runs inside T3 Code. Depending on context, that may also include you.
- **allocation** a guaranteed percentage of a parent's capacity assigned to a portfolio item.
- **applied configuration** a bound Project's custom fields as Manifold read them at the end of the binding's last Apply, against which a plan tells drift from a change to the declaration.
- **available balance** allocation less usage counted as it arrives, per portfolio item and account.
- **binding** a declaration in the process repository that ties a GitHub Project or a T3code project to a portfolio item.
- **blueprint** a declarative, static schema (YAML) specifying states, transitions, and structure of a state machine.
- **blueprint version** a blueprint as it is at one process repository commit, named by the commit and its path, and for a bundled blueprint also by its bundle.
- **board** a KANBAN board
- **bundle** the blueprints one Manifold build ships, by path, identified by a digest of their texts; a process repository file at the same path replaces a bundled blueprint.
- **call** one model request recorded in a provider session file, with its timestamp, model, and token counts.
- **callback** an imperative actor that runs until its state exits, receiving and sending events.
- **capacity** what an account can spend in a window.
- **card move** Manifold setting the lifecycle field of a task's item on its Project to a declared option, when the task's actor invokes `github-card-move`.
- **ceiling** the most of its parent's limit a portfolio item may use, its allocation and borrowed unallocated remainder together.
- **cell** the JSONata expression at one rule and one column of a decision table.
- **child state machine** a blueprint invoked or spawned by another state machine actor, for work the parent owns.
- **client** means the web, desktop, or mobile UI for T3Code.
- **comparator** the user's function that picks which task in a gate's population proceeds next.
- **created project** a T3code project that a task actor created with `t3code-project-create`, recorded in Manifold's store with the creating actor and its portfolio item, so usage of a thread in it that no actor owns is attributed to that item unless a binding names the project.
- **console** the web user interface to Manifold
- **credit** a ledger entry that adds to an account's capacity for a window.
- **deadline** a time at which an actor in a state receives an event.
- **deadline loop** the router's one timer that fires due deadlines into their actors' inboxes and re-arms at the earliest unfired deadline.
- **decision model** a GoRules JDM graph in the process repository whose tables, expressions, and switches are JSONata, evaluated by the Zen engine.
- **draft** the edited text of one process repository file in the console, with the commit it is based on, kept in the browser until it is saved or discarded.
- **drift** a change to a bound Project's owned configuration made on GitHub since Manifold last applied it, which the declaration in force does not hold.
- **environment** means one running T3 server and the machine, filesystem, provider credentials, and state it owns.
- **epic** the issues under one root task: its sub-issue tree on GitHub, the issues outside the tree its dependencies name, and the dependencies among them.
- **escalation** a question put to a person, with up to three choices or a free-text answer, by a blueprint state or by the service, closed by the first answer.
- **estimate** a task's expected usage, produced by the user's process, in the account's native unit.
- **event match** a JSONata expression over an event that decides whether a transition takes it.
- **event source** a shared origin of events that Manifold routes to actors.
- **gate** an implementation on a blueprint state that decides which waiting tasks may leave it.
- **GitHub mirror** the last state the GitHub event source read of each entity it follows, against which it compares current GitHub state.
- **harness plugin** the MCP server the host CLI serves to each provider T3 Code runs, giving the agent the tools to hand off and escalate.
- **hold** an operator's pause or disconnect of one T3 Code environment, kept in Manifold's store under the environment's name until the matching resume or reconnect. A pause holds the thread and turn commands actors invoke; a disconnect closes Manifold's connection and holds every command to the environment.
- **holder** a task actor holding a token from a gate.
- **implementation** a named piece of code a blueprint binds: actor logic, an action, a guard, or a delay.
- **inbox** the per-actor store of routed events, each pending until the actor consumes it and kept after.
- **intake** the decision that gives a newly discovered task its blueprint and portfolio item.
- **invocation** the identity of an invoked implementation: its actor id, its invoke id, and the entry id of the state entry that invoked it.
- **issue** a way to track tasks related to a repository on GitHub
- **late attribution** the actor, portfolio item, and state visit a call is counted for when the thread of its provider session, or the actor that owns that thread, reaches the service after the call posted; the ledger keeps the call's actual where it posted.
- **lifecycle field** the single-select field of a bound Project that shows where each task is, declared with its option names in the process repository's task metadata declaration.
- **mapping** a JSONata expression at a schema boundary: a child's input, a final state's output, a migration path's context, or an event payload assigned into context.
- **message** text a task sends to one thread, which reaches the thread's agent only once an actor that follows the thread takes it as an event, and which the agent reads once with `get-messages`.
- **migration** moving a running actor that waits on events from its blueprint version to a later version at the same path, in one save that keeps its state, identity, threads, token, reservation, inbox, and the deadlines the later version still declares.
- **migration path** an entry of a blueprint's `migrations`: a JSON Schema an earlier version's context satisfies and a mapping from that context to the blueprint's own context.
- **notification destination** a name the process repository uses for where an escalation is sent, mapped in service configuration to an ntfy server, topic, security posture, and credential.
- **pacing** a limit that spreads a portfolio item's allocation across a window, plus a burst, and restarts at each reset.
- **parent** a task with subtasks
- **pass** one turn of an agent thread that a state machine actor follows, from the command or escalation answer that started it to the reply that closed it: the agent's handoff, or the turn settling without one.
- **population** the task actors in a gated state that hold no token from its gate.
- **portfolio item** a user-declared node in the portfolio tree that budget is allocated to and usage is attributed to.
- **project** an adaptable table, board, and roadmap that integrates with your issues and pull requests on GitHub to help you plan and track your work
- **project configuration plan** the ordered changes an Apply would make to bring a bound Project's custom fields to the task metadata declaration.
- **promise** an invoked implementation actor that finishes once, with an output or an error.
- **provider** means the agent runtime or harness T3 Code talks to, such as Codex, Claude, Cursor, Grok, or OpenCode.
- **redelivery** a webhook delivery GitHub sends again with its original GUID when the source asks for a failed delivery.
- **reset** the instant at which an account's capacity starts again, closing one window and opening the next.
- **reservation** an estimate held against a portfolio item's available balance from a task's release until settlement.
- **retention window** how long Manifold's store keeps one kind of row it no longer needs, in whole days or `forever`, after which the service removes it: an ended actor's consumed events and history, a source event's record, or a gate's comparator evaluation.
- **revision** the process repository's declared files at one commit, read-only.
- **router** delivers an event from a source to the actors whose identity matches its topic.
- **service** the running Manifold service
- **session** the entire end-to-end conversation or workflow containing multiple agent turns
- **settle** when no more activity is occuring on a thread
- **settlement** retiring a reservation and posting the actual when a task actor ends.
- **snapshot** the persisted state of an actor: its state value and context.
- **state entry** one entry of an actor into a state, named by an entry id that a replay reproduces and a re-entry changes.
- **state machine** a declarative stateful actor, built from a blueprint.
- **state machine actor** an actor running a blueprint.
- **state visit** one run of a state machine actor's saves with the same state value and blueprint version, from the save that entered it until the next save with another value or version.
- **stop stage** one of the ordered points at which the service's stop closes what wiring parts registered, the latest registered first within a stage.
- **subscription** (events) the topics an actor hears and the event types it takes, derived from its snapshot and its blueprint.
- **T3code project** means an environment-local workspace record rooted at a directory.
- **sweep** a periodic comparison of bound GitHub Projects and tracked issue relationships with the GitHub mirror.
- **task** a specific piece of work that needs to be completed, documented as an issue and executed as an actor
- **task field** a field of a bound Project's tasks that the task metadata declaration declares, whose configuration Manifold owns on the Project.
- **thread** means the durable conversation and work history for a T3code project.
- **thread change** a difference between two thread states, or the removal of a thread, that the T3 Code environment source publishes as one event whose id is drawn from the change itself, such as a turn id or a request id.
- **thread state** what the T3 Code environment source keeps of a thread to decide its changes: the thread's latest turn and its state, its open approval and user-input requests, and its session's status.
- **token** what a gate grants a task actor so it may leave the gated state.
- **topic** a path of segments joined by `.` that names where an event comes from, whose first segment is its event source.
- **tracked issue** an issue that is the content of a present item on a bound GitHub Project.
- **trap** a configuration of a task actor holding a gate's token from which no run that keeps the token reaches the gate's return point.
- **turn** a single, complete cycle of work executed by an agent in response to a user prompt
- **unallocated remainder** the part of a parent's limit that no child's allocation guarantees, which its children borrow up to their ceiling.
- **unowned usage** the posted calls attributed to a thread that no actor owns, or to a provider session whose thread the service does not know.
- **usage move** an operator's re-attribution of a posted call from unowned usage to a portfolio item or an actor, which the ledger carries to the new item in the window the call spent, keeping its account and amount.
- **usage unit** a session, subagent, or child thread whose calls one provider session file records.
- **variance** actual less estimate for one task.
- **webhook delivery** one signed HTTP request from a GitHub webhook, identified by its GUID across hooks and redeliveries.
- **weight** a portfolio item's share of the unallocated remainder among its siblings with waiting work.
- **window** the period from one reset of an account's capacity to the next.
- **wiring part** the code in a module's directory that opens the module inside the service from the members of the parts listed before it, mounts its endpoints, and registers what stop closes; the service's start list names it once.
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
