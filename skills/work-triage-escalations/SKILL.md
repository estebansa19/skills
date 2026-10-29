---
name: work-triage-escalations
description: "Triage new escalation tickets that a bot posts in a Slack channel — poll the channel, extract each Jira key, classify the ticket (bug | data-cleanup | needs-info), analyze it, and draft a Jira comment + Slack thread reply + reaction. DRY-RUN by default (drafts everything, writes nothing); pass --post to write for real. Use when asked to 'triage the escalations', run /work-triage-escalations, or run the escalation-triage bot."
compatibility: "Needs Node 18+ on PATH for scripts/parse.mjs, and an interactive claude.ai login with the Atlassian and Slack connectors connected — do NOT set CLAUDE_CODE_OAUTH_TOKEN, a setup token suppresses the connectors. The Slack user must be a member of the escalations channel when it is private. Uses Serena for bug analysis when connected; falls back to Grep/Glob."
metadata:
  version: "3.0"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/parse.mjs *), Read, Grep, Glob, Agent, AskUserQuestion
argument-hint: "[--channel <name>] [--project <KEY>] [--post] [--once KEY-123] [--limit N] [--max-tickets N] — default: dry-run, N=50 msgs / 10 tickets; asks for a missing channel or project"
user-invocable: true
disable-model-invocation: true
---

# Triage Escalations

Triage new escalations as the on-call engineer, in this Claude Code session and as the user:
their claude.ai Atlassian and Slack connectors, and the product's checkout at the session cwd.
Classify each ticket, then draft (or, with `--post`, write) a Jira comment, a Slack thread reply
and a reaction.

## Configuration

- slack_channel: ask
- jira_project: ask
- jira_site: ask

Nothing about the workplace ships with the skill, and it reads no config file, notes or memory.
Before S1, settle all three, then start without asking anything else:

- `slack_channel`: the channel the bot posts in, from `--channel`.
- `jira_project`: the project key of the escalation tickets, such as `EE`, from `--project` or
  the prefix of the `--once` key. The key pattern is `\b<KEY>-\d+\b`.
- `jira_site`: call `getAccessibleAtlassianResources`. One site: use it. Several: ask which.
  The site's `id` is the cloudId and its `url` the site URL.

Ask for every one still missing in a single message, and wait. **Never poll a guessed channel
or comment on a guessed Jira site.**

## Before you start

- **Node 18+ on `PATH`** for `parse.mjs` (`node --version`). Without it, apply the parser
  contract in S1 by hand.
- **An interactive claude.ai login** with the Atlassian and Slack connectors connected. Do
  **not** set `CLAUDE_CODE_OAUTH_TOKEN`: a setup token suppresses the connectors. They don't
  work through the Agent SDK or in headless or scheduled runs either, so this stays a skill
  you invoke by hand.
- **The Slack user is a member of the channel**; a non-member's read of a private one comes
  back empty.
- **The product's checkout is the working directory**, for the bug analysis.

## Safety

- **Dry-run is the default:** draft everything and print it, with zero writes to Jira or Slack.
  Only `--post` writes.
- The four write tools (`addCommentToJiraIssue`, `editJiraIssue`, `slack_send_message`,
  `slack_add_reaction`) are deliberately **not** pre-approved, so each write prompts: a second
  gate behind `--post`. Don't add them to `allowed-tools`.
- **Never fetch Graylog** (VPN/login-gated). When a ticket cites logs, flag "evidence present,
  needs manual check" and move on.
- Data-cleanup analysis reads the ticket text only; never query BigQuery.

## Arguments

Parse the arguments and start; don't ask to confirm scope, mode or any argument. The only
questions are the Configuration values still missing.

| Argument | Effect |
|---|---|
| *(none)* | Dry-run over the channel. |
| `--channel <name>` | The Slack channel to poll (`slack_channel`). Asked for when missing. |
| `--project <KEY>` | The Jira project key of the tickets (`jira_project`). Asked for when missing. |
| `--post` | Write for real: the `--once` ticket, or else the selected tickets channel-wide, one at a time, newest first. |
| `--once KEY-123` | Exactly that ticket. The channel is still read to find its message (the reply and reaction target); if it isn't in the last N messages, only the Jira comment is drafted or written. Ignores the reaction discard and the cap. |
| `--limit N` | Channel messages to scan. Default 50; one call returns at most 100. |
| `--max-tickets N` | Distinct un-triaged tickets per run, newest first, in dry-run and `--post` alike. Default 10; the rest are reported as deferred. `all` removes the cap — with `--post` it writes to every un-triaged ticket. |

## Tools and facts

- **Jira:** `mcp__claude_ai_Atlassian__getJiraIssue`, `…getAccessibleAtlassianResources`,
  `…editJiraIssue`, `…addCommentToJiraIssue`, `…searchJiraIssuesUsingJql`.
- **Slack:** `mcp__claude_ai_Slack__slack_search_channels`, `…slack_read_channel`,
  `…slack_read_thread`, `…slack_send_message`, `…slack_add_reaction`.
- **The bot message:** a bot sends one `[Automated Message]` per new ticket, with a score, the
  Jira link and the title. The key is plain text. The message is
  the thread we reply under: the parser records `threadTs = thread_ts ?? null`, and the reply
  parent is `threadTs ?? slackTs`.
- **Marker reactions** (they also mark a ticket triaged): bug → `bug` 🐛, data-cleanup →
  `broom` 🧹, needs-info → `thinking_face` 🤔, error → `rotating_light` 🚨. A human ✅
  `white_check_mark` is not ours and discards nothing.
- **Idempotency has two layers.** At poll time, skip a ticket whose bot message carries a
  marker reaction; this is also the cursor, since each `--post` run marks what it triaged. At
  write time, skip a ticket whose Jira labels include any `auto-triage:*`, or that has a comment
  whose first line contains `🤖 auto-triage` (catches a ticket whose Jira side posted but whose
  reaction didn't).
- **Re-triage** means removing the `auto-triage:*` label (and the reaction) by hand.

## S1 — Poll and select

1. **Channel.** Call `slack_search_channels` with query `<slack_channel>` and
   `channel_types: "public_channel,private_channel"` (a private channel is missing from the
   default search), and take the `id` of the exact-name match. No exact match: stop and say so.
2. **Read** with `slack_read_channel`: that channel id, `limit` N, and
   `response_format: "detailed"`, which surfaces the `Reactions:` line the discard needs.
3. **Project, then select with the parser.** The tool returns one formatted text blob, not
   JSON. Don't save the blob verbatim: re-emitting ~20 KB of text is the slowest step of the
   poll (~110 s at N=50 against ~27 s for the projection). Write a compact JSON array to a file
   in the session scratchpad, one object per message that has at least one key, in order:

   ```json
   [{ "ts": "<Message TS>", "text": "<every key in the message, space-separated>", "reactions": ["<short-names from its Reactions: line>"] }]
   ```

   Use `[]` when there is no `Reactions:` line. Copy values mechanically; don't group,
   re-order or decide anything. Then run the parser, in `scripts/` next to this SKILL.md
   (`${CLAUDE_SKILL_DIR}` where the harness sets it — never a repo-relative path):

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/parse.mjs" <channel.json> \
        --max-tickets <N> --key-pattern '\b<jira_project>-\d+\b'
   ```

   It prints `Selection (JSON)`: `selected` (newest un-triaged distinct tickets up to the cap,
   each with its reply target `slackTs`/`threadTs` and `hits`), `triaged` (skipped for a marker
   reaction) and `deferred`/`deferredCount`. `--selftest` runs its unit tests.

   **The parser decides the selection, never your own reading.** Its contract, for applying it
   by hand: the key pattern, global; skip messages with no text or no key; a key repeated in one
   message counts once; the same key across messages is one ticket, replied to on its newest
   message; ignore other keys such as `VULN-…`; a ticket is triaged if any of its messages
   carries a marker reaction. If a ts or reaction is ambiguous, save the raw output to a `.txt`
   file and run the parser on that instead.
4. **Print** the selected keys (newest first), the skipped ones with their reaction, and the
   deferred count. For `--once`, say whether its message was found.

## S2 — Analyze (zero writes)

5. **cloudId:** the `jira_site` id from the Configuration step (its hostname also works as a
   cloudId).
6. **Keys:** the `--once` key (with its newest message from S1, if found), or else the parser's
   `selected` keys. Never analyze the `triaged` or `deferred` ones.
7. **One subagent per key, all in one message.** Read `references/analysis-contract.md` and
   spawn `subagent_type: "core:work-triage-analyst"` with
   `Analyze {key}. cloudId: {cloudId}. Contract: <absolute path to analysis-contract.md>`.
   Fall back in order, and say in the summary which path ran:
   1. `core:work-triage-analyst`;
   2. `subagent_type: general-purpose` with the same prompt, when that type isn't available:
      the contract holds the full instructions;
   3. no Agent tool at all: apply the contract inline, one key at a time.

   Whichever runs, the analysis makes zero writes.
8. **Collect** each JSON result and pair it with its Slack `slackTs`/`threadTs`.

## S3 — Draft (zero writes)

Read `references/report-contract.md` first: it has the reaction map, the templates and the
summary table.

9. **Compose three artifacts per ticket:**
   - the **Jira comment**, starting exactly `## 🤖 auto-triage` and a blank line;
   - the **Slack reply**, the per-class one-liner with no Jira URL and a U+200B after the
     key's hyphen, so Jira's bot doesn't unfurl it;
   - the **reaction** for the class.

   Dry-run prints all three per ticket, each in its own labelled fenced block, and flags a
   ticket whose labels already include `auto-triage:*` as "would SKIP on `--post`". With
   `--post`, don't print the drafts; the summary is enough. A `--once` ticket whose message
   wasn't found gets the Jira comment only.
10. **Summary:** one row per selected ticket (Key · Classification · Decision · Status, with
    Status `drafted` in dry-run), then "N more un-triaged escalation(s) remain beyond the cap —
    re-run to continue", omitted when `deferredCount` is 0.
11. **Without `--post`, stop here.**

## S4 — Post (`--post` only)

Write the `--once` ticket, or each selected ticket in turn, newest first, using its S2
analysis. Per ticket:

12. **Gate and claim.** `getJiraIssue` with `fields: ["summary","status","labels","comment"]`
    and `responseContentFormat: "markdown"`. SKIP it, writing nothing, if any label matches
    `auto-triage:*` or any comment's first line contains `🤖 auto-triage`. Otherwise
    `editJiraIssue` with `fields.labels` = its labels plus `auto-triage:processing`. The tool
    sets the whole array, so always read-modify-write it, and keep the returned labels as the
    base for step 15.
13. **Jira comment:** `addCommentToJiraIssue` with `contentFormat: "markdown"`.
14. **Slack reply and reaction**, only when S1 found the ticket's message; otherwise note "no
    source message — Jira comment only":
    - `slack_send_message` with the channel id, the reply, and `thread_ts: threadTs ?? slackTs`;
      report the returned link.
    - `slack_add_reaction` on the bot message (`message_ts: slackTs`, never our reply) with the
      class's emoji. A duplicate reaction succeeds silently.
15. **Swap the label:** the base labels, minus `auto-triage:processing`, plus
    `auto-triage:<class>`.

**If a write fails:** best-effort swap `auto-triage:processing` → `auto-triage:error`
(read-modify-write), add 🚨 `rotating_light` to the bot message if there is one, and record
exactly what was and wasn't written. If those writes fail too, just record it. Then move on to
the next ticket; `--once` ends. The error label makes later runs SKIP the ticket until someone
clears it by hand.

16. **Summary:** the S3 table with Status `posted`, `SKIP — already auto-triaged` or `error`,
    then the deferred line.
