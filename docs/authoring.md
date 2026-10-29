# Writing a skill

> Installing: [install.md](./install.md). A value that differs at work lives in the skill's
> `work-` version ([Work versions](#work-versions)).

`deep-review` is the reference implementation. When a question comes up about structure —
frontmatter, references, agent contracts, approval gates — the answer is almost always
"the way `deep-review` already does it". `commit` is the smallest complete example and is
worked through at the bottom of this page.

## Where things go

```
.claude-plugin/
├── marketplace.json             the marketplace: one plugin, `core`, at the repo root
└── plugin.json                  its name and description
agents/                          every subagent the skills dispatch
skills/<name>/
├── SKILL.md                     the workflow — under 500 lines
├── references/                  checklists and contracts, read on demand
└── scripts/                     executables the skill runs
```

Every skill is `/core:<name>`. A skill that only makes sense at work is named `work-<name>`,
and so is the work version of an everyday skill. Agents follow the same rule.

Four rules make this scale:

1. **A skill owns everything it needs** — script, reference — inside its own directory.
   The one exception is agents: Claude Code loads them only from the plugin's root
   `agents/` (see [Agents](#agents)).
2. **Anything true of one setup only lives in a `work-` skill**, never in another skill's
   body. CI fails a project fact in a skill without the prefix.
3. **Nothing private ships, even in a `work-` skill: the repo is public.** A channel, a Jira
   site, a cloud id or an internal command is asked for or found when the skill runs
   (`work-triage-escalations` asks for its channel and project). CI fails a Slack channel id,
   a UUID or an Atlassian site in any file.
4. **A value that differs at work is a setting with a work version.** The skill lists it as
   a `- key: value` line in its `## Configuration` section, with the personal value, and
   its steps refer to it by key. `work-<name>` sets the work value
   ([Work versions](#work-versions)). There are no plugin options and no presets.

That is why `work-deep-review` runs the same reviewers as `deep-review`: what differs at work
is the house rules, and those live in the work repo's `.claude/conventions.md`, which the
setting names and every reviewer reads.

## Work versions

`work-<name>` runs `<name>` with the work settings. It is a short skill, not a copy, so a fix
to the base reaches both:

- its frontmatter repeats the base's `allowed-tools`, `argument-hint` and invocation flags,
  with a description that starts "Work version of `<name>`";
- its body reads `<dir>/../<name>/SKILL.md` and follows it with its own `## Configuration`
  in place of the base's, and runs the `work-` version of any skill the base runs;
- its `## Configuration` sets only keys the base's section has.

CI checks all three, and that a work version of a guarded skill keeps
`disable-model-invocation`. Give a skill a work version when it reads a setting whose work
value differs, or when it runs a skill that does (`work-god-mode` exists only for that).

## What goes in a SKILL.md

Only what changes the model's behaviour: the steps, the approval gates, the hard rules, and the
defaults it would otherwise get wrong. Leave out what it already knows how to do (finding a
test runner, reading a branch name) and why the skill is written the way it is; that goes on
this page or in the commit message. A skill that writes code loads `code-style` instead of
restating its rules, and every skill keeps what it tells the user short.

## When a skill waits for the user

Skills follow [Never Block on the Human](../skills/principles/references/never-block-on-the-human.md):
reversible work proceeds and the skill says what it chose; only irreversible or outward-facing
steps pause. `work-` skills keep their approval gates, because their output lands on other
people. An outward step whose answer differs at work is a setting rather than a rule:
`publish_approval` is `skip` in `create-pr`, `babysit` and `land`, and `ask` in their work
versions.

## Content from elsewhere

A skill adapted from another project is credited in the README, through
`.github/scripts/gen-readme.mjs`, and the source's license notice is appended to the root
`LICENSE`. Skill directories carry no notice files of their own. `god-mode`, `principles`, `how`,
`why`, `teach`, `babysit` and `land` are adapted from pstack.

## Frontmatter

Spec fields first, then Claude Code extensions:

```yaml
---
name: my-skill                    # must equal the directory name; lowercase-hyphen
description: "..."                # what it does + when to use it + trigger phrases
compatibility: "Requires ..."     # only where a dependency is real
metadata:
  version: "2.0"
allowed-tools: Bash(git:*), Read, Grep, Glob, AskUserQuestion
argument-hint: "[...]"
user-invocable: true
disable-model-invocation: true    # every skill with side effects
---
```

**Spec fields** (`name`, `description`, `license`, `compatibility`, `metadata`,
`allowed-tools`) are the portable baseline. **Extensions** are Claude Code-only and allowed:
`argument-hint`, `arguments`, `when_to_use`, `model`, `effort`, `context`, `agent`,
`background`, `hooks`, `paths`, `shell`, `disable-model-invocation`, `user-invocable`,
`disallowed-tools`.

### Why CI does not simply run `skills-ref validate`

`skills-ref validate` accepts **only** the six spec fields and rejects everything else — so
it rejects every skill here. We are not willing to drop `disable-model-invocation` to please
it: without that field, Claude can auto-run `/work-implement` — which writes code and runs
migrations — in the middle of an unrelated task.

So `.github/scripts/validate-skills.mjs` does both, which is stronger than either alone:

1. runs `skills-ref validate` against a copy whose frontmatter is reduced to the spec
   fields — so the spec fields are genuinely spec-valid; and
2. asserts every remaining key is on the allowlist above — so a **typo'd or invented** key
   still fails, which neither check catches on its own.

Non-spec keys are also rejected by the claude.ai upload / Skills API path. That is a real
constraint if you ever publish a skill there; it is not one here.

### `disable-model-invocation`

It stops the model invoking a skill on its own initiative; the skill stays typeable as a
slash command. The documented example for the field is literally `/commit`.

**The validator requires it on eight skills by name**, and on their work versions:
`work-implement` writes code and runs migrations, `build` scaffolds projects and installs
dependencies, `work-debug-escalation` edits code, `deep-review` posts to GitHub,
`work-triage-escalations` writes to Jira and Slack, `babysit` pushes fixes to a PR, `land`
merges one, and `god-mode` drives all of the others.

**`commit` and `create-pr` deliberately do not**, so Claude can drive them when asked to
ship something rather than the user typing both slash commands by hand. That is a real
trade, not an oversight: `create-pr` still gates its push behind Step 4's approval, but
`commit` has no gate before it commits, so nothing except the session's own instructions
stops one landing mid-task. Set the field on a new skill unless you have decided otherwise
as explicitly as this.

### Descriptions

The description is what the model matches against to decide relevance, and it gets
truncated under a listing budget as the set grows. Write *what it does + when to use it +
the phrases you would actually type*, in the third person ("shows the draft", not "shows
you the draft"): the description is injected into the system prompt. Front-load the
distinctive part.

## Degradation is required, not optional

Write to the spec as the baseline and treat Claude Code extras as progressive enhancement.
Every harness-specific mechanism needs a plain-language fallback in the body:

| Mechanism | Fallback |
|---|---|
| `` !`cmd` `` injection | Put the command in a numbered step instead. Better in every way — see below |
| `${CLAUDE_SKILL_DIR}/scripts/x` | "…or the `scripts/x` next to this SKILL.md" |
| Agent dispatch | named type → `general-purpose` → inline, one at a time |
| An MCP server (Serena, a tracker) | say what to do without it; `Grep`/`Glob` is worse but works |

### Prefer a numbered step to `` !`cmd` ``

Injected commands run **before** the body reaches the model, never prompt, and **abort the
entire invocation** on a non-zero exit or any permission decision that is not *allow*. Both
of `create-pr`'s original defects came from that: an injected `git push` ran at invocation
time, *before* the approval gate meant to guard it, and an injected `cat` of a missing
`.github/pull_request_template.md` killed the whole skill in any repo without one.

They also cannot use anything the body resolves — a command that needs the base branch from
live inference simply cannot be injected. Put commands in numbered steps, as `deep-review` does.

## Agents

**An agent file lives in the root `agents/` directory, and nowhere else.** Claude Code
loads agents only from there — not from a path a manifest lists, and not through a
symlink (both checked against Claude Code 2.1.302, the listed path again on 2.1.312: neither
loads). That is also why the work skills share one plugin with the rest: a second plugin
sourced from the same root loads every agent in `agents/`. CI enforces it. The
OpenCode build copies the agents a skill dispatches into that skill's own `agents/`, where
the inline fallback reads them.

**An agent's file name and its `name:` field must be the same string**, and a skill
dispatches it as `core:<name>` — Claude Code prefixes every plugin agent with its plugin's
name. A work agent is `work-<name>`, so it never collides with a core one. CI checks that
every `core:<name>` a skill names resolves to an agent or a skill.

**Never hardcode a repo-relative path to a checklist.** It resolves in only one install
layout and fails silently everywhere else — the agent just reviews without its checklist.
The orchestrator passes the absolute path, as `deep-review` does for the checklists in its
own `references/`. CI greps for the repo-relative form.

**A reviewer's checklist is named for its lane, not for the agent.** The orchestrator
derives `<lane>.md` by removing everything up to and including `review-` from the agent
name: `core:review-backend` → `backend.md`.

**Fall back when a declared *tool* is missing**, not just when an agent type is. An agent
that wants Serena must still work with `Grep`/`Read` and say so in its `notes`.

## Project facts

A skill without the `work-` prefix states none; a `work-` skill states its facts outright,
as `work-implement` does with its proposal directory. A skill's
settings sit in its `## Configuration` section. Everything else is found live from the repo,
and the skill says what to find in a line ("the base is `origin/HEAD`"), not in a table of
keys and inference rules. Never read a per-repo config file: CI fails skills that reference
one — make the value a setting instead.

A missing value falls through to **inference, never a static default**. `base_branch: main`
as a constant is wrong for every repo still on `master`.

## Sync direction

**This repo is canonical.** Work repositories and every other project *consume* skills through
the plugin; changes flow out of here, never back in by hand. The 2026-08-29 pull that
brought `code-review`, its agents and checklists, and the updated `implement` (now `work-implement`) was the last
inbound sync. Machines installed from GitHub get changes through the marketplace update;
this machine reads the checkout in place ([install.md](./install.md#this-machine-a-live-checkout)).

## Checklist before committing

```bash
bash .github/scripts/check.sh
```

That is the same script CI runs, so the two cannot drift. It is safe locally — the
installer test uses a throwaway `CLAUDE_CONFIG_DIR` and OpenCode directory, never your real
`~/.claude`. If it reports the README as out of date, regenerate it with
`node .github/scripts/gen-readme.mjs`.

## Worked example — `commit`

The smallest skill, and the clearest case of one outgrowing its job: version 2 ran to 181
lines for something that writes one line. Version 3 is about 40. What went, and why:

- **Settled choices became rules.** `commit_style` (three modes) and `body_default` (two) are
  gone. It is always Conventional Commits, or `EE-1234: fix …` when the branch starts with a
  ticket key, and the message is one line with at most one body line.
- **Ticket detection stopped being inferred.** Version 2 derived a `ticket.pattern` from the
  shape of recent branch names; now the branch either starts with a key or it does not.
- **The design notes moved here.** Why commands are numbered steps rather than injected, and
  why a body is the exception, are explained above; the skill only carries the instruction.

What it kept, because each one changes behaviour: staging only the work at hand and never a
secret, naming what a stage leaves out, the configured trailer and no other, the pre-commit-hook path
(re-stage once after a formatter, stop on a failed check, never `--no-verify`), and the examples.
