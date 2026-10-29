---
name: work-god-mode
description: "Work version of god-mode: the same front door for any non-trivial task, with every step that runs a skill running its work version where there is one (work-commit, work-create-pr, work-babysit, work-land, work-deep-review). Use for /work-god-mode followed by the task in plain words."
metadata:
  version: "1.0"
allowed-tools: Read, Grep, Glob, Agent
argument-hint: "[the task, in your own words]"
user-invocable: true
disable-model-invocation: true
---

# Work god mode

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Read `<dir>/../god-mode/SKILL.md` and follow it; inside it, `<dir>` means that skill's own
directory. Where it runs another skill, run that skill's `work-` version when there is one.
