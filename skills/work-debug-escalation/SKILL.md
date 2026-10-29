---
name: work-debug-escalation
description: "Disciplined 5-phase bug hunt for a production escalation: sets up a runnable feedback loop before touching code, reproduces the bug as a failing test, ranks hypotheses with evidence and waits for the user to pick one, applies the smallest fix, then strips debug artifacts. The fix loop is capped at 3 hypotheses so a wrong theory stops rather than spirals. Use when asked to 'debug this', 'find the root cause', 'fix this escalation', 'why is this failing in production', or run /work-debug-escalation."
compatibility: "Requires git and the repo's test runner. Traces code with Serena when it is connected and with Grep/Glob otherwise."
metadata:
  version: "3.0"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(bin/rspec:*), Bash(bundle exec rspec:*), Bash(bin/rails runner:*), Read, Grep, Glob, Edit, Write, AskUserQuestion
argument-hint: "[paste ticket description, error log, or escalation details]"
user-invocable: true
disable-model-invocation: true
---

# Debug an escalation

Work through the five phases in order; each ends at a check before the next one starts. Trace
code by reading it, never from memory: Serena's `find_symbol`, `find_referencing_symbols` and
`get_symbols_overview` when it is connected, otherwise Grep for the symbol and its callers and
Read around each hit.

Load the `code-style` skill before writing the test or the fix. Keep your messages short.

## Phase 1 — Feedback loop

1. Use the escalation details in the arguments, or ask for them.
2. State what fails (the error, wrong output or wrong state), where (endpoint, job, model method,
   UI flow) and what triggers it.
3. Propose one command to run after every change: the repo's test runner on a single spec (a
   wrapper in `script/` or `bin/` first, otherwise the manifest's runner), or a snippet that
   prints PASS or FAIL, run with the repo's Rails runner (the wrapper its `CLAUDE.md` names,
   otherwise `bin/rails runner '…'`).
4. Ask whether this matches the bug, including any command you had to guess, and wait.

## Phase 2 — Reproduce

1. Trace from the affected surface to the code involved and its callers.
2. Read the nearest existing spec for its factories, setup and assertion style.
3. Write the smallest test, in that style, that fails right now for the reported reason. If it
   passes, the reproduction is wrong; reassess.
4. Run the feedback loop, confirm the failure, and give the test's `file:line` and the error.

## Phase 3 — Hypotheses

1. Trace the path from trigger to failure (method bodies, callbacks, validations, branches) and
   check `git log --oneline -20 -- <file>` for a recent regression.
2. Give at most three hypotheses, most likely first, each with its evidence and one cheap check
   that would rule it out.
3. Ask which one to pursue, and wait.

## Phase 4 — Fix

1. Change only what the chosen hypothesis needs, in the surrounding style. A fix growing past
   about 20 lines means the hypothesis is probably wrong or too broad; stop and reassess.
2. Run the feedback loop. Still failing means the hypothesis was wrong: go back to Phase 3
   rather than adding code.
3. After the third wrong hypothesis, stop. Report the reproduction, the three hypotheses and what
   each check showed, and ask how to proceed.
4. Once it passes, run the specs for the affected area and fix any regression before moving on.

## Phase 5 — Clean up

1. Remove debug output (`puts`, `pp`, `binding.pry`, `byebug`, `debugger`, `console.log`,
   `print`), temporary comments and variables that only existed to inspect a value.
2. Keep only the lines that fix or test the bug; justify anything else or drop it.
3. Run `/simplify` if it is available, otherwise review the diff for the same things yourself.
4. Run the feedback loop one last time.
5. Sum up in a few lines: the root cause, the fix, the regression test (`file:line`) and the
   files changed.
