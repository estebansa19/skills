---
name: work-commit
description: "Work version of commit: commits the staged changes the same way and adds the work Co-authored-by trailer. Use instead of commit in work repositories: 'commit this', 'commit my changes', or run /work-commit."
compatibility: "Requires git. Reads no config file."
metadata:
  version: "1.0"
allowed-tools: Bash(git branch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Read, AskUserQuestion
argument-hint: "[message — used verbatim]"
user-invocable: true
---

# Work commit

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Read `<dir>/../commit/SKILL.md` and follow it with the configuration below in place of its
own; inside it, `<dir>` means that skill's own directory. Where it runs another skill, run that
skill's `work-` version when there is one.

## Configuration

- commit_trailer: Co-authored-by: Claude <noreply@anthropic.com>
