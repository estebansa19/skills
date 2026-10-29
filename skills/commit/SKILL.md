---
name: commit
description: "Commits the staged changes with a one-line Conventional Commits message, or a ticket-prefixed one (EE-1234: fix …) when the branch starts with a ticket key. When nothing is staged it stages the work at hand and names what it left out, and it reports a failing pre-commit hook instead of bypassing it. Use when asked to 'commit this', 'commit my changes', 'write a commit message', or run /commit."
compatibility: "Requires git. Reads no config file."
metadata:
  version: "3.0"
allowed-tools: Bash(git branch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Read, AskUserQuestion
argument-hint: "[message — used verbatim]"
user-invocable: true
---

## Configuration

- commit_trailer: none

## Steps

1. Run `git branch --show-current`, `git status --short` and `git diff --cached --stat`, then
   read the staged diff, file by file when it is large.
2. If nothing is staged, stage the changes that belong to the work at hand, or every tracked
   change when you can't tell, and never a file that looks like a secret or local config
   (`.env*`, keys, credentials). If only part of the tree is staged, commit just that. Either
   way, say in one line what you left out.
3. Write the message, unless the arguments give one to use verbatim:
   - The branch starts with a ticket key, alone or after a `type/` segment (`EE-1234-…`,
     `feat/ee-1234-…`): `EE-1234: fix duplicate welcome email`, with the key uppercased.
   - Otherwise Conventional Commits, `type(scope): summary`, with the type one of `feat`, `fix`,
     `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `style` or `revert`. Add a
     scope only when it names a real module, and `!` before the colon for a breaking change.
   - Lowercase imperative summary, under 72 characters, no trailing period. Say what changed,
     not how.
   - One line. Add a single body line only for a fact the diff cannot show, such as a
     constraint that forced the approach.
4. Commit with `git commit -m`. If `commit_trailer` is not `none`, put it after a blank line.
   Add no other trailer or attribution.
5. If a pre-commit hook rewrote files, re-stage them and retry once. If it failed a check, show
   its output and stop. Never use `--no-verify` unless asked.

## Examples

```
feat: add pagination to GET /workout_sessions
fix(i18n): persist detected language across refresh
chore(deps): update to latest compatible versions
EE-1234: fix duplicate welcome email on signup
```
