# Backend Review Checklist

Server-side conventions, correctness, performance, and test quality. Cross-cutting design
(SOLID, god objects, pattern fit) belongs to the architecture reviewer.

**Read the repo before applying any of this.** Identify the language, framework and version
from the manifest, and read 2–3 files neighbouring the changed ones. Every rule below is
subordinate to what this codebase already does — a house rule written in `CLAUDE.md` /
`AGENTS.md` / a conventions doc **wins outright**.

Severity: **blocking** (correctness/data/security) · **should-fix** (real cost) · **nit**.

---

## 1. Input and boundaries

- **Unvalidated input reaching a query, a filesystem path, a shell command, or a template.**
  Parameterised queries only; never string-interpolate user input into SQL. *blocking.*
- **Mass assignment** — a whole params/body hash handed to a create/update without an allowlist,
  letting a caller set fields the endpoint never intended (`role`, `account_id`, `verified`).
  *blocking.*
- **Missing authorization on a new endpoint or a new branch of an existing one.** Authentication
  is not authorization: check the object-level check exists, not just "is logged in". *blocking.*
- **Type/shape assumptions at a boundary** — assuming a key exists, a list is non-empty, or an
  external response has a field. Name the input that breaks it. *should-fix.*

## 2. Data access and performance

- **N+1 queries** — a query inside a loop or inside a serializer/presenter walking a collection.
  Cite the loop and the query. Preload/join/batch instead. *should-fix* (*blocking* on a hot path
  or an unbounded collection).
- **Unbounded result sets** — a fetch with no limit or pagination over a table that grows.
  *should-fix.*
- **Work done per-row that could be done in one statement** — a backfill or bulk update looping
  in application code. *should-fix.*
- **Missing index for a new query pattern** — a new filter/sort/join on an unindexed column.
  Flag it here; migration mechanics belong to the database reviewer. *should-fix.*
- **A query that ignores the repo's required scoping** — tenancy, partition, or shard keys that
  every other query in this codebase carries. Read the neighbours to see what is required.
  *blocking* when present in the repo's conventions.

## 3. Correctness and state

- **Related writes with no transaction** — two or more writes that must both land, or neither.
  A failure between them leaves inconsistent data. *blocking.*
- **External side effects inside callbacks/hooks/signals** — an HTTP call, email, or job enqueued
  from a model lifecycle hook. It fires inside the transaction, on every code path that saves,
  and in tests. Move it to the caller. *should-fix.*
- **Swallowed exceptions** — `rescue nil`, bare `except: pass`, empty `catch`. If it is truly
  ignorable, say why in a comment; otherwise handle or re-raise. *should-fix.*
- **Nil/None/empty handling** — a method that can return nothing whose callers assume a value;
  a default that silently masks a failure. *should-fix.*
- **Non-idempotent job or endpoint that will be retried** — retries are a fact of the runtime;
  a double-charge or double-send is a real bug. *blocking.*
- **Time and money** — naive local time where the domain needs a zone or UTC; floats for money.
  *should-fix.*
- **Concurrency** — a read-then-write with no lock or atomic operation where two requests race.
  Name the interleaving. *blocking* when it corrupts data.

## 4. API and compatibility

- **A public signature, response field, or serialized shape changed without its callers.**
  `grep` for the callers before accepting it. *blocking* if consumers are external.
- **A new required field or stricter validation applied to existing data.** What happens to rows
  that already violate it? *should-fix → blocking.*
- **Error responses that leak internals** — a raw exception message, stack trace, or SQL in a
  response body. *should-fix.*

## 5. Tests

- **A bug fix with no test that fails without it.** This is the single highest-value catch in
  this checklist. *should-fix → blocking* for a regression that already reached production.
- **New behavior with no test of its edge cases** — only the happy path covered.
- **Tests asserting implementation, not behavior** — mocking the thing under test, asserting a
  private method was called. They pass while the feature breaks. *should-fix.*
- **Non-deterministic tests** — real time, real network, ordering dependence, unseeded randomness.
  A frozen-time helper called without an explicit value is a common flake source. *should-fix.*
- **Over-mocked tests** that would pass if the collaborator's contract changed. *nit → should-fix.*

## 6. Stay out of the linter's lane

Do not re-flag formatting, spacing, quote style, line length, or import order — nor anything
the orchestrator listed in `owned_by_tooling`. Check the repo's actual linter config before
calling something a violation: **do not impose a stricter style than the repo enforces on itself.**

---

## Sources
- OWASP Top 10 — https://owasp.org/www-project-top-ten/
- Rails security guide — https://guides.rubyonrails.org/security.html
- Google engineering practices, code review — https://google.github.io/eng-practices/review/
