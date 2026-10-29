# Changelog — work-triage-escalations

Build history. This is development record, not instruction: it used to sit in `SKILL.md`
and was re-read on every invocation.

This skill is built in stages that mirror the pipeline in §3; **S1–S5** are wired up.

- **S1 — poll + parse: IMPLEMENTED.** Resolve the channel, read the last N messages,
  extract EE-keys with the ported parser, print them.
- **S2 — analyze: IMPLEMENTED.** For each distinct key, spawn one analysis subagent that
  fetches the Jira issue, classifies it (`bug | data-cleanup | needs-info`), analyzes it per
  class, and returns the structured result (schema + subagent prompt in §5). Zero writes.
- **S3 — draft reports: IMPLEMENTED.** For each analyzed ticket, compose the Jira comment
  (`🤖 auto-triage` header + per-class body), the Slack thread reply (no Jira link — omitted to
  prevent JIRA's bot from auto-posting a follow-up), and the reaction, and **print** all three;
  end with the run summary table. Zero writes. Report format + dry-run rules in §6.
- **S4 — post + label lifecycle: IMPLEMENTED (`--post --once`).** With `--post`, the drafts
  become real writes for **one** ticket (`--once EE-XXXX`): claim (`auto-triage:processing`),
  post Jira comment → Slack reply → reaction, then swap the label to `auto-triage:<class>`.
  Idempotent — a ticket already carrying an `auto-triage:*` label or a `🤖 auto-triage` comment
  is SKIPped, so a re-run is a no-op. Channel-wide `--post` is added in S5 (below). See §4 S4 + §6.
- **S5 — scope + channel-wide post: IMPLEMENTED.** The poll now **discards already-triaged
  tickets by their marker reaction** (🐛/🧹/🤔/🚨 on the bot message) and selects the newest
  **`--max-tickets`** un-triaged distinct tickets (default 10) — the deterministic selection
  lives in `parse.mjs` (`selectTickets`). `--post` **without** `--once` now writes those
  selected tickets channel-wide (serial, newest-first), with the **error path**
  (`auto-triage:error` + 🚨, keep going) replacing S4's stop-on-failure. The run ends by
  reporting how many un-triaged escalations remain beyond the cap. See §4 S5 + §6.
- **v3 — slimmed.** `SKILL.md` went from 407 lines to about 200, saying each rule once. S4
  and S5 became one S4 post step that reuses the S2 analysis instead of re-running it. The
  Jira comment header is `## 🤖 auto-triage` everywhere (one step still said the setext form),
  and the Slack reply has no deep link. `triage-analyst` now ships as `work:triage-analyst`,
  rebuilt from `references/analysis-contract.md`, which it reads from the path it is given.
- **Renamed.** The skill is `work-triage-escalations` and its analyst `core:work-triage-analyst`:
  the work plugin folded into `core`, with every work skill and agent prefixed `work-`.
