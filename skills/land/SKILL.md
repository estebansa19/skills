---
name: land
description: "Merges a GitHub PR once it is verified, without asking again: checks it is merge-ready (running babysit first when it is not), has a fresh agent that did not write the change verify the PR's head by running the tests and the changed behavior the way a user would, merges with the repo's usual method only on a PASS and only if the head hasn't moved, then reads the PR back to confirm it merged. The request to merge is the authorization; with publish_approval set to ask, it confirms before commenting, marking a draft ready or merging. Use for 'merge it once everything looks right', 'babysit the PR and merge it', 'land this PR', 'ship it', 'merge when green', or run /land."
compatibility: "Requires git and the gh CLI, authenticated (gh auth status). Verifies with a subagent on Claude Code and inline elsewhere."
metadata:
  version: "1.0"
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git log:*), Bash(git worktree:*), Bash(git switch:*), Bash(git pull --ff-only:*), Bash(git branch -d:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh pr ready:*), Bash(gh pr comment:*), Bash(gh pr merge:*), Bash(gh repo view:*), Bash(gh api:*), Read, Grep, Glob, Agent
argument-hint: "[PR number or URL]"
user-invocable: true
disable-model-invocation: true
---

# Land

Merge one PR, but only after someone other than its author has run it and only on the exact code
that was checked. Green CI and an approving bot review are not a verdict: neither runs the change
the way a user would.

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it).

## Configuration

- publish_approval: skip

## 1. Merge-ready first

The PR is the argument, or the current branch's PR. Read it:

```bash
gh pr view <n> --json number,url,isDraft,baseRefName,headRefOid,mergeStateStatus,reviewDecision,state
```

- **Not merge-ready** (checks failing or pending, `BEHIND`, `DIRTY`, unresolved threads): read
  `<dir>/../babysit/SKILL.md` and run it in drive mode until it reports merge-ready, then come back
  here. Its hand-off to land doesn't apply when land started it.
- **Waiting on a required human review:** stop and report. That is not yours to bypass.
- **A draft** gets marked ready in step 3, once it is verified.

## 2. Verify independently

Spawn one `general-purpose` agent that did not write the change. Give it the PR URL, the base,
the head SHA from step 1, and this brief:

- Check the head SHA out in its own worktree (`git worktree add <scratch>/verify <sha>`); commit,
  push, comment and merge nothing.
- Run the repo's tests and linter.
- Exercise what the PR changes the way a user would: run the CLI, call the endpoint, load the page,
  run the skill on a real task. Compare against the base when the change is a difference in
  behavior.
- Return `PASS`, `PASS+NOTES` or `FAIL`, with the commands it ran and their output.

Without an Agent tool, do this yourself in a clean worktree and say the verdict is not independent.

- **FAIL:** don't merge and don't comment. Hand the findings to babysit to fix, then verify the new
  head again.
- **PASS** or **PASS+NOTES:** go on to step 3, and carry any notes into the report.

## 3. Publish the verdict and merge

The next three actions reach other people: the comment, marking a draft ready (which notifies
reviewers), and the merge. With `publish_approval` = `ask`, show all three and get an OK first.
With `skip`, go ahead.

1. Post the verdict as one short PR comment: the verdict, the SHA it covers, and what ran.
2. If it is a draft: `gh pr ready <n>`.
3. Merge with the repo's usual method. Look at how recent PRs landed
   (`git log --merges --oneline -5 origin/<base>`): merge commits mean `--merge`, otherwise
   `--squash` when the repo allows it.

```bash
gh pr merge <n> --merge|--squash --match-head-commit <verified-sha>
```

`--match-head-commit` makes GitHub refuse the merge if the head moved after the verdict. If it
does, go back to step 2: the verdict covered other code. Never pass `--admin` to get past branch
protection.

## 4. Confirm it merged

```bash
gh pr view <n> --json state,mergedAt,mergeCommit
```

The PR must read `MERGED`. A merge command can succeed while a merge queue has only queued it, and
auto-merge is a request, not a merge; in either case, watch until it reads merged or report what
holds it. Then update the local base (`git switch <base>`, `git pull --ff-only`), delete the merged
local branch with `git branch -d`, and remove the verification worktree.

## 5. Report

A few lines: the verdict and who produced it, what ran, the merge commit, how you confirmed it
merged, and any notes from a `PASS+NOTES`.
