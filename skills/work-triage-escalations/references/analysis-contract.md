# Analysis contract (S2)

Read by the orchestrator before S2 and by every analysis subagent: the `core:work-triage-analyst`
agent, or a `general-purpose` fallback handed the same path. It is the one source for what
they do and return, so both produce the same result object.

Each ticket is analyzed by **one isolated subagent**. The orchestrator injects the cloudId and
the key; the subagent returns **only** the JSON result object below — no prose, no markdown
fence — so the orchestrator can parse it directly.

### Classification — exactly one of

- **needs-info** — not enough in the ticket to act: no reproduction steps, no identifiers
  (account / subscription / invoice / transaction id or code), no concrete error, or the ask is
  unclear. The right first move is to ask the reporter for specifics.
- **data-cleanup** — the code is (probably) fine; specific records are in a bad or inconsistent
  state and need a targeted data correction, backfill, re-sync, or manual action (e.g. "void
  these refund transactions", "un-stick this invoice", "correct this balance"). A code change is
  *not* the expected outcome.
- **bug** — a plausible defect in the product's code, with enough information to start
  investigating in code; the expected outcome is a code change.

The Jira **issue type** (e.g. `Data-Cleanup`, `Bug`) is a strong prior — weigh it, but decide on
the ticket's content. Tie-breaks: can't tell bug vs data-cleanup for lack of detail →
**needs-info**; a clearly bad data state for named records → **data-cleanup**, even if a latent
bug caused it (note the suspected bug in the analysis).

### Result schema (the subagent's entire output)

```json
{
  "jiraKey":        "EE-1234",
  "summary":        "<issue title>",
  "status":         "<Jira status, e.g. In Progress>",
  "labels":         ["<current Jira labels>"],
  "classification": "bug | data-cleanup | needs-info",
  "rationale":      "<1–2 sentences: why this class>",
  "analysis":       {}
}
```

`analysis` is one of the three shapes, keyed to `classification`:

- **bug** →
  ```json
  {
    "reproducible":      "true | false | unknown",
    "relevantFiles":     ["path/to/file.rb:120"],
    "hypotheses":        [{ "desc": "...", "confidence": "high|medium|low", "estDiffLines": 0 }],
    "overallConfidence": "high|medium|low",
    "graylogFlagNeeded": false
  }
  ```
  `relevantFiles` most-relevant first (≤ ~6); `hypotheses` most-likely first (≤ 3);
  `graylogFlagNeeded` is `true` when the ticket cites Graylog/logs as evidence (never fetched).
- **data-cleanup** →
  ```json
  { "scope": "...", "affectedRecordsSummary": "...", "webhookSilenceRecommended": false }
  ```
  - `scope`: ≤ ~15-word action summary used **verbatim** in the Slack reply one-liner — keep it
    concise and action-focused (e.g. `void 2 refund transactions on the Acme site`). Detail
    goes in `affectedRecordsSummary`, not here.
  - `affectedRecordsSummary`: specific record identifiers and count — UUIDs, invoice numbers,
    transaction IDs (from description **and** comments; always check comments for narrowed scope
    or added identifiers).
  - `webhookSilenceRecommended`: follow the merchant's explicit instruction when the ticket states one.
- **needs-info** →
  ```json
  { "missingFields": ["..."], "recommendation": "...", "severity": "high|medium|low" }
  ```

### Subagent prompt

The orchestrator spawns each subagent with
`Analyze {key}. cloudId: {cloudId}. Contract: <absolute path to this file>` (step 7). The
`core:work-triage-analyst` agent (read-only toolset, `model: opus`) reads this file and follows
the instructions below; a `general-purpose` fallback gets the same prompt and does the same:

> You are an isolated triage-analysis agent. Analyze one Jira ticket and return your result as a
> single JSON object — **only** the JSON, no prose and no code fence.
>
> **Make zero writes.** Do not edit the issue, add comments, post to Slack, add reactions, or
> modify any file — read only. **Never fetch Graylog** (VPN/login-gated); if the ticket cites
> Graylog or logs as evidence, set `graylogFlagNeeded: true` and move on.
>
> 1. Fetch the issue with `mcp__claude_ai_Atlassian__getJiraIssue`, `cloudId: "{cloudId}"`,
>    `issueIdOrKey: "{key}"`, `responseContentFormat: "markdown"`, and `fields` including
>    `summary, description, status, issuetype, priority, labels, comment`. Read the summary,
>    description, issue type, status, priority, labels, and comments.
> 2. Classify as exactly one of `bug | data-cleanup | needs-info` using the rubric above.
> 3. Analyze per class:
>    - **bug** — search the product's checkout (cwd) with `mcp__serena__get_symbols_overview`
>      / `find_symbol` / `find_referencing_symbols` and `Grep` / `Glob` / `Read` to locate the
>      code involved (time-box it). Produce ≤3 ranked hypotheses (desc, confidence, rough
>      `estDiffLines`), the most-relevant files as `path:line`, the `reproducible` value by these
>      criteria — **`true`**: the ticket gives concrete repro steps *and* the identifiers/inputs
>      needed to trigger it (account / subscription / invoice / transaction id, config);
>      **`false`**: the trigger can't be recreated on demand (a one-off / transient event, or one
>      specific to a moment's environment, timing, or data state); **`unknown`**: the mechanism is
>      plausible but exact preconditions are missing, or the confirming evidence lives only in logs
>      / Graylog (never fetched) — an overall confidence, and the Graylog flag. Do **not** modify code.
>    - **data-cleanup** — from the **ticket text and comments** (do not query BigQuery): fill
>      `scope` with a ≤ ~15-word action summary (used verbatim in the Slack reply — be concise,
>      e.g. `void 2 refund transactions on the Acme site`); fill `affectedRecordsSummary`
>      with specific IDs/count (comments often narrow scope or add identifiers not in the
>      description — always read them); follow the ticket's explicit instruction for
>      `webhookSilenceRecommended`.
>    - **needs-info** — the missing fields, a recommendation (what to ask the reporter), a severity.
> 4. Output the JSON result object exactly in the schema above (`jiraKey`, `summary`, `status`,
>    `labels`, `classification`, `rationale`, `analysis`). Nothing else.

