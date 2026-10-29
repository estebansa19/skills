# Frontend Review Checklist

Component design, correctness, accessibility and test quality for client-side code. Mechanical
style belongs to the linter; cross-cutting design belongs to the architecture reviewer.

**Identify the framework and its version from `package.json` before applying any of this**, and
read 2–3 neighbouring components. React, Vue, Svelte, Angular and plain DOM have different
correctness rules, and even one framework differs across major versions. A house convention
written in a `CLAUDE.md` / `AGENTS.md` / conventions doc — including a scoped one inside the
touched folder — **wins outright**.

Severity: **blocking** (breaks users, leaks, XSS) · **should-fix** · **nit**.

---

## 1. Placement and conventions

- **New code added to a directory the repo has marked legacy or deprecated.** Check for a note in
  the folder's own docs or a lint rule. Adding to a directory the team is trying to empty is a
  design flag, not a nit. *should-fix → blocking* where the repo says so explicitly.
- **A component placed outside the layering the repo uses** (design-system / feature / shared /
  utility, or whatever it calls them). *should-fix.*
- **Declaration style inconsistent with siblings** — the repo's own choice of function vs arrow
  component, default vs named export, file naming. Follow the neighbours. *nit.*
- **A new global store slice / reducer / selector / context** where the repo has moved to
  something else (server-state library, local state, signals). *should-fix → blocking* when the
  repo bans it.
- **Import conventions** — deep vs barrel imports where the repo has a rule (bundle size), a
  library the repo has replaced with a wrapper (a date/time helper that carries the app's
  timezone, an HTTP wrapper that carries auth). Using the raw library instead of the wrapper is a
  correctness bug, not a style preference. *should-fix.*

## 2. Effects, lifecycle and state

- **Wrong dependency list on an effect** — a missing dep (stale closure, the bug that "only
  happens the second time") or an over-broad one (re-runs every render). *should-fix → blocking.*
- **No cleanup** for a listener, timer, subscription, observer, or in-flight request. This is a
  real leak and it fires after unmount. *blocking.*
- **State derived into state** — a value copied into local state that could be computed during
  render, then drifting from its source. *should-fix.*
- **An effect used for something that is not synchronisation with an external system** —
  transforming props, handling an event. *should-fix.*
- **Uncontrolled ↔ controlled input switch** — `value` starting `undefined` then becoming a
  string. The framework warns; the field misbehaves. *should-fix.*
- **Mutating props, state, or a store object in place.** *blocking.*
- **A missing or index-based `key` on a rendered list** whose items reorder or are removed —
  wrong item state after a change. *should-fix.*

## 3. Correctness and security

- **Unsanitized HTML injection** — `dangerouslySetInnerHTML`, `v-html`, `innerHTML` with anything
  derived from user or API data. *blocking.*
- **Unhandled promise / missing response-status check** — a `fetch` whose `res.ok` is never
  checked, or a `.then` with no `.catch`. Failure renders as a blank component. *should-fix.*
- **No loading and error states** for new async data. The empty state is a real state. *should-fix.*
- **A link or navigation built by string concatenation** with unescaped user data. *should-fix.*
- **`target="_blank"` without `rel="noopener"`** on older targets. *nit.*
- **Secrets or internal endpoints in client code.** Everything shipped to the browser is public.
  *blocking.*

## 4. Types

- **`any`, `unknown` cast away, or untyped data at an API boundary.** The boundary is exactly
  where types earn their keep. *should-fix.*
- **A non-null assertion (`!`) or a cast standing in for a real check.** *should-fix.*
- **Check what the type checker actually covers**: if it runs separately from the linter, or in a
  permissive mode (`strict: false`), **type quality is yours to catch**, not the linter's.

## 5. Accessibility

- **A new interactive element that is not keyboard reachable or operable** — a `div` with a click
  handler and no role, `tabindex`, or key handler. *should-fix → blocking* on a primary flow.
- **An input with no associated label**, or an icon-only button with no accessible name. *should-fix.*
- **Focus not managed** when a modal/drawer/menu opens and closes. *should-fix.*
- **Meaning carried by color alone**, or text below contrast minimums. *nit → should-fix.*
- **A new image with no `alt`** (empty `alt=""` is correct for decorative). *should-fix.*

## 6. Tests

- **New behavior with no test**, or a bug fix with no test that fails without it. *should-fix.*
- **Tests asserting implementation rather than what a user sees** — reaching into component
  internals or state instead of querying rendered output. *should-fix.*
- **Queries that don't reflect how the element is found by a user** — brittle test-id or CSS
  selectors where a role or label query exists. *nit.*

## 7. Stay out of the linter's lane

Do not re-flag quotes, semicolons, import order, or line length — nor anything the orchestrator
listed in `owned_by_tooling`.

---

## Sources
- React: You Might Not Need an Effect — https://react.dev/learn/you-might-not-need-an-effect
- Rules of Hooks — https://react.dev/reference/rules/rules-of-hooks
- Testing Library guiding principles — https://testing-library.com/docs/guiding-principles
- WAI-ARIA Authoring Practices — https://www.w3.org/WAI/ARIA/apg/
- OWASP DOM-based XSS prevention — https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
