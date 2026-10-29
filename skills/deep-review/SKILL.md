---
name: deep-review
description: "Deep, design-aware code review of a GitHub PR or the current branch's diff vs its base. Routes changed files to specialized reviewers (architecture/OOP/SOLID, backend, database/migrations, frontend) and only spawns the ones the change touches. Presents severity-ranked findings and WAITS for approval, then asks whether to post them as PR comments. Read-only until the user explicitly approves posting. Use when asked to 'review this PR', 'deep review my branch', 'review before I push', or run /deep-review."
compatibility: "Requires git; the gh CLI (authenticated) for PR mode and for posting. Fans out to subagents on Claude Code and runs the same reviewers inline elsewhere. Reads no config file."
metadata:
  version: "3.0"
allowed-tools: Bash(git fetch:*), Bash(git diff:*), Bash(git symbolic-ref:*), Bash(git status:*), Bash(git branch:*), Bash(git switch:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checkout:*), Bash(gh repo view:*), Bash(mkdir:*), Read, Grep, Glob, Agent, AskUserQuestion
argument-hint: "[<PR number | PR url> | --branch] [--only <glob,…>] [--reviewer <name>] — default: auto-detect (PR arg → that PR; otherwise current branch vs its base)"
user-invocable: true
disable-model-invocation: true
---

# Deep Review

Review a change for what linters can't judge: was this the right, coherent, smallest solution,
and does it fit how this codebase already works? Fan out to specialized reviewers based on what
changed, merge their findings, show them, and post them as PR comments only when asked.

- **Read-only until approved.** Steps 1–5 write nothing; Step 6 posts only on an explicit yes.
- **Precision over recall.** Every finding cites a concrete failure (input → wrong result) or a
  named rule from a checklist. Drop what you can't back, or mark it `low`.
- **Stay out of the tooling's lane.** Don't re-flag what `review_owned_by_tooling` names, or
  what `simplify` and `security-review` cover. Security findings are limited to obvious foot-guns.
- **Fit before preference.** Judge against this repo's own patterns, not taste or another framework.

## Configuration

- review_owned_by_tooling: ESLint / Prettier formatting; Type errors caught by tsc / the typecheck script; Dependency and license audits
- review_conventions: auto

- `review_owned_by_tooling`: `;`-separated lanes; `none` lets reviewers decide what a linter owns.
- `review_conventions`: `;`-separated docs every reviewer reads; `auto` means `CLAUDE.md` /
  `AGENTS.md` at the root plus any scoped one in a touched folder.

**Where the briefs and checklists live.** Let `<dir>` be the directory holding this SKILL.md
(`${CLAUDE_SKILL_DIR}` where the harness sets it). Pass reviewers **absolute** paths:

- **Checklist:** `<dir>/references/<lane>.md`, where `<lane>` is the reviewer name with
  everything up to and including `review-` removed (`core:review-backend` → `backend.md`).
- **Finding contract:** `<dir>/references/finding-contract.md`, the same for every reviewer.
- **Agent brief** (inline runs only): `review-backend.md` and so on, in `<dir>/agents/` when this
  skill was copied into another harness, otherwise in the plugin's `agents/` two levels above `<dir>`.

If a checklist is missing, run that reviewer on its brief alone and say so in the Coverage block.

## Step 1 — Determine the review target

`$REVIEW_DIR` is a fresh directory in your session scratchpad, created with `mkdir -p`; use
its absolute path everywhere below.

- **PR mode**, when the argument is a number or a github.com PR URL:
  ```bash
  gh pr view <n> --json number,title,headRefName,baseRefName,headRefOid,url,files
  gh pr diff <n> > "$REVIEW_DIR/diff.patch"
  ```
  The base is the PR's `baseRefName`. If the working tree is clean, you may `gh pr checkout <n>`
  so reviewers read real files; record the original branch to restore in Step 5. If it is dirty,
  don't check out: review from the patch and say so.
- **Branch mode**, when the argument is `--branch`, empty, or not a PR. The base is
  `git symbolic-ref --short refs/remotes/origin/HEAD` without `origin/`, falling back to
  `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`:
  ```bash
  git fetch origin "$BASE" --quiet
  git diff "origin/$BASE...HEAD" > "$REVIEW_DIR/diff.patch"
  git diff --name-status "origin/$BASE...HEAD"
  ```

With zero changed files, say so and stop.

- `--only <glob,…>` restricts the changed files before bucketing; note it in Coverage.
- `--reviewer <name>` runs just that reviewer, to re-check one lane after a fix.

## Step 2 — Bucket changed files and pick reviewers

The architecture reviewer always runs: it reads the whole diff and covers any file no other
reviewer owns. Every other reviewer runs only if it owns at least one changed file. A file may
go to two reviewers; Step 4 dedups.

| Reviewer | Owns (changed paths matching) |
|---|---|
| `core:review-architecture` | **the entire diff**, always, plus any file no one else owns (`*.yml`, `*.json`, `Dockerfile*`, `*.sh`, `config/**`, build files, docs) |
| `core:review-backend` | server-side source and its tests: `**/*.rb`, `**/*.py`, `**/*.go`, `**/*.java`, `**/*.php`, `**/*.rs`, server-side `**/*.ts`/`**/*.js`, server templates (`**/*.haml`, `**/*.erb`, `**/*.jinja`) |
| `core:review-database` | `db/**`, `migrations/**`, `**/migrate/**`, `**/*schema*.{rb,sql}`, `**/structure.sql`, ORM schema files (`schema.prisma`, `**/models.py`) |
| `core:review-frontend` | `**/*.tsx`, `**/*.jsx`, `**/*.vue`, `**/*.svelte`, client-side `**/*.ts`/`**/*.js`, `**/*.css`, `**/*.scss`, and their tests |

## Step 3 — Fan out (parallel, read-only)

Spawn the selected reviewers in a single message, with `subagent_type` set to the reviewer name
including its plugin prefix (`core:review-backend`). Fall back in order:

1. The named agent type.
2. `subagent_type: general-purpose` with the same instructions, when that type isn't available.
3. No Agent tool at all: run the reviewers inline, one at a time, from their
   briefs and checklists, producing the same JSON for each. Say so in Coverage.

Give each reviewer:

- the target line (`PR #123 → main`, `branch EE-4321 → main`);
- the absolute path to `$REVIEW_DIR/diff.patch`;
- the absolute path to its checklist;
- the `review_conventions` docs and the `review_owned_by_tooling` lanes;
- the exact files it owns (the architecture reviewer gets all of them, to review as one design);
- the absolute path to the finding contract, as the only thing it may return.

A reviewer missing a declared tool (Serena not connected) falls back to Grep/Glob/Read and
notes it; the review still runs.

## Step 4 — Merge, dedup, rank

1. **Dedup:** same file, line within ±3, same root cause → keep the highest severity and
   confidence, and note when several reviewers agreed.
2. **Drop** any `low`-confidence finding with no cited rule or failure.
3. **Rank:** `blocking`, then `should-fix`, then `nit`; high confidence first within each.

## Step 5 — Restore, present findings, and WAIT

If you checked out the PR in Step 1, switch back to the original branch now, before the
report. Then print it and wait. Don't fix anything and don't post.

```
## Deep review — <target>
<N> files reviewed · reviewers: architecture, backend, database
Findings: 🔴 <b> blocking · 🟠 <s> should-fix · 🔵 <n> nit

### 🔴 Blocking
1. `path/to/file.rb:42` — <title>  · confidence: high
   Why: <concrete failure or cited rule>
   Fix: <concrete suggestion, small code sketch if useful>

### 🟠 Should-fix
...

### 🔵 Nit
...

### Coverage
Ran: <reviewers>. Skipped: <reviewer> (no matching files).
Scope: <full diff | --only <globs> | single reviewer>.  Mode: <parallel | inline>.
Not re-flagged (owned by tooling): <review_owned_by_tooling>.
```

If nothing was found, say the change looks clean and what was checked. End with: *"I've made no
changes to your code, and you're on `<branch>`. Tell me which findings to act on or push back
on, and I can post selected ones as PR comments."*

## Step 6 — Optionally post as PR comments (only after approval)

Only when asked, and only in PR mode:

1. Confirm which findings to post (default: all `blocking` and `should-fix`).
2. Post them as one review on the PR's head commit, so the author gets one notification and
   every comment lands together:
   ```bash
   gh api repos/{owner}/{repo}/pulls/<n>/reviews --input - <<'EOF'
   { "commit_id": "<headRefOid>", "event": "COMMENT", "body": "<summary>",
     "comments": [ { "path": "<file>", "line": <line>, "side": "RIGHT", "body": "<finding>" } ] }
   EOF
   ```
   Each comment states the problem and the fix on its own; use a ```` ```suggestion ```` block
   when the fix is a small, exact edit. GitHub rejects the whole review if one comment sits on a
   line outside the diff, so put any such finding in the summary body instead.
3. Report what was posted.

In branch mode there is no PR: offer a copy-pasteable markdown block and suggest `create-pr`.
