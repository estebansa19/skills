---
name: code-style
description: "How to write and change code: state assumptions first, write the least code that works, touch only what the task needs, keep files small and readable with one-line comments, then verify and report briefly, applying the principles skill. Loaded by build, work-implement and work-debug-escalation before they write code; load it for any task that writes or edits code."
metadata:
  version: "1.0"
user-invocable: false
---

# Code style

The repo's own rules (`CLAUDE.md`, `AGENTS.md`, linter and formatter config) win over these.

Load the `principles` skill as well. Its four habits apply to every change; the rest apply when
their trigger fires.

## Before writing

- State what you are assuming. When the request can be read two ways, settle it by reading the
  code or running something. If that can't settle it, take the likelier reading, say which, and
  proceed. A calling skill's approval gate overrides this.
- If there is a simpler way than the one asked for, say so before building it.
- Decide how you will know it works (a test, a command, an expected output) before you start.

## Scope

- Write the least code that does the job: no options, layers or abstractions nobody asked for,
  and no handling for cases that cannot happen.
- Every changed line traces back to the request. Don't reformat, rename or refactor code you
  weren't asked to touch; mention what you noticed instead.
- Remove what your change made unused, and nothing else.
- Match the patterns and style of the code around you.

## Readability

- One file, one job. When a file starts mixing concerns or can't be taken in at a glance, split
  it by responsibility instead of growing it.
- Short functions at one level of abstraction; early returns over nested conditionals.
- Names say what a thing is or does, so it needs no comment. No `data`, `tmp`, `handle` or
  unexplained abbreviations.
- Comments explain why, never what, in one line. No banners, step-by-step narration, change
  history or commented-out code.
- No leftover debug output, and no TODO for work you could finish now.

## Before calling it done

- Re-read the diff as a reviewer would. If it could be half the size or reads as
  overcomplicated, simplify it.
- Run the checks you decided on.
- Report in a few plain lines what changed and how you verified it, plus a line per principle
  you applied, by name, with the decision it changed. No formal reports or long explanations;
  the user asks when they want more.
