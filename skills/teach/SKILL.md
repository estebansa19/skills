---
name: teach
description: "Teaches a concept, a technology or a piece of code from scratch, assuming no prior knowledge, inside the time the user gives: theory first, then the smallest runnable example, then one new idea per step, each step built, run and explained before the next so the lesson starts at once. Diagrams where a picture explains it, bare-minimum code and real output where behavior does, and how real systems use it. For code in front of the user, runs how and why first. Asks no questions along the way. Use for 'teach me X', 'explain Y from scratch', 'I want to learn Z', 'compare A and B', a timed lab, or run /teach."
compatibility: "Runs examples with the language's own runtime. Fans out through how and why on Claude Code."
metadata:
  version: "2.0"
allowed-tools: Read, Grep, Glob, Write, WebSearch, WebFetch, Agent
argument-hint: "[a concept, a source to learn from, or code to understand]"
user-invocable: true
---

# Teach

The goal is that the user understands it: what it is, how it works, why it exists, and when to use
it. Assume they know nothing about it, including the tools and vocabulary around it, and start from
scratch. Don't ask them questions, don't quiz them, and don't ask for predictions; the explanation
and the examples do the work.

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it).

## Fit the time

- The time the user gives is the whole session, from your first message to the last, including
  writing and running code. Plan the steps to fit it at a beginner's pace before writing anything.
- When the request holds more than fits, teach the core in depth and drop the rest. Say in the
  first message what you dropped, as a follow-up session.

## Ground it

- **A source they bring** (an article, docs, a talk): read it in full first, and teach from it.
- **Facts and APIs** come from the current docs or the installed version, never memory; tools and
  languages change between versions.
- **Code in front of them** (a subsystem, a change, a PR): read it, then run `how` for how it works
  and `why` when the reasons matter, by reading `<dir>/../how/SKILL.md` and
  `<dir>/../why/SKILL.md` and following them. Keep `why`'s confidence language intact.
- **An ambiguous topic** ("replication" in which system?): take the common meaning, say which in a
  line, and go.

## Build it from scratch, one step at a time

1. **Theory first, no code.** What it is in plain words, its common name, the problem it solves,
   and a diagram of the parts. Code comes after.
2. **The smallest version that works.** The first example is a few lines that show the bare idea,
   even if it is naive.
3. **One new idea per step.** Each step adds one idea to the last, in its diagram, its code, or
   both. A code step shows what changed, runs it, and explains the output. A step that needs two
   new ideas is two steps. Define every term the first time it appears, and keep one name per
   concept.
4. **A diagram or code, whichever shows it.** A step about structure or flow (what talks to what,
   in what order) can be a diagram alone; a step about behavior (output, a failure, timing) needs
   code that runs. Start with diagrams until the parts are known, then code. For three or more
   moving parts, each step redraws the diagram with its one new part. Mermaid for flows and
   structure, ASCII when simpler.
5. **A tool is a new concept.** Before using a tool (a proxy, a database, a framework), explain
   what it is and what each part of its config means, from zero, one setting per step. Never
   show its config or its errors before that.
6. **Show it in real life**, where it applies: where it sits in a real system and how real code
   uses it. Use a diagram, a short excerpt quoted from a real project or config, or a small facade
   of the real application with only the parts that matter; run it only when running shows
   something the excerpt can't. Never build the real application.
7. **Connect it to their world** once the general idea is clear: their codebase, a tool they use,
   a system they've read about.
8. **Close** with when to use it and when not, the common pitfalls, and where to go deeper.

## Teach while you build

- The lesson starts in the first message. Never build everything first and teach after.
- When a step's code has run, your next output is that step as visible text (the explanation, the
  code, its real output), before any other tool call. A step that exists only in your thinking was
  never sent.
- Before the close, check that every step you refer to was sent.
- Your own mistakes and fixes are not lesson content. Fix them and move on; mention one only if it
  changes what the user should believe, in one line at the end.

## Bare-minimum code

- The fewest lines that show the idea, each example on one screen.
- Nothing the idea doesn't need: no threads, queues, locks, pools, retries, CLI options or test
  harnesses, unless that is the idea this step teaches.
- Pick the language whose standard library does the plumbing in the fewest lines (an HTTP server
  in one line), so the code shows only the concept. Say the choice in a line.
- Measure with the simplest tool that shows the number (`curl -w`, `time`, a three-line loop). A
  comparison runs the same input on both sides and says what limits the result.
- Run every example before showing its output, and show only output you actually got. Numbers
  come from this machine and say so.
- Write examples in a scratch folder (the session's scratchpad when there is one), not the user's
  project, unless they ask for the files there. Files the user keeps are one small file per step.

## How to say it

- **Short steps.** A step is a few sentences and its diagram, or its code and output. Follow-ups
  go deeper wherever the user points.
- **Short paragraphs.** At most three sentences, one idea each. Three or more parallel items are a
  list or a table, not a paragraph.
- **Make it click.** The concrete mechanism, not a metaphor or a preview of what's coming. Walk
  through what happens step by step. A list of functions and constants is reference, not teaching.
- **Plain spoken English, tight not terse.** No framing labels ("the key insight", "TL;DR"), no
  pauses, and don't announce a part as hard or important; just say it.

If a study-log skill is available, end by offering, in one line, to log the session.
