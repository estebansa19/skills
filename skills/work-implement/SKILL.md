---
name: work-implement
description: "Ticket-to-implementation pipeline for work tickets, with two approval gates: fetches the Jira ticket and its governing constraints, writes a Scope Contract naming the non-goals, audits the repo's conventions against real files with an evidence line per claim, writes a proposal for approval, then builds it with a capped test-fix loop. Reach for this over work-debug-escalation when adding behaviour rather than chasing a defect. Use when asked to 'implement EE-1234', 'build this ticket', 'take this from ticket to PR', or run /work-implement."
compatibility: "Requires git and the repo's test runner. Fetches tickets through the Atlassian MCP when it is connected and takes a plain-text description otherwise. Runs the convention audit in parallel subagents on Claude Code and inline elsewhere."
metadata:
  version: "3.0"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Grep, Glob, Edit, Write, Agent, AskUserQuestion
argument-hint: "[ticket key | ticket URL | ticket description | path to a proposal]"
user-invocable: true
disable-model-invocation: true
---

# Implement a ticket

Eight phases, two gates. Don't skip a phase, and don't pass a gate without the user's explicit
OK. Keep your messages short; the proposal file carries the detail.

Track the phases as a checklist (your task list, where the harness has one) and tick each off
as it ends:

```
- [ ] 1 Requirements        - [ ] 5 Approval (gate 2)
- [ ] 2 Scope (gate 1)      - [ ] 6 Implementation
- [ ] 3 Convention audit    - [ ] 7 Test-fix loop
- [ ] 4 Proposal            - [ ] 8 Report and hand-off
```

## Phase 1 — Requirements

Load the ticket from the arguments:

- **A ticket key or Jira URL:** fetch it through the Atlassian MCP, resolving the cloud id with
  its resources tool first: summary, description, status, type, labels and comments. If the MCP
  isn't connected, ask for the ticket text.
- **Plain text:** use it as the requirements.
- **A path to a proposal:** resume at Phase 6 with it.
- **Nothing:** ask for a key, a URL or a description.

If the description is thin, ask whether the user wants to add context.

Then follow the ticket's trail: its links, parent and epic, and any RFC or design doc they point
to. Collect every explicit invariant ("X must be blocked", "Y is immutable") into a **Governing
Constraints** list. If the domain has modes or states, find where the code defines them and which
transitions are legal. If the ticket contradicts a constraint, stop and ask.

## Phase 2 — Scope Contract (gate 1)

Write:

- **In scope:** one line per acceptance criterion, as behaviour.
- **Non-goals:** what a straightforward implementation would likely add but the ticket doesn't
  ask for, especially reusing a create form or component on an edit path, and fields the ticket
  mentions only in passing. Say why each one is excluded.
- **Invariants:** from the Governing Constraints.
- **Deliverables:** every file to create or modify, tagged with its type in this repo's
  vocabulary (`CREATE app/presenters/ui/foo_presenter.rb [presenter]`).

Ask whether the scope, non-goals included, matches their intent and whether a file is missing.
Wait.

## Phase 3 — Convention audit

Audit each file type in the deliverables in its own subagent, all in parallel
(`subagent_type: general-purpose`), or inline one type at a time when subagents aren't
available. Each audit:

1. Searches the whole directory family for that type (`app/presenters/**/*.rb`, not just the
   target namespace, whose files are often the non-standard ones).
2. Reads two or three real files of that type, recently modified ones first.
3. Extracts the pattern: base class, includes, method shape, naming, placement, and any gate the
   type always carries (feature flag, authorization, shard scoping).
4. Checks `.claude/conventions.md`, `CLAUDE.md` and any scoped `CLAUDE.md` in the touched
   folders. A written rule beats an observed sample.
5. Returns `key: value` with an evidence line (`path/to/file.rb:47`) per claim, and drops any
   claim it can't back.

Combine the results into a **Conventions Confirmed** list, grouped by type, with the evidence.

## Phase 4 — Proposal

Write the proposal to `personal/<ticket-key>-proposal.md`, or ask for a name when there is no key:

1. **Context and scope**, including what is out of scope.
2. **Conventions verified:** the Phase 3 list.
3. **Deliverables:** for each file, the existing file it mirrors and a sketch of its structure
   (inheritance, includes, signatures), not full code.
4. **Testing:** for each test file, where it lives and its three most important scenarios.
5. **Risks:** anything that would surprise a reviewer.

Check it before showing it:

- Every deliverable has a section, and every pattern claim has Phase 3 evidence.
- List each capability the change newly allows (fields, options, transitions, API params). One
  that no acceptance criterion requires is scope creep: remove it or make it the user's call.
- For each new state or transition, check it doesn't break an invariant or orphan existing data.
  Any that does is a blocking risk; raise it.

## Phase 5 — Approval (gate 2)

Show the proposal and ask whether to implement it or change it first. Apply changes and ask
again until it is approved. On "not yet", give the file path: `/work-implement <path>` resumes at
Phase 6.

## Phase 6 — Implementation

Load the `code-style` skill. Work in dependency order: migrations, models, services,
controllers, views, tests.

- Write complete code with no stubs or TODOs, following the confirmed conventions rather than
  patterns from other codebases.
- Keep business logic in domain services (`initialize` + `call`), out of controllers and views.
- Run queries inside whatever scope the repo requires (a shard, a tenant), as the
  neighbouring code does.
- Run each migration right after writing it, with the repo's migrate command (from `CLAUDE.md`,
  `bin/` or `script/`; ask when none is documented).

If something goes wrong halfway (a migration fails, a pattern doesn't fit), stop. Say what is
already written and what already ran, since a migration that ran is not undone by deleting its
file. Offer the revert and wait.

## Phase 7 — Test-fix loop

Run the new tests with the repo's runner (a wrapper in `script/` or `bin/` first). On a failure,
find the exact cause, fix the implementation rather than the test, and re-run only what failed.
After three failed attempts, stop, report the failures with your diagnosis, and ask how to
proceed.

## Phase 8 — Report and hand-off

In a few lines: the files created or modified, the test results with example counts, and
anything still open. Then offer to commit with the `work-commit` skill and open the PR with
`work-create-pr`; run them only on a yes.
