---
name: teach
description: "Teaches a concept, a technology or a piece of code from scratch, assuming no prior knowledge: a plain definition first, then the idea built up one layer at a time with code snippets, runnable examples and diagrams, running the code to show real behavior and real numbers (a working setup of the thing, two approaches or two languages side by side). For code in front of the user, runs how and why first. Asks no questions along the way. Use for 'teach me X', 'explain Y from scratch', 'I want to learn Z', 'compare A and B', or run /teach."
compatibility: "Runs examples with the language's own runtime. Fans out through how and why on Claude Code."
metadata:
  version: "1.0"
allowed-tools: Read, Grep, Glob, Write, WebSearch, WebFetch, Agent
argument-hint: "[a concept, a source to learn from, or code to understand]"
user-invocable: true
---

# Teach

The goal is that the user understands it: what it is, how it works, why it exists, and when to use
it. Assume they know nothing about it and start from scratch. Don't ask them questions, don't quiz
them, and don't ask for predictions; the explanation and the examples do the work.

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it).

## Ground it

- **A source they bring** (an article, docs, a talk): read it in full first, and teach from it.
- **Facts and APIs** come from the current docs or the installed version, never memory; tools and
  languages change between versions.
- **Code in front of them** (a subsystem, a change, a PR): read it, then run `how` for how it works
  and `why` when the reasons matter, by reading `<dir>/../how/SKILL.md` and
  `<dir>/../why/SKILL.md` and following them. Keep `why`'s confidence language intact.
- **An ambiguous topic** ("replication" in which system?): take the common meaning, say which in a
  line, and go.

## Build it from scratch

1. **Plain definition.** What it is in general terms, its common name, and the problem it solves,
   in a sentence or two.
2. **The mechanism, one layer at a time.** Each layer adds one idea on top of the last, starting
   from the smallest version that works. Define every term the first time it appears, and keep
   one name per concept from start to finish.
3. **Show each layer.** Follow each idea with a short snippet or example that makes it concrete.
   When running it shows what words can't (behavior, a failure, timing, size), run it and show
   the real output.
4. **Draw what moves.** For three or more moving parts, a series of diagrams where each redraws
   the last and adds one part. Mermaid for flows and structure, ASCII when simpler.
5. **Connect it to their world** once the general idea is clear: their codebase, a tool they use,
   a system they've read about.
6. **Close** with when to use it and when not, the common pitfalls, and where to go deeper.

## Examples that run

Choose the demonstration that fits the topic, for example a minimal working setup of the thing
(two processes replicating a write), the same task in two languages or two approaches side by
side, or the failure it prevents reproduced and then fixed.

- Keep each example small and self-contained, runnable with the language's own runtime and
  nothing else unless the topic is the tool.
- Write them in a scratch folder (the session's scratchpad when there is one), not the user's
  project, unless they ask for the files there.
- Run every example before showing its output, and show only output you actually got. Numbers
  come from this machine and say so.
- A comparison runs the same input on both sides, warms up, repeats, and says what limits the
  result (Explain the Number in the `principles` skill).

## How to say it

- **Complete, in one pass.** Give the whole from-scratch explanation, each layer short. Follow-ups
  go deeper wherever the user points.
- **Make it click.** The concrete mechanism, not a metaphor or a preview of what's coming. Walk
  through what happens step by step. A list of functions and constants is reference, not teaching.
- **Plain spoken English, tight not terse.** No framing labels ("the key insight", "TL;DR"), no
  pauses, and don't announce a part as hard or important; just say it.

If a study-log skill is available, end by offering, in one line, to log the session.
