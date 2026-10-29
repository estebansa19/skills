---
name: how
description: "Explains how a subsystem works, for someone about to change it or new to it: what it is, the runtime flow, where things live and the gotchas. A narrow question is answered directly; a subsystem fans out 2–4 read-only explorers and one explainer merges what they trace. Use for 'how does X work', a walkthrough before changing something, 'where should this live', or run /how. Use why for the reasons behind it."
compatibility: "Fans out to subagents on Claude Code and runs the same roles inline elsewhere."
metadata:
  version: "1.0"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git ls-files:*), Agent
argument-hint: "[what to explain]"
user-invocable: true
disable-model-invocation: true
---

# How

Answer "how does X work?" at the level of a senior engineer onboarding onto a subsystem: enough
to build a working mental model, not so much that it reads like annotated source code.

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). Pass prompts to subagents by absolute path.

**Subagents.** Explorers are `subagent_type: Explore` (or `general-purpose` where Explore is
missing) with `model: sonnet`, told not to edit files. The explainer is `general-purpose` on the
session's model. Without an Agent tool, play each role yourself, one after another, from the same
prompts.

## 1. Assess

If the scope is ambiguous, state how you read it and go on; the user can redirect.

- **Narrow** (one module, a small utility, "how does function X work"): no subagents. Read the
  code and answer in the explainer's format from `<dir>/references/explainer-prompt.md`. Go to 4.
- **Subsystem** (several files or services, a cross-cutting feature, an architectural overview):
  go to 2.

When in doubt, take the narrow path.

## 2. Explore

Split the question into 2–4 angles, each a distinct slice of the subsystem. Spawn every explorer
in one message, each with `<dir>/references/explorer-prompt.md` and its angle filled in.

## 3. Synthesize

When every explorer has returned, spawn one explainer with
`<dir>/references/explainer-prompt.md` and all their findings filled in.

## 4. Present

Present the explanation. Light edits for clarity or for context from the conversation are fine;
don't rewrite it. Keep the explorers' open questions visible rather than smoothing them over.

The sections are the explainer prompt's, minus any that don't apply: Overview, Key Concepts, How
It Works, Where Things Live, Gotchas.
