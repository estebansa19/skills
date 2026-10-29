---
name: work-create-pr
description: "Work version of create-pr: drafts the PR the same way, links the ticket in the tracker the repo's PRs already link, and waits for an OK before pushing and opening it. Use instead of create-pr in work repositories: 'open a PR', 'create a pull request', or run /work-create-pr."
compatibility: "Requires git and the gh CLI, authenticated (gh auth status). Reads no config file."
metadata:
  version: "1.0"
allowed-tools: Bash(git symbolic-ref:*), Bash(git branch:*), Bash(git status:*), Bash(git fetch:*), Bash(git log:*), Bash(git diff:*), Bash(git push -u:*), Bash(gh repo view:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh pr create:*), Bash(gh pr edit:*), Read, Grep, Glob, AskUserQuestion
argument-hint: "[--draft]"
user-invocable: true
---

# Work create PR

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Read `<dir>/../create-pr/SKILL.md` and follow it with the configuration below in place of
its own; inside it, `<dir>` means that skill's own directory. Where it runs another skill, run
that skill's `work-` version when there is one.

## Configuration

- ticket_tracker_url: infer
- publish_approval: ask
