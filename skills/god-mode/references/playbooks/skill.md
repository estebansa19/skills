### Skill

**Keep only prose that changes a decision.**

1. Follow the repo's authoring guide when it has one (`docs/authoring.md`, `CONTRIBUTING.md`), and
   copy the structure of the nearest existing skill.
2. Tell the agent what to do and skip the why, unless the rule is confusing without it. Point at
   types, READMEs and config instead of restating them. Reuse other skills by name or path; don't
   copy their steps.
3. Run the repo's checks (a validate or check script) until they pass.
4. When the change alters behavior, test it on a real task. Run the task headless with and
   without the change (`claude -p` in two clones of the target repo, `--plugin-dir` pointing at
   the changed plugin, the same prompt and budget cap), then compare the diffs, the transcripts
   and the cost.
5. Keep the test blind. Use a prompt a user would type, with no words like "test" or "eval" and
   nothing that says what is being measured. Grade from what the run did (its transcript and
   diff), not from what it says it applied.
6. One task is an anecdote. Before trusting a change, run a second task of a different shape.
7. Commit with the `commit` skill.

**Reply:** what the skill does now, the design decisions, the check results, and the before and
after runs.
