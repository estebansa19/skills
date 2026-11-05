# Analysis contract

Instructions for the analyst of one escalation: the `core:work-triage-analyst` agent, a
`general-purpose` subagent handed the same prompt, or the orchestrator inline. Return only the
JSON object below: no prose, no code fence.

**Read only.** No Jira edits or comments, no Slack messages or reactions, no file changes, no
commands. Never fetch Graylog or other login-gated logs: when the ticket cites them, set
`logsNeedManualCheck`. Never query a database or BigQuery.

## Steps

1. Fetch the ticket with `getJiraIssue` (`responseContentFormat: "markdown"`, fields `summary,
   description, status, issuetype, priority, labels, assignee, comment`). Read the comments:
   they often narrow the scope or add identifiers.
2. Classify it as exactly one of:
   - `bug`: a plausible defect in the product's code; the expected outcome is a code change.
     A UI defect (layout, spacing, copy, a broken interaction) is a bug.
   - `data-cleanup`: the code is probably fine; named records are in a bad state and need a
     targeted correction. A latent bug that caused it goes in `rootCause`.
   - `needs-info`: the ticket can't be acted on: no identifiers, no concrete error or
     expected behavior, or an unclear ask. Can't tell bug from data-cleanup → `needs-info`.

   The Jira issue type is a strong prior, not the answer.
3. Trace it in the checkout at the working directory by reading code, never from memory: Serena
   (`find_symbol`, `find_referencing_symbols`, `get_symbols_overview`) when connected, else
   Grep/Glob/Read. Follow the path from the reported surface (endpoint, job, model, page) to the
   line that decides the wrong outcome. Time-box it: stop at a located cause or after about
   twenty files.
4. Decide `quickFix` with the rubric below, then return the object.

## Quick-fix rubric

`quickFix.verdict` is `yes` only when every line holds for its kind; otherwise `no`, with the
lines that failed in `reasons`.

- **All kinds:** the class is not `needs-info`; the ask is unambiguous (the ticket states the
  expected behavior or the target state); no product, merchant or other-team decision is
  needed; the latest comments don't say it is resolved, worked around or waiting on someone
  (otherwise put the confirming question in `missingInfo`); about an hour of work including
  the test.
- **`code`** (backend): the cause is located to specific lines with `high` confidence; the fix
  is about 20 changed lines or fewer in at most three files; no migration, no new feature
  flag, no public API or webhook contract change.
- **`frontend`:** the defect is in one component or stylesheet (spacing, alignment, a missing
  condition, copy) and the fix doesn't change behavior shared across pages.
- **`data`:** the records are identified in the ticket (ids, codes, a precise query); the target
  state is stated; one application's data; non-destructive (no deletes, no closing sites or
  accounts); under 10,000 records; an existing model method or a few attribute updates can
  make the correction.

## Result

```json
{
  "key": "EE-1234",
  "title": "<ticket summary>",
  "status": "<Jira status>",
  "assignee": "<display name or null>",
  "classification": "bug | data-cleanup | needs-info",
  "problem": "<2-3 sentences: what is wrong, for whom, since when, in our words>",
  "rootCause": [
    { "hypothesis": "<what goes wrong and why>", "evidence": "<path:line or ticket fact>", "confidence": "high | medium | low" }
  ],
  "filesToReview": ["path/to/file.rb:120 — <why this file>"],
  "reproduction": {
    "steps": "<how to trigger it locally, or null>",
    "specTarget": "<the existing spec nearest the cause, or null>"
  },
  "missingInfo": ["<question for the reporter>"],
  "logsNeedManualCheck": false,
  "quickFix": {
    "verdict": "yes | no",
    "kind": "code | frontend | data | null",
    "change": "<the fix in one sentence, or null>",
    "reasons": ["<each rubric line that decided it>"]
  }
}
```

- `rootCause`: at most three, most likely first; empty for `needs-info`.
- `filesToReview`: at most six, most relevant first.
- `quickFix.kind` is `null` only when no kind applies.
