---
name: work-deep-review
description: "Work version of deep-review: reviews with the same reviewers, with the repo's .claude/conventions.md as the house rules every reviewer reads, leaving RuboCop, ESLint and security to tooling. Use instead of deep-review in work repositories, or run /work-deep-review."
compatibility: "Requires git; the gh CLI (authenticated) for PR mode and for posting. Fans out to subagents on Claude Code and runs the same reviewers inline elsewhere. Reads no config file."
metadata:
  version: "1.0"
allowed-tools: Bash(git fetch:*), Bash(git diff:*), Bash(git symbolic-ref:*), Bash(git status:*), Bash(git branch:*), Bash(git switch:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checkout:*), Bash(gh repo view:*), Bash(mkdir:*), Read, Grep, Glob, Agent, AskUserQuestion
argument-hint: "[<PR number | PR url> | --branch] [--only <glob,…>] [--reviewer <name>] — default: auto-detect (PR arg → that PR; otherwise current branch vs its base)"
user-invocable: true
disable-model-invocation: true
---

# Work deep review

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Read `<dir>/../deep-review/SKILL.md` and follow it with the configuration below in place of
its own; inside it, `<dir>` means that skill's own directory. Where it runs another skill, run
that skill's `work-` version when there is one.

## Configuration

- review_owned_by_tooling: RuboCop style; ESLint style; deep security
- review_conventions: .claude/conventions.md
