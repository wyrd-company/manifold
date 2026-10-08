---
name: Manifold
description: >-
  Operator dashboard for Manifold. It uses the visual language of T3 Code so that
  a T3 Code user reads it without learning a new vocabulary.
source: T3 Code semantic tokens and primitives, with the Manifold contrast palette
relationships:
  # GAP-EDGE: no ontology type covers a visual design document; `related-to`
  # names the technical design that builds the console from it.
  related-to:
    - operator-console
colors:
  light:
    background: "#f5f7fb"
    sidebar: "#edf1f7"
    card: "#ffffff"
    popover: "#ffffff"
    accent: "#e3ebf6"
    border: "#c5d0df"
    input: "#7588a1"
    foreground: "#202d40"
    muted-foreground: "#52647d"
    icon-muted: "#657891"
    primary: "#1b4ed8"
    primary-foreground: "#ffffff"
    link: "#1b4ed8"
    success: "#10b981"
    success-foreground: "#047857"
    warning: "#f59e0b"
    warning-foreground: "#a64b07"
    error: "#ef4444"
    error-foreground: "#b91c1c"
    info: "#3b82f6"
    info-foreground: "#1d4ed8"
    lane: "#eaf0f8"
    tile: "#ffffff"
    edge: "#526985"
    grid: "#d4deec"
  dark:
    background: "#101722"
    sidebar: "#151f2e"
    card: "#1c2839"
    popover: "#25354b"
    accent: "#30445e"
    border: "#435974"
    input: "#6b839f"
    foreground: "#eef4ff"
    muted-foreground: "#b2c1d7"
    icon-muted: "#96abc7"
    primary: "#729fff"
    primary-foreground: "#0b1728"
    link: "#9fc1ff"
    success: "#10b981"
    success-foreground: "#34d399"
    warning: "#f59e0b"
    warning-foreground: "#fbbf24"
    error: "#ef4444"
    error-foreground: "#ff8585"
    info: "#3b82f6"
    info-foreground: "#60a5fa"
    lane: "#152031"
    tile: "#223149"
    edge: "#9db2ce"
    grid: "#2b3c52"
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
  state-node:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    width: 200px
    height: 56px
  state-group:
    backgroundColor: "{colors.lane}"
    borderColor: "{colors.input}"
    rounded: "{rounded.lg}"
    titleHeight: 32px
    padding: 24px
  transition-edge:
    strokeColor: "{colors.edge}"
    strokeWidth: 1.75px
    selectedStrokeColor: "{colors.primary}"
    selectedStrokeWidth: 2.5px
    pillBackgroundColor: "{colors.card}"
    pillBorderColor: "{colors.input}"
    pillHeight: 20px
  canvas-toolbar:
    backgroundColor: "{colors.popover}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    height: 40px
  inspector:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.border}"
    width: 320px
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
matter define Manifold's palette. Text, graph routes, controls, and overlay
surfaces stay distinguishable in both themes.

- **Neutrals.** Light theme uses slate surfaces on a cool near-white background.
  Dark theme uses deep slate, with distinct canvas, card, and popover surfaces.
  Dialogs have a visible border and a dark scrim; their controls have 24px
  of inset space. Muted text remains readable on every surface.
- **Primary.** One blue (`primary`), with contrasting `primary-foreground` text.
  Use it for the one main action in a view and for focus rings. Do not use it
  for status.
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

- **Primary**: the one main action in a view ("Add item").
- **Outline**: row actions and secondary actions ("Pause", "Disconnect",
  "Cancel").
- **Ghost**: icon-only controls in the header and dialog title. Each has an
  `aria-label`.
- **Destructive outline**: actions that remove data ("Delete"). The label is
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
- A toolbar row under it with a ghost "Refresh" icon button, right-aligned.
- Four stat tiles in one row, two per row below 960px of content width. A
  tile is a card with a 12px muted label, a 24px tabular value, and one
  12px detail line. The tiles are not links. A tile whose read failed
  shows "—" and "Not available" muted.
  - **Active actors**: the count; the detail is "N held" in
    `error-foreground`, or "None held" muted.
  - **Needs attention**: the count of the list below; the detail counts
    each kind, "1 escalation · 1 held · 1 paused", or "Nothing waits on you".
  - **Closest to limit**: the budget source account's share as the value,
    then the account name and its window label ("acct-a · Weekly"), a meter
    (warning at 85% or more), and "of N accounts" muted.
  - **Environments**: "C of T connected"; the detail is "P paused" in
    `warning-foreground`, or "None paused" muted.
- Active actors table, at most 10 rows. Columns: Task (the issue title over
  its reference and the blueprint path in mono, or the actor id in mono for
  an actor that is not a task), Portfolio item, Current state (a status dot
  and label, "Running" with a success dot or "Held" with an error dot, over
  each state path in mono), Updated (the time since the actor's last save,
  "5m"), and Thread ("Open thread", or a muted dash). The caption is "N
  active actors", with "View all" linking to Actors when there are more
  than 10.
- Needs attention and Budget share one row, half each, at 960px of content
  width or more, and stack below it.
- Needs attention list: escalations, held actors, and paused environments.
  Each item is one row: a 16px icon (info for an escalation, error for a
  held actor, warning for a paused environment), a title, one muted line of
  detail, the time it has waited in muted 12px text, and one outline link
  button. With no item, the empty state "Nothing needs attention",
  "Escalations, held actors, and paused environments appear here."
- Budget: one row per portfolio item that is not archived, sub-items
  included, in Portfolio's order. A sub-item's title is indented 16px per
  level. Each row has the item title,
  the account and window ("acct-a · Weekly") in muted text, a meter, and
  "<used> of <amount> · 85%" under it. At 85% or more the fill changes to
  warning and a "Near limit" badge follows the meter. An item with no
  guaranteed amount shows "No allocation" muted and no meter. The section
  header links to Portfolio.

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
- Toolbar: a Root task select, a summary (tasks, done, open), a ghost
  "Refresh" icon button, and two switches on the right: "Critical path" and
  "Fade completed". Both are on by default, and each operator's choice is
  kept between visits.
- The graph sits in a card on a dotted grid, with zoom controls at the bottom
  left and a legend at the bottom right. Under the graph is a 56px selection
  bar.

The Root task select lists every tracked issue that has sub-issues and whose
parent is not a tracked issue: open roots first, then closed roots marked
"Closed", each as its reference and title. The epic is the root's sub-issue
tree. The summary counts the tree's issues other than the root; a closed
issue is done. The root shows in the graph only when a dependency names it.

A task node is 152×84px: a status mark and the reference, an "Escalated" or
"Failed" badge when that applies, the title in at most two lines, and the
lifecycle state with the actor's current state. A done task shows a check and
a muted title. An open task with no actor shows a hollow dot. A sub-issue that
is not on a bound Project shows "Not on a bound Project" in place of the
lifecycle state.

**Outside issues.** A dependency from a task of the tree to an issue outside
it shows that issue as a node with a dashed border and "Outside this epic"
before its lifecycle state. It takes part in the critical path, since the
tree waits on it, and is not counted in the summary.

**Cycles.** GitHub's dependencies can form a cycle. A dependency inside a
cycle is a 1.5px dashed `error` edge and is never critical, and a warning
alert above the graph says "N dependencies on GitHub form a cycle. The
critical path leaves them out."

**Critical path.** Critical edges are 2px primary; other edges are 1.5px
`edge`. The critical path is the chain with the most open tasks; between
chains with as many, the shorter one.

**Focus.** Everything that is not in focus fades: nodes to 30%, edges to 10%.
Transitions take 150ms.

- Hover or keyboard focus on a task: focus is the task, the tasks it waits
  on, and the tasks that wait on it.
- Select a task (click, or Enter on a focused node): focus is the critical
  path through that task: the chain of most open tasks before it, the task,
  and the chain of most open tasks after it. The selection bar shows the
  chain, its open count, "Clear", and "Open task", or "Open on GitHub" for
  an issue that is not a task. Clicking the selected task again, or Escape,
  clears the selection. With no selection, the bar says "Select a task to see
  the chain through it."
- With no hover and no selection, "Critical path" highlights the root task's
  critical path, and "Fade completed" fades edges that leave done tasks (25%)
  and done nodes (55%).

The selected root and task are in the address, so a reload, a pasted link, or
the Task page's back link shows the same view. With no root task, the screen
shows "No epics": "An epic appears here when a tracked issue has sub-issues on
GitHub."

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
  and no meter. An archived account that an allocation names has an
  "Archived" warning badge in place of its kind, a muted line "Restore it
  in Settings, Accounts", and no meter.
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

The dialog has 24px insets. Allocation, Ceiling, and Weight share a row with
20px gaps. Name, Pacing, and Sub-items span the full width. Below 420px the
allocation controls stack. The fields scroll while the footer stays reachable.

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

#### Unowned usage

Under the table and the archived list, an "Unowned usage" section lists
the usage of threads no task owns: threads an operator opened outside
Manifold, and sessions whose thread is unknown. A muted line under the
heading reads "Usage from threads no task owns. Move it to the item or
task it was for."

- Columns: Thread (the thread's title, or "Untitled thread", with a muted
  mono line of the environment and thread id; "Unmapped session" with the
  environment, provider, and session id for a session), Counts on (the
  items whose usage includes it), Amount (for the selected account, with
  "N calls" muted under it and a muted "N pending" badge while calls wait
  for a price, an account, or a window), Last used ("about 2 hours ago"),
  and a "Move" button (outline, small).
- The first 20 rows show, newest first; "Show all (N)" shows the rest.
  With nothing to list, the section shows only the muted line "No unowned
  usage."

"Move" opens a 480px "Move usage" dialog that names the thread and its
amount per account. A radio group picks "To a portfolio item", with a
select of the live items indented under their parents, Others included,
or "To a task", with a searchable list of the bound Projects' tasks as
"repository#number title", grouped by Project. "Move" (primary) is
disabled until a target is chosen. A move keeps each call's account,
amount, and window, so the budget cards do not change; the item's usage
and lifetime cost, or the task's actual, take the calls at once. A
success toast reads "Moved N calls to <target>". A refusal shows its
message in an error alert above the footer and keeps the dialog open.

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
  Portfolio item, Blueprint, Environment, and Account selects, each "All"
  by default. The actor count ("3 active actors") and a ghost Refresh icon
  button are right-aligned.
- Columns: Task (title, reference in mono), Portfolio item, Blueprint (mono),
  Current state (status dot, state in mono, actor status, and a thread link
  icon for an active actor; "Last state" in Completed), Environment (mono),
  Usage (tokens over dollars), Time, and Timeline.
- The Timeline cell is a mini bar: one segment per state visit, width by time,
  2px gaps. Completed visits use `edge`; the current visit is primary
  (45% opacity while it waits on a turn); an escalated visit is warning and a
  failed one is error. Each segment has a tooltip with the state and its time.
- A cell still reading shows a muted ellipsis; a cell whose read failed
  shows a muted dash.
- A row opens the actor.
- Empty states: "No active actors" in Active, "No completed actors" in
  Completed, and "No actors match these filters" with "Clear filters"
  when filters hide every row.

#### Actor page

- Header: "All actors" back link; the reference and title; a status badge
  (Running, Completed, Failed); a meta line with portfolio item, blueprint,
  environment, account, and start time. On the right: a Timeline / Sequence segmented
  control and "Open thread" when the actor has a thread to open.
- Four tiles: Tokens, Cost, Time, Passes.
- **Timeline** view: the actor timeline, one row per state visit with the
  state and pass on the left, a bar on a shared time axis, the event the
  visit exited on after the bar ("handoff", "idle", "answered: retry"), or
  "running", and usage on the right. A dashed
  primary line marks now while the actor runs. A pass that ends without a
  handoff is warning. A visit that changed the blueprint commit shows the
  new short commit, muted, under its state. A total row closes the table.
- **Sequence** view: lifelines for Manifold, each T3 Code thread the actor
  follows, and GitHub. Manifold's messages are solid arrows; replies are
  dashed. A pass either starts a thread ("Start thread") or continues one
  the actor already has ("Continue thread"), as the blueprint decides. An
  abnormal reply, such as "idle", is warning. A card move is a solid arrow
  to GitHub ("Move to Done · confirmed"), warning when unconfirmed; a
  person's change on the board is a dashed arrow from GitHub ("Status:
  Done · by a person"). The pass that is running is a note on the
  thread's lifeline, and an event a running actor has not yet taken is
  muted with "pending". Usage sits in a right-hand column on the row of the
  reply that closed each pass.
- The views are read-only. Nothing on the page sends a command or
  changes a declaration.

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
to the process repository. The canvas is the main view; the YAML is the
other view of the same draft, and the two are never shown side by side.

- Header (56px): the blueprint path in mono, the version the draft is based
  on, a "Draft · N changes" badge, the view toggle (a segmented control,
  "Canvas" and "YAML"), then "Discard draft" (ghost) and "Publish"
  (primary).
- "Discard draft" asks first, in a 400px alert dialog that names the number
  of changes and the published version that stays. The confirm button is
  solid error.
- Canvas view: the canvas toolbar over the canvas's top-left corner, the
  ReactFlow canvas on the dotted grid, and the inspector (320px) at the
  right. Selected paths wrap inside the panel; the controls do not expand its
  width. Under 1024px of content width the inspector is a sheet over the
  canvas from the right.
- YAML view: the code editor, full width.
- Under either view: the Problems strip (below).

#### Canvas

The canvas reads at a glance in both themes. Nodes are solid surfaces with
`input`-colored borders and `foreground` text. Invoke icons and gate badges
use info, final states use success, and history markers use warning. Event
edges use `edge`; completion edges use success, error edges use error, and
delay edges use warning. Selection uses primary. Every node and edge type differs by shape,
border, stroke, or icon, never by color alone.

`StateNode` is 200×56: a 24px icon chip on a tinted info surface, the state
key in mono (weight 600), and under it the source of its first invoke in
mono `muted-foreground`, with "+N" when it invokes more. A state that
declares a gate has a "Gate" badge (info tint) after the source. The chip's
icon is `Circle` for a state that invokes nothing, `Zap` for a Manifold
implementation, and `FileCode2` for a child blueprint.

| Node           | Look                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| State          | `StateNode`, 1px `input` border, 8px radius                                                                                                                        |
| Final state    | `StateNode` with a 3px double `success` border and the `CircleCheckBig` chip                                                                                       |
| Compound state | `GroupNode`: a 32px title bar with the `SquareStack` icon and the key in mono (weight 600), its children inside with 24px padding, 1px `input` border, 10px radius |
| Parallel state | `GroupNode` with the `Columns2` icon and a "Parallel" badge; each region, a child state, has a dashed `input` border                                               |
| History state  | `HistoryNode`: a 40px circle, 1px warning border, `H` (shallow) or `H*` (deep) in mono (weight 600), the key in 12px mono `muted-foreground` under it              |
| Initial marker | `InitialNode`: a 10px `foreground` dot joined by an unlabeled `foreground` edge with an arrowhead to the initial child                                             |

Nested groups alternate solid `lane` and `card` surfaces, so each level
stands apart from the one around it. Their title bars remain above their
children. Edge routes and labels use root coordinates, including transitions
that enter or leave a nested group. Label buttons stay above the group surfaces;
clicking or keyboard-activating a label selects its transition in the inspector.

`TransitionEdge` draws a transition with a 1.75px semantic-color
stroke, an arrowhead, and a label pill: 20px high, `card` surface, 1px
`input` border, 6px radius, 12px mono text in the edge’s semantic color.

| Edge      | Stroke       | Pill                                                                  |
| --------- | ------------ | --------------------------------------------------------------------- |
| Event     | solid        | the event type                                                        |
| `always`  | dashed (6 4) | "always"                                                              |
| `after`   | dotted (2 3) | `Clock` icon, the delay, and its duration ("3600000 · 1h")            |
| `onDone`  | solid        | `CircleCheck` icon in `success-foreground`, "done", and the invoke id |
| `onError` | solid        | `CircleAlert` icon in `error-foreground`, "error", and the invoke id  |

A guarded transition has the `Filter` icon first in its pill. A
transition with no target is a short loop on its source.

- Selection is a 2px primary border with a ring, as for `TaskNode`. The
  selected edge, and the edges into and out of the selected node, are 2.5px
  primary, with a primary pill border.
- A state changed in the draft has a 6px warning dot at its top-left
  corner.
- A state with a problem has a 16px "!" badge on its top-right corner,
  error or warning colored. A transition with a problem has its pill
  bordered in error or warning color with a 12px "!" icon.
- Handles show on hover with the Select tool: an 8px dot on the top and
  bottom edge of each node, `card` fill with a primary border.
- When the canvas cannot draw the draft, it shows the last drawing at 40%
  opacity with an info alert over it: "The canvas cannot draw this text.
  Fix it in the YAML view." and "Open YAML" (outline).

#### Canvas toolbar

The toolbar floats 12px inside the canvas's top-left corner: 40px high,
the `popover` surface, a 1px border, 10px radius, and the dialog shadow at
its smallest. Its buttons are 28px ghost icon buttons with a tooltip that
names the button and its key, in groups split by 1px vertical dividers:

1. Select (`MousePointer2`, V) and Pan (`Hand`, H). The active tool has
   the `accent` fill and a `foreground` icon.
2. Add state (`SquarePlus` with a chevron, S), a menu of State, Compound
   state, Parallel state, Final state, and History state, each with its
   node's icon; and Add transition (`Spline`, T). While one is armed its
   button stays pressed and the cursor is a crosshair; a placed state
   shows as a 50% ghost node under the pointer.
3. Undo (`Undo2`) and Redo (`Redo2`).
4. Zoom out (`ZoomOut`), Zoom in (`ZoomIn`), and Fit (`Maximize`).
5. Automatic layout (`Network`).

Select owns object interaction: a primary click selects, a node drag moves
and pins the layout, and a primary drag on blank canvas leaves the viewport
fixed. Pan owns viewport interaction: a primary drag pans even when it starts
over a node or transition label, while clicks leave the inspected selection
unchanged. Pan and temporary Space panning cannot move or connect objects.
Middle- and right-button drags pan in either tool; the wheel continues to zoom.

#### Event picker

A 280px popover at the point a new transition was dropped: the title "New
transition", the source and target paths in mono joined by an arrow, a
filter field, and a list. Declared event types come first in mono, then
"always", "after", "done", and "error" with their pill icons, then "Use
<name>" for a typed name the list lacks.

#### YAML view

The YAML view is the blueprint YAML in the code editor with line numbers,
full width, and editable. Lines that differ from the published version
have a 3px warning bar in the gutter and a faint warning background. Each
problem underlines its range in error or warning color. A toolbar (48px)
shows the file path, the legend for changed lines, and "Copy".

#### Inspector

The inspector is 320px on the `card` surface with a 1px left border, and
scrolls by itself.

- Header (48px): the kind's icon, the kind in 12px `muted-foreground`
  ("State", "Compound state", "Event transition", "Delayed transition",
  "Blueprint"), and the state path or label in mono under it.
- Body: groups with a 12px weight 500 `muted-foreground` heading and a
  chevron to collapse, 16px between fields. A group opens when it holds a
  value. Each field has a visible label; controls are 28px.
- Footer: "Remove" (destructive outline) for a node or an edge.

Every state node has an inspector, the machine's root included. Groups for
a state: Basics (key, id, description, type, initial child, and, for a
history state, shallow or deep and its default target), Transitions, Entry
actions, Exit actions, Invoke, Gate, Meta, Tags, and Output. The root is the
Blueprint inspector: Basics (description, machine id, type, initial
child), Context, Schemas, Layout, and the state groups other than Gate.
Groups for a transition: Trigger (event type, delay, or invoke), Target,
Guard, Actions, and Details (reenter, description, order, meta). A group
that the node's type does not use shows only while it holds a value. "More
properties" (ghost, with a `Plus` icon) ends the inspector and opens a menu
of the properties not shown; choosing one adds its group.

- **Transitions** lists each outgoing transition as a row: its trigger
  icon, its label in mono, an arrow, and its target in mono, or "not
  connected" in warning text. A row opens that transition. "Add
  transition" (outline) sits under the list.
- **Actions** are rows of the action (a combobox, or "Assign" for an
  expression), its parameters under it, and a ghost remove button; "Add
  action" (outline) sits under them.
- **Invoke** is a card per invoke: `src` as a combobox in mono with its
  description in 13px `muted-foreground` under it; Contract: Input and
  Output, each a small table of property (mono), type, and required (a
  check), or "Not declared" in muted text with "Declare contract"
  (outline); `id` and `systemId` in mono; its input; and its done, error,
  and snapshot transitions as Transitions rows. Unknown names show their
  line in warning text.
- **Gate** shows "Add gate" (outline) with no gate. A gate shows its
  comparator path (mono), its return point, the "Reservation" switch, the
  token event type (mono), the dependencies region, and "Remove gate"
  (error text, outline).
- **Tags** are badges with a remove icon, and a field to add one.
- A field with a problem has an error or warning border and the message
  under it in 12px `-foreground` text.
- Comboboxes of implementations group their entries (Decide, Flow,
  Thread, Task, People) and show each description under its name.

Fields that hold a name (a key, an event type, a delay, an invoke id) take
effect on Enter or when they lose focus. Other fields take effect as they
change.

#### Expression field

An expression (an assign, a guard, or a mapping) is a code field in mono
with a "JSONata" label: one line, growing to eight as it wraps. A problem
underlines its position, or the whole expression, and its message shows
under the field. A static value, such as an invoke's input, is a YAML
field of the same look with a "YAML" label; a YAML field whose text does
not parse shows the parse error under it and is not applied.

#### Problems

The editor validates the draft as it changes. A strip under the view
shows the count of errors (error color) and warnings (warning color) and
lists each problem with its state path; a problem selects the node or
edge it marks on the canvas, or its line in the YAML view. The strip
collapses to its 36px header.

- Errors are error-colored and disable Publish until fixed.
- Warnings are warning-colored and do not block Publish.

#### Input and output schemas

The input schema and the output schema open from the Schemas group of the
blueprint inspector, in a 920px dialog.

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

Accounts and what the operator sets on each, as `accounts.yml` declares
them.

- Section header: "Accounts and budget sources", a one-line description, a
  ghost "Refresh" icon button, and "Add account" (primary).
- Columns: Account (name, and its providers under it in muted text), Used
  by (the environments, one per line in mono, with the provider instance
  after a `·` when the account names one), Budget (the amount per window
  with the window's name, "API budget" or "Subscription estimate" muted
  under it, and "Resets in about …"), Current use (the window's name, its
  percentage, and a meter, warning at 85% or more; "No window yet" when
  none is open), Last report (a success dot when the latest call charged
  to the account is less than 24 hours old, an idle dot when it is older,
  and its age, "3 hours ago"; "No report yet" with an idle dot when no
  call has charged it), and an Edit icon button.
- "Show archived (N)" under the table when an account is archived: each
  archived account with its name, its kind, and "Restore".
- A Pricing card: how cost is estimated ("Each call is priced at its
  model's API price, for subscriptions too."), the bundled price table as
  "LiteLLM at <short commit>" with its model count, and how many models
  `prices.yml` prices. When calls wait for a price, a warning line "N
  models in use have no price" lists each provider and model with its
  waiting calls, and "Price them in prices.yml."
- A subscription shows the capacity the operator declares. Its plan,
  detected windows, model caps, and granted resets are what its provider
  reports, which Manifold does not read.

Add account and Edit account are one 520px dialog:

- Kind: API budget or Subscription (fixed once the account exists).
- Name (fixed once the account exists, since usage and allocations name
  the account by it) and Provider.
- Used by: environments as checkboxes. A checked environment has one
  "Instance" input in mono, empty for none, and "Add instance" for an
  environment that runs more than one account of the provider. An
  instance another account already uses for this provider shows "Used
  by" and that account's name in error color, and Save is disabled; an
  unchecked environment another account uses with no instance shows
  "Used by" and that account's name muted. An account whose usage names
  more than one provider shows Used by read only, with "Edit its usage in
  accounts.yml."
- API budget: "Budget per window", "Window" (Monthly, Weekly, Daily, or
  Every N hours, days, or months), and "Resets on", a date and time.
- Subscription: "Usage limit per window", the operator's estimate of the
  provider's limit at API prices, "Window", and "Resets at", a reset the
  provider showed.
- Each finding marks the input it locates, with its message under it; the
  rest list in a Problems box above the footer. Save is disabled while
  there is a finding. A warning, such as a portfolio item that allocates
  to an account the edit archives, lists in warning color and does not
  disable Save.
- Edit has "Archive account" at the bottom left (error text, outline). It
  asks first in a 400px alert dialog that names each portfolio item that
  allocates to the account. Accounts are archived, never deleted, so past
  usage keeps its source.

### Environments

- Title row: "Environments", its description, and a ghost "Refresh" icon
  button. No primary action.
- Table columns: Environment, Status, Active threads, Scheduled threads,
  Actions. Environment is the name over the host, both mono, the host
  muted.
- Status uses the connection status: Connected, Connecting (the warning
  dot that pings), Disconnected, or Error with the error as a muted second
  line. A paused environment adds the warning badge "Paused" after the
  label.
- Active threads shows "—" for an environment that is not connected,
  because the count is not known. Counts are right-aligned with tabular
  numbers.
- Row actions, outline: Pause / Resume and Disconnect / Reconnect, each
  with its icon (`Pause`, `Play`, `Unplug`, `PlugZap`). No confirmation.
  The pressed button shows a spinner while its request runs, and both
  buttons of the row are disabled.
- Caption: "3 environments · 2 connected · 1 paused".
- Under the table, a card titled "Add or remove an environment" explains
  that environments live in the service configuration on the host: the
  steps to add and remove one, the configuration file's path in mono, and
  a read-only YAML example with a ghost copy button. There is no "Add
  environment" button and no "Forget" action, because the console does not
  write service configuration.
- With no environment, the table is replaced by the empty state "No
  environments", and the card stays.

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
- `StateNode`: a ReactFlow custom node for an atomic or final blueprint
  state.
- `AccountsContent`: the Accounts and budget sources section of Settings.
- `GroupNode`, `HistoryNode`, and `InitialNode`: ReactFlow custom nodes for
  a compound or parallel state, a history state, and an initial marker.
- `TransitionEdge`: a ReactFlow custom edge for a blueprint transition.
- `CanvasToolbar`: the blueprint canvas's toolbar.
- `Inspector`: the panel that edits the selected node or edge of a
  blueprint, one set of groups per node and edge type.
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
