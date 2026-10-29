---
name: work-babysit
description: "Work version of babysit: drives the PR to merge-ready the same way, but shows every review reply and resolved thread and waits for an OK before posting. Use instead of babysit in work repositories, or run /work-babysit."
compatibility: "Requires git and the gh CLI, authenticated (gh auth status). Watches checks with gh pr checks --watch as a background command on Claude Code."
metadata:
  version: "1.0"
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git log:*), Bash(git diff:*), Bash(git merge:*), Bash(git merge-base:*), Bash(git push), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh pr checkout:*), Bash(gh run view:*), Bash(gh run rerun:*), Bash(gh api:*), Read, Grep, Glob, Edit, Write
argument-hint: "[PR number or URL] [check | drive | threads]"
user-invocable: true
disable-model-invocation: true
---

# Work babysit

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Read `<dir>/../babysit/SKILL.md` and follow it with the configuration below in place of its
own; inside it, `<dir>` means that skill's own directory. Where it runs another skill, run that
skill's `work-` version when there is one.

## Configuration

- publish_approval: ask
