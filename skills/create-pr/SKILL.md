---
name: create-pr
description: "Drafts a GitHub pull request from the branch's commits and diff, fills the repo's PR template (or a short free-form body), and opens it as a draft PR, first waiting for approval when the publish_approval option is ask. Targets the repo's real base branch, links the ticket when a tracker is installed, and assigns the PR to its author. Use when asked to 'open a PR', 'create a pull request', 'raise a PR for this branch', or run /create-pr."
compatibility: "Requires git and the gh CLI, authenticated (gh auth status). Reads no config file."
metadata:
  version: "3.0"
allowed-tools: Bash(git symbolic-ref:*), Bash(git branch:*), Bash(git status:*), Bash(git fetch:*), Bash(git log:*), Bash(git diff:*), Bash(git push -u:*), Bash(gh repo view:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh pr create:*), Bash(gh pr edit:*), Read, Grep, Glob, AskUserQuestion
argument-hint: "[--draft]"
user-invocable: true
---

## Configuration

- ticket_tracker_url: none
- publish_approval: skip

## Step 1 — Check the branch

- The base is `git symbolic-ref --short refs/remotes/origin/HEAD` without `origin/`; if that
  fails, `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`. Ask only if both fail.
- Stop and say why on a detached HEAD, with no remote, or with no commits ahead of the base.
- Run `gh pr list --head "$(git branch --show-current)" --state open --json number,url`. If a PR
  is already open, give its URL and offer to update its body instead of opening a second one.

## Step 2 — Read the change

```bash
git fetch origin "$BASE" --quiet
git log "origin/$BASE...HEAD" --oneline
git diff "origin/$BASE...HEAD" --stat
git diff "origin/$BASE...HEAD"        # file by file when the stat is large
```

## Step 3 — Write the draft

**Title:** the commit rule. If the branch starts with a ticket key,
`EE-1234: fix duplicate welcome email`; otherwise Conventional Commits, `type(scope): summary`.
Under 72 characters.

**Body:** fill `.github/pull_request_template.md` (or `.github/PULL_REQUEST_TEMPLATE.md`) when
the repo has one. Read it with your file tool, since it may not exist. Match each section by
what it asks for, not by its heading:

- **Summary / Description:** 2–3 sentences on what was wrong and what changed. No file list.
- **Why / Motivation:** only when the summary doesn't already answer it.
- **Changes:** one line per logical change.
- **Testing / QA:** tick only the checkboxes you actually ran, with any number they ask for
  (`Tests pass (657)`), and delete a line you can't tick. Write repro steps when asked for them.
- **Ticket / Related:** link the branch's key through `ticket_tracker_url`, replacing `{key}`.
  Omit the section when it is `none`. When it is `infer`, copy the link format from the repo's
  recent PRs (`gh pr list --state merged --limit 10 --json body`), and ask for it when none
  links a ticket.
- **Screenshots:** N/A when nothing visible changed. Leave any other section as the template has it.

Without a template, write a short Description and a Testing section.

**No attribution.** The body ends with its last section: no "Generated with Claude Code" line
and no co-author line, whatever default the harness suggests.

## Step 4 — Approval

- `publish_approval` is `ask`: show the title and the full body, and ask whether to open it as
  a draft (the default). Nothing is pushed until the user approves; apply their changes and ask
  again.
- `publish_approval` is `skip`: show the title and the full body, then go on to Step 5 and open
  it as a draft unless the arguments say otherwise.

## Step 5 — Push and open

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base "$BASE" --assignee @me --title "<title>" [--draft] --body "$(cat <<'EOF'
<body>
EOF
)"
```

Return the PR URL.
