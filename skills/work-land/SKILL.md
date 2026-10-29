---
name: work-land
description: "Work version of land: verifies and merges the PR the same way, but shows the ready flip, the comment and the merge and waits for an OK first. Use instead of land in work repositories, or run /work-land."
compatibility: "Requires git and the gh CLI, authenticated (gh auth status). Verifies with a subagent on Claude Code and inline elsewhere."
metadata:
  version: "1.0"
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git log:*), Bash(git worktree:*), Bash(git switch:*), Bash(git pull --ff-only:*), Bash(git branch -d:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh pr ready:*), Bash(gh pr comment:*), Bash(gh pr merge:*), Bash(gh repo view:*), Bash(gh api:*), Read, Grep, Glob, Agent
argument-hint: "[PR number or URL]"
user-invocable: true
disable-model-invocation: true
---

# Work land

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Read `<dir>/../land/SKILL.md` and follow it with the configuration below in place of its
own; inside it, `<dir>` means that skill's own directory. Where it runs another skill, run that
skill's `work-` version when there is one.

## Configuration

- publish_approval: ask
