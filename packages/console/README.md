---
relationships:
  implements: operator-console
---

# Manifold operator console

The React console builds into static files under `/console/`. Run `task install`
to install dependencies and Chromium, then `task check` to verify the console
and its browser flow. The service's `mountConsole` mounts the static files and
operator-authenticated actors API. `DESIGN.md` defines the visual design.

The primitives in `src/ui` derive from T3 Code's MIT-licensed
`apps/web/src/components/ui` at commit `4ee6bfd50ef4a089440d5c3662db2298da9cc50e`.
Each copied primitive carries the upstream license. Imports use local modules.
The sidebar frame uses the declared fixed-width collapse behavior; upstream
resizing, mobile sheets, and Effect-backed persistence are outside this shell.
Dialog styles use the console's declared opaque surfaces and scrim.

Compare these primitives with the pinned source when adopting T3 Code changes.
The browser keeps theme, sidebar mode, and the operator token in localStorage.
The token is sent only in the API's Authorization header.
