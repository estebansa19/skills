---
name: god-mode
description: "The front door for any non-trivial task: restates the goal, matches the task to a playbook (investigation, learn, change, bug fix, refactor, review, ship, babysit, skill), copies its steps into the task list, and runs the skills each step names under the principles skill. Proceeds on reversible work and pauses only for irreversible or outward-facing actions; work tickets go to the work-* skills. Use for /god-mode followed by the task in plain words."
metadata:
  version: "1.0"
allowed-tools: Read, Grep, Glob, Agent
argument-hint: "[the task, in your own words]"
user-invocable: true
disable-model-invocation: true
---

# God mode

Let `<dir>` be the directory holding this SKILL.md (`${CLAUDE_SKILL_DIR}` where the harness sets
it). The skills this mode runs are its siblings: to run the `<name>` skill, read
`<dir>/../<name>/SKILL.md` and follow it. Don't reach for the Skill tool; several of these can
only be started by the user.

If no task was given, ask for one.

## Every task

1. **Restate it first.** In your first message, say in your own words the goal, the problem it
   solves, and, when it ships a change, the smallest change you expect to meet it. Don't wait for
   confirmation. If the evidence rules out what was asked for, show it and stop.
2. **Load the principles** from `<dir>/../principles/SKILL.md`. Read the full rule of each one
   you apply.
3. **Match a playbook** below and open `<dir>/references/playbooks/<name>.md`. Put its steps in
   the task list, word for word, before any task-specific items. A step you skip stays in the
   list as `skip: <reason>`.
4. **No playbook fits:** take the closest one, adapt it, and say how. Work too large for one run
   is split into units per Sequence Verifiable Units, each run through its own playbook.

## Playbooks

- **investigation.** A read-only question: how does X work, why is Y this way, are we sure about
  Z, should we do X or Y.
- **learn.** Learn a concept or technology from scratch, compare two, or understand code deeply.
- **change.** New or changed behavior, from a small edit to a feature.
- **bug-fix.** A defect to reproduce, root-cause and fix.
- **refactor.** The structure changes; the behavior does not.
- **review.** Review a diff, a branch or a PR.
- **ship.** Commit and open a PR for work that is done.
- **babysit.** A PR's status: check on it, get it green, answer its review threads, and merge it
  when asked.
- **skill.** Write or change a skill, and test that it works.

## Autonomy

**Never Block on the Human.** Reversible work proceeds without asking: edits, scratch files,
branches, local commits, read-only calls to any tool. When you choose for the user, say what you
chose and what they could tell you instead.

**Pause** for irreversible or outward-facing actions: force-pushing a shared branch, deploying,
deleting data, and anything that messages other people.

**Gates you were given hold.** A work ticket or production escalation belongs to the
`work-implement` or `work-debug-escalation` skill when it is installed. Those start only from
the user, so stop and say which to run (`/core:work-implement`, `/core:work-debug-escalation`);
their approval gates stand. A setting that asks for approval, such as `publish_approval` set to `ask`, stands too.

**No is an acceptable answer.** Asked whether to do something, or shown an approach, give your
real judgment. Push back or say it doesn't earn its place when that is true.

## Subagents

- Use them for bulk reading and for independent slices that can run in parallel, not for work
  you can finish in a few reads (Guard the Context Window).
- Brief each one with the user's goal, file paths rather than pasted content, the scope it may
  touch, and how you will judge it done.
- You own their work. Read the diff and rerun the checks yourself; don't pass their summary
  through. A second opinion is the same brief on a different model.
- Give new work to a fresh agent with the full brief, rather than chaining follow-ups onto one.

## The reply

- Lead with the outcome for the user, then what the next person to touch this code inherits.
- Label the evidence for every claim: measured, read, or inferred.
- Name each principle you applied, with the decision it changed.
- Short sentences, a table for alternatives, and the open decisions last, including any default
  you chose for them. Each playbook names what else its reply carries.
