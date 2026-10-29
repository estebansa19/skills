# Architecture & Design Review Checklist

Read the change as **one design decision**, not a pile of files. Your job is the judgment a
linter can never make: *was this the right, coherent, smallest solution, and does it fit this
codebase?* Language-specific idioms belong to the other reviewers — you own cross-cutting design.

Severity: **blocking** (correctness/safety) · **should-fix** (design smell / real maintenance
cost) · **nit** (author's call). Thresholds below are **heuristics to investigate, not gates** —
flag only when the smell has a concrete cost, and cite it.

---

## 0. The core questions (ask these first, every time)

- **What problem does this change actually solve?** State it in one sentence. If the diff does
  more than the stated problem needs, the extra is a finding (scope creep / speculative work).
- **Is this the simplest coherent solution?** Is there a **smaller solution that sacrifices
  nothing** — fewer objects, fewer branches, reusing something that already exists? If yes,
  that's a `should-fix` with the smaller alternative sketched. *(simpler-alternative)*
- **Does it fit the existing design?** Work out what layering this repo already uses — read the
  directory structure and the neighbours of each changed file. Does the change put logic in the
  layer the codebase already uses for that kind of logic, or bolt on a parallel/ad-hoc pattern?
  Inconsistency with established patterns is a `should-fix` even when the code "works".
  *(pattern-fit / coherence)*
- **Is the abstraction right-sized?** Under-engineered (copy-paste, primitives everywhere) and
  over-engineered (indirection, config, or "flexibility" nobody asked for) are both smells.
- **Would a senior engineer here call this overcomplicated?** If yes, say why and how to cut it.

## 1. SOLID

- **SRP** — a class/module with a name containing "and", or methods that split into groups
  touching disjoint state (persistence + formatting + HTTP). Multiple reasons to change → fragile
  edits, merge conflicts. Method-level: a method that both *computes* a value and *does I/O* can't
  be tested without the side effect. *should-fix.*
- **OCP** — a `case`/`if`/`switch` on a type/`kind`/`status` that recurs in several places, where
  adding a variant means editing every branch. Prefer polymorphism or a registry. *should-fix.*
- **LSP** — a subclass that overrides to raise "not implemented", returns `nil`/`None` where the
  parent returns a collection, or narrows accepted args. Substitution breaks callers. *blocking.*
- **ISP** — a collaborator passed in but only one of its many methods used; a module mixed in for
  one method dragging unrelated behavior. Fat interfaces couple clients to what they don't need.
  *nit → should-fix.*
- **DIP** — a domain/business object instantiating a concrete external client
  (an HTTP client, a gateway, a cache connection) inline instead of receiving it. Blocks testing
  and swapping. Inject the collaborator. *should-fix.*

## 2. Object design & code smells

- **God object / large class** — a class much larger than its neighbours, or ~10+ public methods;
  the module everything reaches into. High-churn hotspot. Investigate extraction; don't fail
  purely on line count. *should-fix.*
- **Long method** — meaningfully longer than a handful of lines with multiple responsibilities /
  deep nesting; hides branches and intent. *nit → should-fix.*
- **Long parameter list / data clump** — > ~4 positional args, or the same 2–3 params travelling
  together everywhere (`start_date, end_date`) — a missing object. Prefer keyword args or a value
  object. *should-fix / nit.*
- **Primitive obsession** — money as a float, state as a bare string, validation-heavy strings
  passed raw; logic/validation duplicates wherever the primitive goes. *should-fix.*
- **Feature envy / inappropriate intimacy** — a method that reaches repeatedly into another
  object's data to decide something (behavior in the wrong class), or a class touching another's
  internals. Move behavior to the data. *should-fix.*
- **Law of Demeter (train wrecks)** — `a.b.c.d`; couples the caller to the whole object graph.
  Delegate or add an intention-revealing method. *should-fix* (nit for view/params chains).
- **Shotgun surgery / divergent change** — one logical change edits many unrelated files, or one
  file changes for many unrelated reasons → responsibilities are mis-located. *should-fix.*
- **Duplication of existing capability** — the change reimplements something the codebase already
  provides (a service, module, helper, scope). Reuse it. Search before accepting new code.
  *should-fix.*
- **Entry point doing too much** — a controller action / handler / route instantiating and
  mutating several models or holding branching business logic; the domain layer should own it.
  *should-fix.*

## 3. Coherence & "was this the right solution"

- **Naming reveals intent** — classes/methods/variables named for *what they do*, not vague
  `Manager`/`Handler`/`data`/`info`/`process`. A wrong name is a design smell (it hides the real
  responsibility). *nit → should-fix.*
- **One change, one idea** — the diff should tell a single coherent story. Unrelated refactors
  mixed into a feature change hide risk and bloat review. Call them out. *nit.*
- **Consistency with siblings** — does a new service/domain object mirror the shape of its
  neighbors (the local convention — an initializer plus a single entry method, a handler
  signature, whatever the repo does)? Divergence for no reason costs future readers. *should-fix.*
- **Error/edge handling matches the domain** — swallowed exceptions (`rescue nil`, bare
  `except: pass`, empty `catch`), missing handling of the empty/null/failure case, or handling of
  impossible cases (dead defensive code). *should-fix.*

## 4. Backstop pass (files no other reviewer owns)

For each changed `*.yml`/`*.yaml`/`*.json`/`*.toml`/`Dockerfile`/`*.sh`/`config/**`/build file/
CI workflow/docs: sanity-check for correctness, an **obvious** security/secret issue (hardcoded
credential, secret committed, permissive config, an unpinned or newly-added third-party action),
and coherence with the rest of the change. Don't deep-lint; catch the things that would actually
bite. *blocking* for a committed secret; else *should-fix / nit*.

---

## Sources
- Sandi Metz' Rules for Developers — https://thoughtbot.com/blog/sandi-metz-rules-for-developers
- Refactoring code smells catalog — https://refactoring.guru/refactoring/smells
- thoughtbot Ruby Science — https://thoughtbot.com/ruby-science/
- Law of Demeter — https://avdi.codes/demeter-its-not-just-a-good-idea-its-the-law/
