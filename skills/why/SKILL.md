---
name: why
description: "Finds out why code is the way it is: the design rationale, the tradeoff, the incident or request that shaped it. Anchors on git history and PRs, searches every other evidence source the session has a tool for (tickets, docs, team chat, monitoring, error tracking, analytics), and returns a cited answer that separates what the record says from what is inferred and what is unknown. Use for 'why does X work this way', 'why did we pick Y', a regression's history, or run /why. Use how for runtime behavior."
compatibility: "Requires git; gh for PR bodies. Other sources are searched only when the session has a tool for them. Fans out on Claude Code and runs inline elsewhere."
metadata:
  version: "1.0"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git blame:*), Bash(git show:*), Bash(gh pr view:*), Bash(gh pr list:*), Agent
argument-hint: "[what to explain the reasons for]"
user-invocable: true
disable-model-invocation: true
---

# Why

Find the forces that gave code its shape. `how` answers what the code does; `why` answers why it
is that way, and says honestly how sure the answer is.

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Pass references to subagents by absolute path.

Work as a careful, precise investigator: what the record says, what you infer, and what you don't
know stay separate. `<dir>/references/epistemics.md` is the confidence framework; read it before
writing the answer.

## 1. Target and question

The target is a piece of code, a pattern, a feature or a named decision. The question is usually a
rationale, a tradeoff, a motivating edge case, an external constraint or a history sweep. If the
target is vague, take your best reading from the conversation, state it in a line, and go on.

## 2. Code anchor

Build the seed context yourself before anything else: file paths and line ranges, key symbols,
the last commits touching the target, PR numbers from merge commits (`(#1234)` in the subject),
and any ticket IDs.

```bash
git blame -L <start>,<end> <file>
git log --follow -p -- <file>
git log --oneline -20 -- <file>
git log -1 --format=%B <commit>
gh pr view <number> --json title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews
```

Every investigator and the synthesizer get this anchor.

## 3. Investigate

Map the session's tools to evidence categories: **source control** (always, through git and `gh`),
**issue tracker**, **long-form docs**, **team chat**, **infrastructure observability**, **error
tracking**, **product analytics**. One tool maps to one category, its primary one.

- **Only source control is available:** investigate it yourself with
  `<dir>/references/investigator-prompt.md` and `<dir>/references/sources/code-archaeology.md`
  as your method, then go to 4.
- **Two or more are available:** spawn one investigator per category in one message, each owning
  exactly one tool: `general-purpose` (it needs the session's MCP tools) with `model: sonnet`,
  told not to write anything. Each gets the investigator prompt filled in, the anchor, and the
  question. The source-control investigator also gets `sources/code-archaeology.md`.

If the target looks defensive (null checks, retries, timeouts, rate limits, feature flags), add
`<dir>/references/sources/incident-postmortem.md` to every investigator.

Skip a category only with a written reason that goes in Sources Consulted: no tool for it in this
session (a gap, not a choice), or provably irrelevant (a build script has no error-tracking trail).

## 4. Synthesize

Write the answer from `<dir>/references/synthesizer-prompt.md`, with the findings (null results
and skips included), the anchor, the question, and the epistemics framework. When investigators
ran, spawn one `general-purpose` synthesizer on the session's model for this; otherwise do it
yourself.

## 5. Present

Present the answer. Light edits for clarity are fine; **don't rewrite the confidence language**.
Its hedges are findings.

The sections are the synthesizer prompt's: The Question, The Code in Question, What We Found, What
We Can Reasonably Infer, Competing Hypotheses, What We Don't Know, Sources Consulted (one line per
category, searched or skipped, with the reason), Confidence Summary. When the question is a
precursor to changing the code, end with a Preserve / Change / Avoid / Risk list for the change.

**Recency bias** is the common failure: the latest commit is rarely the whole reason. The current
shape is usually the accretion of earlier decisions, so trace back.
