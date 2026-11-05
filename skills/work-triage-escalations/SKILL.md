---
name: work-triage-escalations
description: "Runs the escalation triager's loop for one escalation at a time: lists the unclaimed escalations a bot posted in a Slack channel, claims one with 👀, analyzes the Jira ticket (root cause, files to review, reproduction, missing info), posts a triage comment, and when the fix is quick (about an hour: a contained code or frontend change, or a small data fix) assigns it, says so in the thread, and takes it through a regression test, the fix, a commit and a draft PR. Use when on triage rotation: 'triage the escalations', 'triage this escalation ticket', 'what escalations are pending', or run /work-triage-escalations."
compatibility: "Needs Node 18+ for scripts/queue.mjs, and an interactive claude.ai login with the Atlassian and Slack connectors (they don't work headless or with CLAUDE_CODE_OAUTH_TOKEN set). The Slack user must be a member of the channel when it is private. Traces code with Serena when connected, Grep/Glob otherwise."
metadata:
  version: "4.0"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/queue.mjs *), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Grep, Glob, Agent, AskUserQuestion
argument-hint: "[KEY-123] [--channel <name>] [--project <KEY>] — no key: list the unclaimed escalations and pick one"
user-invocable: true
disable-model-invocation: true
---

# Triage escalations

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it).

Do the triager's job on one escalation per run, as the user, through their Atlassian and Slack
connectors and the product checkout at the working directory: claim it, analyze it, post the
triage, and fix it when the fix is quick. Keep messages to the user short; the triage comment
carries the detail.

## Configuration

- slack_channel: ask
- jira_project: ask
- jira_site: ask
- data_script_repo: ask
- run_manifest_repo: ask

Settle the first three before step 1, from `--channel`, `--project` (or the prefix of the given
key) and `getAccessibleAtlassianResources` (one site: use it; several: ask which; its `id` is the
cloudId). Ask for every missing one in a single message. Never read a guessed channel or post
to a guessed site. The two repo paths (the checkouts of the repo that holds production data-fix
scripts and of the repo whose manifests run them) are asked for only at step 11, for a data fix.

## Rules

- **Writes happen only where a step says so**, and the triage comment, the assignment and the
  Slack reply only after the user's OK at step 5. Don't pre-approve the write tools.
- Never fetch Graylog or other login-gated logs, and never query production data. Say what a
  human needs to check instead.
- Slack text never contains a Jira URL or a ticket key (Jira's bot unfurls both).

## 1. Pick the escalation

1. Find the channel: `slack_search_channels` with the name and `channel_types:
   "public_channel,private_channel"`; take the exact-name match, or stop and say none matched.
2. `slack_read_channel` with that id, `limit: 50`, `response_format: "detailed"` (it carries
   the `Reactions:` line). Write a compact JSON array to the session scratchpad, one object per
   message that contains a ticket key: `{"ts": "<Message TS>", "text": "<the message's keys and
   title>", "reactions": ["<names from its Reactions: line>"]}`. Copy values; decide nothing.
   Then run `<dir>/scripts/queue.mjs`:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/queue.mjs" <file.json> --key-pattern '\b<jira_project>-\d+\b'
   ```

   It prints `unclaimed` (no reaction on any of the ticket's messages, newest first, each with
   its `slackTs`/`threadTs`) and `claimed` with their reactions: the team reacts as it works (👀
   claimed, 💬 triaged, ✅ done), so any reaction means someone picked it up. The script decides
   what is claimed, not your reading. Without Node, apply that rule by hand.
3. **With a key:** use its entry (claimed or not). Not in the last 50 messages: carry on with no
   Slack target and say so; the Slack steps are skipped.
   **Without a key:** show the unclaimed ones as `key — title`, and ask which to take with
   AskUserQuestion (the four newest as options; Other takes any key). None unclaimed: say so and
   stop.

## 2. Claim it

4. `getJiraIssue` (`fields: ["summary","assignee","comment"]`). If someone other than the user
   is assigned, an engineer already posted an analysis comment, or the message already has
   reactions, say who and what, and ask whether to go on.
5. `slack_add_reaction` with `eyes` on the escalation's message (`message_ts: slackTs`). Picking
   the escalation is the OK for this one write.

## 3. Analyze

6. Spawn `core:work-triage-analyst` with `Analyze <key>. cloudId: <cloudId>. Contract:
   <absolute path to references/analysis-contract.md>`. No such agent: a `general-purpose`
   subagent with the same prompt; no Agent tool: read the contract and do it inline. Parse the
   JSON it returns.

## 4. Reproduce (bugs with a `specTarget` only)

7. Load the `code-style` skill. Make sure the tree is clean (`git status`; if not, stop and say
   so), then branch from the base: `git switch -c <KEY>-<short-slug> origin/<base>`, base being
   `origin/HEAD`. Follow Phase 2 of the `work-debug-escalation` skill (read
   `<dir>/../work-debug-escalation/SKILL.md`) to write the smallest spec, next to `specTarget`,
   that fails now for the reported reason, and run it. Give it about fifteen minutes. Failing
   for the right reason: reproduced. Otherwise: not reproduced, with why; delete the spec.
   A styling defect a spec can't observe: skip this step and say so.

## 5. Triage comment and the call (gate)

8. Draft the comment from `references/messages.md`. Show it and the verdict (`quickFix` with its
   reasons, plus your reproduction result: a quick fix you couldn't reproduce is `no` unless the
   cause is certain from the code) and ask with AskUserQuestion:
   - **Post and take it** (offered only when the verdict is `yes`): post, assign, reply, fix.
   - **Post triage only:** post the comment; stop.
   - **Edit first:** take their changes, then ask again.
   - **Stop:** post nothing; leave the 👀 and say so.
9. On a post: `addCommentToJiraIssue` (`contentFormat: "markdown"`), then `slack_add_reaction`
   with `speech_balloon` on the escalation's message. On a take, also:
   `atlassianUserInfo` for the user's account id, `editJiraIssue` with `fields: {"assignee":
   {"accountId": "<id>"}}`, and the Slack thread reply from `references/messages.md`. If a write
   fails, report exactly what was and wasn't posted and stop.
   Not taken: discard the reproduction spec, switch back to the base and delete the branch,
   report, and stop here.

## 6. Fix (taken only)

10. **Code or frontend:** continue `work-debug-escalation` at Phase 4 with the step 7 spec as the
    feedback loop and the first `rootCause` as the chosen hypothesis (triage stands in for its
    Phases 1–3 and their gates); then its Phase 5. A styling fix with no spec: check it in the
    running app with the `run` skill when it is available, and say so in the PR. When the fix
    outgrows the rubric (a second hypothesis, past about 20 lines, or a migration), stop: it is
    no longer quick. Say so, and ask whether to keep going or hand it back; handing it back
    means unassigning and correcting the thread, both drafted for the user's OK.
11. **Data:** settle `data_script_repo` and `run_manifest_repo`. In the script repo, from its
    base branch, on a `<KEY>-<slug>` branch, write the script and its spec following that
    repo's `CLAUDE.md` (its generator, target directory and test command), with the ticket's
    record ids as input, and run the spec until it passes. Then, in the manifest repo, add the
    run manifest following its `CLAUDE.md` (region, filename and content rules, lint), pointing
    at the script. Each repo gets its own commit and PR (step 12); the manifest PR links the
    script PR, and its template sections go to the user for confirmation, as that repo requires.

## 7. Ship

12. In each repo you changed: run the `work-commit` skill, then `work-create-pr` (each from
    `<dir>/../<name>/SKILL.md`); it waits for the user's OK before pushing. Hand over from
    there.

## Report

One block: the key and title, the classification, reproduced or not, the verdict, what was
posted (comment, 👀 and 💬, assignment, thread reply), and the branch and PR links. Then the next
unclaimed escalation, if any, so the user can run the skill again on it.
