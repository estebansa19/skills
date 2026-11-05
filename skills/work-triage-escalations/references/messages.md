# Messages

What the skill posts, built from the analysis JSON. Leave out a section whose data is empty.

## Jira triage comment

Posted with `addCommentToJiraIssue`, `contentFormat: "markdown"`, starting `## Triage notes`.

```
## Triage notes

**Classification:** <bug | data-cleanup | needs-info>
**Problem:** <problem>

**Likely root cause:**
1. <hypothesis> — <evidence> _(confidence: <high | medium | low>)_

**Where to look:**
- `<path:line>` — <why>

**Reproducible:** <one of the reproduction lines below>

**Missing information:**
- <question>

**Next step:** <one of the next-step lines below>
```

Reproduction lines:

- `Yes — reproduced locally with a failing spec (<spec path>).`
- `Not reproduced locally — <why: no identifiers, data-dependent, timing>.`
- `Not attempted — <data-cleanup: the bad state is in production data | needs-info>.`

Add `Logs cited in the ticket need a manual check (not fetched).` under it when
`logsNeedManualCheck` is true.

Next-step lines:

- Taken as a quick fix: `Quick fix (<kind>): <change>. I'm taking it; PR to follow.`
- Not quick: `Not a quick fix — <the failed rubric lines, briefly>. Starting point for whoever picks it up: <the first file or hypothesis>.`
- `needs-info`: `Waiting on the reporter for the missing information above.`

## Slack thread reply (only when the escalation is taken)

Posted with `slack_send_message` under the escalation's message (`thread_ts: threadTs ??
slackTs`). Standard markdown. No Jira URL and no ticket key: Jira's Slack bot answers both with
a noisy unfurl.

```
Taking this one — it looks like a quick fix: <change>. PR to follow.
```
