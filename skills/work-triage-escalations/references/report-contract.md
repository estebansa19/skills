# Report contract (S3)

The three artifacts drafted per ticket, their exact templates, the reaction map, and the
end-of-run summary table. Dry-run prints these; `--post` writes them.

For each analyzed ticket the skill drafts three artifacts. Dry-run **prints** them; `--post`
(S4 single ticket / S5 channel-wide) sends them in order Jira comment → Slack reply → reaction.
The formats below are designed so the dry-run draft is exactly what `--post` will send.

### Reaction (by classification)

| Classification | Emoji name (no colons) | Renders as |
| --- | --- | --- |
| bug          | `bug`            | 🐛 |
| data-cleanup | `broom`          | 🧹 |
| needs-info   | `thinking_face`  | 🤔 |
| error path       | `rotating_light` | 🚨 |

### Jira comment (markdown — posted with `contentFormat: "markdown"`)

Every comment MUST begin with the marker header, exactly:

    ## 🤖 auto-triage

(ATX H2 heading — the subagent must emit `## 🤖 auto-triage` literally, followed by a blank
line before the body. Do **not** use the setext `🤖 auto-triage\n---` form — it produces the
same render but different raw text, which confuses tooling.)

The `🤖 auto-triage` marker doubles as the report-step idempotency check — never post a second
comment when any existing comment body **contains `🤖 auto-triage` on its first line** (matches
both the ATX `## 🤖 auto-triage` and any legacy setext `🤖 auto-triage\n---` forms). Then the
per-class body (omit any header whose
data is empty rather than printing a blank section):

**bug**

```
## 🤖 auto-triage

**Classification:** 🐛 bug
**Rationale:** <rationale>

**Reproducible:** <true | false | unknown>  ·  **Overall confidence:** <high | medium | low>

**Likely code involved:**
- `path/to/file.rb:120`
- `path/to/other.rb:88`

**Hypotheses (most likely first):**
1. <desc>  _(confidence: high · ~12 diff lines)_
2. <desc>  _(confidence: medium · ~30 diff lines)_

> ⚠️ Evidence present in Graylog / logs — auto-triage never fetches Graylog (VPN/login-gated); needs a manual log check.
```

(include the ⚠️ blockquote only when `graylogFlagNeeded` is true.)

**data-cleanup**

```
## 🤖 auto-triage

**Classification:** 🧹 data-cleanup
**Rationale:** <rationale>

**Scope:** <scope>
**Affected records:** <affectedRecordsSummary>
**Silence webhooks during the fix:** <yes | no>
```

**needs-info**

```
## 🤖 auto-triage

**Classification:** 🤔 needs-info  ·  **Severity:** <high | medium | low>
**Rationale:** <rationale>

**Missing information:**
- <field>
- <field>

**Recommended next step:** <recommendation>
```

### Slack thread reply (standard markdown — posted under the bot message)

One line, tailored per class. The reply parent is `threadTs ?? slackTs` (from S1). Use
**standard** markdown (`**bold**`), not Slack mrkdwn. Two Jira-bot suppression rules apply:

1. **No Jira URL** — do not include a link to the Jira site (`<site url>/browse/…`); Jira's bot
   auto-posts a noisy follow-up whenever a Jira URL appears in Slack.
2. **Break the issue key** — Jira's Slack integration also detects bare `PROJECT-NUMBER` patterns
   (e.g. `EE-1234`) and auto-unfurls them as link previews. When interpolating `{KEY}`, insert a
   **zero-width space (U+200B)** between the hyphen and the number so the bot's regex no longer
   matches. The result looks identical to readers (`EE-1234`) but is not detected by the bot.
   Substitution: `key.replace(/-(\d+)$/, '-​$1')`.

Per-class templates (apply the U+200B substitution to `{KEY}` before sending):

- **bug** — `🐛 **{KEY}** auto-triaged as **bug** — reproducible: {reproducible}, confidence: {overallConfidence}, {n} hypothesis(es) drafted.`
- **data-cleanup** — `🧹 **{KEY}** auto-triaged as **data-cleanup** — {scope}.`
- **needs-info** — `🤔 **{KEY}** auto-triaged as **needs-info** (severity {severity}) — missing: {missingFields, comma-joined}.`

### Run summary table (end of run)

One row per **selected** ticket, followed by the deferred line.

| Key | Classification | Decision | Status |
| --- | --- | --- | --- |
| EE-1234 | 🐛 bug | investigate code (2 hypotheses) | drafted |
| EE-5678 | 🧹 data-cleanup | run targeted data fix | drafted |
| EE-9012 | 🤔 needs-info | ask reporter for repro / ids | drafted |

> _3 more un-triaged escalation(s) remain beyond the `--max-tickets` cap — re-run to continue._

- **Decision** — the terse next step from the analysis (bug → "investigate code"; data-cleanup
  → "run targeted data fix"; needs-info → "ask reporter for …").
- **Status** — dry-run: `drafted`; `--post`: `posted`, `SKIP — already auto-triaged`, or `error`
  (write failed; ticket marked `auto-triage:error` + 🚨, run continued). In dry-run, append
  ` (would SKIP on --post)` for any ticket already carrying an `auto-triage:*` label.
- **Deferred line** — print the count of un-triaged tickets beyond the cap (`deferredCount` from
  `parse.mjs`); omit when it is 0. Already-triaged tickets skipped at poll time are done, not
  counted here (you may note them separately).

