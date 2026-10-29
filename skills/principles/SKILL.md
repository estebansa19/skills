---
name: principles
description: "Named engineering principles, one rule each with when it applies: four everyday habits (measure the number, design it twice, label the evidence, look for the same problem elsewhere) plus rules for scope, architecture, verification and working without blocking. Loaded by code-style and god-mode; load it before planning, building or reviewing a change. The user steers with a principle's name."
metadata:
  version: "1.0"
user-invocable: false
---

# Principles

Each entry gives a name, when it applies, and the rule in one line. Before you apply one, read its
full rule in the linked file.

**Cite what you applied.** In your report, name each principle that changed a decision, and the
decision it changed. Cite only principles whose full rule you read this session. A principle with
no decision behind it was not applied.

**Steering.** When the user names a principle ("apply prove it works"), read its full rule and redo
the step it governs.

## Habits: every change

- [Measure the Number](references/measure-the-number.md). The request rests on a quantity. Find
  its real value and the limit it runs into before choosing a fix; measure again after.
- [Design It Twice](references/design-it-twice.md). The change has more than one reasonable shape.
  Write down two whole designs with how each fails before building one.
- [Label the Evidence](references/label-the-evidence.md). Every claim you report. Say whether it
  was measured, read or inferred.
- [Look for the Same Problem Elsewhere](references/look-for-the-same-problem-elsewhere.md). You
  fixed a problem. Check the code that shares its pattern; report what is outside your change.

## Core

- [Never Block on the Human](references/never-block-on-the-human.md). Tempted to ask about
  reversible work. Proceed and present; pause only for irreversible or outward-facing actions.
- [Laziness Protocol](references/laziness-protocol.md). Sizing a diff or tempted to add layers.
  The smallest change that solves the problem.
- [Foundational Thinking](references/foundational-thinking.md). Before writing logic. Get the data
  structures right first; scaffold before features.
- [Redesign from First Principles](references/redesign-from-first-principles.md). Integrating a new
  requirement. Redesign as if it had been there from day one instead of bolting it on.
- [Attack the Premise](references/attack-the-premise.md). Two or more fixes on one premise failed
  the same check. Write the premise down and test it before the next fix.
- [Subtract Before You Add](references/subtract-before-you-add.md). Sequencing an addition or
  rewrite. Remove dead weight first, then build on the simpler base.
- [Minimize Reader Load](references/minimize-reader-load.md). Code that is hard to trace. Count
  layers and hidden state; collapse one-caller wrappers.
- [Outcome-Oriented Execution](references/outcome-oriented-execution.md). A planned rewrite or
  migration with phases. Converge on the target; no throwaway compatibility states.
- [Experience First](references/experience-first.md). A scope or UX tradeoff. Choose the user's
  experience over implementation convenience.
- [Build the Lever](references/build-the-lever.md). Non-trivial edits, migrations or checks. Build
  the script that does or proves the work, so a reviewer can rerun it.

## Architecture

- [Model the Domain](references/model-the-domain.md). Stateful or branchy logic. Encode the domain
  in a structure (state machine, typed model, table) instead of scattered conditionals.
- [Boundary Discipline](references/boundary-discipline.md). Validation and error handling.
  Guard at system boundaries, trust internal types, keep business logic pure.
- [Type System Discipline](references/type-system-discipline.md). Designing types or signatures.
  Make illegal states unrepresentable; parse external data at the boundary.
- [Make Operations Idempotent](references/make-operations-idempotent.md). Commands or loops that
  can crash and retry. Converge to the same end state on every run.
- [Migrate Callers Then Delete Legacy APIs](references/migrate-callers-then-delete-legacy-apis.md).
  A new internal API with old callers. Migrate and delete in one wave.
- [Separate Before Serializing Shared State](references/separate-before-serializing-shared-state.md).
  Concurrent writers to one file, key or branch. Remove the sharing before adding locks.

## Verification

- [Prove It Works](references/prove-it-works.md). Before saying done. Check the real artifact, not
  a proxy, a self-report or "it compiles".
- [Fix Root Causes](references/fix-root-causes.md). Debugging. Trace the symptom to the first wrong
  decision and fix it there.
- [Sequence Verifiable Units](references/sequence-verifiable-units.md). Multi-step work and commit
  order. Small units, each ending in a check; the failing test lands before the fix.
- [Test Behavior, Not Implementation](references/test-behavior-not-implementation.md). Writing or
  keeping a test. Assert what users of the code can observe.
- [Explain the Number](references/explain-the-number.md). About to trust or report a measured
  number. Name what limits it and rule out that it measured something else.

## Delegation and meta

- [Guard the Context Window](references/guard-the-context-window.md). Large outputs or fan-out.
  Send bulk to subagents; keep summaries in the main thread.
- [Encode Lessons in Structure](references/encode-lessons-in-structure.md). Writing the same
  instruction a second time. Make it a lint, check, test or script instead.
