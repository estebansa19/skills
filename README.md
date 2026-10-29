# skills

My day-to-day [Agent Skills](https://agentskills.io/specification), in one repo: installed as
one Claude Code plugin, with a prebuilt skills-only bundle for OpenCode.

The `god-mode` entry point, the `principles`, and the `how`, `why`, `teach`, `babysit` and
`land` skills are based on [pstack](https://github.com/cursor/plugins/tree/main/pstack),
modified to fit my requirements; its MIT notice is kept in the [LICENSE](./LICENSE).

> **This file is generated** by `.github/scripts/gen-readme.mjs` from the plugin manifest and
> the skill frontmatter. Edit those, not this file; CI fails on a diff.

## Install

One command, no login, no questions:

```bash
curl -fsSL https://raw.githubusercontent.com/estebansa19/skills/HEAD/install.sh | bash
```

For OpenCode, append `-s -- --opencode`.

The installer registers this repo as the `estebansa19` plugin marketplace with auto-update on
and installs the `core` plugin; Claude Code keeps it current from there. OpenCode gets only
the skill folders, from the `opencode` release CI rebuilds on every push to `master`.

Already in a Claude Code session? `/plugin install core --marketplace estebansa19/skills` installs it
too, with auto-update off until you turn it on under `/plugin` → **Marketplaces**.

Details: [docs/install.md](./docs/install.md).

## Skills

Everyday workflows for any repository: god-mode as the front door to build, commit, create-pr, babysit, land, deep-review, how, why and teach, plus the code-style rules and principles they share. The work-* skills add work tickets, escalation debugging and triage, and approval gates on anything that posts.

| Skill | What it does |
|---|---|
| [`/core:babysit`](./skills/babysit/SKILL.md) | Drives a GitHub PR to merge-ready: reads the merge state and failing CI logs, fixes what the diff broke, reruns a flake once, merges the base in when the branch is behind or conflicted… |
| [`/core:build`](./skills/build/SKILL.md) | Builds a change in the current repo or creates a new project. |
| [`code-style`](./skills/code-style/SKILL.md) | How to write and change code: state assumptions first, write the least code that works, touch only what the task needs, keep files small and readable with one-line comments, then verify… *(loaded by another skill, not typed)* |
| [`/core:commit`](./skills/commit/SKILL.md) | Commits the staged changes with a one-line Conventional Commits message, or a ticket-prefixed one (EE-1234: fix …) when the branch starts with a ticket key. |
| [`/core:create-pr`](./skills/create-pr/SKILL.md) | Drafts a GitHub pull request from the branch's commits and diff, fills the repo's PR template (or a short free-form body), and opens it as a draft PR, first waiting for approval when the… |
| [`/core:deep-review`](./skills/deep-review/SKILL.md) | Deep, design-aware code review of a GitHub PR or the current branch's diff vs its base. |
| [`/core:god-mode`](./skills/god-mode/SKILL.md) | The front door for any non-trivial task: restates the goal, matches the task to a playbook (investigation, learn, change, bug fix, refactor, review, ship, babysit, skill), copies its… |
| [`/core:how`](./skills/how/SKILL.md) | Explains how a subsystem works, for someone about to change it or new to it: what it is, the runtime flow, where things live and the gotchas. |
| [`/core:land`](./skills/land/SKILL.md) | Merges a GitHub PR once it is verified, without asking again: checks it is merge-ready (running babysit first when it is not), has a fresh agent that did not write the change verify the… |
| [`principles`](./skills/principles/SKILL.md) | Named engineering principles, one rule each with when it applies: four everyday habits (measure the number, design it twice, label the evidence, look for the same problem elsewhere) plus… *(loaded by another skill, not typed)* |
| [`/core:teach`](./skills/teach/SKILL.md) | Teaches a concept, a technology or a piece of code from scratch, assuming no prior knowledge: a plain definition first, then the idea built up one layer at a time with code snippets… |
| [`/core:why`](./skills/why/SKILL.md) | Finds out why code is the way it is: the design rationale, the tradeoff, the incident or request that shaped it. |

### Work

A `work-<name>` skill is the work version of `<name>`: it runs that skill with the work
settings in place of its own. The rest exist only at work.

| Skill | What it does |
|---|---|
| [`/core:work-babysit`](./skills/work-babysit/SKILL.md) | Work version of babysit: drives the PR to merge-ready the same way, but shows every review reply and resolved thread and waits for an OK before posting. |
| [`/core:work-commit`](./skills/work-commit/SKILL.md) | Work version of commit: commits the staged changes the same way and adds the work Co-authored-by trailer. |
| [`/core:work-create-pr`](./skills/work-create-pr/SKILL.md) | Work version of create-pr: drafts the PR the same way, links the ticket in the tracker the repo's PRs already link, and waits for an OK before pushing and opening it. |
| [`/core:work-debug-escalation`](./skills/work-debug-escalation/SKILL.md) | Disciplined 5-phase bug hunt for a production escalation: sets up a runnable feedback loop before touching code, reproduces the bug as a failing test, ranks hypotheses with evidence and… |
| [`/core:work-deep-review`](./skills/work-deep-review/SKILL.md) | Work version of deep-review: reviews with the same reviewers, with the repo's .claude/conventions.md as the house rules every reviewer reads, leaving RuboCop, ESLint and security to tooling. |
| [`/core:work-god-mode`](./skills/work-god-mode/SKILL.md) | Work version of god-mode: the same front door for any non-trivial task, with every step that runs a skill running its work version where there is one (work-commit, work-create-pr… |
| [`/core:work-implement`](./skills/work-implement/SKILL.md) | Ticket-to-implementation pipeline for work tickets, with two approval gates: fetches the Jira ticket and its governing constraints, writes a Scope Contract naming the non-goals, audits… |
| [`/core:work-land`](./skills/work-land/SKILL.md) | Work version of land: verifies and merges the PR the same way, but shows the ready flip, the comment and the merge and waits for an OK first. |
| [`/core:work-triage-escalations`](./skills/work-triage-escalations/SKILL.md) | Triage new escalation tickets that a bot posts in a Slack channel — poll the channel, extract each Jira key, classify the ticket (bug \| data-cleanup \| needs-info), analyze it, and draft… |

Agents: `core:review-architecture`, `core:review-backend`, `core:review-database`, `core:review-frontend`, `core:work-triage-analyst`.

## Layout

```
.claude-plugin/     marketplace.json and plugin.json: the repo root is the one plugin
skills/<name>/      every skill; work-* ones are work versions or work-only
agents/             every subagent the skills dispatch
install.sh          Claude Code by default, --opencode for OpenCode
.github/scripts/    check.sh, the validator, the OpenCode bundle builder, this README's generator
```

## Docs

- [Installing and updating](./docs/install.md) — both harnesses, this machine's live checkout
- [Writing a skill](./docs/authoring.md) — frontmatter policy, settings, agents, degradation rules
