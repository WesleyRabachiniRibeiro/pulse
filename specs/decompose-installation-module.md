# Decompose the installation module

status: todo
created: 2026-09-10

## Goal
`electron/modules/installation/installation.service.ts` (943 lines, zero test coverage) mixes winget process execution, the install retry ladder, the uninstall flow, and browser-default post-processing in one file — and spawns OS processes (`winget`, `taskkill`) directly instead of through the module's own `infrastructure/` folder. `src/features/installation/components/Installation/Installation.tsx` has one ~205-line function mixing state derivation with rendering. Decompose both into focused, single-responsibility units that a human can read function-by-function, and make the existing "only `infrastructure/` talks to the OS" convention (already enforced for PowerShell) also cover process spawning here — all with no observable behavior change.

## Context
- Files/modules this touches:
  - `electron/modules/installation/installation.service.ts` (primary target)
  - `electron/modules/installation/infrastructure/` (destination for extracted process-spawning code — `asAdmin.ts`, `asUser.ts`, `autostart.ts`, `steamWindows.ts` already live here as prior art)
  - `src/features/installation/components/Installation/Installation.tsx`
  - `src/features/installation/lib/` and/or new sibling component folders (destination for extracted logic/subcomponents)
  - `eslint.config.js` (new override block)
  - `shared/architecture.test.ts` (new boundary check, same style as the existing one)
- Existing patterns/interfaces to follow:
  - CLAUDE.md: `infrastructure/` is where a module talks to Windows; a service asks for data, doesn't know where it came from. This convention already exists in this exact module for PowerShell (`asAdmin.ts`, `asUser.ts`) — extend it to also cover `node:child_process` spawning of `winget`/`taskkill`, which today happens directly in `installation.service.ts`.
  - `shared/architecture.test.ts`'s existing test `'só a infraestrutura de um módulo chama o PowerShell'` (import-graph walk, no regex-on-source) is the pattern to mirror for the new child-process boundary check — add a parallel `it(...)`, don't invent a new mechanism.
  - Renderer: `QueueItem/` and `Stages/` are already separate `Component/` folders (each with its own `.tsx`, `.module.css`, `index.ts`) sitting next to `Installation/` — new subcomponents extracted from `Installation.tsx` follow that same folder shape.
  - `headline()` and `phase()` in `Installation.tsx` are already pure, exported-from-module functions with no JSX — the group-derivation logic (the `groups` array built inline in the component body) should be extracted the same way.
- Product & decision docs: none — this is a technical refactor, no PRD.
- Design & conventions: `CLAUDE.md` (English identifiers/filenames, no code comments, PT-BR screen text, `Component/` folder shape, `eslint-plugin-boundaries` entry-point rule).
- Tests: `npm test` (vitest), `npm run typecheck`, `npm run lint` (`npm run build` chains all three). No test file exists today for `installation.service.ts` or for anything under `src/features/installation/**`. No `@testing-library/react`/`jsdom` dependency exists in this repo — do not add one (see Decisions & assumptions).

## Acceptance criteria
- The system shall have no non-test file under `electron/modules/installation/**` or `src/features/installation/**` exceeding 300 lines, enforced by an eslint `max-lines` rule.
- The system shall have no function under `electron/modules/installation/**` or `src/features/installation/**` exceeding 40 lines, enforced by an eslint `max-lines-per-function` rule.
- The system shall have no function under `electron/modules/installation/**` or `src/features/installation/**` with cyclomatic complexity greater than 10, enforced by an eslint `complexity` rule.
- These three eslint rules shall be added as an override scoped to `electron/modules/installation/**` and `src/features/installation/**` only, so `npm run lint` continues to pass with zero new violations in every other module.
- Where code under `electron/modules/installation/**` spawns an OS process (`winget`, `taskkill`) or otherwise talks directly to the operating system, the system shall confine that code to files under `electron/modules/installation/infrastructure/`, verified by a new test in `shared/architecture.test.ts` mirroring the existing PowerShell boundary check.
- Before any restructuring of `installation.service.ts`, the system shall have characterization tests (written first, against current behavior, per the mandatory TDD flow) covering: drive-refusal retry, scope-refusal retry, locale-refusal retry, the MSI-busy retry loop, the admin-permission wait/grant/deny flow, cancellation of the whole queue and of a single item, the `PARALLEL_LIMIT` concurrency cap, and the uninstall flow (winget success, winget failure falling back to the program's own uninstaller, the "package not installed" case, and the "verified vs. unverified disappearance" distinction).
- When the decomposition is complete, the system shall preserve all current observable behavior of the installation module — no functional change — demonstrated by the characterization tests above and `shared/architecture.test.ts` all passing unmodified in intent (only the new boundary test is new).
- The system shall extract the group-derivation logic currently inline in `Installation.tsx`'s render body into an exported, independently unit-tested pure function (input: a `Run`; output: the same grouped/filtered structure), following the existing `headline()`/`phase()` pattern — tested with plain vitest, no DOM rendering.
- Where `Installation.tsx`'s JSX is split into subcomponents, each new subcomponent shall live in its own `Component/` folder (matching `QueueItem/`, `Stages/`) and shall be covered by typecheck only — no render tests are required, since no React component-testing infrastructure exists in this repo and none is being added by this spec.
- The system shall keep `npm run build` (lint + typecheck + test + bundle) passing after the decomposition.

## Constraints
- Pure refactor: no behavior change, no new features, no change to any user-facing (PT-BR) screen text or log message text.
- No new runtime or dev dependencies — in particular, do not add `@testing-library/react`, `jsdom`, `happy-dom`, or any DOM-rendering test tool.
- Follow `CLAUDE.md`: English identifiers/filenames, no code comments (including ones explaining the refactor decision), `Component/` folder shape for any new component.
- The new eslint rules apply only within the two override globs above — do not raise them repo-wide as part of this spec.

## Out of scope
- `electron/modules/installation/steps/*` and `shared/domain/steps/*` — already one file per tweak, not flagged as oversized or overly complex.
- `electron/modules/installation/ssh.ts`, `shortcuts.ts`, `steam.gate.ts`, `launch.ts`, `editor.ts`, `history.service.ts`, `installation.handlers.ts` — not touched unless a function they call is moved and the import needs updating; no internal restructuring of these files.
- Any other module flagged by the earlier codebase survey (`electron/modules/preflight`, `steam`, `catalog`, `src/features/selection`, `src/features/manage`) — future specs, not this one.
- Introducing `@testing-library/react`, `jsdom`, or any component-render testing infrastructure.
- Renaming Portuguese identifiers/filenames to English, removing code comments repo-wide, splitting history into stacked PRs, or i18n work — separate items already queued (see project history), not part of this spec.
- Raising the new eslint thresholds (300/40/10) repo-wide — this spec pilots them on one module only.

## Decisions & assumptions
- Numeric readability thresholds (engineer's decision): 300 lines per file, 40 lines per function, cyclomatic complexity ≤ 10 — enforced as eslint errors, scoped to this module via an override, not applied repo-wide yet.
- Scope (engineer's decision): covers both `electron/modules/installation` and `src/features/installation` in this one spec, even though `Installation.tsx` (256 lines) sits under the file-length threshold — its single ~205-line render function violates the function-length threshold on its own.
- Characterization tests before restructuring (engineer's decision): mandatory. `installation.service.ts` has no existing tests, so behavior-preserving characterization tests must exist before any code is moved or split.
- Renderer test strategy (engineer's decision): extract and unit-test pure logic only (no component-rendering tests); do not introduce new testing dependencies. New subcomponents get typecheck coverage, not render tests.
- (Investigated fact) `shared/architecture.test.ts` and `eslint-plugin-boundaries` currently pass with zero violations app-wide — the "layers not respected" problem is about separation of concerns *within* files, not cross-module boundary breaches; no existing cross-module violation needs fixing.
- (Investigated fact) No `eslint` size/complexity rule (`max-lines`, `max-lines-per-function`, `complexity`) exists anywhere in this repo today; this spec introduces the first one, as a pilot on this module.
- (Investigated fact) Before drafting this spec, an accidental uncommitted change was found in the working tree (`CLAUDE.md` emptied to 0 bytes, plus a partial `shared/` reorganization) — unrelated to this spec, confirmed as accidental by the engineer, and restored to HEAD via `git stash` (preserved at `stash@{0}` in the main checkout) before this worktree was created.
