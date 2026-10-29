---
name: build
description: "Builds a change in the current repo or creates a new project. For a change: reads the code it touches, says briefly what it will do and how it will check it, makes the smallest edit that works and runs the tests. For a new project: settles the stack, looks up the current version of every runtime, dependency and GitHub Action instead of trusting memory, and scaffolds a minimal, tested, CI-ready skeleton. Use when asked to 'add X', 'build this feature', 'make a small change', 'start a new project', 'scaffold a …', or run /build."
compatibility: "Requires git. Version lookups use the package managers' CLIs and gh, with web search as the fallback."
metadata:
  version: "1.0"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git init:*), Bash(npm view:*), Bash(gem info:*), Bash(pip index versions:*), Bash(go list -m:*), Bash(gh api:*), Read, Grep, Glob, Edit, Write, WebSearch, WebFetch, AskUserQuestion
argument-hint: "[what to build]"
user-invocable: true
disable-model-invocation: true
---

# Build

Load the `code-style` skill and follow it for everything you write.

**Keep your output short.** No formal reports, headings or long explanations, in your messages
or your summary: a few plain lines. The user asks when they want more.

If no arguments were given, ask what to build. It is a new project when the user asks for one or
the directory has no code yet; otherwise it is a change to this repo.

## A change to this repo

1. Read the code you will touch and its neighbours, and find how the repo runs its tests and
   linter (README, package scripts, `Makefile`, `bin/` or `script/`).
2. Say in two or three lines what you will change and how you will check it, then go on without
   waiting. When the request can be read more than one way, settle it from the code or a quick
   run; if that can't, take the likelier reading and say which.
3. Make the change. Add or update a test when behaviour changes.
4. Run the tests and the linter. Fix what your change broke; after three failed attempts, stop
   and say what is failing.
5. Tell the user what changed and how you verified it.

## A new project

1. Settle the stack. If the user didn't name one, recommend one in a line and ask.
2. Look up the current version of everything you will pin. Never take a version from memory:

   | What | How |
   |---|---|
   | npm packages | `npm view <pkg> version`, plus `npm view <pkg> peerDependencies` when two must agree |
   | Ruby gems | `gem info <gem> --remote` |
   | Python packages | `pip index versions <pkg>` |
   | Go modules | `go list -m -versions <module>` |
   | GitHub Actions | `gh api repos/<owner>/<repo>/releases/latest -q .tag_name`, or its newest tag when it has no releases |
   | Runtimes | the current LTS or stable release, from the official site |

   Prefer the official scaffolder (`npm create vite@latest`, `rails new`, `uv init`, …), then
   check what it pinned. When the latest versions of two pieces don't work together, take the
   newest combination that does and say what held back.
3. Scaffold only what the first feature needs: a README with the run and test commands,
   `.gitignore`, a formatter and linter, one passing test, the lockfile, and a CI workflow that
   installs, lints and tests.
4. Pin the runtime in one file (`.nvmrc`, `.tool-versions`, `.python-version`) and have CI read
   it (`node-version-file` and its equivalents), so there is one place to bump. Reference each
   Action by its current major tag.
5. Run the install, the linter and the tests locally.
6. Tell the user what you created, with each runtime, dependency and Action and the version you
   pinned. Offer Dependabot to keep them current rather than adding it.
