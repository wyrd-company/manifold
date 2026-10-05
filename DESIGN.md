---
name: Manifold
description: >-
  Operator dashboard for Manifold. It uses the visual language of T3 Code so that
  a T3 Code user reads it without learning a new vocabulary.
source: T3 Code web client (apps/web/src/index.css, components/ui)
relationships:
  # GAP-EDGE: no ontology type covers a visual design document; `related-to`
  # names the technical design that builds the console from it.
  related-to:
    - operator-console
colors:
  light:
    background: "#fcfcfc"
    sidebar: "#fafafa"
    card: "#ffffff"
    popover: "#ffffff"
    accent: "#f4f4f5"
    border: "#e4e4e7"
    input: "#d4d4d8"
    foreground: "#27272a"
    muted-foreground: "#71717a"
    icon-muted: "#8b8b93"
    primary: "#1b4ed8"
    primary-foreground: "#ffffff"
    link: "#1b4ed8"
    success: "#10b981"
    success-foreground: "#047857"
    warning: "#f59e0b"
    warning-foreground: "#b45309"
    error: "#ef4444"
    error-foreground: "#b91c1c"
    info: "#3b82f6"
    info-foreground: "#1d4ed8"
    lane: "#f4f4f5"
    tile: "#ffffff"
    edge: "#a1a1aa"
    grid: "#e9e9ec"
  dark:
    background: "#0a0a0a"
    sidebar: "#111111"
    card: "#111111"
    popover: "#141414"
    accent: "#1c1c1c"
    border: "#1f1f1f"
    input: "#2a2a2a"
    foreground: "#f5f5f5"
    muted-foreground: "#8a8a8a"
    icon-muted: "#7a7a7a"
    primary: "#346bf1"
    primary-foreground: "#ffffff"
    link: "#7ea2ff"
    success: "#10b981"
    success-foreground: "#34d399"
    warning: "#f59e0b"
    warning-foreground: "#fbbf24"
    error: "#ef4444"
    error-foreground: "#f87171"
    info: "#3b82f6"
    info-foreground: "#60a5fa"
    lane: "#0e0e0e"
    tile: "#141414"
    edge: "#3f3f46"
    grid: "#1a1a1a"
typography:
  font-sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
  font-mono: 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace'
  page-title: { fontSize: 18px, fontWeight: 600, letterSpacing: -0.01em }
  dialog-title: { fontSize: 16px, fontWeight: 600 }
  body: { fontSize: 14px, fontWeight: 400 }
  control: { fontSize: 14px, fontWeight: 500 }
  secondary: { fontSize: 13px, fontWeight: 400 }
  label: { fontSize: 12px, fontWeight: 500 }
  badge: { fontSize: 11px, fontWeight: 500 }
  mono: { fontFamily: "{typography.font-mono}", fontSize: 12.5px }
rounded:
  sm: 6px
  control: 8px
  lg: 10px
  dialog: 14px
  full: 9999px
spacing:
  unit: 4px
  header-height: 52px
  sidebar-width: 256px
  sidebar-rail-width: 48px
  nav-row-height: 32px
  control-height: 32px
  control-height-sm: 28px
  table-head-height: 40px
  table-row-height: 52px
  page-padding: 28px 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    height: "{spacing.control-height}"
    rounded: "{rounded.control}"
  button-outline:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.input}"
    textColor: "{colors.foreground}"
    height: "{spacing.control-height}"
    rounded: "{rounded.control}"
  button-ghost:
    backgroundColor: transparent
    hoverBackgroundColor: "{colors.accent}"
    iconColor: "{colors.icon-muted}"
  button-destructive-outline:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.input}"
    textColor: "{colors.error-foreground}"
  badge:
    height: 18px
    rounded: "{rounded.sm}"
    typography: "{typography.badge}"
  status-dot:
    size: 8px
    rounded: "{rounded.full}"
  table:
    container: "{colors.card} with 1px {colors.border}, {rounded.lg}"
    headRowBackground: "{colors.sidebar}"
    headTypography: "{typography.label}"
  dialog:
    backgroundColor: "{colors.popover}"
    rounded: "{rounded.dialog}"
    width: 440px
  lane:
    backgroundColor: "{colors.lane}"
    width: 264px
    rounded: "{rounded.lg}"
  task-node:
    backgroundColor: "{colors.tile}"
    borderColor: "{colors.border}"
    rounded: "{rounded.control}"
    width: 152px
    height: 84px
  graph-edge:
    strokeColor: "{colors.edge}"
    strokeWidth: 1.5px
    criticalStrokeColor: "{colors.primary}"
    criticalStrokeWidth: 2px
  task-card:
    backgroundColor: "{colors.tile}"
    borderColor: "{colors.border}"
    rounded: "{rounded.control}"
    padding: 10px 12px
---

# Manifold design

## Overview

Manifold is an operator console for work that runs on T3 Code. The design uses
T3 Code's own tokens, primitives, and density, so that a T3 Code user sees the
same surfaces, controls, and status language in both products.

The look is quiet and compact. Neutral surfaces carry the content. Color
appears only for the primary action and for state (connected, paused, failed).
There is no decoration: no gradients, no illustration, no brand color in
backgrounds.

Manifold supports light and dark themes and follows the system setting by
default, as T3 Code does.

This document holds the visual design. What each screen shows and what
Manifold does is in the Manifold specification; this document says how it looks.

## Colors

The token names are T3 Code's semantic names. The hex values in the front
matter are the resolved values of T3 Code's defaults. The source of truth is
T3 Code's `index.css`; when T3 Code changes a default, change it here.

- **Neutrals.** Light theme uses the zinc scale on a near-white background.
  Dark theme uses near-black neutrals, with surfaces made by mixing a small
  percentage of white into the background.
- **Primary.** One blue (`oklch(0.488 0.217 264)` light,
  `oklch(0.571 0.21 264)` dark). Use it for the one main action in a view and
  for focus rings. Do not use it for status.
- **Status.** Success is emerald, warning is amber, error is red, info is
  blue. A status fill (dot, solid badge) uses the base color. Status text uses
  the `-foreground` variant, so that text keeps a 4.5:1 contrast.
- **Code.** In code editors, paths and names use `link` color, strings use
  `success-foreground`, `true`, `false`, and `null` use
  `warning-foreground`, and operators, punctuation, and comments use
  `muted-foreground`.
- **Tinted surfaces.** Badges and alerts use the status color at 8% (light) or
  16% (dark) opacity behind `-foreground` text.

## Typography

Manifold uses the system sans stack, the same as T3 Code. There is no web font.
Use the mono stack for values that an operator copies or compares: host names,
URLs, thread and actor IDs, commit SHAs.

Use numbers with `font-variant-numeric: tabular-nums` in tables and counters,
and align them to the right.

The type scale is small. A page title is 18px. Most text is 13–14px. Column
heads and captions are 12px in `muted-foreground`.

## Layout

The application frame has three regions:

1. **Header.** Full width, 52px, above the sidebar and the content. From left
   to right: sidebar toggle, Manifold mark and name, breadcrumb, flexible
   space, command search (⌘K), theme toggle. A bottom border separates it
   from the content.
2. **Sidebar.** 256px wide when expanded, a 48px icon rail when collapsed.
   The header toggle changes the mode. In the rail, each item shows only its
   icon and has an `aria-label`. Group labels become 1px dividers. The width
   change animates for 160ms with `cubic-bezier(0.4, 0, 0.2, 1)`.
3. **Content.** Fills the remaining space and scrolls by itself. Padding is
   28px top and bottom, 32px left and right. A page starts with a title row:
   title and one-line description on the left, the primary action on the
   right.

Spacing is on a 4px grid. Stacks use `gap`, not margins.

## Elevation and depth

Surfaces are separated by 1px borders, not shadows. Only these elements have a
shadow:

- The primary button: a 1px white inset highlight at 16% and a 1px drop
  shadow.
- The selected sidebar item in light theme: a 1px border ring and a 2px
  shadow, so that white-on-near-white stays visible.
- Dialogs and popovers: a large soft shadow over a scrim (black at 60% dark,
  32% light).

## Shapes

- 6px: badges, keyboard hints.
- 8px: buttons, inputs, sidebar items (T3 Code's `--control-radius`).
- 10px: cards and table containers (T3 Code's `--radius`).
- 14px: dialogs.
- Status dots are circles.

## Components

### Buttons

Heights are 32px for page actions and 28px inside table rows. Text is 14px
(13px in rows), weight 500. An icon sits before the label at 14–16px.

- **Primary**: the one main action in a view ("Add environment").
- **Outline**: row actions and secondary actions ("Pause", "Disconnect",
  "Cancel").
- **Ghost**: icon-only controls in the header and dialog title. Each has an
  `aria-label`.
- **Destructive outline**: actions that remove data ("Forget"). The label is
  error-colored; the fill stays neutral so that a list of rows does not become
  a wall of red.

Pressed buttons scale to 0.97. Disabled buttons use 64% opacity. On touch
pointers every control has a hit area of at least 44×44px, as in T3 Code.

### Status

A connection status is an 8px dot plus a text label. Never use the color
alone.

| State        | Dot              | Label color      |
| ------------ | ---------------- | ---------------- |
| Connected    | success          | foreground       |
| Reconnecting | warning, pinging | foreground       |
| Disconnected | muted, 40%       | muted-foreground |
| Error        | error            | error-foreground |

A condition that is independent of the connection, such as "Paused", is a
warning badge after the label.

### Tables

A table sits in a card with a 1px border and 10px radius. The head row is 40px
on the sidebar color, with 12px, weight 500, muted labels. Body rows are 52px
with a 1px border between them and no border after the last row. Cells have
16px horizontal padding. Row actions are right-aligned. A caption under the
table gives totals in 12px muted text.

When a table has no rows, show an empty state in its place: a dashed border,
an icon, a one-line title, and a one-line explanation.

### Dialogs

440px wide, 14px radius. The title row has the title, a one-line description,
and a ghost close button. Fields stack with 16px between them; each has a
visible `<label>`. The footer has a top border, a tinted background, and the
buttons right-aligned: secondary first, primary last.

### Icons

Use Lucide icons (T3 Code uses `lucide-react`), 16px in navigation and
headers, 14px in row buttons, stroke width 2, color `icon-muted` unless the
item is selected.

## Screens

### Sidebar

- No label: Overview, Board, Epics, Actors.
- **Plan**: Portfolio.
- **Configure**: Blueprints, GitHub Projects, Environments.

Settings is at the bottom of the sidebar; Task fields is a Settings section.
Overview is the default screen.

These are not in the sidebar. The operator opens them from another screen, and
the header breadcrumb shows the path:

- Task page: from a Board card or an Epics node.
- Actor detail: from Actors.
- Blueprint editor: from Blueprints.
- A Project's configuration and Apply: from GitHub Projects.
- T3code project edit: from GitHub Projects.
- Task fields: from Settings, with quick links on Blueprints and GitHub
  Projects.
- Portfolio item edit: from Portfolio.

Manifold uses T3 Code's words. A T3 Code server is an **environment**, and a
T3 Code workspace folder is a **T3code project**. A bare "Project" is a GitHub
Project, and the GitHub screen is "GitHub Projects".

### Overview

The shell reference screen. From top to bottom:

- Title row: "Overview" and a one-line description. No primary action.
- Four stat tiles: active actors, items that need attention, the budget source
  account closest to its limit (with a meter and the account count), and
  environments connected.
- Active actors table: task title with reference and blueprint, portfolio item,
  current state with the actor's status, elapsed time, and a link to the
  thread.
- Needs attention list: escalations, failed actors, and paused environments.
  Each item has an icon, a title, one line of detail, and one link.
- API budget this month: one meter per portfolio item. At 85% or more the
  fill changes to warning and a "Near limit" badge appears.

### Board

Tasks in lanes, one per lifecycle state declared in the task fields. The
current state of a task's actor shows on its card.

- Title row: "Board" and a one-line description. No primary action.
- Filters in one row: Project, when more than one GitHub Project is bound,
  then Portfolio item, Root task, and "Clear filters" when a filter is set.
  The board shows one Project at a time, since each Project declares its
  own lanes. The task count and a ghost "Refresh" button are
  right-aligned in the same row.
- Lanes are 264px wide with a 40px header (name and count badge). The board
  scrolls horizontally; each lane scrolls vertically.
- Cards are ordered by priority, highest first. An empty lane shows
  "No tasks" in a dashed box.
- A task whose lifecycle state is not set, or is not a declared state, is
  in a "No status" lane before the declared lanes. The lane shows only
  while it holds a task. A Project that declares no lifecycle field shows
  every task there, under an info alert that says so.
- A card opens the Task page.
- Each lane can collapse to a 44px strip that shows an expand icon, the count,
  and the lane name set vertically. The lane header has a ghost collapse
  button. Lanes start expanded. Each operator's collapsed lanes are kept
  between visits.
- A card's drop targets are the state changes its actor currently accepts,
  so they differ per card. While a card is dragged, each target lane gets a
  dashed primary border and a "Drop to move to <state>" label, and the
  other lanes fade to 50%. A card with no accepted move does not drag. The
  same moves are in the card's context menu as "Move to <state>". The
  example screens show a Backlog card whose actor accepts one move, to Ready.

A task card has, from top to bottom:

1. Priority badge (P0 and P1 on the accent surface in foreground text, lower
   priorities muted), the task reference in mono, and "done" time with a check
   in the Done lane.
2. Title, 13px weight 500, at most two lines.
3. Portfolio item and root task, 12px muted.
4. Actor row, when the task has an actor: status dot, current state in
   mono, actor status, and an "Escalated" (warning) or "Failed" (error)
   badge. A task that has no actor yet shows "Waiting for intake" in muted
   text in its place.

### Epics

A dependency graph of the tasks under one root task. It reads left to right:
a task sits to the right of every task it waits on. "Waits on" is GitHub's
issue dependency ("blocked by"); Manifold keeps no dependency data of its own.

- Title row: "Epics" and a one-line description.
- Toolbar: a Root task select, a summary (tasks, done, open), and two
  switches on the right: "Critical path" and "Fade completed". Both are on by
  default.
- The graph sits in a card on a dotted grid, with zoom controls at the bottom
  left and a legend at the bottom right. Under the graph is a 56px selection
  bar.

A task node is 152×84px: a status mark and the reference, an "Escalated" or
"Failed" badge when that applies, the title in at most two lines, and the
lifecycle state with the actor's current state. A done task shows a check and
a muted title. An open task with no actor shows a hollow dot.

**Critical path.** Critical edges are 2px primary; other edges are 1.5px
`edge`.

**Focus.** Everything that is not in focus fades: nodes to 30%, edges to 10%.
Transitions take 150ms.

- Hover or keyboard focus on a task: focus is the task, the tasks it waits
  on, and the tasks that wait on it.
- Select a task (click, or Enter on a focused node): focus is the critical
  path through that task: the chain of most open tasks before it, the task,
  and the chain of most open tasks after it. The selection bar shows the
  chain, its open count, "Clear", and "Open task". Clicking the selected
  task again clears the selection.
- With no hover and no selection, "Critical path" highlights the root task's
  critical path, and "Fade completed" fades edges that leave done tasks (25%)
  and done nodes (55%).

### Portfolio

Portfolio items and their allocations of the budget. The operator creates
the items and nests them as they like. GitHub Projects and T3code projects
attach to items; an item can hold several of either kind. Estimated reset
times read
"Resets in about …". An actor that used a model with no price shows a "No
price" warning badge in the Actors list and "No price" with the model named on
the actor page.

#### Portfolio table

- Title row: "Portfolio", a one-line description, "Edit allocations"
  (outline), and "Add item" (primary).
- Budget source cards, one per account: name and kind on one line, a
  granted-reset badge with its expiry under it, one meter per window with
  its value and estimated reset (the reset text truncates, never wraps), and
  a note when an early reset was detected. An account that an allocation
  names and `accounts.yml` does not declare has a "Not declared" warning
  badge in place of its kind, a muted line "Declare it in accounts.yml",
  and no meter.
- Account row, under the cards when there is more than one account:
  "Allocations for" and an account select. Allocation, Lifetime cost, the
  "Unallocated" row, the edits, and the dialog are for the selected
  account.
- Columns: Name (with a muted line under it for the projects attached to
  the item: their names when they fit, else counts such as "2 GitHub
  Projects, 1 T3code project"), Allocation (the guaranteed percentage of
  the parent over its API amount, and the ceiling as "up to N%" when the
  item has one),
  Current usage, Lifetime cost, Active tasks, Completed tasks, and an Edit
  icon button. An "Unallocated" row (muted, no Edit button) shows the
  remainder of the parent that no item is guaranteed. A total row closes the
  table.
- Current usage shows the account and window closest to the item's
  allocation of it on one line ("Subscription A · weekly", the amount, the
  percentage), then the meter with "Near limit" and a "+N" after it, then
  "Can reserve" and the amount the item can reserve now, its allocation plus
  what it can borrow from the unallocated remainder up to its ceiling. "+N"
  lists the other accounts and their percentages on hover and to screen
  readers.
- A usage meter at 85% or more of the item's allocation is warning and shows
  "Near limit".
- An item with sub-items has a chevron that shows them as indented rows on
  the `lane` surface, with the same columns and their own "Unallocated" row.
- "Other" is always the last item. At the top level it holds usage attached
  to no item. Every item with sub-items has its own "Other" as its last
  sub-item, holding tasks and usage that match none of its sub-items; an
  item with no sub-items shows none. Every "Other" has an allocation like
  any item, but it has no Edit button and cannot be renamed or archived.
- Under the table, "Show archived (N)" lists archived items with their
  archive date, lifetime cost, completed tasks, and "Restore". A restored
  item comes back with a 0% allocation.

#### Edit allocations

"Edit allocations" turns every allocation and ceiling into a number input
and swaps the title-row buttons for "Cancel" and "Save allocations". A status
bar above the table (info) shows the unallocated remainder of each parent
that the edit changes. Sub-item rows edit the same way. Each ceiling is at
most 100%.

While the allocations under one parent add up to more than 100%, their
inputs have error borders, the status bar is error and names that parent
and its sum, and "Save allocations" is disabled.

Under the status bar, a problems list shows each lint finding and warning
on one line: the kind in mono, the file and location in mono, and the
message, findings in error color and warnings in warning color.

#### Edit item

A 480px dialog: Name, Allocation (percentage of the parent), Ceiling
(optional percentage), Weight (optional whole number), a "Pacing" switch
that shows a Burst percentage input while on, and Sub-items. Each sub-item row
has its name, its amount, an allocation input, a ceiling input, and a remove
button. "Add sub-item" appends a row with a name field. The unallocated
remainder of the sub-items shows next to the heading. While the sub-item
allocations add up to more than 100%, their inputs have error borders, the
heading shows the sum in error color, and "Save" is disabled.

The footer has "Archive item" on the left (error text, outline). Items are
archived, never deleted: an archived item keeps its history and its
allocation goes back to the parent's unallocated remainder. A muted note
beside the button says so: "Its allocation returns to <parent>." When the
item has attached projects, "Archive item" opens a 480px dialog listing
each project with a choice: "Move to <parent>" (it lands on the parent's
"Other"), "Reassign to" a sibling picked from a select, or "Archive
project". The confirm button is solid error.

"Add item" opens the same dialog with only a name and adds a top-level
item. A new item starts at 0%. The item's id, made from the name, shows
under the Name field in muted mono and never changes.

### Task page

One task: a GitHub issue and everything Manifold knows about it. It opens from
a Board card or an Epics node ("Open task"), over whichever screen it came
from; the breadcrumb shows that screen and the task reference, and the back
link returns to it.

- Header: the reference (mono, muted) and title, a lifecycle badge (dot and
  label in the lane's status color), a priority badge, and a meta line with
  portfolio item, blueprint, root task, and when the issue was opened. On
  the right: "Open on GitHub" (outline), a ghost menu button with "Force
  re-intake", and one primary action: the move the task's actor currently
  accepts ("Move to Ready" in the Backlog example), or "Open thread" while a
  thread is turning.
- "Force re-intake" asks first, in a 400px alert dialog that says the current
  actor closes and its reservation settles. The confirm button is solid
  error.
- Main column:
  - An escalation panel when the actor is escalated (warning surface): the
    agent's question, the choices as outline buttons when the escalation has
    them, a one-line answer field when it takes text, and a muted line
    "The first answer from any channel is recorded." The
    answer goes back to the thread that raised the escalation. Each open
    escalation is its own block in the panel. While an answer is sent, the
    block's controls are disabled. The block then shows the outcome in
    place of its controls: "Answered: <answer>" on a success surface, or,
    when another channel answered first, "Already answered: <answer>
    (<channel>)" on a neutral surface.
  - Current actor: the current state and the actor's status, blueprint,
    environment, account, usage and time, the actor timeline bar with each
    visit's state and duration under it, and "Open actor". A task in Backlog
    shows its actor waiting in its backlog state.
  - Description: the issue text and the acceptance list as read-only
    checkboxes.
  - Actors: every actor for this task, with its last state, when, and usage.
  - Threads: a table of the actor's T3 Code threads: title, the latest
    turn's state as a status dot and label, an "Archived" badge, and an
    "Open in T3 Code" link icon.
  - Escalations: the task's answered and withdrawn escalations, newest
    first: title, status badge, the answer and the channel it came
    through, and when it closed.
  - Activity: newest first, a status dot and one line per event.
- Right column (320px):
  - Fields: every task field with its value, read only; lifecycle state, the
    field Manifold sets, carries a lock icon; hovering a name says where the
    field is stored. A "Task fields" link opens Settings.
  - Dependencies: "Waits on" and "Blocks", each task with its status dot,
    reference, and title, from the issue's "blocked by" relationships; "View
    in Epics".
  - Usage: the task's total tokens and cost, and a table with one row per
    account: Account, Estimate, Actual, Variance, and Reserved, numbers
    right-aligned. A variance above zero is in warning text. The caption
    says "Settled" or "Open".

### Actors

A list of blueprint actors. An actor opens as its own page under Actors; the header
breadcrumb shows "Actors / #ref actor", and "Actors" in it returns to the list.

#### Actors list

- Title row: "Actors" and a one-line description. No primary action.
- Filters in one row: an Active / Completed segmented control, then
  Portfolio item, Blueprint, Environment, and Account selects. The actor count
  is right-aligned.
- Columns: Task (title, reference in mono), Portfolio item, Blueprint (mono),
  Current state (status dot, state in mono, actor status, and a thread link
  icon for an active actor; "Last state" in Completed), Environment (mono),
  Usage (tokens over dollars), Time, and Timeline.
- The Timeline cell is a mini bar: one segment per state visit, width by time,
  2px gaps. Completed visits use `edge`; the current visit is primary
  (45% opacity while it waits on a turn); an escalated visit is warning and a
  failed one is error. Each segment has a tooltip with the state and its time.
- A row opens the actor.

#### Actor page

- Header: "All actors" back link; the reference and title; a status badge
  (Running, Completed, Failed); a meta line with portfolio item, blueprint,
  environment, account, and start time. On the right: a Timeline / Sequence segmented
  control and "Open thread".
- Four tiles: Tokens, Cost, Time, Passes.
- **Timeline** view: the actor timeline, one row per state visit with the
  state and pass on the left, a bar on a shared time axis, the event the
  visit exited on after the bar ("handoff", "idle → retry"), or "running",
  and usage on the right. A dashed
  primary line marks now. A pass that ends without a handoff is warning. A
  total row closes the table.
- **Sequence** view: lifelines for Manifold, the T3 Code thread, and GitHub.
  Manifold's messages are solid arrows; replies are dashed. A pass either
  starts a thread ("Start thread") or continues one the actor already has
  ("Continue thread"), as the blueprint decides. An abnormal reply,
  such as "idle", is warning. The pass that is running is a note on the
  thread's lifeline. Usage sits in a right-hand column on the row of the
  reply that closed each pass.

### Blueprints

The processes Manifold runs, from the process repository.

#### Blueprints list

- Title row: "Blueprints", a one-line description, and "Add blueprint"
  (primary). Add blueprint opens a 440px dialog with a name (lowercase
  letters, digits, and hyphens) and "Start from", a published blueprint to
  copy. "Create draft" opens the editor on the new draft.
- Columns: Name (mono, with a one-line description), Version (short SHA in
  mono and date), Active actors, and an Edit button. A blueprint with a local
  draft shows a "Draft" badge.
- Edit, or the name, opens the editor. The breadcrumb shows
  "Blueprints / name".

#### Blueprint editor

The editor works on a local draft. Publish commits the draft and pushes it
to the process repository.

- Header (56px): the blueprint name in mono, the version the draft is based
  on, a "Draft · N changes" badge, tabs (Graph, Source, Input schema,
  Output schema), then "Discard draft" (ghost), "Auto layout" (outline, Graph tab
  only), and "Publish" (primary).
- "Discard draft" asks first, in a 400px alert dialog that names the number
  of changes and the published version that stays. The confirm button is
  solid error.
- Left: the implementation palette (208px), with a filter field and the
  implementations in groups. Each entry is the implementation name in mono
  with its icon; its description is the tooltip. Dragging an entry onto the
  canvas adds a state that invokes it. The Flow group also has "State", a
  state that invokes nothing and waits on its events, and "Final state".
- Center: the ReactFlow canvas on the dotted grid. The layout is automatic
  (Dagre or ELK), top to bottom. Transitions carry the event name as a mono
  pill; a guarded transition has a guard icon in its pill. Transitions into
  and out of the selected state are primary. A state changed in the draft
  has a warning dot. Zoom controls at the bottom left.
- Right: `StateSettings` for the selected state (320px): state id, the
  fields for its implementation, the events it exits on with the state each
  one leads to ("not connected", in warning text, when an event has no
  transition), and its gate.
- Bottom of the canvas: the Problems strip (below).

`StateNode` is 200×56: an icon chip, the state id in mono (weight 600), and
the implementation name. A state with a gate has a "Gate" badge after the
implementation name. A final state has a double border. Selection is a 2px
primary border with a ring, as for `TaskNode`.

The palette groups are Decide, Flow, Thread, Task, and People. The
implementations, their settings, and their events are in the specification.

#### Source

The Source tab shows the blueprint YAML the draft generates, read only, full
width, in the code editor with line numbers. Lines that differ from the
published version have a 3px warning bar in the gutter and a faint warning
background. A toolbar (48px) shows the file path, "Generated from the graph
· read only", the legend for changed lines, and "Copy".

#### State settings

The panel shows the state id, one field per setting of its implementation,
and the events it exits on with the state each one leads to. Each event has
its match and its guard as JSONata fields. A state that evaluates a decision
model has an "Open decision model" button. Mappings (input, output, actions)
are rows of two mono inputs joined by an arrow, with an "Add" button under
them. JSONata fields are labeled "JSONata" and have an expand button at the
right edge.

The Gate group is last. With no gate it has "Add gate" (outline). A gate
shows its comparator (a select of the TypeScript files in the process
repository, in mono), a "Reservation" switch, the transition it guards, and
"Remove gate" (error text, outline).

#### Expression editor

The expand button opens a 920px dialog titled with the state, field, and key.
On the left, the expression in a code editor. On the right, the result of
the expression against a chosen source: the context of a recent actor of this
blueprint, or a sample built from the input schema. Under the editor, the
parse state ("Valid JSONata" or the error and its position); under the
result, whether it matches the schema the field feeds. "Apply" writes the
expression back to the field.

#### Problems

The editor validates the draft as it changes. A strip under the canvas
shows the count of errors (error color) and warnings (warning color) and
lists each problem with its state id; a problem opens its state. A state
with a problem has a 16px "!" badge on its top-right corner, error or warning
colored. The strip collapses to its 36px header.

- Errors are error-colored and disable Publish until fixed.
- Warnings are warning-colored and do not block Publish.

#### Input and output schemas

The input schema and the output schema each have an editor tab.

- A toolbar (48px): a Visual / YAML switch, the count, and "Add property"
  (outline, Visual only). The add button stays in the toolbar so a long
  table does not hide it.
- Visual: the property table: Property (mono, indented for nesting, with a
  chevron on object rows), Type (string, number, integer, boolean, object,
  array, enum), Required (checkbox), Description, and remove.
- YAML: the whole file, full width, in a code editor. Both views edit the
  same document; comments written in the YAML are kept when the table
  changes it.

#### Decision model editor

The settings of a state that evaluates a decision model summarize the model
(rule count, hit policy, inputs) and have "Open decision model". That opens
the JDM editor in a 920px dialog, themed with Manifold's tokens: inputs and
outputs as mono column headers, output columns on the `accent` surface, one
row per rule, cells labeled "JSONata", "Add rule", "Add input", "Add output",
and "Apply to draft".

#### Publish

A 480px dialog: the changed files with their git status letter (A success,
M warning) and path in mono, a commit message, and the target repository and
branch. "Commit and push" commits and pushes.

### GitHub Projects

#### Projects list

- Title row: "GitHub Projects", a one-line description, "Task fields"
  (ghost, a quick link), and "Bind a Project" (primary).
- Columns: Project (`org/name` in mono, linking to GitHub), Portfolio item
  (the item it attaches to), Active cards, Completed cards, Environment (the
  environment for its threads), Configuration, and an action.
- Configuration is a badge: "In sync" (success), "Drift · N" (warning; the
  configuration was changed outside Manifold), "Pending · N" (info; the task
  fields changed since the last Apply), or "Not applied" (info; bound but
  never applied). The action is "View" when in sync and "Review
  changes" otherwise.

#### T3code projects

A second table under the Projects table, with the heading "T3code projects"
and "Bind a T3code project" (outline) on the right of the heading.

- Columns: T3code project (name over its path, both mono), Environment,
  Portfolio item (the item it attaches to), Active threads, and an Edit
  icon button.
- A T3code project associated with a bound GitHub Project has no binding of
  its own. Its row shows that Project's portfolio item with "Associated with
  `org/name`" under it in muted text, and it has no Edit button. A GitHub
  Project can have many associated T3code projects.
- Bind a T3code project and Edit are one 440px dialog: T3code project (a
  select of the environment's T3code projects), Name (the binding name,
  prefilled from the project's title, read only on Edit), Environment, and
  Portfolio item.

#### Bind a Project

A 480px dialog: Project (`org/number` or the Project's URL), Name (the
binding name, prefilled from the Project), Environment, Portfolio item (the
item the Project attaches to), T3code projects, and a warning note that Manifold takes
control of the Project's fields and status options that the task fields
declare. T3code projects
has a "Create one from the templates" checkbox, which shows the name and
path templates in mono with the name and path they give, and under it
"Associate existing T3code projects", one checkbox per T3code project of
the environment (name and path in mono). "Bind and
review changes" is disabled until "I understand" is checked. It opens the
Project's page with its first Apply.

#### A Project's page

- Header: "All Projects" back link, the Project name in mono with a GitHub
  link and its Configuration badge; a meta line with the portfolio item,
  the environment, the task fields version, and when it was last applied.
  On the right: "Task fields" (ghost) and "Apply N changes" (primary;
  "Nothing to apply" and disabled when in sync).
- A "T3code projects" card with the count and "Associate existing"
  (outline) in its header, and one row per associated T3code project: name
  and path in mono, and its active threads. With none it says that Manifold
  adds one each time it creates a T3code project for the Project.
- Apply on this page is for Projects with drift, pending changes, or never
  applied.
- One card, "What Apply will change", with a switch "Also remove what the
  task fields do not define" (off by default). Groups, one per storage kind;
  Project fields is the one kind. Each group names where it applies and sums
  its changes.
- A change row: a 18px mark (`+` create in success, `~` change in warning,
  `−` remove in error), the target in mono, and what happens. A change that
  undoes drift has a "Drift" badge, and a change Apply writes into the task
  fields, for a field set to Accept, has an "Into task fields" badge. With
  the switch off, a change that needs a removal is dimmed with a "Kept"
  badge and does not count.
- With the switch on, "Apply N changes" first asks in a 400px alert dialog
  that names what will be removed; the confirm button is solid error.

### Settings

Settings has tabs under its title: Task fields, Accounts and budget sources,
and General.

#### Task fields

The task metadata schema editor, with the same draft, discard, and publish
path as a blueprint.

The Publish dialog (660px when there are Projects) lists each bound Project
with its counts of creates, changes, and removes, and what happens to it
after Publish. The section header also says how many Projects the draft
changes, with "Review impact".

- Section header: "Task fields", a "Draft · N changes" badge, a one-line
  description, "Discard draft" (ghost), and "Publish" (primary). A line with
  the published version, its date, the file path, and the draft's impact on
  bound Projects.
- The schema editor, in storage mode: rows are called fields, a "Stored as"
  column follows Type, and Visual has a field panel (320px) on the right for
  the selected field. Columns: Field, Type, Stored as, and a remove button.
  "Add field" adds a text field stored as a Project field and selects it.
- Lifecycle state, the field Manifold sets, has a 20px lock icon after the
  name (tooltip and label "Set by Manifold"). Its name, type, and storage
  are shown disabled, it has no "When changed on GitHub", and it has no
  remove button.
- Selecting a row shows it in the field panel: "Stored as", whether that storage
  can hold the type, the kind's settings (the Project field name), a
  single-select field's options, what exists on GitHub for it, its scope,
  and "When changed on GitHub", a two-option segmented control: Revert or
  Accept.
- A field with a finding is an error: a red "!" on the row, red borders on
  Type and Stored as when the finding is at either, and a Problems box under
  the table.
  Publish is disabled while there are errors.

#### Accounts and budget sources

Accounts and what the operator sets on each.

- Section header: "Accounts and budget sources", a one-line description, and
  "Add account" (primary).
- Columns: Account (name and provider), Used by (the environments, one per
  line in mono), Budget (an API account's monthly amount and reset day; a
  subscription's plan and window count), Current use (the window closest to
  its limit, named, with its percentage, a meter, and a granted-reset badge
  under it when there is one), Last report (a success dot when recent, an
  idle dot when not), and an Edit icon button.
- A Pricing card: how subscription cost is estimated, when the price table
  was updated, how many models it has, a warning count of models in use
  with no price ("their actors are flagged") with "View actors", and "Refresh".

Add account and Edit account are one 520px dialog:

- Kind: API budget or Subscription (fixed once the account exists).
- Name and Provider.
- Used by: environments as checkboxes. An environment another account
  already uses for this provider is disabled with "Used by" and that
  account's name.
- API budget: Monthly budget and "Resets on".
- Subscription: Plan, the usage windows and model caps as detected (read
  only), and granted resets with their expiry. A new subscription says its
  windows appear after the first usage report.
- Edit has "Archive account" at the bottom left (error text, outline).
  Accounts are archived, never deleted, so past usage keeps its source.

### Environments

- Title row: "Environments", description, and the primary "Add environment"
  button.
- Table columns: Host (mono), Status, Active threads, Scheduled threads,
  Actions.
- Row actions: Pause / Resume, Disconnect / Reconnect, Forget.
- Active threads shows "—" for a disconnected environment, because the count
  is not known.
- "Add environment" opens a dialog with the server URL and the credential
  the environment requires.

## Implementation

Manifold's UI is a React application built on the same stack as T3 Code's web
client: Tailwind CSS v4, Base UI primitives, class-variance-authority for
variants, and lucide-react for icons. Manifold adds dnd-kit for drag and drop
(pointer, touch, and keyboard), ReactFlow (`@xyflow/react`) for graphs, and
CodeMirror 6 for code: YAML with `@codemirror/lang-yaml`, and JSONata
expressions. The Epics graph and the blueprint editor share ReactFlow, one
automatic layout engine, and one node style. T3 Code's `components/ui` primitives
(button, badge, table, dialog, menu, select, sidebar) are the starting point
for Manifold's own, so that both products look and behave the same.

Each screen and each reusable part in this document is one React component,
with the same name as the design canvas uses:

- `AppShell`: header, sidebar, and the content region. The canvas keeps it in
  `Main`.
- `OverviewContent`, `BoardContent`, `EpicsContent`, `ActorsContent`,
  `PortfolioContent`, `BlueprintsContent`, `ProjectsContent`,
  `EnvironmentsContent`, `SettingsContent`: the content of each sidebar
  screen. `TaskFieldsContent` is a Settings section.
  `BlueprintsContent` holds both the list and the editor, and `ActorsContent`
  holds both the list and the actor page. `ProjectsContent` holds GitHub
  Projects and T3code projects.
- `TaskCard`: one card on the Board, used wherever a task shows as a card.
- `TaskContent`: the Task page, shown over the screen it was opened from.
- `TaskNode`: a ReactFlow custom node for a task in a graph.
- `StateNode`: a ReactFlow custom node for a blueprint state.
- `AccountsContent`: the Accounts and budget sources section of Settings.
- `StateSettings`: the edit component for a blueprint state, one set of
  fields per implementation, and its gate.
- `SchemaEditor`: a Visual / YAML editor for a JSON Schema, used for
  blueprint input and output schemas, and in storage mode (Stored as column,
  field panel, Problems) for Task fields.
- `PublishDialog` and `DiscardDialog`: the draft publish and discard dialogs,
  used by the blueprint editor and Task fields.
- The decision model editor is `@gorules/jdm-editor`, themed with Manifold's
  tokens.
- YAML is read and written with the `yaml` package's document model, so
  that comments survive edits from the schema table.

Components read colors from the token names in this document, set as CSS
custom properties on the root element, so that a theme change is one class
change.

## Tables

Tables use fixed layout with every column width in percent, set on the
header cells, so that long values truncate with an ellipsis instead of
pushing into the next column. Cells that hold two lines (a name over a
detail) truncate each line on its own. A cell's badge or extra control goes
on its own line or after its meter, never on the line with the value.

## Do and don't

- Do reuse T3 Code's token names in code, so that a T3 Code theme (including
  an imported VS Code theme) can apply to Manifold later.
- Do keep one primary button per view.
- Do show state with a dot or badge and a text label.
- Don't add brand color to surfaces, gradients, or colored left borders on
  cards.
- Don't use emoji as icons.
- Don't use shadows to separate surfaces that a border can separate.
